import type { GameId } from "@shared/games";
import type { FinishRewards, GameWord, RoundResult } from "@shared/types";
import { create } from "zustand";

export interface LastRound {
  gameId: GameId;
  unitId: number;
  unitIdx: number;
  unitTitle: string;
  setSlug: string;
  difficulty: string;
  words: GameWord[];
  result: RoundResult;
  /** null for guests (nothing was saved) */
  rewards: FinishRewards | null;
  saved: boolean;
}

interface State {
  round: LastRound | null;
  setRound: (r: LastRound | null) => void;
}

export const useLastRound = create<State>((set) => ({
  round: null,
  setRound: (round) => set({ round }),
}));
