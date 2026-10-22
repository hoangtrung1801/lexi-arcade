import { createRng, shuffle } from "./rng";
import {
  SPELL,
  SPELL_BOSS_BONUS,
  SPELL_BOSS_HP,
  SPELL_DOORS,
  SPELL_HEART_BONUS,
  SPELL_HEARTS,
  SPELL_WAVE,
} from "./rules";
import { calcWpm, wordScore } from "./scoring";
import type { Difficulty, GameWord, RoundResult, SpellEvent } from "./types";
import { checkTimeline, tooManyWpm, type ValidationResult } from "./validate";

/** How a floor's words are dealt: doors to spell, waves of monsters, then the boss's meanings. */
export interface SpellPlan {
  doors: GameWord[];
  waves: GameWord[][];
  boss: GameWord[];
}

const prefixClash = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

/**
 * Deals a floor from the session seed. Doors take unit words only; words due for review go to
 * the boss first, then to the monsters. Two monsters of one wave never have words where one is
 * the start of the other, so typing one cannot finish the other by accident.
 */
export function spellPlan(
  words: readonly GameWord[],
  seed: number,
  dueIds: ReadonlySet<number> = new Set(),
): SpellPlan {
  const rng = createRng(seed);
  const unit = shuffle(
    words.filter((w) => !dueIds.has(w.id)),
    rng,
  );
  const due = shuffle(
    words.filter((w) => dueIds.has(w.id)),
    rng,
  );
  const doorCount = Math.max(0, Math.min(SPELL_DOORS, unit.length - 2));
  const doors = unit.slice(0, doorCount);
  const rest = [...unit.slice(doorCount), ...due];
  const bossCount = Math.min(SPELL_BOSS_HP, Math.max(1, Math.ceil(rest.length / 2)));
  // the boss holds the due words (at the end of `rest`) and the last unit words
  const boss = rest.slice(rest.length - bossCount);
  const mobs = rest.slice(0, rest.length - bossCount);
  const waves: GameWord[][] = [];
  for (const w of mobs) {
    const fit = waves.find(
      (wave) =>
        wave.length < SPELL_WAVE &&
        !wave.some((o) => prefixClash(o.lemma.toLowerCase(), w.lemma.toLowerCase())),
    );
    if (fit) fit.push(w);
    else waves.push([w]);
  }
  return { doors, waves, boss };
}

/** How long a monster with this word takes to reach the hero. */
export function mobTravelMs(lemma: string, difficulty: Difficulty): number {
  const d = SPELL[difficulty];
  return d.mobMs + d.perLetterMs * lemma.length;
}

/** How long the boss takes to wind up a blow while this word is asked. */
export function bossWindupMs(lemma: string, difficulty: Difficulty): number {
  const d = SPELL[difficulty];
  return d.bossMs + d.perLetterMs * lemma.length;
}

/**
 * Replays a floor. Each finished word scores more the longer the run of clean words before it;
 * a wrong key, a hint or a lost heart breaks the run. Clearing the floor adds the boss bonus and
 * a bonus for every heart left. A word is missed when it cost a heart or half of it was hinted.
 */
export function computeSpellResult(
  events: readonly SpellEvent[],
  words: readonly GameWord[],
): RoundResult {
  const byId = new Map(words.map((w) => [w.id, w]));
  const done = new Set<number>();
  const dirty = new Set<number>();
  const hurtBy = new Set<number>();
  const reveals = new Map<number, number>();
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let correctKeys = 0;
  let wrongKeys = 0;
  let hurts = 0;
  let lastT = 0;

  for (const ev of events) {
    if (hurts >= SPELL_HEARTS || done.size === words.length) break;
    lastT = ev.t;
    if (ev.type === "correct") correctKeys++;
    else if (ev.type === "wrong") {
      wrongKeys++;
      combo = 0;
      dirty.add(ev.wordId);
    } else if (ev.type === "reveal") {
      reveals.set(ev.wordId, (reveals.get(ev.wordId) ?? 0) + 1);
      dirty.add(ev.wordId);
      combo = 0;
    } else if (ev.type === "hurt") {
      hurts++;
      hurtBy.add(ev.wordId);
      dirty.add(ev.wordId);
      combo = 0;
    } else if (!done.has(ev.wordId)) {
      done.add(ev.wordId);
      score += wordScore(byId.get(ev.wordId)?.lemma.length ?? 0, combo);
      combo++;
      maxCombo = Math.max(maxCombo, combo);
    }
  }

  const won = words.length > 0 && done.size === words.length && hurts < SPELL_HEARTS;
  if (won) score += SPELL_BOSS_BONUS + (SPELL_HEARTS - hurts) * SPELL_HEART_BONUS;
  const totalKeys = correctKeys + wrongKeys;
  const accuracy = totalKeys === 0 ? 0 : correctKeys / totalKeys;
  const halfHinted = [...reveals]
    .filter(([id, n]) => n * 2 >= (byId.get(id)?.lemma.length ?? 1))
    .map(([id]) => id);
  const missed = new Set([...hurtBy, ...halfHinted]);
  const stars: RoundResult["stars"] = !won
    ? 0
    : hurts === 0 && accuracy >= 0.9
      ? 3
      : hurts <= 1
        ? 2
        : 1;

  return {
    status: won ? "won" : "lost",
    score,
    wpm: calcWpm(correctKeys, lastT),
    accuracy,
    maxCombo,
    stars,
    livesLost: hurts,
    durationMs: lastT,
    correctKeys,
    wrongKeys,
    hitWordIds: [...done],
    missedWordIds: [...missed],
    cleanWordIds: [...done].filter((id) => !dirty.has(id)),
  };
}

/**
 * Server-side checks. Monsters sharing a first few letters can swap targets mid-word, so letters
 * are counted for the whole floor: there must be at least as many right keys as letters in the
 * finished words.
 */
export function validateSpell(
  events: readonly SpellEvent[],
  words: readonly GameWord[],
  elapsedWallMs: number,
): ValidationResult {
  const timeline = checkTimeline(
    events,
    elapsedWallMs,
    (i) => events[i]?.type === "correct" || events[i]?.type === "wrong",
  );
  if (timeline) return { ok: false, reason: timeline };
  const byId = new Map(words.map((w) => [w.id, w]));
  const revealed = new Map<number, number>();
  const done = new Set<number>();
  let correctKeys = 0;
  let doneLetters = 0;
  let hurts = 0;
  for (const ev of events) {
    const w = byId.get(ev.wordId);
    if (!w) return { ok: false, reason: "unknown-word" };
    if (ev.type === "correct") correctKeys++;
    else if (ev.type === "reveal") {
      const n = (revealed.get(w.id) ?? 0) + 1;
      if (n > w.lemma.length) return { ok: false, reason: "too-many-reveals" };
      revealed.set(w.id, n);
    } else if (ev.type === "hurt") {
      if (++hurts > SPELL_HEARTS) return { ok: false, reason: "too-many-hurts" };
    } else if (ev.type === "done") {
      if (done.has(w.id)) return { ok: false, reason: "word-already-done" };
      done.add(w.id);
      doneLetters += w.lemma.length;
      if (correctKeys < doneLetters) return { ok: false, reason: "done-without-typing" };
    }
  }
  if (tooManyWpm(correctKeys, events.at(-1)?.t ?? 0)) return { ok: false, reason: "wpm-too-high" };
  return { ok: true };
}
