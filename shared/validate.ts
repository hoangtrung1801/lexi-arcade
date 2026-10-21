import { MAX_SESSION_MS, MAX_WPM, MIN_KEY_INTERVAL_MS } from "./rules";
import type { GameEvent, GameWord } from "./types";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Structural + plausibility checks on a submitted event log. */
export function validateEvents(
  events: readonly GameEvent[],
  words: readonly GameWord[],
  elapsedWallMs: number,
): ValidationResult {
  if (events.length === 0) return { ok: false, reason: "empty-events" };
  if (events.length > 20000) return { ok: false, reason: "too-many-events" };
  if (elapsedWallMs > MAX_SESSION_MS) return { ok: false, reason: "session-expired" };

  const ids = new Set(words.map((w) => w.id));
  const typedChars = new Map<number, number>();
  let prevT = -1;
  let prevKeyT = -Infinity;
  let correctKeys = 0;

  for (const ev of events) {
    if (!Number.isFinite(ev.t) || ev.t < 0) return { ok: false, reason: "bad-time" };
    if (ev.t < prevT) return { ok: false, reason: "time-not-monotonic" };
    prevT = ev.t;
    if (ev.wordId !== undefined && !ids.has(ev.wordId))
      return { ok: false, reason: "unknown-word" };
    if (ev.type === "correct" || ev.type === "wrong") {
      if (ev.t - prevKeyT < MIN_KEY_INTERVAL_MS) return { ok: false, reason: "keys-too-fast" };
      prevKeyT = ev.t;
    }
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

  // The client clock cannot run longer than the wall clock (small tolerance).
  if (prevT > elapsedWallMs + 5000) return { ok: false, reason: "events-longer-than-session" };

  const minutes = Math.max(prevT, 1000) / 60000;
  if (correctKeys / 5 / minutes > MAX_WPM) return { ok: false, reason: "wpm-too-high" };
  return { ok: true };
}
