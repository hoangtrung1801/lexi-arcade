import { createRng, shuffle } from "@shared/rng";
import { TRAIN_LIVES } from "@shared/rules";
import { computeTrainResult, sentenceParts } from "@shared/sentence";
import type { GameConfig, RoundResult, Sentence, TrainEvent } from "@shared/types";
import { Clock } from "../common/Stage";

export interface Crate {
  id: number;
  text: string;
}

export type TrainNotice =
  | { kind: "place" | "unplace" | "reject" | "hint" }
  | { kind: "wrong" }
  | { kind: "solved" }
  | { kind: "end" };

export type TrainStatus = "ready" | "playing" | "paused" | "over";

/** what typing a crate's word compares against */
export function crateKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z'-]/g, "");
}

/**
 * Sentence Express rules, independent of rendering. Each station shows a sentence in Vietnamese;
 * its English words lie shuffled in the yard as crates. Crates are loaded onto the train in order
 * (click, or type the word); a full train is sent off. In the wrong order it costs one lump of
 * coal and the wrong wagons are marked; a hint fixes the start of the train and loads the next
 * right crate.
 */
export class TrainEngine {
  readonly sentences: Sentence[];
  readonly events: TrainEvent[] = [];
  status: TrainStatus = "ready";
  idx = 0;
  crates: Crate[] = [];
  /** crate ids on the train, in wagon order */
  placed: number[] = [];
  /** wagons marked wrong by the last send-off (cleared by any change) */
  wrongSlots = new Set<number>();
  /** the current sentence was solved; the train is leaving */
  departing = false;
  lives = TRAIN_LIVES;
  buffer = "";
  private readonly clock: Clock;
  private listeners = new Set<(n: TrainNotice) => void>();

  constructor(
    private config: GameConfig & { sentences: Sentence[] },
    now?: () => number,
  ) {
    this.sentences = shuffle(config.sentences, createRng(config.seed));
    this.clock = new Clock(now);
    this.load();
  }

  subscribe(fn: (n: TrainNotice) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(n: TrainNotice) {
    for (const fn of this.listeners) fn(n);
  }

  get current(): Sentence | undefined {
    return this.sentences[this.idx];
  }

  get parts() {
    return sentenceParts(this.current?.en ?? "");
  }

  get full(): boolean {
    return this.placed.length === this.crates.length && this.crates.length > 0;
  }

  get solvedCount(): number {
    return this.idx + (this.departing ? 1 : 0);
  }

  get score(): number {
    return computeTrainResult(this.events, this.sentences).score;
  }

  elapsed() {
    return this.clock.elapsed();
  }

  private load() {
    const s = this.current;
    if (!s) return;
    const words = sentenceParts(s.en).words;
    const rng = createRng((this.config.seed ^ (s.id * 2654435761)) >>> 0);
    let order = shuffle(
      words.map((text, id) => ({ id, text })),
      rng,
    );
    // never hand out the sentence already in order
    for (let i = 0; i < 8 && order.map((c) => c.text).join(" ") === words.join(" "); i++)
      order = shuffle(order, rng);
    this.crates = order;
    this.placed = [];
    this.wrongSlots = new Set();
    this.buffer = "";
    this.departing = false;
  }

  start() {
    if (this.status !== "ready") return;
    this.clock.start();
    this.status = "playing";
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

  private get canEdit() {
    return this.status === "playing" && !this.departing;
  }

  crate(id: number): Crate | undefined {
    return this.crates.find((c) => c.id === id);
  }

  isPlaced(id: number) {
    return this.placed.includes(id);
  }

  place(id: number) {
    if (!this.canEdit || this.isPlaced(id) || this.full || !this.crate(id)) return;
    this.placed = [...this.placed, id];
    this.wrongSlots = new Set();
    this.buffer = "";
    this.emit({ kind: "place" });
  }

  /** take a wagon's crate back to the yard (later wagons move up) */
  unplace(slot: number) {
    if (!this.canEdit || slot < 0 || slot >= this.placed.length) return;
    this.placed = this.placed.filter((_, i) => i !== slot);
    this.wrongSlots = new Set();
    this.emit({ kind: "unplace" });
  }

  undo() {
    this.unplace(this.placed.length - 1);
  }

  private freeCrates() {
    return this.crates.filter((c) => !this.isPlaced(c.id));
  }

  /**
   * Typing picks a crate: letters that no free crate starts with are rejected. A word is loaded
   * as soon as it is complete, unless a longer free word starts with it ("a" / "an"): then Space
   * or Enter loads it.
   */
  type(raw: string) {
    if (!this.canEdit) return;
    if (raw === " ") {
      this.confirm();
      return;
    }
    const ch = raw.toLowerCase();
    if (!/^[a-z'-]$/.test(ch)) return;
    const next = this.buffer + ch;
    const free = this.freeCrates();
    if (!free.some((c) => crateKey(c.text).startsWith(next))) {
      this.emit({ kind: "reject" });
      return;
    }
    this.buffer = next;
    const exact = free.find((c) => crateKey(c.text) === next);
    const longer = free.some(
      (c) => crateKey(c.text).length > next.length && crateKey(c.text).startsWith(next),
    );
    if (exact && !longer) this.place(exact.id);
    else this.emit({ kind: "place" });
  }

  /** Space/Enter with a typed word: load it. Returns true if something was loaded. */
  confirm(): boolean {
    if (!this.canEdit || !this.buffer) return false;
    const exact = this.freeCrates().find((c) => crateKey(c.text) === this.buffer);
    if (!exact) return false;
    this.place(exact.id);
    return true;
  }

  erase() {
    if (!this.canEdit) return;
    if (this.buffer) {
      this.buffer = this.buffer.slice(0, -1);
      this.emit({ kind: "unplace" });
    } else this.undo();
  }

  /** words currently on the train */
  answer(): string[] {
    return this.placed.map((id) => this.crate(id)?.text ?? "");
  }

  /** Enter: load the typed word, or send a full train off. */
  enter() {
    if (this.confirm()) return;
    this.submit();
  }

  submit() {
    const s = this.current;
    if (!this.canEdit || !s || !this.full) return;
    const t = this.elapsed();
    const answer = this.answer();
    this.events.push({ t, type: "submit", sentenceId: s.id, answer });
    const words = this.parts.words;
    if (answer.join(" ") === words.join(" ")) {
      this.departing = true;
      this.buffer = "";
      this.emit({ kind: "solved" });
      return;
    }
    this.lives--;
    this.wrongSlots = new Set(answer.flatMap((w, i) => (w === words[i] ? [] : [i])));
    this.emit({ kind: "wrong" });
    if (this.lives <= 0) this.end();
  }

  /** Keep the right start of the train, then load the next right crate. */
  hint() {
    const s = this.current;
    if (!this.canEdit || !s) return;
    const words = this.parts.words;
    const answer = this.answer();
    let k = 0;
    while (k < answer.length && answer[k] === words[k]) k++;
    if (k >= words.length) return;
    this.events.push({ t: this.elapsed(), type: "hint", sentenceId: s.id });
    const keep = this.placed.slice(0, k);
    const pick = this.crates.find((c) => !keep.includes(c.id) && c.text === words[k]);
    this.placed = pick ? [...keep, pick.id] : keep;
    this.wrongSlots = new Set();
    this.buffer = "";
    this.emit({ kind: "hint" });
  }

  /** after the departure animation: next station, or the end of the line */
  next() {
    if (!this.departing) return;
    this.idx++;
    if (this.idx >= this.sentences.length) {
      this.departing = false;
      this.end();
      return;
    }
    this.load();
    this.emit({ kind: "place" });
  }

  private end() {
    this.status = "over";
    this.clock.pause();
    this.emit({ kind: "end" });
  }

  result(): RoundResult {
    return computeTrainResult(this.events, this.sentences);
  }
}
