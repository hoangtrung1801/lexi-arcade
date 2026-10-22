import type { GameId } from "./games";
import type { AnyEvent } from "./rounds";
import type { Difficulty, FinishRewards, GameWord, Ghost, RoundResult, Sentence } from "./types";

export interface MeResponse {
  user: null | {
    id: string;
    email: string;
    displayName: string;
    image: string | null;
    level: number;
    xp: number;
    xpForNext: number;
    xpForCurrent: number;
    coins: number;
    streakDays: number;
    settings: Record<string, unknown>;
  };
}

export interface SetSummary {
  id: number;
  slug: string;
  name: string;
  cefr: string;
  unitCount: number;
}

export type UnitState = "locked" | "open" | "done";
export interface UnitSummary {
  id: number;
  idx: number;
  titleVi: string;
  topic: string | null;
  wordCount: number;
  state: UnitState;
  bestStars: number;
  bestScore: number;
  /** locked because guests only get the first 3 units */
  guestLocked: boolean;
}

export interface UnitsResponse {
  set: SetSummary;
  units: UnitSummary[];
  dueCount: number;
}

export interface UnitWordsResponse {
  unitId: number;
  words: GameWord[];
}

/** Sentence Express: a guest run's sentences, dealt from the whole set */
export interface SetSentencesResponse {
  set: SetSummary;
  sentences: Sentence[];
  words: GameWord[];
}

/** Sentence Express: the sets to pick from, with the player's best run in each */
export interface TrainSet {
  slug: string;
  name: string;
  cefr: string;
  wordCount: number;
  sentenceCount: number;
  bestScore: number;
  bestStars: number;
  plays: number;
}
export interface TrainSetsResponse {
  sets: TrainSet[];
}

export interface StartSessionRequest {
  gameId?: GameId;
  /** every game but Sentence Express */
  unitId?: number;
  /** Sentence Express */
  setSlug?: string;
  difficulty: Difficulty;
}
export interface StartSessionResponse {
  sessionId: string;
  seed: number;
  difficulty: Difficulty;
  unitId: number;
  gameId: GameId;
  words: GameWord[];
  dueWordIds: number[];
  /** Sentence Express only */
  sentences: Sentence[];
  /** Ghost Race only: your best run and the fastest run by anyone else on this unit */
  ghosts: Ghost[];
}

export interface FinishSessionRequest {
  events: AnyEvent[];
}
export interface FinishSessionResponse {
  result: RoundResult;
  rewards: FinishRewards;
}

export interface VocabItem extends GameWord {
  cefr: string;
  box: number;
  dueAt: number;
  saved: boolean;
  hasAudio: boolean;
}
export interface VocabResponse {
  filter: "learned" | "due" | "saved";
  items: VocabItem[];
  counts: { learned: number; due: number; saved: number };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
}
export interface LeaderboardResponse {
  game: string;
  period: "week" | "all";
  entries: LeaderboardEntry[];
}

export interface QuestItem {
  key: string;
  title: string;
  progress: number;
  target: number;
  reward: number;
  claimed: boolean;
}
export interface QuestsResponse {
  date: string;
  quests: QuestItem[];
}
