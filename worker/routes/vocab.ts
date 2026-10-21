import { and, count, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { Hono } from "hono";
import type { VocabItem, VocabResponse } from "../../shared/api";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware";

const FILTERS = ["learned", "due", "saved"] as const;
type Filter = (typeof FILTERS)[number];

export const vocab = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const db = getDb(c.env);
    const q = c.req.query("filter");
    const filter: Filter = FILTERS.includes(q as Filter) ? (q as Filter) : "learned";
    const now = Date.now();

    const wordCols = {
      id: schema.words.id,
      lemma: schema.words.lemma,
      meaningVi: schema.words.meaningVi,
      ipa: schema.words.ipa,
      pos: schema.words.pos,
      cefr: schema.words.cefr,
      audioKey: schema.words.audioKey,
      box: schema.userWordProgress.box,
      dueAt: schema.userWordProgress.dueAt,
    };

    let rows: {
      id: number;
      lemma: string;
      meaningVi: string;
      ipa: string | null;
      pos: string | null;
      cefr: string;
      audioKey: string | null;
      box: number | null;
      dueAt: number | null;
    }[];

    if (filter === "saved") {
      rows = await db
        .select(wordCols)
        .from(schema.userSavedWords)
        .innerJoin(schema.words, eq(schema.userSavedWords.wordId, schema.words.id))
        .leftJoin(
          schema.userWordProgress,
          and(
            eq(schema.userWordProgress.wordId, schema.words.id),
            eq(schema.userWordProgress.userId, user.id),
          ),
        )
        .where(eq(schema.userSavedWords.userId, user.id))
        .orderBy(desc(schema.userSavedWords.createdAt))
        .limit(500);
    } else {
      const cond =
        filter === "due"
          ? and(
              eq(schema.userWordProgress.userId, user.id),
              gt(schema.userWordProgress.lastSeenAt, 0),
              lte(schema.userWordProgress.dueAt, now),
            )
          : and(eq(schema.userWordProgress.userId, user.id), gt(schema.userWordProgress.lastSeenAt, 0));
      rows = await db
        .select(wordCols)
        .from(schema.userWordProgress)
        .innerJoin(schema.words, eq(schema.userWordProgress.wordId, schema.words.id))
        .where(cond)
        .orderBy(desc(schema.userWordProgress.lastSeenAt))
        .limit(500);
    }

    const ids = rows.map((r) => r.id);
    const savedRows = ids.length
      ? await db
          .select({ wordId: schema.userSavedWords.wordId })
          .from(schema.userSavedWords)
          .where(and(eq(schema.userSavedWords.userId, user.id), inArray(schema.userSavedWords.wordId, ids)))
      : [];
    const saved = new Set(savedRows.map((r) => r.wordId));

    const [learned] = await db
      .select({ n: count() })
      .from(schema.userWordProgress)
      .where(and(eq(schema.userWordProgress.userId, user.id), gt(schema.userWordProgress.lastSeenAt, 0)));
    const [due] = await db
      .select({ n: count() })
      .from(schema.userWordProgress)
      .where(
        and(
          eq(schema.userWordProgress.userId, user.id),
          gt(schema.userWordProgress.lastSeenAt, 0),
          lte(schema.userWordProgress.dueAt, now),
        ),
      );
    const [savedN] = await db
      .select({ n: count() })
      .from(schema.userSavedWords)
      .where(eq(schema.userSavedWords.userId, user.id));

    const items: VocabItem[] = rows.map((r) => ({
      id: r.id,
      lemma: r.lemma,
      meaningVi: r.meaningVi,
      ipa: r.ipa,
      pos: r.pos,
      cefr: r.cefr,
      box: r.box ?? 0,
      dueAt: r.dueAt ?? 0,
      saved: saved.has(r.id),
      hasAudio: !!r.audioKey,
    }));
    const body: VocabResponse = {
      filter,
      items,
      counts: { learned: learned?.n ?? 0, due: due?.n ?? 0, saved: savedN?.n ?? 0 },
    };
    return c.json(body);
  })
  .post("/:wordId/save", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const wordId = Number(c.req.param("wordId"));
    if (!Number.isInteger(wordId)) return c.json({ error: "bad-request" }, 400);
    const db = getDb(c.env);
    const w = await db.select({ id: schema.words.id }).from(schema.words).where(eq(schema.words.id, wordId)).get();
    if (!w) return c.json({ error: "not-found" }, 404);
    await db
      .insert(schema.userSavedWords)
      .values({ userId: user.id, wordId, createdAt: Date.now() })
      .onConflictDoNothing();
    return c.json({ ok: true });
  })
  .delete("/:wordId/save", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const wordId = Number(c.req.param("wordId"));
    if (!Number.isInteger(wordId)) return c.json({ error: "bad-request" }, 400);
    await getDb(c.env)
      .delete(schema.userSavedWords)
      .where(and(eq(schema.userSavedWords.userId, user.id), eq(schema.userSavedWords.wordId, wordId)));
    return c.json({ ok: true });
  });
