import { drawNine, type FrameSpec, frameSprite, mix, toCanvas } from "../../lib/pixelart";

/** Shared Word Blaster art: word plates (also used by the hub preview). */

export const WORD_FONT = '"Galmuri11 Bold", "Galmuri11", monospace';
export const MEANING_FONT = '"Galmuri11", monospace';
export const PLATE_H = 20;
const PLATE_PAD = 7;

interface PlateTone {
  hi: string;
  shade: string;
  top: string;
  bottom: string;
  lip: string;
}

export const PLATE_TONES: PlateTone[] = [
  { hi: "#96b1d4", shade: "#283155", top: "#9a4aa8", bottom: "#35416f", lip: "#1b223f" },
  { hi: "#a8f0a0", shade: "#17574a", top: "#3fae68", bottom: "#237a52", lip: "#0f3a30" },
  { hi: "#9af2e4", shade: "#0f4a55", top: "#2a9a9a", bottom: "#1a6a74", lip: "#0b3c3d" },
  { hi: "#a8e7ff", shade: "#29366f", top: "#3f78e0", bottom: "#2a4fb0", lip: "#14235e" },
  { hi: "#ffb0b8", shade: "#5c1532", top: "#d8456a", bottom: "#a02a50", lip: "#4a0f2a" },
  { hi: "#a8bfd7", shade: "#1d2234", top: "#4a5480", bottom: "#323b5e", lip: "#151827" },
];

const C = 4;
const frames = new Map<string, HTMLCanvasElement>();

function plateFrame(tone: PlateTone, lock: boolean) {
  const key = `${tone.top}|${lock}`;
  let cv = frames.get(key);
  if (!cv) {
    const bands = PLATE_H - C * 2;
    const spec: FrameSpec = {
      c: C,
      cut: 2,
      outline: lock ? "#ffcd75" : "#0d0e18",
      rings: [[tone.hi, tone.shade]],
      bands: Array.from({ length: bands }, (_, i) => mix(tone.top, tone.bottom, i / (bands - 1))),
      lip: 2,
      lipColor: tone.lip,
    };
    cv = toCanvas(frameSprite(spec));
    frames.set(key, cv);
  }
  return cv;
}

let measure: CanvasRenderingContext2D | null = null;
export function plateWidth(text: string) {
  measure ??= document.createElement("canvas").getContext("2d");
  if (!measure) return text.length * 7 + PLATE_PAD * 2;
  measure.font = `12px ${WORD_FONT}`;
  return Math.ceil(measure.measureText(text).width) + PLATE_PAD * 2;
}

/** Paints a plate into `ctx` at (x, y); typed letters turn gold. */
export function paintPlate(
  ctx: CanvasRenderingContext2D,
  text: string,
  typed: number,
  toneIdx: number,
  lock: boolean,
  x = 0,
  y = 0,
) {
  const tone = PLATE_TONES[toneIdx % PLATE_TONES.length] as PlateTone;
  const w = plateWidth(text);
  ctx.imageSmoothingEnabled = false;
  drawNine(ctx, plateFrame(tone, lock), C, x, y, w, PLATE_H);
  ctx.font = `12px ${WORD_FONT}`;
  ctx.textBaseline = "alphabetic";
  const done = text.slice(0, typed);
  const rest = text.slice(typed);
  const tx = x + PLATE_PAD;
  const ty = y + 13;
  const dw = Math.round(ctx.measureText(done).width);
  ctx.fillStyle = tone.lip;
  ctx.fillText(rest, tx + dw, ty + 1);
  ctx.fillStyle = "#f4f4f4";
  ctx.fillText(rest, tx + dw, ty);
  if (done) {
    ctx.fillStyle = "#7a3a12";
    ctx.fillText(done, tx, ty + 1);
    ctx.fillStyle = "#ffcd75";
    ctx.fillText(done, tx, ty);
  }
  return w;
}

const BOOM = [
  "#ffffff",
  "#fff3cf",
  "#ffcd75",
  "#ef7d57",
  "#f05d6c",
  "#b13e53",
  "#5d275d",
  "#4a5878",
  "#333c57",
];

/** Procedural explosion strip: `frames` cells of `size`², fireball → ring → smoke. */
export function paintExplosion(frames = 8, size = 44) {
  const cv = document.createElement("canvas");
  cv.width = frames * size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const c = size / 2;
  const hash = (x: number, y: number) => {
    const h = Math.imul((x * 73856093) ^ (y * 19349663), 2654435761);
    return ((h >>> 0) % 1000) / 1000;
  };
  for (let f = 0; f < frames; f++) {
    const t = f / (frames - 1);
    const r = 5 + 15 * (1 - (1 - t) ** 2);
    const ring = 6 + 16 * t;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const d = Math.sqrt(dx * dx + dy * dy);
        const n = hash(x >> 1, y >> 1);
        let color: string | undefined;
        if (d < r * (0.75 + n * 0.35)) {
          // break apart into smoke as it ages
          if (t > 0.45 && n < (t - 0.45) * 1.7) continue;
          const th = ((x & 1) + (y & 1) * 2) / 4;
          const idx = Math.floor(t * 5 + (d / r) * 2.6 + th * 0.8);
          color = BOOM[Math.min(BOOM.length - 1, idx)];
        } else if (t < 0.7 && Math.abs(d - ring) < 0.7) {
          color = t < 0.35 ? "#c6fbff" : "#73eff7";
        }
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(f * size + x, y, 1, 1);
      }
    }
  }
  return cv;
}
