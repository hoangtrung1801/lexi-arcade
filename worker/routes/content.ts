import { and, asc, count, eq, gt, lte } from "drizzle-orm";
import { Hono } from "hono";
import type {
  SetSummary,
  UnitSentencesResponse,
  UnitState,
  UnitSummary,
  UnitsResponse,
  UnitWordsResponse,
} from "../../shared/api";
import { type GameId, isGameId } from "../../shared/games";
import { GUEST_UNIT_LIMIT } from "../../shared/rules";
import { getUnit, getUnitSentences, getUnitWords, getWordsByIds, isUnitUnlocked } from "../content";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";

function gameOf(q: string | undefined): GameId {
  return isGameId(q) ? q : "word-blaster";
}

export const content = new Hono<AppEnv>()
  .get("/sets", async (c) => {
    const db = getDb(c.env);
    const sets = await db.select().from(schema.wordSets).orderBy(asc(schema.wordSets.sortOrder));
    const counts = await db
      .select({ setId: schema.units.setId, n: count() })
      .from(schema.units)
      .groupBy(schema.units.setId);
    const byId = new Map(counts.map((r) => [r.setId, r.n]));
    const out: SetSummary[] = sets.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      cefr: s.cefr,
      unitCount: byId.get(s.id) ?? 0,
    }));
    return c.json({ sets: out });
  })
  .get("/sets/:slug/units", async (c) => {
    const db = getDb(c.env);
    const userId = c.var.user?.id ?? null;
    const game = gameOf(c.req.query("game"));
    const set = await db
      .select()
      .from(schema.wordSets)
      .where(eq(schema.wordSets.slug, c.req.param("slug")))
      .get();
    if (!set) return c.json({ error: "not-found" }, 404);

    const unitRows = await db
      .select()
      .from(schema.units)
      .where(eq(schema.units.setId, set.id))
      .orderBy(asc(schema.units.idx));

    const progress = new Map<number, { stars: number; score: number }>();
    let dueCount = 0;
    if (userId) {
      const rows = await db
        .select()
        .from(schema.userUnitProgress)
        .where(
          and(eq(schema.userUnitProgress.userId, userId), eq(schema.userUnitProgress.gameId, game)),
        );
      for (const r of rows) progress.set(r.unitId, { stars: r.bestStars, score: r.bestScore });
      const [due] = await db
        .select({ n: count() })
        .from(schema.userWordProgress)
        .where(
          and(
            eq(schema.userWordProgress.userId, userId),
            lte(schema.userWordProgress.dueAt, Date.now()),
            gt(schema.userWordProgress.lastSeenAt, 0),
          ),
        );
      dueCount = due?.n ?? 0;
    }

    let prevStars = 1; // unit 1 is always open
    const units: UnitSummary[] = unitRows.map((u) => {
      const p = progress.get(u.id);
      const bestStars = p?.stars ?? 0;
      const guestLocked = !userId && u.idx > GUEST_UNIT_LIMIT;
      const unlocked = userId ? prevStars >= 1 : u.idx <= GUEST_UNIT_LIMIT;
      let state: UnitState = unlocked ? "open" : "locked";
      if (userId && bestStars >= 1) state = "done";
      prevStars = bestStars;
      return {
        id: u.id,
        idx: u.idx,
        titleVi: u.titleVi,
        topic: u.topic,
        wordCount: u.wordCount,
        state,
        bestStars,
        bestScore: p?.score ?? 0,
        guestLocked,
      };
    });

    const body: UnitsResponse = {
      set: { id: set.id, slug: set.slug, name: set.name, cefr: set.cefr, unitCount: units.length },
      units,
      dueCount,
    };
    return c.json(body);
  })
  .get("/units/:id/words", async (c) => {
    const db = getDb(c.env);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "bad-request" }, 400);
    const unit = await getUnit(db, id);
    if (!unit) return c.json({ error: "not-found" }, 404);
    const userId = c.var.user?.id ?? null;
    const game = gameOf(c.req.query("game"));
    if (!(await isUnitUnlocked(db, userId, unit, GUEST_UNIT_LIMIT, game))) {
      return c.json({ error: userId ? "locked" : "login-required" }, userId ? 403 : 401);
    }
    const words = await getUnitWords(c.env, db, id);
    const body: UnitWordsResponse = { unitId: id, words };
    return c.json(body);
  })
  .get("/units/:id/sentences", async (c) => {
    const db = getDb(c.env);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "bad-request" }, 400);
    const unit = await getUnit(db, id);
    if (!unit) return c.json({ error: "not-found" }, 404);
    const userId = c.var.user?.id ?? null;
    if (!(await isUnitUnlocked(db, userId, unit, GUEST_UNIT_LIMIT, "sentence-express"))) {
      return c.json({ error: userId ? "locked" : "login-required" }, userId ? 403 : 401);
    }
    const sentences = await getUnitSentences(db, id);
    const words = await getWordsByIds(db, [...new Set(sentences.map((s) => s.wordId))]);
    const body: UnitSentencesResponse = { unitId: id, sentences, words };
    return c.json(body);
  });
