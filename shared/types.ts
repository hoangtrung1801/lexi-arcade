export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** A word as the game sees it. */
export interface GameWord {
  id: number;
  lemma: string;
  meaningVi: string;
  ipa?: string | null;
  pos?: string | null;
}

/**
 * Event log produced by the game and replayed by the server.
 * `t` is milliseconds since the round started; `wordId` is the word being asked.
 */
export type GameEvent =
  | { t: number; type: "correct"; wordId: number } // a key that still matches an answer plate
  | { t: number; type: "wrong"; wordId?: number } // a key that matches no answer plate
  | { t: number; type: "hit"; wordId: number } // right answer typed and shot down
  | { t: number; type: "miss"; wordId: number } // the right answer reached the ground
  | { t: number; type: "bad"; wordId: number; choiceId: number }; // typed a wrong answer (choiceId)

/** Ghost Race log: keys while typing a word, letters the game revealed, and finished words. */
export type RaceEvent =
  | { t: number; type: "correct"; wordId: number }
  | { t: number; type: "wrong"; wordId: number }
  | { t: number; type: "reveal"; wordId: number } // the game showed the next letter
  | { t: number; type: "done"; wordId: number };

/** A Sentence Express sentence. `en` is the full sentence, punctuation included. */
export interface Sentence {
  id: number;
  wordId: number;
  en: string;
  vi: string;
}

/** Sentence Express log: a train sent off with the words in `answer` order, or a hint taken. */
export type TrainEvent =
  | { t: number; type: "submit"; sentenceId: number; answer: string[] }
  | { t: number; type: "hint"; sentenceId: number };

/** A recorded run to race against: [ms since start, fraction of the track] after every word. */
export interface Ghost {
  kind: "best" | "top";
  name: string;
  durationMs: number;
  points: [number, number][];
}

export interface GameConfig {
  unitId: number;
  words: GameWord[];
  seed: number;
  difficulty: Difficulty;
}

export type RoundStatus = "won" | "lost";

/** Everything derived from an event log. Client and server must agree on this. */
export interface RoundResult {
  status: RoundStatus;
  score: number;
  wpm: number;
  accuracy: number; // 0..1
  maxCombo: number;
  stars: 0 | 1 | 2 | 3;
  livesLost: number;
  durationMs: number;
  correctKeys: number;
  wrongKeys: number;
  hitWordIds: number[];
  missedWordIds: number[];
  /** words hit without any wrong key and never missed (eligible for SRS promotion) */
  cleanWordIds: number[];
}

export interface FinishRewards {
  xpGained: number;
  coinsGained: number;
  newStars: number;
  unlockedUnitId: number | null;
  levelUp: boolean;
  level: number;
  xp: number;
  coins: number;
  streakDays: number;
}
