import { createRng, shuffle } from "@shared/rng";
import { DIFFICULTY, MAX_LIVES, WAVE_GAP_MS } from "@shared/rules";
import { computeResult, wordScore } from "@shared/scoring";
import type { GameConfig, GameEvent, GameWord, RoundResult } from "@shared/types";

/** Logical playfield, matches the Phaser canvas (scaled to fit the window). */
export const FIELD_W = 960;
export const FIELD_H = 540;
export const GROUND_Y = FIELD_H - 64;
export const LANES = 6;
/** Words stay clear of the control column on the right-hand side. */
export const PLAY_W = FIELD_W - 110;

/** One falling answer plate. */
export interface ActiveWord {
  uid: number;
  word: GameWord;
  /** true for the plate that answers the current question */
  correct: boolean;
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

/**
 * Pure game logic. No DOM, no Phaser: it reads time from an injected clock, so tests can drive it.
 *
 * Each question shows a Vietnamese meaning (`prompt`) while a wave of English answer plates
 * falls: the right word plus distractors from the same round. Typing narrows the plates that
 * still match; completing the right word shoots it down, completing a wrong one costs a life,
 * and letting the right one reach the ground costs a life and re-asks the question later.
 *
 * Everything that matters for scoring is recorded in `events`; the final result is always
 * `computeResult(events, words)` — the same function the server runs.
 */
export class WordBlasterEngine {
  readonly words: GameWord[];
  readonly events: GameEvent[] = [];
  /** the word being asked (its Vietnamese meaning is on screen), null between waves */
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
  private settledAt = -Infinity;
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
        // a distractor that nobody picked just burns up in the shield
        this.active = this.active.filter((a) => a !== w);
        this.retarget();
      }
    }

    if (!this.prompt && this.queue.length > 0 && t - this.settledAt >= WAVE_GAP_MS) {
      this.spawnWave();
    }
  }

  /** Asks the next word: one plate per answer, in distinct lanes, slightly staggered. */
  private spawnWave() {
    const id = this.queue.shift();
    const word = id === undefined ? undefined : this.byId.get(id);
    if (!word) return;
    const picked = [word];
    for (const w of shuffle(this.words, this.rng)) {
      if (picked.length >= DIFFICULTY[this.config.difficulty].options) break;
      if (w.meaningVi === word.meaningVi) continue;
      if (picked.some((p) => overlaps(p.lemma, w.lemma))) continue;
      picked.push(w);
    }
    const laneW = PLAY_W / LANES;
    const lanes = shuffle(
      Array.from({ length: LANES }, (_, i) => i),
      this.rng,
    );
    this.active = shuffle(picked, this.rng).map((w, i) => ({
      uid: ++this.uid,
      word: w,
      correct: w.id === word.id,
      x: ((lanes[i] ?? i) + 0.5) * laneW,
      y: -28 - Math.floor(this.rng() * 70),
      typed: 0,
    }));
    this.prompt = word;
    this.typed = "";
    this.emit({ kind: "prompt", word });
  }

  /** Ends the current question and clears its remaining plates. */
  private settle(t: number) {
    const rest = this.active;
    this.active = [];
    this.prompt = null;
    this.typed = "";
    this.settledAt = t;
    this.retarget();
    if (rest.length) this.emit({ kind: "clear", words: rest });
  }

  private handleMiss(w: ActiveWord, t: number) {
    const asked = this.prompt;
    this.active = this.active.filter((a) => a !== w);
    this.events.push({ t, type: "miss", wordId: w.word.id });
    this.lives--;
    this.combo = 0;
    this.emit({ kind: "miss", word: w });
    this.settle(t);
    if (this.lives <= 0) this.finish("lost");
    else if (asked) this.queue.push(asked.id);
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

    // distractors never share a prefix with another answer, so a full match is unambiguous
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
      this.emit({ kind: "hit", word: done, points, combo: this.combo });
      this.settle(t);
      if (this.hitCount >= this.total) this.finish("won");
      return "hit";
    }

    this.events.push({ t, type: "bad", wordId: asked.id, choiceId: done.word.id });
    this.lives--;
    this.combo = 0;
    this.active = this.active.filter((a) => a !== done);
    this.typed = "";
    this.retarget();
    this.emit({ kind: "bad", word: done });
    if (this.lives <= 0) {
      this.settle(t);
      this.finish("lost");
    }
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
