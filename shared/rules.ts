import type { Difficulty } from "./types";

export const MAX_LIVES = 4;
export const WORDS_PER_UNIT = 12;
export const GUEST_UNIT_LIMIT = 3;
export const MAX_DUE_RATIO = 0.3;
export const MAX_WPM = 250;
export const MAX_SESSION_MS = 30 * 60 * 1000;
/**
 * Most keys a human can plausibly produce within any one window. Single gaps between keys are not
 * checked: keys pressed while the page stutters are handled back to back, a fraction of a
 * millisecond apart, and fast typists press keys almost together.
 */
export const KEY_BURST_WINDOW_MS = 1000;
export const MAX_KEYS_PER_WINDOW = 30;

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

/** Ghost Race: the pace car drives at this speed, and a stuck player gets a letter after `revealMs`. */
export const RACE: Record<Difficulty, { parWpm: number; revealMs: number }> = {
  easy: { parWpm: 16, revealMs: 3000 },
  normal: { parWpm: 24, revealMs: 4000 },
  hard: { parWpm: 34, revealMs: 6000 },
};

/** Sentence Express: coal (lives) per round, and the quickest a human can load one word. */
export const TRAIN_LIVES = 3;
export const TRAIN_MIN_MS_PER_WORD = 120;
export const TRAIN_POINTS_PER_WORD = 20;
/** Sentence Express is a timed run over a whole word set */
export const TRAIN_RUN_MS = 90_000;
/** time added for every sentence solved */
export const TRAIN_BONUS_MS = 5_000;
/** sentences dealt for one run (more than anyone can solve in time) */
export const TRAIN_POOL = 80;
/** sentences solved for 1, 2 and 3 stars */
export const TRAIN_STAR_SENTENCES = [5, 10, 16] as const;

/** Spell Dungeon: a floor (unit) is 4 doors to spell, waves of monsters, then a boss. */
export const SPELL_HEARTS = 4;
export const SPELL_DOORS = 4;
export const SPELL_BOSS_HP = 6;
export const SPELL_WAVE = 3;
/** time between two monsters of a wave setting off */
export const SPELL_MOB_STAGGER_MS = 1500;
export const SPELL_BOSS_BONUS = 300;
export const SPELL_HEART_BONUS = 100;
/**
 * How long a monster takes to reach the hero and the boss to wind up a blow, plus some time for
 * every letter of the word. Easy shows each word's first letter; hard has no hint button.
 */
export const SPELL: Record<
  Difficulty,
  { mobMs: number; bossMs: number; perLetterMs: number; firstLetter: boolean; hints: boolean }
> = {
  easy: { mobMs: 12000, bossMs: 10000, perLetterMs: 700, firstLetter: true, hints: true },
  normal: { mobMs: 9000, bossMs: 8000, perLetterMs: 550, firstLetter: false, hints: true },
  hard: { mobMs: 6500, bossMs: 6000, perLetterMs: 420, firstLetter: false, hints: false },
};

export const DAILY_QUESTS = [
  { key: "play_3", title: "Chơi 3 ván", target: 3, reward: 15 },
  { key: "hit_30", title: "Đúng 30 từ (mọi game)", target: 30, reward: 20 },
  { key: "accuracy_95", title: "Một ván chính xác ≥ 95%", target: 1, reward: 25 },
] as const;
export type QuestKey = (typeof DAILY_QUESTS)[number]["key"];
