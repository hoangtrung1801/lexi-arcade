import type { GameId } from "./games";
import { computeRaceResult, validateRace } from "./race";
import { computeResult } from "./scoring";
import { computeTrainResult, validateTrain } from "./sentence";
import { computeSpellResult, validateSpell } from "./spell";
import type {
  Difficulty,
  GameEvent,
  GameWord,
  RaceEvent,
  RoundResult,
  Sentence,
  SpellEvent,
  TrainEvent,
} from "./types";
import { type ValidationResult, validateEvents } from "./validate";

/** What the server knows about a round when it checks and scores the log. */
export interface RoundContext {
  words: readonly GameWord[];
  sentences: readonly Sentence[];
  difficulty: Difficulty;
}

/** Each game's log type; the server parses it with the matching schema before calling these. */
export type AnyEvent = GameEvent | RaceEvent | TrainEvent | SpellEvent;

export function validateRound(
  game: GameId,
  events: readonly AnyEvent[],
  ctx: RoundContext,
  elapsedWallMs: number,
): ValidationResult {
  if (game === "ghost-race") return validateRace(events as RaceEvent[], ctx.words, elapsedWallMs);
  if (game === "sentence-express")
    return validateTrain(events as TrainEvent[], ctx.sentences, elapsedWallMs);
  if (game === "spell-dungeon")
    return validateSpell(events as SpellEvent[], ctx.words, elapsedWallMs);
  return validateEvents(events as GameEvent[], ctx.words, elapsedWallMs);
}

export function scoreRound(
  game: GameId,
  events: readonly AnyEvent[],
  ctx: RoundContext,
): RoundResult {
  if (game === "ghost-race")
    return computeRaceResult(events as RaceEvent[], ctx.words, ctx.difficulty);
  if (game === "sentence-express") return computeTrainResult(events as TrainEvent[], ctx.sentences);
  if (game === "spell-dungeon") return computeSpellResult(events as SpellEvent[], ctx.words);
  return computeResult(events as GameEvent[], ctx.words);
}
