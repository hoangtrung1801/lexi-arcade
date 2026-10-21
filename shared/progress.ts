import { COINS_PER_STAR, STAR_BONUS_XP } from "./rules";

/** Vietnam is UTC+7 with no DST. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function vnDate(ts: number): string {
  return new Date(ts + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function vnWeek(ts: number): string {
  const d = new Date(ts + VN_OFFSET_MS);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function nextStreak(prevDays: number, lastActive: string | null, today: string): number {
  if (!lastActive) return 1;
  const gap = daysBetween(lastActive, today);
  if (gap <= 0) return Math.max(prevDays, 1);
  if (gap === 1) return prevDays + 1;
  return 1;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 100;
}

export function roundRewards(score: number, stars: number, bestStars: number) {
  const newStars = Math.max(0, stars - bestStars);
  return {
    newStars,
    xp: Math.floor(score / 10) + newStars * STAR_BONUS_XP,
    coins: newStars * COINS_PER_STAR,
  };
}
