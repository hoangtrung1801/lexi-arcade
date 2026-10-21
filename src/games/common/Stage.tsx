import { type ReactNode, useEffect, useState } from "react";

export const STAGE_W = 1280;
export const STAGE_H = 720;

function measure() {
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
}

/** A fixed 1280x720 play area scaled to the largest 16:9 box that fits the window. */
export function Stage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [k, setK] = useState(measure);
  useEffect(() => {
    const on = () => setK(measure());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: Math.floor(STAGE_W * k), height: Math.floor(STAGE_H * k) }}
    >
      <div
        className={`absolute top-0 left-0 origin-top-left overflow-hidden ${className}`}
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${k})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** Vietnamese IMEs turn keys into composed letters the games cannot read. */
export function isImeKey(e: KeyboardEvent) {
  if (e.isComposing || e.key === "Process" || e.keyCode === 229) return true;
  return e.key.length === 1 && /\p{L}/u.test(e.key) && !/^[a-z]$/i.test(e.key);
}

/** Round clock in ms that stops while paused. */
export class Clock {
  private startedAt = 0;
  private pausedAt = 0;
  running = false;
  constructor(private now: () => number = () => performance.now()) {}
  start() {
    this.startedAt = this.now();
    this.running = true;
  }
  pause() {
    if (!this.running) return;
    this.pausedAt = this.now();
    this.running = false;
  }
  resume() {
    if (this.running) return;
    this.startedAt += this.now() - this.pausedAt;
    this.running = true;
  }
  elapsed(): number {
    const end = this.running ? this.now() : this.pausedAt;
    return Math.max(0, Math.round(end - this.startedAt));
  }
}
