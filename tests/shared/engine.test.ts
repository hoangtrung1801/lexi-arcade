import { computeResult, validateEvents } from "@shared/index";
import type { GameConfig, GameWord } from "@shared/types";
import { describe, expect, it } from "vitest";
import { GROUND_Y, WordBlasterEngine } from "@/games/word-blaster/logic/engine";

const words: GameWord[] = ["cat", "dog", "sun", "map"].map((lemma, i) => ({
  id: i + 1,
  lemma,
  meaningVi: lemma,
}));

function make(difficulty: GameConfig["difficulty"] = "easy", seed = 42) {
  let now = 0;
  const clock = () => now;
  const engine = new WordBlasterEngine({ unitId: 1, words, seed, difficulty }, clock);
  const advance = (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      engine.tick();
    }
  };
  return {
    engine,
    advance,
    set: (v: number) => (now = v),
    get now() {
      return now;
    },
  };
}

/** Types out the word that is currently lowest on the screen. */
function shootLowest(engine: WordBlasterEngine, advance: (ms: number) => void) {
  const w = [...engine.active].sort((a, b) => b.y - a.y)[0];
  if (!w) return false;
  for (const ch of w.word.lemma) {
    advance(120);
    engine.type(ch);
  }
  return true;
}

describe("WordBlasterEngine", () => {
  it("spawns words over time and never more than the difficulty allows", () => {
    const g = make("easy");
    g.engine.start();
    g.advance(500);
    expect(g.engine.active.length).toBe(1);
    g.advance(20000);
    expect(g.engine.active.length).toBeLessThanOrEqual(3);
  });

  it("locks onto the first letter and finishes a word", () => {
    const g = make();
    g.engine.start();
    g.advance(500);
    const w = g.engine.active[0];
    expect(w).toBeDefined();
    const lemma = w?.word.lemma ?? "";
    expect(g.engine.type(lemma[0] ?? "")).toBe("correct");
    expect(g.engine.target?.uid).toBe(w?.uid);
    g.advance(100);
    g.engine.type(lemma[1] ?? "");
    g.advance(100);
    expect(g.engine.type(lemma[2] ?? "")).toBe("hit");
    expect(g.engine.hitCount).toBe(1);
    expect(g.engine.score).toBe(30);
    expect(g.engine.target).toBeNull();
  });

  it("a wrong key breaks the combo and is logged", () => {
    const g = make();
    g.engine.start();
    g.advance(500);
    shootLowest(g.engine, g.advance);
    expect(g.engine.combo).toBe(1);
    g.advance(100);
    expect(g.engine.type("#")).toBe("ignored");
    expect(g.engine.type("q")).toBe("wrong");
    expect(g.engine.combo).toBe(0);
    expect(g.engine.events.at(-1)?.type).toBe("wrong");
  });

  it("loses a life when a word reaches the ground and re-queues it", () => {
    const g = make("hard");
    g.engine.start();
    g.advance(20000);
    expect(g.engine.lives).toBeLessThan(4);
    expect(g.engine.events.some((e) => e.type === "miss")).toBe(true);
  });

  it("ends the round as lost after four misses", () => {
    const g = make("hard");
    g.engine.start();
    g.advance(120000);
    expect(g.engine.status).toBe("lost");
    expect(g.engine.result().status).toBe("lost");
    expect(g.engine.result().stars).toBe(0);
  });

  it("pausing freezes time and physics", () => {
    const g = make();
    g.engine.start();
    g.advance(1000);
    const y = g.engine.active[0]?.y;
    const t = g.engine.elapsed();
    g.engine.pause();
    g.advance(5000);
    expect(g.engine.active[0]?.y).toBe(y);
    g.engine.resume();
    expect(g.engine.elapsed() - t).toBeLessThan(40);
  });

  it("a full run's result matches the server-side replay and passes validation", () => {
    const g = make("easy");
    g.engine.start();
    let guard = 0;
    while (g.engine.status === "playing" && guard++ < 5000) {
      g.advance(100);
      if (g.engine.active.length > 0) shootLowest(g.engine, g.advance);
    }
    expect(g.engine.status).toBe("won");
    const res = g.engine.result();
    expect(res.status).toBe("won");
    expect(res.hitWordIds.sort()).toEqual([1, 2, 3, 4]);
    expect(res.score).toBe(g.engine.score);
    expect(computeResult(g.engine.events, words).score).toBe(res.score);
    expect(validateEvents(g.engine.events, words, g.engine.elapsed() + 1000)).toEqual({ ok: true });
    expect(res.stars).toBe(3);
  });

  it("words never go below the ground line without being handled", () => {
    const g = make("hard");
    g.engine.start();
    for (let i = 0; i < 800; i++) {
      g.advance(16);
      for (const w of g.engine.active) expect(w.y).toBeLessThan(GROUND_Y + 1);
    }
  });
});
