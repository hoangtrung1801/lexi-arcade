import {
  computeTrainResult,
  type Sentence,
  sentenceParts,
  type TrainEvent,
  validateTrain,
} from "@shared/index";
import { describe, expect, it } from "vitest";
import { crateKey, TrainEngine } from "../../src/games/sentence-express/engine";

const sentences: Sentence[] = [
  { id: 1, wordId: 10, en: "I have a cat.", vi: "Tôi có một con mèo." },
  { id: 2, wordId: 20, en: "Is it an apple?", vi: "Đó có phải quả táo không?" },
];
const ok = (id: number, t: number): TrainEvent => ({
  t,
  type: "submit",
  sentenceId: id,
  answer: sentenceParts(sentences.find((s) => s.id === id)?.en ?? "").words,
});

describe("sentence parts", () => {
  it("keeps the final punctuation off the crates", () => {
    expect(sentenceParts("I have a cat.")).toEqual({ words: ["I", "have", "a", "cat"], end: "." });
    expect(sentenceParts("Is it an apple?").end).toBe("?");
    expect(sentenceParts("Don't stop, please!").words).toEqual(["Don't", "stop,", "please"]);
  });
});

describe("sentence express scoring", () => {
  it("a clean run wins with 3 stars", () => {
    const r = computeTrainResult([ok(1, 3000), ok(2, 7000)], sentences);
    expect(r.status).toBe("won");
    expect(r.stars).toBe(3);
    expect(r.hitWordIds).toEqual([10, 20]);
    expect(r.cleanWordIds).toEqual([10, 20]);
  });

  it("a wrong train costs a life; a hint halves the points", () => {
    const wrong: TrainEvent = {
      t: 2000,
      type: "submit",
      sentenceId: 1,
      answer: ["have", "I", "a", "cat"],
    };
    const hint: TrainEvent = { t: 5000, type: "hint", sentenceId: 2 };
    const clean = computeTrainResult([ok(1, 3000), ok(2, 7000)], sentences);
    const r = computeTrainResult([wrong, ok(1, 3000), hint, ok(2, 7000)], sentences);
    expect(r.livesLost).toBe(1);
    expect(r.stars).toBe(2);
    expect(r.score).toBeLessThan(clean.score);
    expect(r.cleanWordIds).toEqual([]);
  });

  it("three wrong trains end the round", () => {
    const wrong = (t: number): TrainEvent => ({
      t,
      type: "submit",
      sentenceId: 1,
      answer: ["a", "have", "I", "cat"],
    });
    const r = computeTrainResult([wrong(1000), wrong(2000), wrong(3000)], sentences);
    expect(r.status).toBe("lost");
    expect(r.missedWordIds).toEqual([10]);
  });
});

describe("sentence express validation", () => {
  it("accepts a real run", () => {
    expect(validateTrain([ok(1, 3000), ok(2, 7000)], sentences, 9000)).toEqual({ ok: true });
  });
  it("rejects answers that are not the sentence's words", () => {
    const ev: TrainEvent = {
      t: 3000,
      type: "submit",
      sentenceId: 1,
      answer: ["I", "have", "a", "dog"],
    };
    expect(validateTrain([ev], sentences, 9000)).toEqual({
      ok: false,
      reason: "answer-not-the-sentence",
    });
  });
  it("rejects replaying a solved sentence and bot speed", () => {
    expect(validateTrain([ok(1, 3000), ok(1, 4000)], sentences, 9000).ok).toBe(false);
    expect(validateTrain([ok(1, 10), ok(2, 20)], sentences, 9000)).toEqual({
      ok: false,
      reason: "too-fast",
    });
  });
});

describe("train engine", () => {
  function setup() {
    let now = 0;
    const e = new TrainEngine(
      { unitId: 1, seed: 3, difficulty: "normal", words: [], sentences },
      () => now,
    );
    e.start();
    return { e, at: (t: number) => (now = t) };
  }

  it("never hands out the sentence in order", () => {
    const { e } = setup();
    expect(e.crates.map((c) => c.text).join(" ")).not.toBe(e.parts.words.join(" "));
  });

  it("typing loads crates, a/an waits for Space, and a full train departs", () => {
    const { e, at } = setup();
    let t = 0;
    while (e.status === "playing") {
      for (const w of e.parts.words) {
        for (const c of crateKey(w)) e.type(c);
        if (e.buffer) e.type(" ");
      }
      expect(e.answer()).toEqual(e.parts.words);
      t += 2000;
      at(t);
      e.enter();
      expect(e.departing).toBe(true);
      e.next();
    }
    const r = e.result();
    expect(r.status).toBe("won");
    expect(r.stars).toBe(3);
    expect(validateTrain(e.events, sentences, t + 1000)).toEqual({ ok: true });
  });

  it("a wrong train marks the wrong wagons and costs coal", () => {
    const { e, at } = setup();
    const right = e.parts.words;
    // load the crates in yard order, which is never the sentence order
    for (const c of e.crates) e.place(c.id);
    at(2000);
    e.submit();
    expect(e.lives).toBe(2);
    expect(e.wrongSlots.size).toBeGreaterThan(0);
    e.hint();
    expect(e.answer()[0]).toBe(right[0]);
  });
});
