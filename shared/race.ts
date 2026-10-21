import { createRng, shuffle } from "./rng";
import { RACE } from "./rules";
import { calcWpm, wordScore } from "./scoring";
import type { Difficulty, GameWord, RaceEvent, RoundResult } from "./types";
import { checkTimeline, tooManyWpm, type ValidationResult } from "./validate";

/** The order words come up in a race; client and tests derive it from the session seed. */
export function raceOrder(words: readonly GameWord[], seed: number): GameWord[] {
  return shuffle(words, createRng(seed));
}

/** Letters on the whole track. */
export function trackLength(words: readonly GameWord[]): number {
  return words.reduce((n, w) => n + w.lemma.length, 0);
}

/** How long the pace car takes to cover the track. */
export function parMs(words: readonly GameWord[], difficulty: Difficulty): number {
  return Math.round((trackLength(words) / 5 / RACE[difficulty].parWpm) * 60000);
}

/**
 * Replays a race. Keys that do not match the next letter are rejected and break the combo; a word
 * scores more the longer the run of clean words before it. Finishing ahead of the pace car adds a
 * time bonus. A word counts as missed when the game had to reveal half of it or more.
 */
export function computeRaceResult(
  events: readonly RaceEvent[],
  words: readonly GameWord[],
  difficulty: Difficulty,
): RoundResult {
  const byId = new Map(words.map((w) => [w.id, w]));
  const done = new Set<number>();
  const wrongOn = new Set<number>();
  const reveals = new Map<number, number>();
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let correctKeys = 0;
  let wrongKeys = 0;
  let lastT = 0;

  for (const ev of events) {
    if (done.size === words.length) break;
    lastT = ev.t;
    if (ev.type === "correct") correctKeys++;
    else if (ev.type === "wrong") {
      wrongKeys++;
      combo = 0;
      wrongOn.add(ev.wordId);
    } else if (ev.type === "reveal") {
      reveals.set(ev.wordId, (reveals.get(ev.wordId) ?? 0) + 1);
      combo = 0;
    } else if (!done.has(ev.wordId)) {
      done.add(ev.wordId);
      score += wordScore(byId.get(ev.wordId)?.lemma.length ?? 0, combo);
      combo++;
      maxCombo = Math.max(maxCombo, combo);
    }
  }

  const won = words.length > 0 && done.size === words.length;
  const par = parMs(words, difficulty);
  if (won) score += Math.max(0, Math.round((par - lastT) / 100));
  const totalKeys = correctKeys + wrongKeys;
  const accuracy = totalKeys === 0 ? 0 : correctKeys / totalKeys;
  const missed = [...reveals].filter(([id, n]) => n * 2 >= (byId.get(id)?.lemma.length ?? 1));
  const stars: RoundResult["stars"] = !won
    ? 0
    : lastT <= par && accuracy >= 0.95
      ? 3
      : lastT <= par
        ? 2
        : 1;

  return {
    status: won ? "won" : "lost",
    score,
    wpm: calcWpm(correctKeys, lastT),
    accuracy,
    maxCombo,
    stars,
    livesLost: 0,
    durationMs: lastT,
    correctKeys,
    wrongKeys,
    hitWordIds: [...done],
    missedWordIds: missed.map(([id]) => id),
    cleanWordIds: [...done].filter((id) => !wrongOn.has(id) && !reveals.has(id)),
  };
}

/** The run as a ghost: where on the track (0..1) the car was when each word was finished. */
export function raceGhost(
  events: readonly RaceEvent[],
  words: readonly GameWord[],
): [number, number][] {
  const total = trackLength(words) || 1;
  const len = new Map(words.map((w) => [w.id, w.lemma.length]));
  const seen = new Set<number>();
  let chars = 0;
  const points: [number, number][] = [];
  for (const ev of events) {
    if (ev.type !== "done" || seen.has(ev.wordId)) continue;
    seen.add(ev.wordId);
    chars += len.get(ev.wordId) ?? 0;
    points.push([ev.t, Math.round((chars / total) * 1000) / 1000]);
  }
  return points;
}

/** Where a ghost is on the track (0..1) at time t; it moves at a steady pace within each word. */
export function ghostAt(points: readonly [number, number][], t: number): number {
  let prev: [number, number] = [0, 0];
  for (const p of points) {
    if (t <= p[0]) {
      const span = p[0] - prev[0];
      return span <= 0 ? p[1] : prev[1] + ((p[1] - prev[1]) * (t - prev[0])) / span;
    }
    prev = p;
  }
  return prev[1];
}

export function validateRace(
  events: readonly RaceEvent[],
  words: readonly GameWord[],
  elapsedWallMs: number,
): ValidationResult {
  const timeline = checkTimeline(
    events,
    elapsedWallMs,
    (i) => events[i]?.type === "correct" || events[i]?.type === "wrong",
  );
  if (timeline) return { ok: false, reason: timeline };
  const byId = new Map(words.map((w) => [w.id, w]));
  const typed = new Map<number, number>();
  const revealed = new Map<number, number>();
  const done = new Set<number>();
  let correctKeys = 0;
  for (const ev of events) {
    const w = byId.get(ev.wordId);
    if (!w) return { ok: false, reason: "unknown-word" };
    if (done.has(ev.wordId)) return { ok: false, reason: "word-already-done" };
    if (ev.type === "correct") {
      correctKeys++;
      const n = (typed.get(w.id) ?? 0) + 1;
      if (n > w.lemma.length) return { ok: false, reason: "too-many-keys" };
      typed.set(w.id, n);
    } else if (ev.type === "reveal") {
      const n = (revealed.get(w.id) ?? 0) + 1;
      if (n > w.lemma.length) return { ok: false, reason: "too-many-reveals" };
      revealed.set(w.id, n);
    } else if (ev.type === "done") {
      if ((typed.get(w.id) ?? 0) < w.lemma.length)
        return { ok: false, reason: "done-without-typing" };
      done.add(w.id);
    }
  }
  if (tooManyWpm(correctKeys, events.at(-1)?.t ?? 0)) return { ok: false, reason: "wpm-too-high" };
  return { ok: true };
}
