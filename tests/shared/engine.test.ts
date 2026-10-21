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

/** Types out the right answer to the current question. */
function answer(engine: WordBlasterEngine, advance: (ms: number) => void) {
  const lemma = engine.prompt?.lemma;
  if (!lemma) return false;
  for (const ch of lemma) {
    advance(120);
    engine.type(ch);
  }
  return true;
}

/** A plate that is not the answer. */
const distractor = (engine: WordBlasterEngine) => engine.active.find((w) => !w.correct);

/** Lets words fall until a question is asked and at least one other word is on screen. */
function ready(g: ReturnType<typeof make>) {
  for (let i = 0; i < 400 && !(g.engine.prompt && distractor(g.engine)); i++) g.advance(16);
}

describe("WordBlasterEngine", () => {
  it("drops words one after another and asks for one of them", () => {
    const g = make("normal");
    g.engine.start();
    g.advance(16);
    expect(g.engine.active).toHaveLength(1);
    g.advance(800);
    expect(g.engine.active).toHaveLength(2);
    expect(g.engine.active[0]?.y).toBeGreaterThan(g.engine.active[1]?.y ?? 0);
    // nothing is asked until a word has come out from under the top HUD
    expect(g.engine.prompt).toBeNull();
    g.advance(2500);
    const prompt = g.engine.prompt;
    expect(prompt).not.toBeNull();
    expect(g.engine.active.filter((w) => w.correct).map((w) => w.word.id)).toEqual([prompt?.id]);
    g.advance(20000);
    // never more than the cap at once
    expect(g.engine.active.length).toBeLessThanOrEqual(5);
  });

  it("shooting the asked word scores, leaves the others falling and asks the next at once", () => {
    const g = make();
    g.engine.start();
    ready(g);
    g.advance(3000); // let more words into view so there is a choice for the next question
    const first = g.engine.prompt;
    const others = g.engine.active.filter((w) => !w.correct).map((w) => w.uid);
    const lemma = first?.lemma ?? "";
    expect(g.engine.type(lemma[0] ?? "")).toBe("correct");
    expect(g.engine.target?.correct).toBe(true);
    for (const ch of lemma.slice(1, -1)) g.engine.type(ch);
    expect(g.engine.type(lemma.at(-1) ?? "")).toBe("hit");
    expect(g.engine.hitCount).toBe(1);
    expect(g.engine.score).toBe(30);
    expect(g.engine.active.map((w) => w.uid)).toEqual(others);
    expect(g.engine.prompt).not.toBeNull();
    expect(g.engine.prompt?.id).not.toBe(first?.id);
    expect(g.engine.typed).toBe("");
  });

  it("asks about the falling words in a random order, not the order they fell in", () => {
    const many: GameWord[] = [
      "cat",
      "dog",
      "sun",
      "map",
      "bed",
      "pen",
      "cup",
      "hat",
      "box",
      "egg",
    ].map((lemma, i) => ({ id: i + 1, lemma, meaningVi: lemma }));
    let lowest = 0;
    let asked = 0;
    for (let seed = 1; seed <= 15; seed++) {
      let now = 0;
      const engine = new WordBlasterEngine(
        { unitId: 1, words: many, seed, difficulty: "normal" },
        () => now,
      );
      engine.subscribe((n) => {
        if (n.kind !== "prompt") return;
        const first = [...engine.active].filter((w) => !w.filler).sort((a, b) => b.y - a.y)[0];
        asked++;
        if (first?.word.id === n.word.id) lowest++;
      });
      engine.start();
      let since = 0;
      for (let i = 0; i < 6000 && engine.status === "playing"; i++) {
        now += 16;
        engine.tick();
        if (!engine.prompt) since = now;
        else if (now - since > 2000) {
          for (const ch of engine.prompt.lemma) engine.type(ch);
          since = now;
        }
      }
      expect(engine.status).toBe("won");
    }
    expect(asked).toBeGreaterThan(100);
    // with words picked in drop order this would be ~100%
    expect(lowest / asked).toBeLessThan(0.75);
  });

  it("a key that matches no plate is a wrong key: logged, combo reset, nothing typed", () => {
    const g = make();
    g.engine.start();
    ready(g);
    answer(g.engine, g.advance);
    expect(g.engine.combo).toBe(1);
    ready(g);
    expect(g.engine.type("#")).toBe("ignored");
    expect(g.engine.type("q")).toBe("wrong");
    expect(g.engine.typed).toBe("");
    expect(g.engine.combo).toBe(0);
    expect(g.engine.events.at(-1)?.type).toBe("wrong");
  });

  it("typing a whole wrong answer costs a life but keeps the question", () => {
    const g = make();
    g.engine.start();
    ready(g);
    const asked = g.engine.prompt;
    const bad = distractor(g.engine);
    expect(bad).toBeDefined();
    let out = "";
    for (const ch of bad?.word.lemma ?? "") out = g.engine.type(ch);
    expect(out).toBe("bad");
    expect(g.engine.lives).toBe(3);
    expect(g.engine.prompt).toBe(asked);
    expect(g.engine.active.some((w) => w.uid === bad?.uid)).toBe(false);
    expect(g.engine.typed).toBe("");
    expect(g.engine.events.at(-1)).toMatchObject({ type: "bad", choiceId: bad?.word.id });
  });

  it("backspace takes back a letter for free", () => {
    const g = make();
    g.engine.start();
    ready(g);
    const lemma = g.engine.prompt?.lemma ?? "";
    g.engine.type(lemma[0] ?? "");
    const logged = g.engine.events.length;
    g.engine.erase();
    expect(g.engine.typed).toBe("");
    expect(g.engine.target).toBeNull();
    expect(g.engine.events.length).toBe(logged);
  });

  it("loses a life when the right answer reaches the ground and asks it again later", () => {
    const g = make("hard");
    g.engine.start();
    ready(g);
    const asked = g.engine.prompt;
    g.advance(15000);
    expect(g.engine.lives).toBeLessThan(4);
    expect(g.engine.events.find((e) => e.type === "miss")?.wordId).toBe(asked?.id);
  });

  it("ends the round as lost after four misses", () => {
    const g = make("hard");
    g.engine.start();
    g.advance(120000);
    expect(g.engine.status).toBe("lost");
    expect(g.engine.result().status).toBe("lost");
    expect(g.engine.result().stars).toBe(0);
  });

  it("four wrong answers also end the round", () => {
    const g = make("easy");
    g.engine.start();
    let guard = 0;
    while (g.engine.status === "playing" && guard++ < 50) {
      ready(g);
      const bad = distractor(g.engine);
      for (const ch of bad?.word.lemma ?? "") g.engine.type(ch);
    }
    expect(g.engine.status).toBe("lost");
    expect(g.engine.result()).toMatchObject({ status: "lost", livesLost: 4 });
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

  it("never offers two answers where one is a prefix of the other", () => {
    const tricky: GameWord[] = ["man", "mango", "manner", "dog", "cat", "sun"].map((lemma, i) => ({
      id: i + 1,
      lemma,
      meaningVi: `nghĩa ${i}`,
    }));
    for (let seed = 1; seed < 40; seed++) {
      const engine = new WordBlasterEngine(
        { unitId: 1, words: tricky, seed, difficulty: "hard" },
        () => now,
      );
      let now = 0;
      engine.start();
      for (let i = 0; i < 1500; i++) {
        now += 16;
        engine.tick();
        const lemmas = engine.active.map((w) => w.word.lemma);
        for (const a of lemmas)
          for (const b of lemmas) if (a !== b) expect(a.startsWith(b)).toBe(false);
      }
      const lemmas = engine.active.map((w) => w.word.lemma);
      for (const a of lemmas)
        for (const b of lemmas) if (a !== b) expect(a.startsWith(b)).toBe(false);
    }
  });

  it("a full run's result matches the server-side replay and passes validation", () => {
    const g = make("easy");
    g.engine.start();
    let guard = 0;
    while (g.engine.status === "playing" && guard++ < 5000) {
      g.advance(100);
      if (g.engine.prompt) answer(g.engine, g.advance);
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

  it("plates never go below the ground line without being handled", () => {
    const g = make("hard");
    g.engine.start();
    for (let i = 0; i < 800; i++) {
      g.advance(16);
      for (const w of g.engine.active) expect(w.y).toBeLessThan(GROUND_Y + 1);
    }
  });
});
