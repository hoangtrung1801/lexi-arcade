import { KEY_BURST_WINDOW_MS, MAX_KEYS_PER_WINDOW, MAX_SESSION_MS, MAX_WPM } from "./rules";
import type { GameEvent, GameWord } from "./types";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Checks every game shares: the log is not empty or huge, times are sane and never go back,
 * keys come no faster than a human types, and the log is not longer than the session.
 */
export function checkTimeline(
  events: readonly { t: number }[],
  elapsedWallMs: number,
  isKey: (index: number) => boolean,
): string | null {
  if (events.length === 0) return "empty-events";
  if (events.length > 20000) return "too-many-events";
  if (elapsedWallMs > MAX_SESSION_MS) return "session-expired";
  let prevT = -1;
  /** times of the keys inside the current burst window */
  const recentKeys: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const t = events[i]?.t ?? Number.NaN;
    if (!Number.isFinite(t) || t < 0) return "bad-time";
    if (t < prevT) return "time-not-monotonic";
    prevT = t;
    if (isKey(i)) {
      recentKeys.push(t);
      while ((recentKeys[0] ?? t) <= t - KEY_BURST_WINDOW_MS) recentKeys.shift();
      if (recentKeys.length > MAX_KEYS_PER_WINDOW) return "keys-too-fast";
    }
  }
  // The client clock cannot run longer than the wall clock (small tolerance).
  if (prevT > elapsedWallMs + 5000) return "events-longer-than-session";
  return null;
}

export function tooManyWpm(correctKeys: number, durationMs: number): boolean {
  const minutes = Math.max(durationMs, 1000) / 60000;
  return correctKeys / 5 / minutes > MAX_WPM;
}

/** Structural + plausibility checks on a submitted Word Blaster event log. */
export function validateEvents(
  events: readonly GameEvent[],
  words: readonly GameWord[],
  elapsedWallMs: number,
): ValidationResult {
  const timeline = checkTimeline(
    events,
    elapsedWallMs,
    (i) => events[i]?.type === "correct" || events[i]?.type === "wrong",
  );
  if (timeline) return { ok: false, reason: timeline };

  const ids = new Set(words.map((w) => w.id));
  const typedChars = new Map<number, number>();
  let correctKeys = 0;

  for (const ev of events) {
    if (ev.wordId !== undefined && !ids.has(ev.wordId))
      return { ok: false, reason: "unknown-word" };
    if (ev.type === "bad" && (!ids.has(ev.choiceId) || ev.choiceId === ev.wordId))
      return { ok: false, reason: "bad-choice" };
    if (ev.type === "correct") {
      correctKeys++;
      typedChars.set(ev.wordId, (typedChars.get(ev.wordId) ?? 0) + 1);
    }
    if (ev.type === "hit") {
      const lemma = words.find((w) => w.id === ev.wordId)?.lemma ?? "";
      if ((typedChars.get(ev.wordId) ?? 0) < lemma.length)
        return { ok: false, reason: "hit-without-typing" };
    }
  }

  if (tooManyWpm(correctKeys, events.at(-1)?.t ?? 0)) return { ok: false, reason: "wpm-too-high" };
  return { ok: true };
}
