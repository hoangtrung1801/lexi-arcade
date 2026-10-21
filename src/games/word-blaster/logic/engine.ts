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

export interface ActiveWord {
  uid: number;
  word: GameWord;
  /** horizontal centre, 0..FIELD_W */
  x: number;
  /** top of the word box */
  y: number;
  typed: number;
}

export type Status = "ready" | "playing" | "paused" | "won" | "lost";

export type Notice =
  | { kind: "key" }
  | { kind: "target"; uid: number | null }
  | { kind: "wrong" }
  | { kind: "hit"; word: ActiveWord; points: number; combo: number }
  | { kind: "miss"; word: ActiveWord }
  | { kind: "end"; status: "won" | "lost" };

export type TypeOutcome = "ignored" | "correct" | "wrong" | "hit";

/**
 * Pure game logic. No DOM, no Phaser: it reads time from an injected clock, so tests can drive it.
 * Everything that matters for scoring is recorded in `events`; the final result is always
 * `computeResult(events, words)` — the same function the server runs.
 */
export class WordBlasterEngine {
  readonly words: GameWord[];
  readonly events: GameEvent[] = [];
  active: ActiveWord[] = [];
  target: ActiveWord | null = null;
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
  private lastSpawnT = -Infinity;
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
      if (w.y >= GROUND_Y) {
        this.handleMiss(w, t);
        if (this.status !== "playing") return;
      }
    }

    const due = t - this.lastSpawnT >= cfg.spawnIntervalMs;
    const idle = this.active.length === 0 && t - this.lastSpawnT >= 350;
    if (this.queue.length > 0 && this.active.length < cfg.maxOnScreen && (due || idle)) {
      this.spawn(t);
    }
  }

  private spawn(t: number) {
    const id = this.queue.shift();
    const word = id === undefined ? undefined : this.byId.get(id);
    if (!word) return;
    const laneW = PLAY_W / LANES;
    // prefer a lane that is not occupied near the top of the field
    const free = Array.from({ length: LANES }, (_, i) => i).filter(
      (l) => !this.active.some((a) => a.y < 110 && Math.abs(a.x - (l + 0.5) * laneW) < laneW * 0.9),
    );
    const pool = free.length ? free : Array.from({ length: LANES }, (_, i) => i);
    const lane = pool[Math.floor(this.rng() * pool.length)] ?? 0;
    this.active.push({ uid: ++this.uid, word, x: (lane + 0.5) * laneW, y: -28, typed: 0 });
    this.lastSpawnT = t;
  }

  private handleMiss(w: ActiveWord, t: number) {
    this.active = this.active.filter((a) => a !== w);
    if (this.target === w) {
      this.target = null;
      this.emit({ kind: "target", uid: null });
    }
    this.events.push({ t, type: "miss", wordId: w.word.id });
    this.lives--;
    this.combo = 0;
    this.emit({ kind: "miss", word: w });
    if (this.lives <= 0) {
      this.finish("lost");
    } else {
      this.queue.push(w.word.id);
    }
  }

  /** Feed one typed character. */
  type(raw: string): TypeOutcome {
    if (this.status !== "playing") return "ignored";
    const ch = raw.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return "ignored";
    const t = this.elapsed();

    let tg = this.target;
    if (!tg) {
      const candidates = this.active.filter((w) => w.word.lemma[0]?.toLowerCase() === ch);
      if (candidates.length === 0) {
        this.events.push({ t, type: "wrong" });
        this.combo = 0;
        this.emit({ kind: "wrong" });
        return "wrong";
      }
      tg = candidates.reduce((a, b) => (b.y > a.y ? b : a));
      this.target = tg;
      this.emit({ kind: "target", uid: tg.uid });
    } else if (tg.word.lemma[tg.typed]?.toLowerCase() !== ch) {
      this.events.push({ t, type: "wrong", wordId: tg.word.id });
      this.combo = 0;
      this.emit({ kind: "wrong" });
      return "wrong";
    }

    tg.typed++;
    this.events.push({ t, type: "correct", wordId: tg.word.id });

    if (tg.typed >= tg.word.lemma.length) {
      this.events.push({ t, type: "hit", wordId: tg.word.id });
      const points = wordScore(tg.word.lemma.length, this.combo);
      this.score += points;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.hit.add(tg.word.id);
      this.hitCount = this.hit.size;
      this.active = this.active.filter((a) => a !== tg);
      this.target = null;
      this.emit({ kind: "hit", word: tg, points, combo: this.combo });
      this.emit({ kind: "target", uid: null });
      if (this.hitCount >= this.total) this.finish("won");
      return "hit";
    }
    this.emit({ kind: "key" });
    return "correct";
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
