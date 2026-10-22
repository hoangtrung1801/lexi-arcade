import { SPELL, SPELL_HEARTS, SPELL_MOB_STAGGER_MS } from "@shared/rules";
import {
  bossWindupMs,
  computeSpellResult,
  mobTravelMs,
  type SpellPlan,
  spellPlan,
} from "@shared/spell";
import type { GameConfig, GameWord, RoundResult, SpellEvent } from "@shared/types";
import { Clock } from "../common/Stage";

export type SpellStage = "door" | "mob" | "boss";
export type SpellStatus = "ready" | "playing" | "paused" | "over";

export type SpellNotice =
  | { kind: "key" | "wrong" | "reveal" | "hurt" }
  | { kind: "done"; word: GameWord; stage: SpellStage }
  | { kind: "stage"; stage: SpellStage }
  | { kind: "end"; won: boolean };

export interface Mob {
  word: GameWord;
  /** clock time it set off (again, after hitting the hero) */
  startAt: number;
  travelMs: number;
  alive: boolean;
  lane: number;
}

/** pauses after a door opens and between stages, for the animations */
export const DOOR_OPEN_MS = 900;
export const STAGE_BREAK_MS = 1600;
const WAVE_BREAK_MS = 900;

/**
 * Spell Dungeon rules, independent of rendering. A floor is three stages:
 *  - doors: spell the word whose meaning is shown, letter by letter;
 *  - monsters: a wave walks at the hero, each carrying a meaning; typing a monster's word slays
 *    it, and a monster that reaches the hero costs a heart and is knocked back to the start;
 *  - the boss: type its meanings one by one before each blow lands.
 * Wrong keys are rejected. Losing every heart ends the floor.
 */
export class SpellEngine {
  readonly plan: SpellPlan;
  readonly words: GameWord[];
  readonly events: SpellEvent[] = [];
  readonly due: ReadonlySet<number>;
  status: SpellStatus = "ready";
  stage: SpellStage = "door";
  hearts = SPELL_HEARTS;
  combo = 0;
  /** letters typed towards the current word (or, for monsters, the word they point at) */
  typed = "";
  doorIdx = 0;
  waveIdx = 0;
  bossIdx = 0;
  mobs: Mob[] = [];
  /** the monster the typed letters point at */
  targetId: number | null = null;
  /** clock time the boss started winding up its next blow */
  bossSince = 0;
  /** nothing can be typed before this clock time (animations between steps) */
  busyUntil = 0;
  won = false;
  private reveals = new Map<number, number>();
  private pending: (() => void) | null = null;
  private readonly clock: Clock;
  private listeners = new Set<(n: SpellNotice) => void>();

  constructor(
    private config: GameConfig & { dueWordIds?: number[] },
    now?: () => number,
  ) {
    this.due = new Set(config.dueWordIds ?? []);
    this.plan = spellPlan(config.words, config.seed, this.due);
    this.words = [...this.plan.doors, ...this.plan.waves.flat(), ...this.plan.boss];
    this.clock = new Clock(now);
    if (this.plan.doors.length === 0) this.stage = this.plan.waves.length ? "mob" : "boss";
  }

  subscribe(fn: (n: SpellNotice) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(n: SpellNotice) {
    for (const fn of this.listeners) fn(n);
  }

  elapsed(): number {
    return this.clock.elapsed();
  }

  get difficulty() {
    return SPELL[this.config.difficulty];
  }

  /** the door or boss word being typed */
  get current(): GameWord | undefined {
    if (this.stage === "door") return this.plan.doors[this.doorIdx];
    if (this.stage === "boss") return this.plan.boss[this.bossIdx];
    return undefined;
  }

  get busy(): boolean {
    return this.elapsed() < this.busyUntil;
  }

  /** the word a hint applies to: the current word, or the monster aimed at (else the closest) */
  get focus(): GameWord | undefined {
    if (this.stage !== "mob") return this.current;
    const alive = this.mobs.filter((m) => m.alive);
    const aimed = alive.find((m) => m.word.id === this.targetId);
    if (aimed) return aimed.word;
    const t = this.elapsed();
    return [...alive].sort((a, b) => this.mobProgress(b, t) - this.mobProgress(a, t))[0]?.word;
  }

  /** letters of a word the game shows: hints, plus the first letter on easy */
  shown(word: GameWord): number {
    return Math.max(this.difficulty.firstLetter ? 1 : 0, this.reveals.get(word.id) ?? 0);
  }

  /** 0 at the far end of the room .. 1 at the hero */
  mobProgress(m: Mob, t = this.elapsed()): number {
    return Math.min(1, Math.max(0, (t - m.startAt) / m.travelMs));
  }

  /** how far the boss has wound up its next blow, 0..1 */
  bossRage(t = this.elapsed()): number {
    const w = this.current;
    if (this.stage !== "boss" || !w || this.status === "over") return 0;
    return Math.min(
      1,
      Math.max(0, (t - this.bossSince) / bossWindupMs(w.lemma, this.config.difficulty)),
    );
  }

  start() {
    if (this.status !== "ready") return;
    this.clock.start();
    this.status = "playing";
    if (this.stage === "mob") this.startWave(0);
    if (this.stage === "boss") this.bossSince = 0;
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

  private startWave(idx: number) {
    const t = this.elapsed();
    this.waveIdx = idx;
    this.mobs = (this.plan.waves[idx] ?? []).map((word, i) => ({
      word,
      startAt: t + i * SPELL_MOB_STAGGER_MS,
      travelMs: mobTravelMs(word.lemma, this.config.difficulty),
      alive: true,
      lane: i,
    }));
    this.targetId = null;
    this.typed = "";
  }

  private enterStage(stage: SpellStage) {
    this.stage = stage;
    this.typed = "";
    this.targetId = null;
    this.busyUntil = this.elapsed() + STAGE_BREAK_MS;
    this.emit({ kind: "stage", stage });
    // the next stage starts its clocks when the break is over
    this.pending = () => {
      if (stage === "mob") this.startWave(0);
      else this.bossSince = this.elapsed();
    };
  }

  private finish(won: boolean) {
    this.won = won;
    this.status = "over";
    this.clock.pause();
    this.emit({ kind: "end", won });
  }

  private wrong(wordId: number | undefined) {
    if (wordId !== undefined) this.events.push({ t: this.elapsed(), type: "wrong", wordId });
    this.combo = 0;
    this.emit({ kind: "wrong" });
  }

  private hurt(wordId: number) {
    this.events.push({ t: this.elapsed(), type: "hurt", wordId });
    this.hearts--;
    this.combo = 0;
    this.emit({ kind: "hurt" });
    if (this.hearts <= 0) this.finish(false);
  }

  private done(word: GameWord) {
    this.events.push({ t: this.elapsed(), type: "done", wordId: word.id });
    this.combo++;
    this.typed = "";
    this.emit({ kind: "done", word, stage: this.stage });
  }

  type(raw: string) {
    if (this.status !== "playing" || this.busy) return;
    const ch = raw.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return;
    if (this.stage === "mob") {
      this.typeAtMobs(ch);
      return;
    }
    const w = this.current;
    if (!w) return;
    if (ch !== w.lemma[this.typed.length]?.toLowerCase()) {
      this.wrong(w.id);
      return;
    }
    this.events.push({ t: this.elapsed(), type: "correct", wordId: w.id });
    this.typed += ch;
    if (this.typed.length < w.lemma.length) {
      this.emit({ kind: "key" });
      return;
    }
    this.done(w);
    const t = this.elapsed();
    if (this.stage === "door") {
      this.doorIdx++;
      this.busyUntil = t + DOOR_OPEN_MS;
      if (this.doorIdx >= this.plan.doors.length) {
        this.pending = () => this.enterStage(this.plan.waves.length ? "mob" : "boss");
      }
      return;
    }
    this.bossIdx++;
    this.bossSince = t;
    if (this.bossIdx >= this.plan.boss.length) this.finish(true);
  }

  private typeAtMobs(ch: string) {
    const t = this.elapsed();
    const want = this.typed + ch;
    const matches = this.mobs.filter(
      (m) => m.alive && t >= m.startAt && m.word.lemma.toLowerCase().startsWith(want),
    );
    if (matches.length === 0) {
      this.wrong(this.focus?.id);
      return;
    }
    // aim at the closest of the monsters these letters fit
    const target = [...matches].sort((a, b) => this.mobProgress(b, t) - this.mobProgress(a, t))[0];
    if (!target) return;
    this.targetId = target.word.id;
    this.typed = want;
    this.events.push({ t, type: "correct", wordId: target.word.id });
    const slain = matches.find((m) => m.word.lemma.toLowerCase() === want);
    if (!slain) {
      this.emit({ kind: "key" });
      return;
    }
    slain.alive = false;
    this.targetId = null;
    this.done(slain.word);
    if (this.mobs.some((m) => m.alive)) return;
    const next = this.waveIdx + 1;
    this.busyUntil = t + WAVE_BREAK_MS;
    this.pending =
      next < this.plan.waves.length ? () => this.startWave(next) : () => this.enterStage("boss");
  }

  /** Backspace: drop the typed letters (to aim at another monster) */
  clear() {
    if (this.status !== "playing") return;
    this.typed = "";
    this.targetId = null;
  }

  /** shows the next letter of the focus word */
  hint() {
    const w = this.focus;
    if (this.status !== "playing" || this.busy || !w || !this.difficulty.hints) return;
    const typedHere = this.stage !== "mob" || this.targetId === w.id ? this.typed.length : 0;
    const next = Math.max(this.shown(w), typedHere) + 1;
    if (next > w.lemma.length) return;
    this.reveals.set(w.id, next);
    this.combo = 0;
    this.events.push({ t: this.elapsed(), type: "reveal", wordId: w.id });
    this.emit({ kind: "reveal" });
  }

  /** Called every frame: runs pending steps, moves monsters, lands the boss's blows. */
  tick() {
    if (this.status !== "playing") return;
    const t = this.elapsed();
    if (this.pending && t >= this.busyUntil) {
      const run = this.pending;
      this.pending = null;
      run();
    }
    if (this.busy) return;
    if (this.stage === "mob") {
      for (const m of this.mobs) {
        if (!m.alive || this.mobProgress(m, t) < 1) continue;
        m.startAt = t;
        if (this.targetId === m.word.id) this.clear();
        this.hurt(m.word.id);
        if ((this.status as SpellStatus) === "over") return;
      }
    } else if (this.stage === "boss" && this.bossRage(t) >= 1) {
      const w = this.current;
      this.bossSince = t;
      if (w) this.hurt(w.id);
    }
  }

  result(): RoundResult {
    return computeSpellResult(this.events, this.words);
  }
}
