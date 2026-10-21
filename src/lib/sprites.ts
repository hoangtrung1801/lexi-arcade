import { dimmed, type Palette, recolor, type Sprite, sprite } from "./pixelart";

/** Placeholder hi-bit sprites (ASCII maps) until the hand-drawn set lands. */

export const OUTLINE = "#0c0a1a";

const GOLD: Palette = { w: "#fff6c4", Y: "#ffd866", y: "#f7b538", d: "#d9822b", D: "#a35a2a" };

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
    palette: { w: "#ffffff", h: "#ffc2c2", R: "#f05d6c", r: "#c43356", d: "#7a1d3f" },
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
    palette: { w: "#fff6c4", y: "#ffd866", o: "#ff9d4f", r: "#f05d6c" },
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
    palette: { ...GOLD, s: "#cfc8ef", S: "#6a5c9e", k: "#3a1a18" },
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
    palette: { ...GOLD, k: "#2a1630", c: "#5a2a4e" },
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
      P: "#7d2f86",
      c: "#c2f4ff",
      C: "#6fd0ff",
      V: "#2f5bd0",
      b: "#55bdf7",
      B: "#3f8ff0",
      y: "#ffd866",
      Y: "#f7b538",
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
      c: "#c2f4ff",
      C: "#6fd0ff",
      b: "#55bdf7",
      B: "#3f8ff0",
      d: "#2f5bd0",
      D: "#1d3383",
      k: "#0f1a45",
      r: "#f05d6c",
      R: "#c43356",
      g: "#cfc8ef",
      G: "#6a5c9e",
      y: "#ffd866",
      o: "#ff9d4f",
    },
    outline: true,
  },
} satisfies Record<string, Def>;

export type SpriteName = keyof typeof SPRITES;

const cache = new Map<string, Sprite>();

export function getSprite(name: SpriteName, color = "#f6f1ff", dim = false): Sprite {
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
