import type {
  FinishSessionRequest,
  FinishSessionResponse,
  LeaderboardResponse,
  MeResponse,
  QuestsResponse,
  SetSummary,
  StartSessionRequest,
  StartSessionResponse,
  UnitSentencesResponse,
  UnitsResponse,
  UnitWordsResponse,
  VocabResponse,
} from "@shared/api";
import type { GameId } from "@shared/games";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me"), staleTime: 30_000 });

export const useSets = () =>
  useQuery({
    queryKey: ["sets"],
    queryFn: () => api<{ sets: SetSummary[] }>("/sets"),
    staleTime: 5 * 60_000,
  });

export const useUnits = (slug: string, game: GameId = "word-blaster") =>
  useQuery({
    queryKey: ["units", slug, game],
    queryFn: () => api<UnitsResponse>(`/sets/${slug}/units?game=${game}`),
  });

export const useUnitWords = (unitId: number | null, game: GameId = "word-blaster") =>
  useQuery({
    queryKey: ["unit-words", unitId, game],
    queryFn: () => api<UnitWordsResponse>(`/units/${unitId}/words?game=${game}`),
    enabled: unitId !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

export const useUnitSentences = (unitId: number | null) =>
  useQuery({
    queryKey: ["unit-sentences", unitId],
    queryFn: () => api<UnitSentencesResponse>(`/units/${unitId}/sentences`),
    enabled: unitId !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

export const useVocab = (filter: "learned" | "due" | "saved", enabled = true) =>
  useQuery({
    queryKey: ["vocab", filter],
    queryFn: () => api<VocabResponse>(`/vocab?filter=${filter}`),
    enabled,
  });

export const useLeaderboard = (game: GameId, period: "week" | "all") =>
  useQuery({
    queryKey: ["leaderboard", game, period],
    queryFn: () => api<LeaderboardResponse>(`/leaderboard?game=${game}&period=${period}`),
  });

export const useQuests = (enabled: boolean) =>
  useQuery({ queryKey: ["quests"], queryFn: () => api<QuestsResponse>("/quests/today"), enabled });

export const startSession = (body: StartSessionRequest) =>
  api<StartSessionResponse>("/sessions", { method: "POST", body });

export const finishSession = (id: string, body: FinishSessionRequest) =>
  api<FinishSessionResponse>(`/sessions/${id}/finish`, { method: "POST", body });

export function useInvalidateProgress() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["me", "units", "vocab", "quests", "leaderboard"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useSaveWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ wordId, saved }: { wordId: number; saved: boolean }) =>
      api(`/vocab/${wordId}/save`, { method: saved ? "POST" : "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab"] }),
  });
}

export function useClaimQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api<QuestsResponse>(`/quests/${key}/claim`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
