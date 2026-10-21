import { computeRaceResult, parMs, raceOrder, trackLength } from "@shared/race";
import { RACE } from "@shared/rules";
import type { GameConfig, GameWord, RaceEvent, RoundResult } from "@shared/types";
import { Clock } from "../common/Stage";

export type RaceNotice =
  | { kind: "key" }
  | { kind: "wrong" }
  | { kind: "reveal" }
  | { kind: "done"; word: GameWord }
  | { kind: "end" };

export type RaceStatus = "ready" | "playing" | "paused" | "over";

/**
 * Ghost Race rules, independent of rendering. The Vietnamese meaning of one word is shown at a
 * time; each correct letter moves the car forward, a wrong letter is rejected and breaks the
 * combo. A player stuck on a word for `revealMs` is shown its next letter (which then no longer
 * counts as known). The race ends when every word has been typed.
 */
export class RaceEngine {
  readonly words: GameWord[];
  readonly events: RaceEvent[] = [];
  readonly total: number;
  readonly par: number;
  status: RaceStatus = "ready";
  idx = 0;
  typed = "";
  /** letters of the current word the game has shown */
  revealed = 0;
  combo = 0;
  private chars = 0;
  private lastProgress = 0;
  private wordDirty = false;
  private readonly clock: Clock;
  private readonly revealMs: number;
  private listeners = new Set<(n: RaceNotice) => void>();

  constructor(
    private config: GameConfig,
    now?: () => number,
  ) {
    this.words = raceOrder(config.words, config.seed);
    this.total = trackLength(this.words) || 1;
    this.par = parMs(this.words, config.difficulty);
    this.revealMs = RACE[config.difficulty].revealMs;
    this.clock = new Clock(now);
  }

  subscribe(fn: (n: RaceNotice) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(n: RaceNotice) {
    for (const fn of this.listeners) fn(n);
  }

  get current(): GameWord | undefined {
    return this.words[this.idx];
  }

  /** 0..1 along the track */
  get progress(): number {
    return (this.chars + this.typed.length) / this.total;
  }

  elapsed(): number {
    return this.clock.elapsed();
  }

  start() {
    if (this.status !== "ready") return;
    this.clock.start();
    this.status = "playing";
    this.lastProgress = 0;
  }

  pause() {
    if (this.status !== "playing") return;
    this.clock.pause();
    this.status = "paused";
  }

  resume() {
    if (this.status !== "paused") return;
    this.clock.resume();
    this.status = "playing";
  }

  type(raw: string) {
    const w = this.current;
    if (this.status !== "playing" || !w) return;
    const ch = raw.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return;
    const t = this.elapsed();
    const want = w.lemma[this.typed.length]?.toLowerCase();
    if (ch !== want) {
      this.events.push({ t, type: "wrong", wordId: w.id });
      this.combo = 0;
      this.wordDirty = true;
      this.emit({ kind: "wrong" });
      return;
    }
    this.events.push({ t, type: "correct", wordId: w.id });
    this.typed += ch;
    this.lastProgress = t;
    if (this.typed.length < w.lemma.length) {
      this.emit({ kind: "key" });
      return;
    }
    this.events.push({ t, type: "done", wordId: w.id });
    this.combo = this.wordDirty ? 0 : this.combo + 1;
    this.chars += w.lemma.length;
    this.idx++;
    this.typed = "";
    this.revealed = 0;
    this.wordDirty = false;
    this.emit({ kind: "done", word: w });
    if (this.idx >= this.words.length) {
      this.status = "over";
      this.clock.pause();
      this.emit({ kind: "end" });
    }
  }

  /** Called every frame: shows the next letter when the player is stuck. */
  tick() {
    const w = this.current;
    if (this.status !== "playing" || !w) return;
    const t = this.elapsed();
    if (t - this.lastProgress < this.revealMs) return;
    const next = Math.max(this.revealed, this.typed.length) + 1;
    if (next > w.lemma.length) return;
    this.revealed = next;
    this.lastProgress = t;
    this.wordDirty = true;
    this.combo = 0;
    this.events.push({ t, type: "reveal", wordId: w.id });
    this.emit({ kind: "reveal" });
  }

  /** time until the next letter is revealed, 0..1 (1 = just reset) */
  revealLeft(): number {
    if (this.status !== "playing") return 1;
    return Math.max(0, 1 - (this.elapsed() - this.lastProgress) / this.revealMs);
  }

  result(): RoundResult {
    return computeRaceResult(this.events, this.words, this.config.difficulty);
  }
}
