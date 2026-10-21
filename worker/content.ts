import { and, asc, eq, inArray } from "drizzle-orm";
import type { GameWord } from "../shared/types";
import type { Db } from "./db";
import { schema } from "./db";
import type { Env } from "./env";

export const GAME_ID = "word-blaster";

export function toGameWord(w: {
  id: number;
  lemma: string;
  meaningVi: string;
  ipa: string | null;
  pos: string | null;
}): GameWord {
  return { id: w.id, lemma: w.lemma, meaningVi: w.meaningVi, ipa: w.ipa, pos: w.pos };
}

/** Words of a unit, cached in KV (content only changes when we re-seed). */
export async function getUnitWords(env: Env, db: Db, unitId: number): Promise<GameWord[]> {
  const key = `unit-words:v1:${unitId}`;
  const cached = await env.CACHE.get<GameWord[]>(key, "json");
  if (cached) return cached;
  const rows = await db
    .select({
      id: schema.words.id,
      lemma: schema.words.lemma,
      meaningVi: schema.words.meaningVi,
      ipa: schema.words.ipa,
      pos: schema.words.pos,
    })
    .from(schema.unitWords)
    .innerJoin(schema.words, eq(schema.unitWords.wordId, schema.words.id))
    .where(eq(schema.unitWords.unitId, unitId))
    .orderBy(asc(schema.unitWords.sortOrder));
  const out = rows.map(toGameWord);
  if (out.length > 0) await env.CACHE.put(key, JSON.stringify(out), { expirationTtl: 3600 });
  return out;
}

export async function getWordsByIds(db: Db, ids: number[]): Promise<GameWord[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: schema.words.id,
      lemma: schema.words.lemma,
      meaningVi: schema.words.meaningVi,
      ipa: schema.words.ipa,
      pos: schema.words.pos,
    })
    .from(schema.words)
    .where(inArray(schema.words.id, ids));
  const byId = new Map(rows.map((r) => [r.id, toGameWord(r)]));
  return ids.map((id) => byId.get(id)).filter((w): w is GameWord => !!w);
}

export async function getUnit(db: Db, unitId: number) {
  return db.select().from(schema.units).where(eq(schema.units.id, unitId)).get();
}

/** Guests: first N units only. Users: unit 1 is open, then each needs >=1 star on the previous. */
export async function isUnitUnlocked(
  db: Db,
  userId: string | null,
  unit: { id: number; setId: number; idx: number },
  guestLimit: number,
): Promise<boolean> {
  if (!userId) return unit.idx <= guestLimit;
  if (unit.idx <= 1) return true;
  const prev = await db
    .select({ id: schema.units.id })
    .from(schema.units)
    .where(and(eq(schema.units.setId, unit.setId), eq(schema.units.idx, unit.idx - 1)))
    .get();
  if (!prev) return false;
  const prog = await db
    .select({ stars: schema.userUnitProgress.bestStars })
    .from(schema.userUnitProgress)
    .where(
      and(eq(schema.userUnitProgress.userId, userId), eq(schema.userUnitProgress.unitId, prev.id)),
    )
    .get();
  return (prog?.stars ?? 0) >= 1;
}
