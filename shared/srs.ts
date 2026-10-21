import { MAX_BOX, SRS_INTERVALS_DAYS } from "./rules";

const DAY_MS = 24 * 60 * 60 * 1000;

export function nextBoxOnClean(box: number): number {
  return Math.min(box + 1, MAX_BOX);
}

export function dueAtFor(box: number, now: number): number {
  return now + (SRS_INTERVALS_DAYS[box] ?? 0) * DAY_MS;
}

export interface SrsUpdate {
  box: number;
  dueAt: number;
  correctDelta: number;
  wrongDelta: number;
}

/**
 * clean hit  -> box + 1
 * missed     -> box 0
 * hit with typos (not clean, not missed) -> box unchanged, reviewed again at the same interval
 */
export function srsUpdate(
  box: number,
  outcome: "clean" | "missed" | "sloppy",
  now: number,
): SrsUpdate {
  if (outcome === "clean") {
    const b = nextBoxOnClean(box);
    return { box: b, dueAt: dueAtFor(b, now), correctDelta: 1, wrongDelta: 0 };
  }
  if (outcome === "missed")
    return { box: 0, dueAt: dueAtFor(0, now), correctDelta: 0, wrongDelta: 1 };
  return { box, dueAt: dueAtFor(box, now), correctDelta: 1, wrongDelta: 1 };
}
