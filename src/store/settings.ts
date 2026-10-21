import type { Difficulty } from "@shared/types";
import { create } from "zustand";

interface Settings {
  sound: boolean;
  showMeaning: boolean;
  difficulty: Difficulty;
  set: (patch: Partial<Omit<Settings, "set">>) => void;
}

const KEY = "lexi.settings.v1";

function load(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export const useSettings = create<Settings>((set, get) => ({
  sound: true,
  showMeaning: true,
  difficulty: "normal",
  ...load(),
  set: (patch) => {
    set(patch);
    try {
      const { sound, showMeaning, difficulty } = get();
      localStorage.setItem(KEY, JSON.stringify({ sound, showMeaning, difficulty }));
    } catch {}
  },
}));
