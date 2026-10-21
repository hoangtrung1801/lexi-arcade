import { createRng, shuffle } from "@shared/rng";
import { DIFFICULTY, MAX_LIVES } from "@shared/rules";
import { computeResult, wordScore } from "@shared/scoring";
import type { GameConfig, GameEvent, GameWord, RoundResult } from "@shared/types";

/** Logical playfield, matches the Phaser canvas (scaled to fit the window). */
export const FIELD_W = 960;
export const FIELD_H = 540;
export const GROUND_Y = FIELD_H - 64;
export const LANES = 6;
/** Words stay clear of the control column on the right-hand side. */
export const PLAY_W = FIELD_W - 110;

/** One falling word plate. */
export interface ActiveWord {
  uid: number;
  word: GameWord;
  /** true for the plate that answers the current question */
  correct: boolean;
  /** an already answered word sent back down only to keep enough choices on screen */
  filler: boolean;
  /** horizontal centre, 0..FIELD_W */
  x: number;
  /** top of the word box */
  y: number;
  /** letters of the typed answer that match this plate (0 when it no longer matches) */
  typed: number;
}

export type Status = "ready" | "playing" | "paused" | "won" | "lost";

export type Notice =
  | { kind: "prompt"; word: GameWord }
  | { kind: "key" }
  | { kind: "erase" }
  | { kind: "target"; uid: number | null }
  | { kind: "wrong" }
  | { kind: "hit"; word: ActiveWord; points: number; combo: number }
  | { kind: "bad"; word: ActiveWord }
  | { kind: "miss"; word: ActiveWord }
  | { kind: "clear"; words: ActiveWord[] }
  | { kind: "end"; status: "won" | "lost" };

export type TypeOutcome = "ignored" | "correct" | "wrong" | "hit" | "bad";

/** True when one word starts with the other, so typing the shorter one would be ambiguous. */
function overlaps(a: string, b: string) {
  return a.startsWith(b) || b.startsWith(a);
}

/** Words fall one after another; until a few are on screen they follow each other this fast. */
const FIRST_GAP_MS = 700;
const FAST_UNTIL = 3;
/** Wait up to this long for a second candidate so the question isn't simply the next word in. */
const CHOICE_WAIT_MS = 1500;
/** A plate can be asked about once it is clear of the top HUD... */
const ASK_BELOW = 70;
/** ...and while it still has this long to fall, so there is time to type it. */
const ASK_LEAD_MS = 3500;

/**
 * Pure game logic. No DOM, no Phaser: it reads time from an injected clock, so tests can drive it.
 *
 * English words fall one after another. The Vietnamese meaning of one of them is on screen
 * (`prompt`); the others are the distractors, and get asked about later. Typing narrows the plates
 * that still match; completing the asked word shoots it down and the next meaning is shown at
 * once, completing another word costs a life, and letting the asked word reach the ground costs
 * a life and sends it back to the queue. Other words that reach the ground just fall back into
 * the queue.
 *
 * Everything that matters for scoring is recorded in `events`; the final result is always
 * `computeResult(events, words)` — the same function the server runs.
 */
export class WordBlasterEngine {
  readonly words: GameWord[];
  readonly events: GameEvent[] = [];
  /** the word being asked (its Vietnamese meaning is on screen), null while none can be */
  prompt: GameWord | null = null;
  active: ActiveWord[] = [];
  /** the lowest plate that still matches what has been typed */
  target: ActiveWord | null = null;
  /** letters typed for the current question */
  typed = "";
  status: Status = "ready";
  lives = MAX_LIVES;
  score = 0;
  combo = 0;
  maxCombo = 0;
  hitCount = 0;

  private queue: number[];
  private byId = new Map<number, GameWord>();
  private hit = new Set<number>();
  private rng: () => number;
  private uid = 0;
  private spawnedAt = -Infinity;
  /** when the field started waiting for a question to be asked */
  private askWaitFrom = 0;
  private lastT = 0;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private listeners = new Set<(n: Notice) => void>();

  constructor(
    private config: GameConfig,
    private clock: () => number = () => performance.now(),
  ) {
    this.words = config.words;
    this.rng = createRng(config.seed);
    for (const w of config.words) this.byId.set(w.id, w);
    this.queue = shuffle(
      config.words.map((w) => w.id),
      this.rng,
    );
  }

  get total() {
    return this.words.length;
  }

  subscribe(fn: (n: Notice) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(n: Notice) {
    for (const fn of this.listeners) fn(n);
  }

  /** Milliseconds of play time (pauses excluded). */
  elapsed() {
    if (this.status === "ready") return 0;
    const now = this.status === "paused" ? this.pausedAt : this.clock();
    return Math.max(0, now - this.startedAt - this.pausedTotal);
  }

  start() {
    if (this.status !== "ready") return;
    this.startedAt = this.clock();
    this.status = "playing";
  }

  pause() {
    if (this.status !== "playing") return;
    this.pausedAt = this.clock();
    this.status = "paused";
  }

  resume() {
    if (this.status !== "paused") return;
    this.pausedTotal += this.clock() - this.pausedAt;
    this.status = "playing";
    this.lastT = this.elapsed();
  }

  /** Advance the simulation to the current clock time. */
  tick() {
    if (this.status !== "playing") return;
    const t = this.elapsed();
    const dt = Math.min(t - this.lastT, 250);
    this.lastT = t;
    const cfg = DIFFICULTY[this.config.difficulty];

    for (const w of this.active) w.y += (cfg.fallSpeed * dt) / 1000;

    for (const w of [...this.active]) {
      if (w.y < GROUND_Y || !this.active.includes(w)) continue;
      if (w.correct) {
        this.handleMiss(w, t);
        if (this.status !== "playing") return;
      } else {
        // a word nobody was asked about burns up in the shield and comes round again later
        this.drop(w);
        this.emit({ kind: "clear", words: [w] });
      }
    }

    const gap = this.active.length < FAST_UNTIL ? FIRST_GAP_MS : cfg.spawnMs;
    if (this.active.length < cfg.maxOnScreen && t - this.spawnedAt >= gap) this.spawn(t);
    if (!this.prompt) this.ask(t);
  }

  /** Can `w` fall now without making a typed answer or a meaning ambiguous? */
  private fits(w: GameWord) {
    return this.active.every(
      (a) =>
        a.word.id !== w.id && a.word.meaningVi !== w.meaningVi && !overlaps(a.word.lemma, w.lemma),
    );
  }

  /** Drops the next queued word in a free lane, or an answered word as an extra choice. */
  private spawn(t: number) {
    let word: GameWord | undefined;
    let filler = false;
    const i = this.queue.findIndex((id) => {
      const w = this.byId.get(id);
      return !!w && this.fits(w);
    });
    if (i >= 0) {
      word = this.byId.get(this.queue.splice(i, 1)[0] as number);
    } else if (this.hit.size < this.total) {
      word = shuffle(
        this.words.filter((w) => this.hit.has(w.id) && this.fits(w)),
        this.rng,
      )[0];
      filler = true;
    }
    if (!word) return;
    const laneW = PLAY_W / LANES;
    // keep clear of lanes whose word has only just entered
    const busy = new Set(this.active.filter((a) => a.y < 90).map((a) => Math.floor(a.x / laneW)));
    const free = Array.from({ length: LANES }, (_, k) => k).filter((k) => !busy.has(k));
    const lanes = free.length ? free : Array.from({ length: LANES }, (_, k) => k);
    const lane = lanes[Math.floor(this.rng() * lanes.length)] ?? 0;
    this.active.push({
      uid: ++this.uid,
      word,
      correct: false,
      filler,
      x: (lane + 0.5) * laneW,
      y: -28,
      typed: 0,
    });
    this.spawnedAt = t;
    this.retarget();
  }

  /** Shows the meaning of one of the falling words that has not been answered yet. */
  private ask(t: number) {
    // any word on screen may be next, not just the oldest, so the order can't be guessed
    const open = this.active.filter((a) => !a.filler && a.y >= ASK_BELOW);
    const fallSpeed = DIFFICULTY[this.config.difficulty].fallSpeed;
    // a word close to the ground is never asked: it would land (and cost a life) right after
    // its meaning appears
    const pool = open.filter((a) => a.y < GROUND_Y - (fallSpeed * ASK_LEAD_MS) / 1000);
    // with a single candidate the question would just follow the drop order, so give the next
    // word a moment to come into view first
    const more = this.queue.length > 0 || this.active.some((a) => !a.filler && a.y < ASK_BELOW);
    if (pool.length < 2 && more && t - this.askWaitFrom < CHOICE_WAIT_MS) return;
    const pick = pool[Math.floor(this.rng() * pool.length)];
    if (!pick) return;
    pick.correct = true;
    this.prompt = pick.word;
    this.emit({ kind: "prompt", word: pick.word });
  }

  /** Takes a plate off the field; an unanswered word goes back to the queue. */
  private drop(w: ActiveWord) {
    this.active = this.active.filter((a) => a !== w);
    if (!w.filler && !this.hit.has(w.word.id)) this.queue.push(w.word.id);
    // letters typed towards the word that just left would otherwise block every next key
    if (!this.active.some((a) => a.word.lemma.toLowerCase().startsWith(this.typed)))
      this.typed = "";
    this.retarget();
  }

  private handleMiss(w: ActiveWord, t: number) {
    this.drop(w);
    this.events.push({ t, type: "miss", wordId: w.word.id });
    this.lives--;
    this.combo = 0;
    this.prompt = null;
    this.askWaitFrom = t;
    this.typed = "";
    this.retarget();
    this.emit({ kind: "miss", word: w });
    if (this.lives <= 0) this.finish("lost");
  }

  /** Recomputes which plates match the typed letters and which one the ship aims at. */
  private retarget() {
    let lowest: ActiveWord | null = null;
    for (const w of this.active) {
      const match = this.typed.length > 0 && w.word.lemma.toLowerCase().startsWith(this.typed);
      w.typed = match ? this.typed.length : 0;
      if (match && (!lowest || w.y > lowest.y)) lowest = w;
    }
    if (lowest !== this.target) {
      this.target = lowest;
      this.emit({ kind: "target", uid: lowest?.uid ?? null });
    }
  }

  /** Feed one typed character. */
  type(raw: string): TypeOutcome {
    if (this.status !== "playing" || !this.prompt) return "ignored";
    const ch = raw.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return "ignored";
    const t = this.elapsed();
    const asked = this.prompt;
    const next = this.typed + ch;

    if (!this.active.some((w) => w.word.lemma.toLowerCase().startsWith(next))) {
      this.events.push({ t, type: "wrong", wordId: asked.id });
      this.combo = 0;
      this.emit({ kind: "wrong" });
      return "wrong";
    }

    this.typed = next;
    this.events.push({ t, type: "correct", wordId: asked.id });
    this.retarget();

    // words on screen never share a prefix, so a full match is unambiguous
    const done = this.active.find((w) => w.word.lemma.toLowerCase() === next);
    if (!done) {
      this.emit({ kind: "key" });
      return "correct";
    }

    if (done.correct) {
      this.events.push({ t, type: "hit", wordId: asked.id });
      const points = wordScore(asked.lemma.length, this.combo);
      this.score += points;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.hit.add(asked.id);
      this.hitCount = this.hit.size;
      this.active = this.active.filter((a) => a !== done);
      this.prompt = null;
      this.typed = "";
      this.retarget();
      this.emit({ kind: "hit", word: done, points, combo: this.combo });
      if (this.hitCount >= this.total) {
        this.emit({ kind: "clear", words: this.active });
        this.active = [];
        this.finish("won");
      } else {
        this.askWaitFrom = t;
        this.ask(t);
      }
      return "hit";
    }

    this.events.push({ t, type: "bad", wordId: asked.id, choiceId: done.word.id });
    this.lives--;
    this.combo = 0;
    this.typed = "";
    this.drop(done);
    this.emit({ kind: "bad", word: done });
    if (this.lives <= 0) this.finish("lost");
    return "bad";
  }

  /** Backspace: take back the last typed letter (free, it only changes the aim). */
  erase() {
    if (this.status !== "playing" || !this.typed) return;
    this.typed = this.typed.slice(0, -1);
    this.retarget();
    this.emit({ kind: "erase" });
  }

  /** Give up the round (counts as a loss). */
  abandon() {
    if (this.status === "playing" || this.status === "paused") this.finish("lost");
  }

  private finish(status: "won" | "lost") {
    this.status = status;
    this.emit({ kind: "end", status });
  }

  result(): RoundResult {
    return computeResult(this.events, this.words);
  }
}
