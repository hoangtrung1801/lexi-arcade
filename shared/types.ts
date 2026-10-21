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
 * `t` is milliseconds since the round started.
 */
export type GameEvent =
  | { t: number; type: "correct"; wordId: number } // one correct key on the locked word
  | { t: number; type: "wrong"; wordId?: number } // wrong key (wordId = locked target, if any)
  | { t: number; type: "hit"; wordId: number } // word fully typed and shot down
  | { t: number; type: "miss"; wordId: number }; // word reached the ground

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
