import {
  calcStars,
  calcWpm,
  comboMultiplier,
  computeResult,
  type GameEvent,
  type GameWord,
  validateEvents,
  wordScore,
} from "@shared/index";
import { describe, expect, it } from "vitest";

const words: GameWord[] = [
  { id: 1, lemma: "cat", meaningVi: "con mèo" },
  { id: 2, lemma: "dog", meaningVi: "con chó" },
];

function type(wordId: number, lemma: string, t0: number): GameEvent[] {
  const evs: GameEvent[] = [];
  for (let i = 0; i < lemma.length; i++) evs.push({ t: t0 + i * 200, type: "correct", wordId });
  evs.push({ t: t0 + lemma.length * 200, type: "hit", wordId });
  return evs;
}

describe("scoring", () => {
  it("caps combo multiplier at x3", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(100)).toBe(3);
  });

  it("scores a word as 10 x length x multiplier", () => {
    expect(wordScore(3, 0)).toBe(30);
    expect(wordScore(3, 10)).toBe(60);
  });

  it("wins a clean round with 3 stars", () => {
    const events = [...type(1, "cat", 1000), ...type(2, "dog", 3000)];
    const r = computeResult(events, words);
    expect(r.status).toBe("won");
    expect(r.score).toBe(30 + 33);
    expect(r.accuracy).toBe(1);
    expect(r.maxCombo).toBe(2);
    expect(r.stars).toBe(3);
    expect(r.cleanWordIds).toEqual([1, 2]);
  });

  it("a wrong key resets the combo and lowers accuracy", () => {
    const events: GameEvent[] = [
      ...type(1, "cat", 1000),
      { t: 2500, type: "wrong", wordId: 2 },
      ...type(2, "dog", 3000),
    ];
    const r = computeResult(events, words);
    expect(r.score).toBe(30 + 30);
    expect(r.cleanWordIds).toEqual([1]);
    expect(r.accuracy).toBeCloseTo(6 / 7);
    expect(r.stars).toBe(1);
  });

  it("loses after 4 misses and awards no stars", () => {
    const events: GameEvent[] = [1, 2, 3, 4].map((n) => ({
      t: n * 1000,
      type: "miss" as const,
      wordId: 1,
    }));
    const r = computeResult(events, words);
    expect(r.status).toBe("lost");
    expect(r.stars).toBe(0);
    expect(r.livesLost).toBe(4);
  });

  it("a wrong answer costs a life, resets the combo and keeps the word out of the clean list", () => {
    const events: GameEvent[] = [
      ...type(1, "cat", 1000),
      { t: 2000, type: "bad", wordId: 2, choiceId: 1 },
      ...type(2, "dog", 3000),
    ];
    const r = computeResult(events, words);
    expect(r.livesLost).toBe(1);
    expect(r.score).toBe(30 + 30);
    expect(r.cleanWordIds).toEqual([1]);
  });

  it("ignores duplicate hits", () => {
    const events: GameEvent[] = [...type(1, "cat", 1000), { t: 2000, type: "hit", wordId: 1 }];
    expect(computeResult(events, words).hitWordIds).toEqual([1]);
  });

  it("calcStars / calcWpm", () => {
    expect(calcStars("won", 0.96, 0)).toBe(3);
    expect(calcStars("won", 0.96, 1)).toBe(2);
    expect(calcStars("won", 0.5, 0)).toBe(1);
    expect(calcStars("lost", 1, 0)).toBe(0);
    expect(calcWpm(300, 60000)).toBe(60);
  });
});

describe("validateEvents", () => {
  it("accepts a plausible log", () => {
    const events = [...type(1, "cat", 1000), ...type(2, "dog", 3000)];
    expect(validateEvents(events, words, 10000).ok).toBe(true);
  });

  it("rejects unknown words", () => {
    const events: GameEvent[] = [{ t: 100, type: "hit", wordId: 99 }];
    expect(validateEvents(events, words, 10000)).toEqual({ ok: false, reason: "unknown-word" });
  });

  it("accepts keys handled back to back after the page stutters", () => {
    // 5 keys pressed during a freeze arrive a fraction of a millisecond apart
    const events: GameEvent[] = [
      ...type(1, "cat", 1000),
      { t: 3000, type: "correct", wordId: 2 },
      { t: 3000.2, type: "correct", wordId: 2 },
      { t: 3000.3, type: "correct", wordId: 2 },
      { t: 3000.3, type: "hit", wordId: 2 },
    ];
    expect(validateEvents(events, words, 10000)).toEqual({ ok: true });
  });

  it("rejects more keys in one second than a human can type", () => {
    const events: GameEvent[] = Array.from({ length: 31 }, (_, i) => ({
      t: 1000 + i * 30,
      type: "wrong" as const,
      wordId: 1,
    }));
    expect(validateEvents(events, words, 10000)).toEqual({ ok: false, reason: "keys-too-fast" });
    expect(validateEvents(events.slice(0, 30), words, 10000)).toEqual({ ok: true });
  });

  it("rejects a wrong answer that names an unknown word or the asked word", () => {
    expect(
      validateEvents([{ t: 100, type: "bad", wordId: 1, choiceId: 99 }], words, 10000),
    ).toEqual({ ok: false, reason: "bad-choice" });
    expect(validateEvents([{ t: 100, type: "bad", wordId: 1, choiceId: 1 }], words, 10000)).toEqual(
      { ok: false, reason: "bad-choice" },
    );
  });

  it("rejects a hit with no typing", () => {
    const events: GameEvent[] = [{ t: 100, type: "hit", wordId: 1 }];
    expect(validateEvents(events, words, 10000)).toEqual({
      ok: false,
      reason: "hit-without-typing",
    });
  });

  it("rejects superhuman typing speed", () => {
    const events: GameEvent[] = [];
    for (let i = 0; i < 400; i++) events.push({ t: 1000 + i * 35, type: "correct", wordId: 1 });
    expect(validateEvents(events, words, 60000)).toEqual({ ok: false, reason: "wpm-too-high" });
  });

  it("rejects events longer than the wall clock", () => {
    const events = type(1, "cat", 60000);
    expect(validateEvents(events, words, 5000)).toEqual({
      ok: false,
      reason: "events-longer-than-session",
    });
  });

  it("rejects non-monotonic time", () => {
    const events: GameEvent[] = [
      { t: 500, type: "correct", wordId: 1 },
      { t: 100, type: "correct", wordId: 1 },
    ];
    expect(validateEvents(events, words, 10000)).toEqual({
      ok: false,
      reason: "time-not-monotonic",
    });
  });
});
