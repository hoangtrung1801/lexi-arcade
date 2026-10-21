import { useEffect } from "react";
import { create } from "zustand";
import { PixelIcon } from "./PixelIcon";

interface ToastState {
  toasts: { id: number; text: string; tone: "info" | "good" | "bad" }[];
  push: (text: string, tone?: "info" | "good" | "bad") => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text, tone = "info") =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId++, text, tone }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string, tone: "info" | "good" | "bad" = "info") =>
  useToasts.getState().push(text, tone);

const TONE = {
  info: { chip: "hb-chip-blue", icon: "star" },
  good: { chip: "hb-chip-green", icon: "check" },
  bad: { chip: "hb-chip-red", icon: "close" },
} as const;

function ToastItem({ id, text, tone }: { id: number; text: string; tone: keyof typeof TONE }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), 3500);
    return () => clearTimeout(t);
  }, [id, dismiss]);
  return (
    <div role="status" className="hb-panel hb-lift flex items-center gap-3 px-3 py-1">
      <span className={`${TONE[tone].chip} flex h-8 w-8 items-center justify-center`}>
        <PixelIcon name={TONE[tone].icon} size={12} color="#0d0e18" />
      </span>
      <span className="t-md">{text}</span>
    </div>
  );
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed right-6 bottom-6 z-[60] flex flex-col gap-3"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
