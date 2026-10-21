import type { Difficulty } from "./types";

export const MAX_LIVES = 4;
export const WORDS_PER_UNIT = 12;
export const GUEST_UNIT_LIMIT = 3;
export const MAX_DUE_RATIO = 0.3;
export const MAX_WPM = 250;
export const MAX_SESSION_MS = 30 * 60 * 1000;
/** Minimum time between two keys that a human can plausibly produce. */
export const MIN_KEY_INTERVAL_MS = 8;

export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = SRS_INTERVALS_DAYS.length - 1;

export const COMBO_STEP = 0.1;
export const COMBO_CAP = 3;
export const POINTS_PER_CHAR = 10;
export const STAR_BONUS_XP = 20;
export const COINS_PER_STAR = 5;

export interface DifficultyConfig {
  /** fall speed, px per second in a 540px tall playfield */
  fallSpeed: number;
  /** time between two words entering the field */
  spawnMs: number;
  /** most words falling at once */
  maxOnScreen: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { fallSpeed: 36, spawnMs: 2600, maxOnScreen: 4 },
  normal: { fallSpeed: 50, spawnMs: 2000, maxOnScreen: 5 },
  hard: { fallSpeed: 70, spawnMs: 1500, maxOnScreen: 6 },
};

export const DAILY_QUESTS = [
  { key: "play_3", title: "Chơi 3 ván", target: 3, reward: 15 },
  { key: "hit_30", title: "Bắn hạ 30 từ", target: 30, reward: 20 },
  { key: "accuracy_95", title: "Một ván chính xác ≥ 95%", target: 1, reward: 25 },
] as const;
export type QuestKey = (typeof DAILY_QUESTS)[number]["key"];
