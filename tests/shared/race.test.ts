import {
  computeRaceResult,
  type GameWord,
  ghostAt,
  parMs,
  type RaceEvent,
  raceGhost,
  validateRace,
} from "@shared/index";
import { describe, expect, it } from "vitest";
import { RaceEngine } from "../../src/games/ghost-race/engine";

const words: GameWord[] = [
  { id: 1, lemma: "cat", meaningVi: "con mèo" },
  { id: 2, lemma: "dog", meaningVi: "con chó" },
];

function type(wordId: number, lemma: string, t0: number, step = 250): RaceEvent[] {
  const evs: RaceEvent[] = [];
  for (let i = 0; i < lemma.length; i++) evs.push({ t: t0 + i * step, type: "correct", wordId });
  evs.push({ t: t0 + (lemma.length - 1) * step, type: "done", wordId });
  return evs;
}

describe("ghost race scoring", () => {
  it("par time grows with the track and shrinks with difficulty", () => {
    expect(parMs(words, "easy")).toBeGreaterThan(parMs(words, "hard"));
  });

  it("a clean race under par earns 3 stars and a time bonus", () => {
    const events = [...type(1, "cat", 500), ...type(2, "dog", 1500)];
    const r = computeRaceResult(events, words, "normal");
    expect(r.status).toBe("won");
    expect(r.stars).toBe(3);
    expect(r.accuracy).toBe(1);
    expect(r.cleanWordIds).toEqual([1, 2]);
    expect(r.score).toBeGreaterThan(60);
  });

  it("a slow race still finishes, with 1 star", () => {
    const par = parMs(words, "normal");
    const events = [...type(1, "cat", 500, par / 4), ...type(2, "dog", par, par / 4)];
    const r = computeRaceResult(events, words, "normal");
    expect(r.status).toBe("won");
    expect(r.stars).toBe(1);
  });

  it("revealing half a word counts it as missed", () => {
    const events: RaceEvent[] = [
      { t: 4000, type: "reveal", wordId: 1 },
      { t: 8000, type: "reveal", wordId: 1 },
      ...type(1, "cat", 8200),
      ...type(2, "dog", 9500),
    ];
    const r = computeRaceResult(events, words, "normal");
    expect(r.missedWordIds).toEqual([1]);
    expect(r.cleanWordIds).toEqual([2]);
  });

  it("an unfinished race is lost", () => {
    const r = computeRaceResult(type(1, "cat", 500), words, "normal");
    expect(r.status).toBe("lost");
    expect(r.stars).toBe(0);
  });

  it("records and replays a ghost", () => {
    const events = [...type(1, "cat", 500), ...type(2, "dog", 1500)];
    const points = raceGhost(events, words);
    expect(points.at(-1)).toEqual([2000, 1]);
    expect(ghostAt(points, 0)).toBe(0);
    expect(ghostAt(points, 99999)).toBe(1);
    const mid = ghostAt(points, 1500);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });
});

describe("ghost race validation", () => {
  const good = [...type(1, "cat", 500), ...type(2, "dog", 1500)];
  it("accepts a real race", () => {
    expect(validateRace(good, words, 5000)).toEqual({ ok: true });
  });
  it("rejects a word finished without typing", () => {
    expect(validateRace([{ t: 500, type: "done", wordId: 1 }], words, 5000).ok).toBe(false);
  });
  it("rejects unknown words and too many keys", () => {
    expect(validateRace([{ t: 500, type: "correct", wordId: 9 }], words, 5000)).toEqual({
      ok: false,
      reason: "unknown-word",
    });
    const extra: RaceEvent[] = [
      ...type(1, "cat", 500).slice(0, 3),
      { t: 1300, type: "correct", wordId: 1 },
    ];
    expect(validateRace(extra, words, 5000)).toEqual({ ok: false, reason: "too-many-keys" });
  });
  it("rejects inhuman speed", () => {
    const long: GameWord[] = [
      { id: 3, lemma: "pneumonoultramicroscopicsilicovolcanoconiosis", meaningVi: "bệnh bụi phổi" },
    ];
    expect(validateRace(type(3, long[0]?.lemma ?? "", 1, 20), long, 5000).ok).toBe(false);
  });
});

describe("race engine", () => {
  function setup() {
    let now = 0;
    const e = new RaceEngine({ unitId: 1, seed: 7, difficulty: "normal", words }, () => now);
    e.start();
    return { e, at: (t: number) => (now = t) };
  }

  it("rejects a wrong letter and finishes after typing every word", () => {
    const { e, at } = setup();
    at(300);
    e.type("z");
    expect(e.typed).toBe("");
    expect(e.combo).toBe(0);
    let t = 400;
    for (const w of [...e.words]) {
      for (const c of w.lemma) {
        t += 200;
        at(t);
        e.type(c);
      }
    }
    expect(e.status).toBe("over");
    expect(e.progress).toBe(1);
    const r = e.result();
    expect(r.status).toBe("won");
    expect(validateRace(e.events, words, t + 1000)).toEqual({ ok: true });
  });

  it("reveals a letter when the player is stuck", () => {
    const { e, at } = setup();
    at(4100);
    e.tick();
    expect(e.revealed).toBe(1);
    at(4200);
    e.tick();
    expect(e.revealed).toBe(1);
  });
});
