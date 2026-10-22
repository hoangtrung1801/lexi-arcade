import { computeSpellResult, spellPlan, validateSpell } from "@shared/spell";
import type { GameConfig, GameWord, SpellEvent } from "@shared/types";
import { describe, expect, it } from "vitest";
import { SpellEngine } from "@/games/spell-dungeon/engine";

const LEMMAS = ["daughter", "husband", "neighbour", "teenager", "cousin", "married", "partner"];
const LEMMAS2 = ["uncle", "aunt", "parent", "child", "family", "wedding"];
const words: GameWord[] = [...LEMMAS, ...LEMMAS2].map((lemma, i) => ({
  id: i + 1,
  lemma,
  meaningVi: `nghĩa ${lemma}`,
}));

function make(opts: Partial<GameConfig & { dueWordIds: number[] }> = {}) {
  let now = 0;
  const engine = new SpellEngine(
    { unitId: 1, words, seed: 7, difficulty: "normal", ...opts },
    () => now,
  );
  const advance = (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      engine.tick();
    }
  };
  return {
    engine,
    advance,
    get now() {
      return now;
    },
  };
}

/** Plays the floor perfectly: types every word, one letter each 100 ms. */
function clear(engine: SpellEngine, advance: (ms: number) => void) {
  for (let guard = 0; guard < 2000 && engine.status === "playing"; guard++) {
    advance(100);
    if (engine.busy) continue;
    const w =
      engine.stage === "mob"
        ? engine.mobs.find((m) => m.alive && engine.elapsed() >= m.startAt)?.word
        : engine.current;
    if (!w) continue;
    const ch = w.lemma[engine.typed.length];
    if (ch) engine.type(ch);
  }
}

describe("spellPlan", () => {
  it("deals every word once, doors from unit words, due words to the boss", () => {
    const due = new Set([12, 13]);
    const plan = spellPlan(words, 3, due);
    const all = [...plan.doors, ...plan.waves.flat(), ...plan.boss].map((w) => w.id);
    expect(all.sort((a, b) => a - b)).toEqual(words.map((w) => w.id));
    expect(plan.doors).toHaveLength(4);
    expect(plan.doors.some((w) => due.has(w.id))).toBe(false);
    for (const id of due) expect(plan.boss.map((w) => w.id)).toContain(id);
    expect(plan.boss.length).toBeLessThanOrEqual(6);
    for (const wave of plan.waves) expect(wave.length).toBeLessThanOrEqual(3);
  });

  it("is the same for the same seed", () => {
    expect(spellPlan(words, 9)).toEqual(spellPlan(words, 9));
  });

  it("never puts a word and its prefix in one wave", () => {
    const clash = ["car", "card", "care", "cart", "cat", "dog", "do", "door", "a", "an", "and"].map(
      (lemma, i) => ({ id: i + 1, lemma, meaningVi: lemma }),
    );
    for (let seed = 0; seed < 30; seed++) {
      for (const wave of spellPlan(clash, seed).waves) {
        for (const a of wave)
          for (const b of wave) if (a !== b) expect(a.lemma.startsWith(b.lemma)).toBe(false);
      }
    }
  });

  it("copes with tiny units", () => {
    const one = spellPlan(words.slice(0, 1), 1);
    expect(one.doors).toHaveLength(0);
    expect(one.boss).toHaveLength(1);
  });
});

describe("SpellEngine", () => {
  it("clears a floor and the server agrees", () => {
    const game = make({ dueWordIds: [12, 13] });
    const { engine, advance } = game;
    engine.start();
    clear(engine, advance);
    expect(engine.status).toBe("over");
    expect(engine.won).toBe(true);
    const r = engine.result();
    expect(r.status).toBe("won");
    expect(r.stars).toBe(3);
    expect(r.hitWordIds).toHaveLength(words.length);
    expect(r.missedWordIds).toEqual([]);
    expect(validateSpell(engine.events, engine.words, game.now + 1000)).toEqual({ ok: true });
  });

  it("rejects wrong letters without advancing", () => {
    const { engine, advance } = make();
    engine.start();
    advance(100);
    const w = engine.current;
    if (!w) throw new Error("no door");
    engine.type(w.lemma[0] === "z" ? "y" : "z");
    expect(engine.typed).toBe("");
    expect(engine.combo).toBe(0);
    expect(engine.events.at(-1)?.type).toBe("wrong");
  });

  it("monsters that reach the hero cost hearts, and four hurts lose the floor", () => {
    const { engine, advance } = make();
    engine.start();
    // open the doors, then stand still
    for (let guard = 0; guard < 500 && engine.stage === "door"; guard++) {
      advance(100);
      const w = engine.current;
      if (!engine.busy && w) engine.type(w.lemma[engine.typed.length] ?? "");
    }
    expect(engine.stage).toBe("mob");
    advance(120_000, 50);
    expect(engine.status).toBe("over");
    expect(engine.won).toBe(false);
    expect(engine.hearts).toBe(0);
    const r = engine.result();
    expect(r.status).toBe("lost");
    expect(r.stars).toBe(0);
    expect(r.livesLost).toBe(4);
    expect(r.missedWordIds.length).toBeGreaterThan(0);
  });

  it("hints show the next letter and mark the word for review", () => {
    const { engine, advance } = make();
    engine.start();
    advance(100);
    const w = engine.current;
    if (!w) throw new Error("no door");
    engine.hint();
    engine.hint();
    engine.hint();
    engine.hint();
    expect(engine.shown(w)).toBe(4);
    clear(engine, advance);
    const r = engine.result();
    expect(r.missedWordIds).toContain(w.id);
    expect(r.cleanWordIds).not.toContain(w.id);
  });

  it("hard has no hints", () => {
    const { engine, advance } = make({ difficulty: "hard" });
    engine.start();
    advance(100);
    engine.hint();
    expect(engine.events.some((e) => e.type === "reveal")).toBe(false);
  });

  it("pausing stops the monsters", () => {
    const { engine, advance } = make();
    engine.start();
    for (let guard = 0; guard < 500 && engine.stage === "door"; guard++) {
      advance(100);
      const w = engine.current;
      if (!engine.busy && w) engine.type(w.lemma[engine.typed.length] ?? "");
    }
    advance(3000);
    engine.pause();
    const before = engine.elapsed();
    advance(60_000);
    expect(engine.elapsed()).toBe(before);
    expect(engine.hearts).toBe(4);
  });
});

describe("validateSpell", () => {
  const ev = (t: number, type: SpellEvent["type"], wordId = 1): SpellEvent => ({ t, type, wordId });

  it("refuses words finished without typing", () => {
    const events = [ev(100, "correct"), ev(200, "done")];
    expect(validateSpell(events, words, 5000).ok).toBe(false);
  });

  it("refuses unknown words and finishing a word twice", () => {
    expect(validateSpell([ev(100, "correct", 999)], words, 5000).ok).toBe(false);
    const w = words[4] as GameWord; // cousin
    const keys = [...w.lemma].map((_, i) => ev(100 + i * 150, "correct", w.id));
    const twice = [
      ...keys,
      ev(1200, "done", w.id),
      ...keys.map((k) => ({ ...k, t: k.t + 1200 })),
      ev(2400, "done", w.id),
    ];
    expect(validateSpell(twice, words, 5000)).toEqual({ ok: false, reason: "word-already-done" });
  });

  it("refuses more hurts than hearts", () => {
    const events = [1, 2, 3, 4, 5].map((i) => ev(i * 1000, "hurt"));
    expect(validateSpell(events, words, 10_000)).toEqual({ ok: false, reason: "too-many-hurts" });
  });

  it("scores nothing past the last heart", () => {
    const hurts = [1, 2, 3, 4].map((i) => ev(i * 1000, "hurt"));
    const r = computeSpellResult([...hurts, ev(5000, "correct"), ev(5100, "done")], words);
    expect(r.status).toBe("lost");
    expect(r.hitWordIds).toEqual([]);
  });
});
