import { bayer, hex } from "./pixelart";

/**
 * Procedural hi-bit night sky: dithered gradient, a nebula band, a lit ringed planet, hill
 * silhouettes and twinkling stars. Drawn at art resolution and scaled up with nearest-neighbour.
 */

type RGB = [number, number, number];

const SKY = [
  "#0b0c15",
  "#0f101c",
  "#131523",
  "#17192a",
  "#1a1c2c",
  "#1c2034",
  "#1e243d",
  "#212947",
  "#232d52",
  "#262f5c",
  "#283365",
  "#29366f",
].map(hex);
const NEBULA: [RGB, number][] = [
  [hex("#29366f"), 0.22],
  [hex("#3b5dc9"), 0.28],
  [hex("#5d275d"), 0.38],
  [hex("#257179"), 0.3],
];
const PLANET = [
  "#121420",
  "#1f1a33",
  "#3d1f45",
  "#5d275d",
  "#85304f",
  "#b13e53",
  "#ef7d57",
  "#f7a466",
  "#ffcd75",
].map(hex);
const RING = ["#384165", "#566c86", "#98abc7", "#ccdeec"].map(hex);

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number, oct = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f, seed + i * 17) * amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum / (1 - 0.5 ** oct);
}

/** Solid bands with a short dithered seam between them (instead of dithering everywhere). */
function edgeDither(p: number, x: number, y: number) {
  const base = Math.floor(p);
  const f = p - base;
  return f > 0.7 && bayer(x, y) < (f - 0.7) / 0.3 ? base + 1 : base;
}

function canvas(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  return cv;
}

/** Gradient + nebula band, fully opaque. */
export function paintSky(w: number, h: number, seed = 7) {
  const cv = canvas(w, h);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const n = SKY.length - 1;
  const scale = 1 / 70;
  for (let y = 0; y < h; y++) {
    const p = (y / h) ** 1.35 * n;
    for (let x = 0; x < w; x++) {
      const th = bayer(x, y);
      const base = SKY[Math.min(n, Math.floor(p + th))] as RGB;
      let [r, g, b] = base;
      // nebula: a diagonal band of fbm clouds
      const along = (y - h * 0.18 - (x / w) * h * 0.38) / (h * 0.22);
      const band = Math.exp(-along * along);
      if (band > 0.05) {
        const v = band * fbm(x * scale, y * scale * 1.6, seed) ** 1.6 * 1.9;
        const level = Math.floor(v * 3 + th - 0.35);
        for (let i = 0; i < Math.min(level, 3); i++) {
          const [c, a] = NEBULA[i] as [RGB, number];
          r += (c[0] - r) * a;
          g += (c[1] - g) * a;
          b += (c[2] - b) * a;
        }
        if (level >= 3 && hash(x, y, seed) > 0.985) {
          const [c, a] = NEBULA[3] as [RGB, number];
          r += (c[0] - r) * a * 2;
          g += (c[1] - g) * a * 2;
          b += (c[2] - b) * a * 2;
        }
      }
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Banded gas giant lit from the top-left, with a tilted ring. Canvas is (2.6r × 1.6r). */
export function paintPlanet(r: number, seed = 3) {
  const W = Math.ceil(r * 2.6);
  const H = Math.ceil(r * 1.6) + 4;
  const cx = W / 2;
  const cy = H / 2;
  const cv = canvas(W, H);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const put = (x: number, y: number, c: RGB) => {
    const i = (y * W + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  };
  const tilt = -0.32;
  const ringAt = (x: number, y: number) => {
    // ring plane: rotate then squash
    const dx = x - cx;
    const dy = y - cy;
    const rx = dx * Math.cos(tilt) - dy * Math.sin(tilt);
    const ry = (dx * Math.sin(tilt) + dy * Math.cos(tilt)) / 0.26;
    const rr = Math.sqrt(rx * rx + ry * ry) / r;
    return { rr, front: ry > 0 };
  };
  const drawRing = (front: boolean) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const { rr, front: f } = ringAt(x + 0.5, y + 0.5);
        if (f !== front || rr < 1.22 || rr > 1.62) continue;
        if (rr > 1.42 && rr < 1.46) continue; // Cassini gap
        const t = 1 - Math.abs(rr - 1.42) / 0.2;
        const lit = x < cx ? 1 : 0;
        const idx = Math.max(0, Math.min(3, Math.floor(t * 2 + lit + bayer(x, y))));
        put(x, y, RING[idx] as RGB);
      }
    }
  };
  drawRing(false);
  const L = [-0.62, -0.48, 0.62];
  const n = PLANET.length - 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lambert = Math.max(0, nx * (L[0] ?? 0) + ny * (L[1] ?? 0) + nz * (L[2] ?? 0));
      const lat = ny * 5 + fbm(nx * 2, ny * 9, seed, 3) * 1.6;
      const stripe = Math.sin(lat * 3.1) * 0.5 + 0.5;
      let p = lambert ** 0.8 * (n - 1.2) + stripe * 1.1;
      if (d2 > 0.86 && lambert > 0.35) p += 1.2; // atmosphere rim
      put(x, y, PLANET[Math.max(0, Math.min(n, edgeDither(p, x, y)))] as RGB);
    }
  }
  drawRing(true);
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Two silhouette ridges with a rim highlight; transparent above. */
export function paintHills(w: number, h: number, seed = 11) {
  const cv = canvas(w, h);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const layers = [
    { base: h * 0.42, amp: h * 0.3, freq: 1 / 90, body: "#12172a", rim: "#333c5f" },
    { base: h * 0.7, amp: h * 0.22, freq: 1 / 60, body: "#0a0d17", rim: "#222843" },
  ];
  layers.forEach((l, li) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(l.base - fbm(x * l.freq, li * 10, seed + li, 3) * l.amp);
      ctx.fillStyle = l.body;
      ctx.fillRect(x, top, 1, h - top);
      ctx.fillStyle = l.rim;
      ctx.fillRect(x, top, 1, 1);
    }
  });
  return cv;
}

export interface Star {
  x: number;
  y: number;
  depth: 0 | 1 | 2;
  sparkle: boolean;
  phase: number;
  speed: number;
}

export function makeStars(w: number, h: number, count: number, seed = 5): Star[] {
  const rnd = rand(seed);
  return Array.from({ length: count }, () => {
    const depth = (rnd() < 0.6 ? 0 : rnd() < 0.75 ? 1 : 2) as Star["depth"];
    return {
      x: rnd() * w,
      y: rnd() * h,
      depth,
      sparkle: depth === 2 && rnd() < 0.5,
      phase: rnd() * Math.PI * 2,
      speed: 0.6 + rnd() * 1.8,
    };
  });
}

const STAR_RAMP = ["#3a4367", "#566c86", "#a8bfd7", "#e6e0ff", "#ffffff"];
const SPARK = ["#73eff7", "#c6fbff"];

/** Draws stars at time `t` (seconds); `drift` is horizontal art pixels per second for depth 0. */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  t: number,
  w: number,
  drift: number,
) {
  for (const s of stars) {
    const x = Math.floor((((s.x - t * drift * (s.depth + 1)) % w) + w) % w);
    const y = Math.floor(s.y);
    const tw = Math.sin(t * s.speed + s.phase) * 0.5 + 0.5;
    const level = Math.min(4, Math.floor(s.depth + tw * 2.2));
    ctx.fillStyle = STAR_RAMP[level] ?? "#fff";
    ctx.fillRect(x, y, 1, 1);
    if (s.sparkle && tw > 0.45) {
      ctx.fillStyle = SPARK[tw > 0.8 ? 1 : 0] ?? "#fff";
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
      if (tw > 0.8) {
        ctx.fillStyle = SPARK[0] ?? "#fff";
        ctx.fillRect(x - 2, y, 1, 1);
        ctx.fillRect(x + 2, y, 1, 1);
        ctx.fillRect(x, y - 2, 1, 1);
        ctx.fillRect(x, y + 2, 1, 1);
      }
    }
  }
}
