import { type FrameSpec, frameSprite, mix, toCanvas } from "./pixelart";

/** CSS pixels per art pixel for all UI chrome (fonts are drawn at 2x too). */
export const PX = 2;

const OUTLINE = "#0c0a1a";

export interface Tone {
  hi: string;
  shade: string;
  bands: string[];
  lip: string;
}

export const TONES = {
  gold: {
    hi: "#fff6c4",
    shade: "#e09a3c",
    bands: ["#ffeb99", "#ffe27a", "#ffd866", "#fbc94e", "#f5b93f", "#eea735"],
    lip: "#a35a2a",
  },
  blue: {
    hi: "#c2f4ff",
    shade: "#2f5bd0",
    bands: ["#8fdcff", "#6fd0ff", "#55bdf7", "#45a8f2", "#3f95ea", "#3a84e0"],
    lip: "#1d3383",
  },
  green: {
    hi: "#e6ffb8",
    shade: "#2c9a5c",
    bands: ["#c8f98d", "#b4f57a", "#9eea6c", "#87dd62", "#72cf5c", "#5fc256"],
    lip: "#17574a",
  },
  red: {
    hi: "#ffb8b0",
    shade: "#7a1d3f",
    bands: ["#ff7f86", "#f86873", "#f05d6c", "#e04b62", "#d13f5a", "#c43356"],
    lip: "#5c1532",
  },
  grey: {
    hi: "#8a7dc0",
    shade: "#241e44",
    bands: ["#544890", "#4d4286", "#463c7c", "#403773", "#3a326a", "#342d61"],
    lip: "#1a1533",
  },
  dark: {
    hi: "#3f3574",
    shade: "#100c22",
    bands: ["#221c42", "#201a3e", "#1e183a", "#1c1636", "#1a1533", "#18132f"],
    lip: "#0c0a1a",
  },
} satisfies Record<string, Tone>;
export type ToneName = keyof typeof TONES;

const gradient = (from: string, to: string, n: number) =>
  Array.from({ length: n }, (_, i) => mix(from, to, i / (n - 1)));

const GEM: [number, number, string][] = [
  [2, 2, "#c2f4ff"],
  [3, 2, "#6fd0ff"],
  [2, 3, "#6fd0ff"],
  [3, 3, "#2f5bd0"],
];

/** Every frame the UI uses. Each becomes a `.hb-<name>` class with a border-image. */
export const FRAMES: Record<string, FrameSpec> = {
  panel: {
    c: 6,
    cut: 2,
    outline: OUTLINE,
    rings: [
      ["#6a5c9e", "#2c2552"],
      ["#3f3574", "#221c42"],
      ["#15112b", "#15112b"],
    ],
    bands: gradient("#2e2756", "#1f1a3c", 10),
  },
  ornate: {
    c: 7,
    cut: 3,
    outline: OUTLINE,
    rings: [
      ["#fff1b0", "#a35a2a"],
      ["#f7b538", "#6e3424"],
      ["#3a1a18", "#2a1414"],
      ["#4c4185", "#1c1736"],
    ],
    bands: gradient("#31285e", "#191431", 12),
    accents: GEM,
  },
  inset: {
    c: 3,
    cut: 1,
    outline: "#09071a",
    rings: [["#0d0a1f", "#3a3170"]],
    bands: gradient("#100d23", "#16122d", 4),
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
