import { type FrameSpec, frameSprite, mix, toCanvas } from "./pixelart";

/** CSS pixels per art pixel for all UI chrome (fonts are drawn at 2x too). */
export const PX = 2;

const OUTLINE = "#0d0e18";

export interface Tone {
  hi: string;
  shade: string;
  bands: string[];
  lip: string;
}

export const TONES = {
  gold: {
    hi: "#fff3cf",
    shade: "#e08c3c",
    bands: ["#ffe399", "#ffd77a", "#ffcd75", "#fbbb4e", "#f5aa3f", "#ee9835"],
    lip: "#9e4a3a",
  },
  blue: {
    hi: "#c6fbff",
    shade: "#3b5dc9",
    bands: ["#8fefff", "#73eff7", "#55d8f7", "#45c5f2", "#3fb1ea", "#3a95e0"],
    lip: "#29366f",
  },
  green: {
    hi: "#e6ffb8",
    shade: "#2c9a5c",
    bands: ["#c8f98d", "#a7f070", "#9eea6c", "#87dd62", "#72cf5c", "#5fc256"],
    lip: "#17574a",
  },
  red: {
    hi: "#ffb8b0",
    shade: "#7a1d3f",
    bands: ["#ff7f86", "#f86873", "#f05d6c", "#e04b62", "#d13f5a", "#b13e53"],
    lip: "#5c1532",
  },
  grey: {
    hi: "#8697b7",
    shade: "#23293f",
    bands: ["#525c86", "#4c557c", "#454e73", "#3f486b", "#3a4262", "#343c5a"],
    lip: "#1f2238",
  },
  dark: {
    hi: "#3e476b",
    shade: "#0f121f",
    bands: ["#21273d", "#1f2439", "#1d2235", "#1a1f32", "#1f2238", "#171b2b"],
    lip: "#0d0e18",
  },
} satisfies Record<string, Tone>;
export type ToneName = keyof typeof TONES;

const gradient = (from: string, to: string, n: number) =>
  Array.from({ length: n }, (_, i) => mix(from, to, i / (n - 1)));

const GEM: [number, number, string][] = [
  [2, 2, "#c6fbff"],
  [3, 2, "#73eff7"],
  [2, 3, "#73eff7"],
  [3, 3, "#3b5dc9"],
];

/** Every frame the UI uses. Each becomes a `.hb-<name>` class with a border-image. */
export const FRAMES: Record<string, FrameSpec> = {
  panel: {
    c: 6,
    cut: 2,
    outline: OUTLINE,
    rings: [
      ["#566c86", "#2b324c"],
      ["#3e476b", "#21273d"],
      ["#151827", "#151827"],
    ],
    bands: gradient("#2e344f", "#1f2437", 10),
  },
  ornate: {
    c: 7,
    cut: 3,
    outline: OUTLINE,
    rings: [
      ["#ffeab0", "#9e4a3a"],
      ["#f5a95f", "#6e3424"],
      ["#3a1a18", "#2a1414"],
      ["#4b547b", "#1b2032"],
    ],
    bands: gradient("#303756", "#181c2d", 12),
    accents: GEM,
  },
  inset: {
    c: 3,
    cut: 1,
    outline: "#0a0c17",
    rings: [["#0d101c", "#3a4367"]],
    bands: gradient("#101320", "#161a29", 4),
  },
  hud: {
    c: 4,
    cut: 2,
    outline: "#0c0a1acc",
    rings: [
      ["#5a4d92cc", "#241e44cc"],
      ["#120e26b3", "#120e26b3"],
    ],
    bands: ["#1b1636b3", "#191433b3", "#171230b3", "#15102db3"],
  },
};

for (const [name, t] of Object.entries(TONES) as [ToneName, Tone][]) {
  const base = { c: 4, cut: 2, outline: OUTLINE, bands: t.bands, lip: 2, lipColor: t.lip };
  FRAMES[`btn-${name}`] = { ...base, rings: [[t.hi, t.shade]] };
  FRAMES[`btn-${name}-down`] = { ...base, rings: [[t.shade, t.hi]], pressed: true };
  FRAMES[`chip-${name}`] = {
    c: 3,
    cut: 1,
    outline: OUTLINE,
    rings: [[t.hi, t.shade]],
    bands: t.bands.slice(1, 5),
  };
}

function rule(name: string, f: FrameSpec, selector = `.hb-${name}`) {
  const url = toCanvas(frameSprite(f)).toDataURL();
  const w = f.c * PX;
  return `${selector}{border-style:solid;border-width:${w}px;border-image:url(${url}) ${f.c} fill / ${w}px stretch;}`;
}

let installed = false;

/** Injects the generated frame classes once, before the first render. */
export function installFrames() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const css: string[] = [];
  for (const [name, f] of Object.entries(FRAMES)) {
    if (name.endsWith("-down")) continue;
    css.push(rule(name, f));
    const down = FRAMES[`${name}-down`];
    if (down) {
      css.push(
        rule(
          `${name}-down`,
          down,
          `.hb-${name}:active:not(:disabled):not([aria-disabled="true"]),.hb-${name}[data-pressed="true"]`,
        ),
      );
    }
  }
  const style = document.createElement("style");
  style.dataset.frames = "";
  style.textContent = css.join("\n");
  document.head.appendChild(style);
}
