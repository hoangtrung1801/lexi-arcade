import {
  TRAIN_BONUS_MS,
  TRAIN_LIVES,
  TRAIN_MIN_MS_PER_WORD,
  TRAIN_POINTS_PER_WORD,
  TRAIN_RUN_MS,
  TRAIN_STAR_SENTENCES,
} from "./rules";
import { comboMultiplier } from "./scoring";
import type { RoundResult, Sentence, TrainEvent } from "./types";
import { checkTimeline, type ValidationResult } from "./validate";

/** The words to put in order, and the punctuation that ends the sentence (kept in place). */
export function sentenceParts(en: string): { words: string[]; end: string } {
  const trimmed = en.trim();
  const last = trimmed.at(-1) ?? "";
  const end = ".?!".includes(last) ? last : "";
  const body = end ? trimmed.slice(0, -1) : trimmed;
  return { words: body.split(/\s+/).filter(Boolean), end };
}

function sameWords(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((w, i) => w === y[i]);
}

/** When a run ends if `solved` sentences have been solved so far. */
export function trainTimeLimit(solved: number): number {
  return TRAIN_RUN_MS + solved * TRAIN_BONUS_MS;
}

export function trainStars(solved: number): RoundResult["stars"] {
  const [one, two, three] = TRAIN_STAR_SENTENCES;
  return solved >= three ? 3 : solved >= two ? 2 : solved >= one ? 1 : 0;
}

/**
 * Replays a Sentence Express run: a race against the clock over a whole word set. Each solved
 * sentence adds time; a train sent off in the wrong order costs a lump of coal (a life) and breaks
 * the combo. A sentence solved with a hint scores half and breaks the combo. The run ends when the
 * time is up (events after it do not count), the coal runs out ("lost") or the sentences run out.
 * Stars come from the number of sentences solved.
 */
export function computeTrainResult(
  events: readonly TrainEvent[],
  sentences: readonly Sentence[],
): RoundResult {
  const byId = new Map(sentences.map((s) => [s.id, { s, words: sentenceParts(s.en).words }]));
  const solved = new Set<number>();
  const tried = new Set<number>();
  const wrongOn = new Set<number>();
  const hinted = new Set<number>();
  let lives = TRAIN_LIVES;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let goodSubmits = 0;
  let badSubmits = 0;
  let placed = 0;
  let lastT = 0;
  let status: "won" | "lost" | null = null;

  for (const ev of events) {
    if (status) break;
    if (ev.t > trainTimeLimit(solved.size)) {
      status = "won";
      break;
    }
    const item = byId.get(ev.sentenceId);
    if (!item || solved.has(ev.sentenceId)) continue;
    lastT = ev.t;
    tried.add(ev.sentenceId);
    if (ev.type === "hint") {
      hinted.add(ev.sentenceId);
      combo = 0;
      continue;
    }
    if (ev.answer.join(" ") === item.words.join(" ")) {
      solved.add(ev.sentenceId);
      goodSubmits++;
      placed += item.words.length;
      const base = TRAIN_POINTS_PER_WORD * item.words.length * comboMultiplier(combo);
      score += Math.round(hinted.has(ev.sentenceId) ? base / 2 : base);
      if (!hinted.has(ev.sentenceId)) combo++;
      maxCombo = Math.max(maxCombo, combo);
      if (solved.size === sentences.length) status = "won";
    } else {
      badSubmits++;
      wrongOn.add(ev.sentenceId);
      combo = 0;
      lives--;
      if (lives <= 0) status = "lost";
    }
  }

  // time ran out with coal left
  const finalStatus = status ?? "won";
  const livesLost = TRAIN_LIVES - Math.max(lives, 0);
  const submits = goodSubmits + badSubmits;
  const accuracy = submits === 0 ? 0 : goodSubmits / submits;
  const stars = trainStars(solved.size);
  const keyword = (id: number) => byId.get(id)?.s.wordId ?? 0;
  const solvedIds = [...solved];

  return {
    status: finalStatus,
    score,
    wpm: 0,
    accuracy,
    maxCombo,
    stars,
    livesLost,
    durationMs: lastT,
    correctKeys: placed,
    wrongKeys: badSubmits,
    hitWordIds: [...new Set(solvedIds.map(keyword))],
    missedWordIds: [...new Set([...tried].filter((id) => !solved.has(id)).map(keyword))],
    cleanWordIds: [
      ...new Set(solvedIds.filter((id) => !wrongOn.has(id) && !hinted.has(id)).map(keyword)),
    ],
  };
}

export function validateTrain(
  events: readonly TrainEvent[],
  sentences: readonly Sentence[],
  elapsedWallMs: number,
): ValidationResult {
  const timeline = checkTimeline(events, elapsedWallMs, () => false);
  if (timeline) return { ok: false, reason: timeline };
  const byId = new Map(sentences.map((s) => [s.id, sentenceParts(s.en).words]));
  const solved = new Set<number>();
  const hints = new Map<number, number>();
  for (const ev of events) {
    const words = byId.get(ev.sentenceId);
    if (!words) return { ok: false, reason: "unknown-sentence" };
    if (solved.has(ev.sentenceId)) return { ok: false, reason: "sentence-already-solved" };
    if (ev.type === "hint") {
      const n = (hints.get(ev.sentenceId) ?? 0) + 1;
      if (n > words.length) return { ok: false, reason: "too-many-hints" };
      hints.set(ev.sentenceId, n);
      continue;
    }
    if (!Array.isArray(ev.answer) || !sameWords(ev.answer, words))
      return { ok: false, reason: "answer-not-the-sentence" };
    if (ev.answer.join(" ") === words.join(" ")) solved.add(ev.sentenceId);
  }
  // Loading a sentence takes time: a whole round faster than a human can click is a bot.
  const minMs = sentences
    .filter((s) => solved.has(s.id))
    .reduce((n, s) => n + (byId.get(s.id)?.length ?? 0) * TRAIN_MIN_MS_PER_WORD, 0);
  if ((events.at(-1)?.t ?? 0) < minMs) return { ok: false, reason: "too-fast" };
  return { ok: true };
}
