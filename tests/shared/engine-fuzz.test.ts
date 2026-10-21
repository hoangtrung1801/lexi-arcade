import { computeResult, validateEvents } from "@shared/index";
import { MAX_LIVES } from "@shared/rules";
import type { Difficulty, GameWord } from "@shared/types";
import { describe, expect, it } from "vitest";
import { GROUND_Y, WordBlasterEngine } from "@/games/word-blaster/logic/engine";

const LEMMAS = [
  "man",
  "mango",
  "manner",
  "dog",
  "cat",
  "car",
  "sun",
  "son",
  "map",
  "bed",
  "pen",
  "egg",
];
const words: GameWord[] = LEMMAS.map((lemma, i) => ({
  id: i + 1,
  lemma,
  // two words share a meaning, like real synonyms in a unit
  meaningVi: lemma === "son" ? "con trai" : lemma === "man" ? "con trai" : `nghĩa ${lemma}`,
}));

/** Tiny deterministic rng for the simulated player. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

/**
 * A sloppy simulated player: reacts after a random delay, sometimes mistypes, sometimes types
 * a wrong answer, sometimes gets distracted. Checks the rules hold at every step.
 */
function play(seed: number, difficulty: Difficulty, skill: number) {
  let now = 0;
  const engine = new WordBlasterEngine({ unitId: 1, words, seed, difficulty }, () => now);
  const r = rng(seed * 7 + 1);
  const lifeLosses: string[] = [];
  engine.subscribe((n) => {
    if (n.kind === "miss" || n.kind === "bad") lifeLosses.push(n.kind);
    if (n.kind === "miss") expect(n.word.correct).toBe(true);
    if (n.kind === "bad") expect(n.word.correct).toBe(false);
    if (n.kind === "prompt") {
      const plate = engine.active.find((a) => a.correct);
      expect(plate?.word.id).toBe(n.word.id);
      expect(plate?.filler).toBe(false);
      expect(plate?.y).toBeGreaterThanOrEqual(70);
    }
  });
  engine.start();
  let plan: string[] = [];
  let nextKeyAt = 0;
  for (let i = 0; i < 40000 && engine.status === "playing"; i++) {
    now += 16;
    const livesBefore = engine.lives;
    const lossesBefore = lifeLosses.length;
    engine.tick();
    // lives only ever go with a miss of the asked word
    expect(livesBefore - engine.lives).toBe(lifeLosses.length - lossesBefore);

    // invariants of the field
    const lemmas = engine.active.map((a) => a.word.lemma);
    for (const a of lemmas)
      for (const b of lemmas) if (a !== b) expect(a.startsWith(b)).toBe(false);
    expect(new Set(engine.active.map((a) => a.word.meaningVi)).size).toBe(engine.active.length);
    expect(engine.active.filter((a) => a.correct).length).toBe(engine.prompt ? 1 : 0);
    for (const a of engine.active) expect(a.y).toBeLessThan(GROUND_Y);
    if (engine.typed)
      expect(engine.active.some((a) => a.word.lemma.startsWith(engine.typed))).toBe(true);

    if (!engine.prompt || now < nextKeyAt) continue;
    if (plan.length === 0) {
      const roll = r();
      const other = engine.active.find((a) => !a.correct && a.y >= 70);
      if (roll > skill + 0.15)
        plan = []; // distracted: wait
      else if (roll > skill && other)
        plan = [...other.word.lemma]; // wrong answer
      else plan = [...engine.prompt.lemma];
      if (r() > skill) plan.splice(1, 0, "q"); // a typo on the way
      nextKeyAt = now + 300 + r() * 1500;
      continue;
    }
    const ch = plan.shift() as string;
    const before = engine.lives;
    const out = engine.type(ch);
    if (out === "bad") expect(engine.lives).toBe(before - 1);
    else expect(engine.lives).toBe(before);
    if (out === "wrong" && engine.typed === "" && ch !== "q") plan = [];
    nextKeyAt = now + 60 + r() * 200;
  }
  return engine;
}

describe("Word Blaster rules under a simulated player", () => {
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    for (const skill of [0.95, 0.75, 0.4]) {
      it(`${difficulty}, skill ${skill}: every round ends, and the server agrees with the client`, () => {
        for (let seed = 1; seed <= 12; seed++) {
          const engine = play(seed, difficulty, skill);
          expect(["won", "lost"]).toContain(engine.status);
          const res = engine.result();
          expect(res.status).toBe(engine.status);
          expect(res.score).toBe(engine.score);
          expect(res.maxCombo).toBe(engine.maxCombo);
          expect(res.livesLost).toBe(MAX_LIVES - engine.lives);
          expect(computeResult(engine.events, words)).toEqual(res);
          expect(validateEvents(engine.events, words, engine.elapsed() + 1000)).toEqual({
            ok: true,
          });
          if (engine.status === "won") expect(res.hitWordIds.length).toBe(words.length);
          else expect(engine.lives).toBe(0);
        }
      });
    }
  }
});
