/** Every playable game. Unit progress is kept per game; word progress is shared by all of them. */
export const GAME_IDS = ["word-blaster", "ghost-race", "sentence-express"] as const;
export type GameId = (typeof GAME_IDS)[number];

export function isGameId(value: unknown): value is GameId {
  return GAME_IDS.includes(value as GameId);
}
