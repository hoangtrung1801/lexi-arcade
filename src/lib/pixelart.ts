/**
 * Tiny pixel-art toolkit shared by the DOM UI and the Phaser scene.
 * Sprites are ASCII maps (one char per pixel, "." = empty) plus a palette; frames are
 * generated 9-slice images with bevels, a 3D lip and banded gradient fills.
 */

export type Palette = Record<string, string>;
/** Row-major pixels, `null` = transparent. */
export interface Sprite {
  w: number;
  h: number;
  px: (string | null)[];
}

/** Parses an ASCII map. With `outline`, the sprite grows by 1px and gets a 4-neighbour outline. */
export function sprite(rows: string[], palette: Palette, outline?: string): Sprite {
  const h0 = rows.length;
  const w0 = Math.max(...rows.map((r) => r.length));
  const pad = outline ? 1 : 0;
  const w = w0 + pad * 2;
  const h = h0 + pad * 2;
  const px: (string | null)[] = new Array(w * h).fill(null);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] ?? ".";
      if (ch === "." || ch === " ") continue;
      px[(y + pad) * w + x + pad] = palette[ch] ?? "#ff00ff";
    }
  });
  if (outline) {
    const filled = px.map((c) => c !== null);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (filled[y * w + x]) continue;
        const n =
          (x > 0 && filled[y * w + x - 1]) ||
          (x < w - 1 && filled[y * w + x + 1]) ||
          (y > 0 && filled[(y - 1) * w + x]) ||
          (y < h - 1 && filled[(y + 1) * w + x]);
        if (n) px[y * w + x] = outline;
      }
    }
  }
  return { w, h, px };
}

/** Replaces every colour through `fn` (used for disabled / "empty" icon states). */
export function recolor(s: Sprite, fn: (c: string) => string): Sprite {
  return { ...s, px: s.px.map((c) => (c ? fn(c) : c)) };
}

/** Horizontal runs, so an SVG needs one <rect> per run instead of one per pixel. */
export function runs(s: Sprite) {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  for (let y = 0; y < s.h; y++) {
    let x = 0;
    while (x < s.w) {
      const c = s.px[y * s.w + x];
      if (!c) {
        x++;
        continue;
      }
      let e = x + 1;
      while (e < s.w && s.px[y * s.w + e] === c) e++;
      out.push({ x, y, w: e - x, c });
      x = e;
    }
  }
  return out;
}

export function toCanvas(s: Sprite, scale = 1): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = s.w * scale;
  cv.height = s.h * scale;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  for (const r of runs(s)) {
    ctx.fillStyle = r.c;
    ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, scale);
  }
  return cv;
}

/* ---------------------------------- colour ---------------------------------- */

export function hex(c: string): [number, number, number] {
  const n = Number.parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function toHex([r, g, b]: [number, number, number]) {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}
export function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
/** Maps a colour onto the dim violet-grey ramp by luminance (locked / empty states). */
export function dimmed(c: string) {
  const [r, g, b] = hex(c);
  const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  return mix("#1d2234", "#7884a5", Math.min(1, l * 1.1));
}

/** 4x4 ordered-dither threshold in [0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => ((BAYER[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;

/* ---------------------------------- frames ---------------------------------- */

export interface FrameSpec {
  /** corner slice size, in art pixels */
  c: number;
  /** chamfer size of the outer corners */
  cut: number;
  outline: string;
  /** face rings inside the outline, outermost first: [top/left colour, bottom/right colour] */
  rings: [string, string][];
  /** fill colours top→bottom; the middle slice stretches them into bands */
  bands: string[];
  /** rows of darker "lip" under the face (3D keycap) */
  lip?: number;
  lipColor?: string;
  /** face pushed down onto the lip */
  pressed?: boolean;
  /** extra pixels in top-left corner coordinates, mirrored into all four corners */
  accents?: [x: number, y: number, color: string][];
}

function ringIndex(x: number, y: number, l: number, t: number, r: number, b: number, cut: number) {
  const dx = Math.min(x - l, r - x);
  const dy = Math.min(y - t, b - y);
  if (dx < 0 || dy < 0) return -1;
  return Math.min(dx, dy, dx + dy - cut);
}

export function frameSprite(f: FrameSpec): Sprite {
  const B = f.bands.length;
  const w = f.c * 2 + 1;
  const h = f.c * 2 + B;
  const lip = f.lip ?? 0;
  const faceT = 1 + (f.pressed ? lip : 0);
  const faceB = h - 2 - (f.pressed ? 0 : lip);
  const px: (string | null)[] = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    const band = f.bands[Math.max(0, Math.min(B - 1, y - f.c))] ?? "#ff00ff";
    for (let x = 0; x < w; x++) {
      const ro = ringIndex(x, y, 0, 0, w - 1, h - 1, f.cut);
      if (ro < 0) continue;
      if (ro === 0) {
        px[y * w + x] = f.outline;
        continue;
      }
      const rf = ringIndex(x, y, 1, faceT, w - 2, faceB, Math.max(0, f.cut - 1));
      if (rf < 0) {
        px[y * w + x] = f.lipColor ?? f.outline;
        continue;
      }
      const ring = f.rings[rf];
      if (!ring) {
        px[y * w + x] = band;
        continue;
      }
      const dt = y - faceT;
      const db = faceB - y;
      const dl = x - 1;
      const dr = w - 2 - x;
      const vertical = Math.min(dt, db) <= Math.min(dl, dr);
      const light = vertical ? dt <= db : dl <= dr;
      px[y * w + x] = light ? ring[0] : ring[1];
    }
  }
  for (const [ax, ay, color] of f.accents ?? []) {
    for (const [x, y] of [
      [ax, ay],
      [w - 1 - ax, ay],
      [ax, h - 1 - ay],
      [w - 1 - ax, h - 1 - ay],
    ] as const) {
      px[y * w + x] = color;
    }
  }
  return { w, h, px };
}

/** Draws a frame sprite (as a canvas) 9-sliced to any size. */
export function drawNine(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  c: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.width;
  const ih = img.height;
  const mw = iw - c * 2;
  const mh = ih - c * 2;
  const cols: [number, number, number, number][] = [
    [0, c, x, c],
    [c, mw, x + c, w - c * 2],
    [iw - c, c, x + w - c, c],
  ];
  const rows: [number, number, number, number][] = [
    [0, c, y, c],
    [c, mh, y + c, h - c * 2],
    [ih - c, c, y + h - c, c],
  ];
  for (const [sx, sw, dx, dw] of cols) {
    for (const [sy, sh, dy, dh] of rows) {
      if (dw > 0 && dh > 0) ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }
}

/** A shaded sphere (lit from the top-left) with a 1px outline; `ramp` is dark→light. */
export function orb(r: number, ramp: string[], outline = "#0d0e18"): Sprite {
  const size = r * 2 + 2;
  const px: (string | null)[] = new Array(size * size).fill(null);
  const n = ramp.length - 1;
  const L = [-0.55, -0.6, 0.58];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5 - size / 2) / r;
      const ny = (y + 0.5 - size / 2) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > (1 + 1.2 / r) ** 2) continue;
      if (d2 > 1) {
        px[y * size + x] = outline;
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      const lit = Math.max(0, nx * (L[0] ?? 0) + ny * (L[1] ?? 0) + nz * (L[2] ?? 0));
      let p = lit * (n - 0.6) + 0.3;
      if (d2 > 0.8 && nx > 0.2 && ny > 0.1) p += 0.8; // bounce light on the shadow side
      const base = Math.floor(p);
      const f = p - base;
      const idx = f > 0.65 && bayer(x, y) < (f - 0.65) / 0.35 ? base + 1 : base;
      px[y * size + x] = ramp[Math.max(0, Math.min(n, idx))] ?? outline;
    }
  }
  // specular glint
  const g = Math.round(size * 0.32);
  px[g * size + g] = "#ffffff";
  px[g * size + g + 1] = "#ffffff";
  px[(g + 1) * size + g] = "#ffffff";
  return { w: size, h: size, px };
}

const urlCache = new Map<string, string>();
/** Data-URL of a sprite, cached by key (for <img> / CSS backgrounds). */
export function spriteUrl(key: string, make: () => Sprite) {
  let u = urlCache.get(key);
  if (!u) {
    u = toCanvas(make()).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
