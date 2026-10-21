import { dimmed, type Palette, recolor, type Sprite, sprite } from "./pixelart";

/** Placeholder hi-bit sprites (ASCII maps) until the hand-drawn set lands. */

export const OUTLINE = "#0d0e18";

const GOLD: Palette = { w: "#fff3cf", Y: "#ffcd75", y: "#f5a95f", d: "#d9742b", D: "#9e4a3a" };

interface Def {
  rows: string[];
  palette: Palette;
  /** mono icons are tinted with the `color` prop through the "X" key */
  mono?: boolean;
  outline?: boolean;
}

export const SPRITES = {
  heart: {
    rows: [
      ".hh...RR.",
      "hwRR.RRRr",
      "hRRRRRRRr",
      "RRRRRRRrr",
      ".RRRRRrr.",
      "..RRRrd..",
      "...Rrd...",
      "....d....",
    ],
    palette: { w: "#ffffff", h: "#ffc2c2", R: "#f05d6c", r: "#b13e53", d: "#7a1d3f" },
    outline: true,
  },
  star: {
    rows: [
      "....w....",
      "...wYy...",
      "...wYy...",
      "wwwYYYyyd",
      ".wYYYYyd.",
      "..YYYyd..",
      "..YYyyd..",
      ".Yyd.ydd.",
      ".yd...dd.",
    ],
    palette: GOLD,
    outline: true,
  },
  coin: {
    rows: [
      "..wYYy..",
      ".wYYYYy.",
      "wYYdYYyd",
      "wYYdYYyd",
      "YYYdYYyd",
      "YYYdYyyd",
      ".yYYyyd.",
      "..yddD..",
    ],
    palette: GOLD,
    outline: true,
  },
  flame: {
    rows: [
      "...r...",
      "..ro...",
      "..roo..",
      ".rooo.r",
      ".royoor",
      "rooyyor",
      "royywor",
      "royywyo",
      ".ryyyo.",
    ],
    palette: { w: "#fff3cf", y: "#ffcd75", o: "#ef7d57", r: "#f05d6c" },
    outline: true,
  },
  lock: {
    rows: [
      "..sSSSS..",
      ".sS...SS.",
      ".s.....S.",
      ".s.....S.",
      "wYYYYYYYd",
      "YYYYkYYyd",
      "YYYkkkYyd",
      "YYYYkYYyd",
      "YYYYkYyyd",
      "ddddddDDd",
    ],
    palette: { ...GOLD, s: "#c5d6e3", S: "#566c86", k: "#3a1a18" },
    outline: true,
  },
  play: {
    rows: ["X.....", "XXX...", "XXXXX.", "XXXXXX", "XXXXX.", "XXX...", "X....."],
    palette: {},
    mono: true,
  },
  back: {
    rows: [".....X", "...XXX", ".XXXXX", "XXXXXX", ".XXXXX", "...XXX", ".....X"],
    palette: {},
    mono: true,
  },
  pause: {
    rows: ["XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX"],
    palette: {},
    mono: true,
  },
  close: {
    rows: ["XX...XX", "XXX.XXX", ".XXXXX.", "..XXX..", ".XXXXX.", "XXX.XXX", "XX...XX"],
    palette: {},
    mono: true,
  },
  speaker: {
    rows: [
      "....X....",
      "...XX..X.",
      "XXXXX...X",
      "XXXXX.X.X",
      "XXXXX.X.X",
      "XXXXX...X",
      "...XX..X.",
      "....X....",
    ],
    palette: {},
    mono: true,
  },
  note: {
    rows: ["...XXXX", "...X..X", "...X..X", "...X..X", ".XXX.XX", "XXXXXXX", ".XX.XX."],
    palette: {},
    mono: true,
  },
  check: {
    rows: [".....XX", "....XX.", "X..XX..", "XXXX...", ".XX...."],
    palette: {},
    mono: true,
  },
  logo: {
    rows: [
      "..wwwwwwwYY..",
      ".wwYYYYYYYYy.",
      "wwYYYYYYYYYyd",
      "wYYkkYYYYYYyd",
      "wYYkcYYYYYYyd",
      "YYYkcYYYYYYyd",
      "YYYkcYYYYYYyd",
      "YYYkcYYYYYYyd",
      "YYYkcccccYYyd",
      "YYYkkkkkkYyyd",
      "YyYYYYYYYYyyd",
      ".dyyyyyyyyyd.",
      "..dddDDDddd..",
    ],
    palette: { ...GOLD, k: "#1a1d2c", c: "#5a2a4e" },
    outline: true,
  },
  avatar: {
    rows: [
      "....hppP....",
      "..hpppppPP..",
      ".hppppPPPPP.",
      ".pPCccCCVVP.",
      ".pCcCCCCCVP.",
      ".PCCCCCCVVP.",
      ".PPVVVVVVPP.",
      "..PPPPPPPP..",
      "...bBBBBb...",
      ".bBBByYBBBb.",
      "bBBBBYyBBBBb",
      "bBBBBBBBBBBb",
    ],
    palette: {
      h: "#e88ad6",
      p: "#b54fb0",
      P: "#5d275d",
      c: "#c6fbff",
      C: "#73eff7",
      V: "#3b5dc9",
      b: "#55d8f7",
      B: "#41a6f6",
      y: "#ffcd75",
      Y: "#f5a95f",
    },
    outline: true,
  },
  ship: {
    rows: [
      ".........w.........",
      "........wbB........",
      "........bBd........",
      ".......wbBdD.......",
      ".......bcCBd.......",
      "......wbcwCBd......",
      "......bBcCCBd......",
      "......bBCCCdD......",
      ".....wbBBCdddD.....",
      "..r..bBBBBBBdD..R..",
      ".rr.wbBBgGgBBdD.RR.",
      ".rRwbBBgGGGgBBdDRR.",
      "rrRbBBBgGGGgBBBdRRR",
      "rRRbBBBBgGgBBBBdDRR",
      "RdDdBBBBBBBBBBdDDdR",
      ".DkDddBBBBBBBddDkD.",
      "..k..DdddddddD..k..",
      "....kDDyoooyDDk....",
    ],
    palette: {
      w: "#ffffff",
      c: "#c6fbff",
      C: "#73eff7",
      b: "#55d8f7",
      B: "#41a6f6",
      d: "#3b5dc9",
      D: "#29366f",
      k: "#0f1a45",
      r: "#f05d6c",
      R: "#b13e53",
      g: "#c5d6e3",
      G: "#566c86",
      y: "#ffcd75",
      o: "#ef7d57",
    },
    outline: true,
  },
} satisfies Record<string, Def>;

export type SpriteName = keyof typeof SPRITES;

const cache = new Map<string, Sprite>();

export function getSprite(name: SpriteName, color = "#f4f4f4", dim = false): Sprite {
  const key = `${name}|${color}|${dim}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def: Def = SPRITES[name];
  const palette = def.mono ? { X: color } : def.palette;
  let s = sprite(def.rows, palette, def.outline ? OUTLINE : undefined);
  if (dim) s = recolor(s, (c) => (c === OUTLINE ? c : dimmed(c)));
  cache.set(key, s);
  return s;
}
