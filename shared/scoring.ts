import { COMBO_CAP, COMBO_STEP, MAX_LIVES, POINTS_PER_CHAR } from "./rules";
import type { GameEvent, GameWord, RoundResult } from "./types";

export function comboMultiplier(combo: number): number {
  return Math.min(COMBO_CAP, 1 + COMBO_STEP * combo);
}

export function wordScore(length: number, combo: number): number {
  return Math.round(POINTS_PER_CHAR * length * comboMultiplier(combo));
}

export function calcWpm(correctKeys: number, durationMs: number): number {
  const minutes = Math.max(durationMs, 1000) / 60000;
  return Math.round((correctKeys / 5 / minutes) * 10) / 10;
}

export function calcStars(
  status: "won" | "lost",
  accuracy: number,
  livesLost: number,
): 0 | 1 | 2 | 3 {
  if (status !== "won") return 0;
  if (accuracy >= 0.95 && livesLost === 0) return 3;
  if (accuracy >= 0.9) return 2;
  return 1;
}

/**
 * Replays an event log into a RoundResult.
 * Rules: wrong key or a missed word resets the combo; hitting 0 lives ends the round
 * (events after that are ignored); the round is won when every word has been hit.
 */
export function computeResult(events: readonly GameEvent[], words: readonly GameWord[]): RoundResult {
  const lemmaLen = new Map(words.map((w) => [w.id, w.lemma.length]));
  const hit = new Set<number>();
  const missed = new Set<number>();
  const wrongOn = new Set<number>();

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let correctKeys = 0;
  let wrongKeys = 0;
  let lives = MAX_LIVES;
  let lastT = 0;
  let status: "won" | "lost" | null = null;

  for (const ev of events) {
    if (status) break;
    lastT = ev.t;
    switch (ev.type) {
      case "correct":
        correctKeys++;
        break;
      case "wrong":
        wrongKeys++;
        combo = 0;
        if (ev.wordId !== undefined) wrongOn.add(ev.wordId);
        break;
      case "hit": {
        const len = lemmaLen.get(ev.wordId) ?? 0;
        if (hit.has(ev.wordId)) break;
        hit.add(ev.wordId);
        score += wordScore(len, combo);
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        if (hit.size === words.length) status = "won";
        break;
      }
      case "miss":
        missed.add(ev.wordId);
        combo = 0;
        lives--;
        if (lives <= 0) status = "lost";
        break;
    }
  }

  const finalStatus = status ?? "lost";
  const totalKeys = correctKeys + wrongKeys;
  const accuracy = totalKeys === 0 ? 0 : correctKeys / totalKeys;
  const livesLost = MAX_LIVES - Math.max(lives, 0);
  const clean = [...hit].filter((id) => !wrongOn.has(id) && !missed.has(id));

  return {
    status: finalStatus,
    score,
    wpm: calcWpm(correctKeys, lastT),
    accuracy,
    maxCombo,
    stars: calcStars(finalStatus, accuracy, livesLost),
    livesLost,
    durationMs: lastT,
    correctKeys,
    wrongKeys,
    hitWordIds: [...hit],
    missedWordIds: [...missed],
    cleanWordIds: clean,
  };
}
