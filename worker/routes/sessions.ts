import { and, asc, eq, gte, inArray, isNotNull, lte, ne, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono } from "hono";
import { z } from "zod";
import type { FinishSessionResponse, StartSessionResponse } from "../../shared/api";
import { GAME_IDS, type GameId } from "../../shared/games";
import { levelFromXp, nextStreak, roundRewards, vnDate, vnWeek } from "../../shared/progress";
import { raceGhost } from "../../shared/race";
import { type AnyEvent, scoreRound, validateRound } from "../../shared/rounds";
import { GUEST_UNIT_LIMIT, MAX_DUE_RATIO } from "../../shared/rules";
import { srsUpdate } from "../../shared/srs";
import type { GameWord, Ghost, RaceEvent, Sentence } from "../../shared/types";
import { ensureProfile } from "../auth";
import {
  getSentencesByIds,
  getUnit,
  getUnitSentences,
  getUnitWords,
  getWordsByIds,
  isUnitUnlocked,
} from "../content";
import type { Db } from "../db";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";
import { rateLimit, requireUser } from "../middleware";
import { ensureQuestStatements, questProgressStatement } from "../quests";

const startBody = z.object({
  gameId: z.enum(GAME_IDS).default("word-blaster"),
  unitId: z.number().int().positive(),
  difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
});

const blasterEvent = z.discriminatedUnion("type", [
  z.object({ t: z.number(), type: z.literal("correct"), wordId: z.number().int() }),
  z.object({ t: z.number(), type: z.literal("wrong"), wordId: z.number().int().optional() }),
  z.object({ t: z.number(), type: z.literal("hit"), wordId: z.number().int() }),
  z.object({ t: z.number(), type: z.literal("miss"), wordId: z.number().int() }),
  z.object({
    t: z.number(),
    type: z.literal("bad"),
    wordId: z.number().int(),
    choiceId: z.number().int(),
  }),
]);
const raceEvent = z.object({
  t: z.number(),
  type: z.enum(["correct", "wrong", "reveal", "done"]),
  wordId: z.number().int(),
});
const trainEvent = z.discriminatedUnion("type", [
  z.object({
    t: z.number(),
    type: z.literal("submit"),
    sentenceId: z.number().int(),
    answer: z.array(z.string().max(40)).max(30),
  }),
  z.object({ t: z.number(), type: z.literal("hint"), sentenceId: z.number().int() }),
]);
const finishBodies = {
  "word-blaster": z.object({ events: z.array(blasterEvent).max(20000) }),
  "ghost-race": z.object({ events: z.array(raceEvent).max(20000) }),
  "sentence-express": z.object({ events: z.array(trainEvent).max(2000) }),
} satisfies Record<GameId, z.ZodType>;

/** How many review items may join a round of `n` unit items: at most MAX_DUE_RATIO of the round. */
function maxDueFor(n: number): number {
  return Math.floor((n * MAX_DUE_RATIO) / (1 - MAX_DUE_RATIO));
}

/** Words due for review that are not already in the round, most overdue first. */
async function dueWordIds(db: Db, userId: string, exclude: number[], limit: number) {
  if (limit <= 0) return [];
  const rows = await db
    .select({ wordId: schema.userWordProgress.wordId })
    .from(schema.userWordProgress)
    .where(
      and(
        eq(schema.userWordProgress.userId, userId),
        lte(schema.userWordProgress.dueAt, Date.now()),
        sql`${schema.userWordProgress.lastSeenAt} > 0`,
        notInArray(schema.userWordProgress.wordId, exclude),
      ),
    )
    .orderBy(asc(schema.userWordProgress.dueAt))
    .limit(limit);
  return rows.map((r) => r.wordId);
}

/** One sentence for each of the most overdue words that have one, outside this unit. */
async function dueSentences(
  db: Db,
  userId: string,
  unitId: number,
  exclude: number[],
  limit: number,
) {
  if (limit <= 0) return [];
  const rows = await db
    .select({
      id: schema.sentences.id,
      wordId: schema.sentences.wordId,
      en: schema.sentences.en,
      vi: schema.sentences.vi,
    })
    .from(schema.userWordProgress)
    .innerJoin(schema.sentences, eq(schema.sentences.wordId, schema.userWordProgress.wordId))
    .where(
      and(
        eq(schema.userWordProgress.userId, userId),
        lte(schema.userWordProgress.dueAt, Date.now()),
        sql`${schema.userWordProgress.lastSeenAt} > 0`,
        ne(schema.sentences.unitId, unitId),
        notInArray(schema.userWordProgress.wordId, exclude),
      ),
    )
    .orderBy(asc(schema.userWordProgress.dueAt))
    .limit(limit * 4);
  const out: Sentence[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.wordId)) continue;
    seen.add(r.wordId);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** Ghost Race: the player's fastest finished run here, and the fastest one by anyone else. */
async function findGhosts(db: Db, userId: string, unitId: number): Promise<Ghost[]> {
  const gs = schema.gameSessions;
  const base = and(
    eq(gs.gameId, "ghost-race"),
    eq(gs.unitId, unitId),
    eq(gs.status, "finished"),
    gte(gs.stars, 1),
    isNotNull(gs.ghostJson),
  );
  const cols = {
    durationMs: gs.durationMs,
    ghostJson: gs.ghostJson,
    name: schema.profiles.displayName,
  };
  const [mine, top] = await Promise.all([
    db
      .select(cols)
      .from(gs)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, gs.userId))
      .where(and(base, eq(gs.userId, userId)))
      .orderBy(asc(gs.durationMs))
      .limit(1)
      .get(),
    db
      .select(cols)
      .from(gs)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, gs.userId))
      .where(and(base, ne(gs.userId, userId)))
      .orderBy(asc(gs.durationMs))
      .limit(1)
      .get(),
  ]);
  const out: Ghost[] = [];
  for (const [kind, row] of [
    ["best", mine],
    ["top", top],
  ] as const) {
    if (!row?.ghostJson || row.durationMs === null) continue;
    out.push({
      kind,
      name: kind === "best" ? "Kỷ lục của bạn" : row.name,
      durationMs: row.durationMs,
      points: JSON.parse(row.ghostJson),
    });
  }
  return out;
}

export const sessions = new Hono<AppEnv>()
  .use(requireUser, rateLimit("RL_SESSIONS"))
  .post("/", async (c) => {
    const parsed = startBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    const { gameId, unitId, difficulty } = parsed.data;
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const db = getDb(c.env);

    const unit = await getUnit(db, unitId);
    if (!unit) return c.json({ error: "not-found" }, 404);
    if (!(await isUnitUnlocked(db, user.id, unit, GUEST_UNIT_LIMIT, gameId))) {
      return c.json({ error: "locked" }, 403);
    }
    await ensureProfile(c.env, user.id, user.name);

    // Review items from other units (shared word progress) join every game's round.
    let words: GameWord[];
    let sentences: Sentence[] = [];
    let dueIds: number[];
    if (gameId === "sentence-express") {
      const own = await getUnitSentences(db, unitId);
      if (own.length === 0) return c.json({ error: "empty-unit" }, 409);
      const due = await dueSentences(
        db,
        user.id,
        unitId,
        own.map((s) => s.wordId),
        maxDueFor(own.length),
      );
      sentences = [...own, ...due];
      dueIds = due.map((s) => s.wordId);
      words = await getWordsByIds(db, [...new Set(sentences.map((s) => s.wordId))]);
    } else {
      const unitWords = await getUnitWords(c.env, db, unitId);
      if (unitWords.length === 0) return c.json({ error: "empty-unit" }, 409);
      dueIds = await dueWordIds(
        db,
        user.id,
        unitWords.map((w) => w.id),
        maxDueFor(unitWords.length),
      );
      words = [...unitWords, ...(await getWordsByIds(db, dueIds))];
    }
    const ghosts = gameId === "ghost-race" ? await findGhosts(db, user.id, unitId) : [];

    const sessionId = crypto.randomUUID();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    await db.insert(schema.gameSessions).values({
      id: sessionId,
      userId: user.id,
      gameId,
      unitId,
      difficulty,
      seed,
      wordIdsJson: JSON.stringify(words.map((w) => w.id)),
      sentenceIdsJson: sentences.length ? JSON.stringify(sentences.map((s) => s.id)) : null,
      startedAt: Date.now(),
    });

    const body: StartSessionResponse = {
      sessionId,
      seed,
      difficulty,
      unitId,
      gameId,
      words,
      dueWordIds: dueIds,
      sentences,
      ghosts,
    };
    return c.json(body);
  })
  .post("/:id/finish", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const raw = await c.req.json().catch(() => null);
    const db = getDb(c.env);
    const sessionId = c.req.param("id");

    const sess = await db
      .select()
      .from(schema.gameSessions)
      .where(and(eq(schema.gameSessions.id, sessionId), eq(schema.gameSessions.userId, user.id)))
      .get();
    if (!sess) return c.json({ error: "not-found" }, 404);
    if (sess.status !== "started") return c.json({ error: "already-finished" }, 409);
    const gameId = (GAME_IDS as readonly string[]).includes(sess.gameId)
      ? (sess.gameId as GameId)
      : "word-blaster";
    const parsed = finishBodies[gameId].safeParse(raw);
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    const events = parsed.data.events as AnyEvent[];

    const now = Date.now();
    const wordIds: number[] = JSON.parse(sess.wordIdsJson);
    const words = await getWordsByIds(db, wordIds);
    const sentences = await getSentencesByIds(db, JSON.parse(sess.sentenceIdsJson ?? "[]"));
    const ctx = {
      words,
      sentences,
      difficulty: sess.difficulty as "easy" | "normal" | "hard",
    };

    const check = validateRound(gameId, events, ctx, now - sess.startedAt);
    if (!check.ok) {
      await db
        .update(schema.gameSessions)
        .set({ status: "rejected", finishedAt: now, rejectReason: check.reason })
        .where(
          and(eq(schema.gameSessions.id, sessionId), eq(schema.gameSessions.status, "started")),
        );
      return c.json({ error: "rejected", reason: check.reason }, 422);
    }

    // One-shot claim so a replayed finish cannot pay out twice.
    const claimed = await db
      .update(schema.gameSessions)
      .set({ status: "finished", finishedAt: now })
      .where(and(eq(schema.gameSessions.id, sessionId), eq(schema.gameSessions.status, "started")))
      .returning({ id: schema.gameSessions.id });
    if (claimed.length === 0) return c.json({ error: "already-finished" }, 409);

    const result = scoreRound(gameId, events, ctx);

    const [profile, unitProg, wordProg, nextUnit] = await Promise.all([
      db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get(),
      db
        .select()
        .from(schema.userUnitProgress)
        .where(
          and(
            eq(schema.userUnitProgress.userId, user.id),
            eq(schema.userUnitProgress.unitId, sess.unitId),
            eq(schema.userUnitProgress.gameId, gameId),
          ),
        )
        .get(),
      db
        .select()
        .from(schema.userWordProgress)
        .where(
          and(
            eq(schema.userWordProgress.userId, user.id),
            inArray(schema.userWordProgress.wordId, wordIds),
          ),
        ),
      getUnit(db, sess.unitId).then((u) =>
        u
          ? db
              .select({ id: schema.units.id })
              .from(schema.units)
              .where(and(eq(schema.units.setId, u.setId), eq(schema.units.idx, u.idx + 1)))
              .get()
          : undefined,
      ),
    ]);

    const bestStars = unitProg?.bestStars ?? 0;
    const reward = roundRewards(result.score, result.stars, bestStars);
    const prevXp = profile?.xp ?? 0;
    const newXp = prevXp + reward.xp;
    const newLevel = levelFromXp(newXp);
    const newCoins = (profile?.coins ?? 0) + reward.coins;
    const today = vnDate(now);
    const streak = nextStreak(profile?.streakDays ?? 0, profile?.lastActiveDate ?? null, today);
    const unlockedUnitId = result.stars >= 1 && bestStars === 0 ? (nextUnit?.id ?? null) : null;

    const statements: BatchItem<"sqlite">[] = [
      db
        .update(schema.gameSessions)
        .set({
          score: result.score,
          wpm: result.wpm,
          accuracy: result.accuracy,
          maxCombo: result.maxCombo,
          stars: result.stars,
          xpGained: reward.xp,
          coinsGained: reward.coins,
          durationMs: result.durationMs,
          ghostJson:
            gameId === "ghost-race" && result.status === "won"
              ? JSON.stringify(raceGhost(events as RaceEvent[], words))
              : null,
        })
        .where(eq(schema.gameSessions.id, sessionId)),
      db
        .insert(schema.userUnitProgress)
        .values({
          userId: user.id,
          unitId: sess.unitId,
          gameId,
          bestStars: result.stars,
          bestScore: result.score,
          bestWpm: result.wpm,
          plays: 1,
          completedAt: result.stars >= 1 ? now : null,
        })
        .onConflictDoUpdate({
          target: [
            schema.userUnitProgress.userId,
            schema.userUnitProgress.unitId,
            schema.userUnitProgress.gameId,
          ],
          set: {
            bestStars: sql`max(${schema.userUnitProgress.bestStars}, ${result.stars})`,
            bestScore: sql`max(${schema.userUnitProgress.bestScore}, ${result.score})`,
            bestWpm: sql`max(${schema.userUnitProgress.bestWpm}, ${result.wpm})`,
            plays: sql`${schema.userUnitProgress.plays} + 1`,
            completedAt:
              result.stars >= 1
                ? sql`coalesce(${schema.userUnitProgress.completedAt}, ${now})`
                : schema.userUnitProgress.completedAt,
          },
        }),
      db
        .update(schema.profiles)
        .set({
          xp: newXp,
          level: newLevel,
          coins: newCoins,
          streakDays: streak,
          lastActiveDate: today,
        })
        .where(eq(schema.profiles.userId, user.id)),
    ];

    // Spaced repetition: one row per word that appeared in this round.
    const existing = new Map(wordProg.map((r) => [r.wordId, r]));
    const clean = new Set(result.cleanWordIds);
    const missed = new Set(result.missedWordIds);
    for (const wordId of new Set([...result.hitWordIds, ...result.missedWordIds])) {
      const outcome = missed.has(wordId) ? "missed" : clean.has(wordId) ? "clean" : "sloppy";
      const prev = existing.get(wordId);
      const upd = srsUpdate(prev?.box ?? 0, outcome, now);
      statements.push(
        db
          .insert(schema.userWordProgress)
          .values({
            userId: user.id,
            wordId,
            box: upd.box,
            dueAt: upd.dueAt,
            correct: (prev?.correct ?? 0) + upd.correctDelta,
            wrong: (prev?.wrong ?? 0) + upd.wrongDelta,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.userWordProgress.userId, schema.userWordProgress.wordId],
            set: {
              box: upd.box,
              dueAt: upd.dueAt,
              correct: (prev?.correct ?? 0) + upd.correctDelta,
              wrong: (prev?.wrong ?? 0) + upd.wrongDelta,
              lastSeenAt: now,
            },
          }),
      );
    }

    if (result.score > 0) {
      statements.push(
        db
          .insert(schema.weeklyScores)
          .values({ week: vnWeek(now), userId: user.id, gameId, score: result.score })
          .onConflictDoUpdate({
            target: [
              schema.weeklyScores.week,
              schema.weeklyScores.userId,
              schema.weeklyScores.gameId,
            ],
            set: { score: sql`${schema.weeklyScores.score} + ${result.score}` },
          }),
      );
    }

    statements.push(...ensureQuestStatements(db, user.id, today));
    statements.push(questProgressStatement(db, user.id, today, "play_3", 1));
    if (result.hitWordIds.length > 0) {
      statements.push(
        questProgressStatement(db, user.id, today, "hit_30", result.hitWordIds.length),
      );
    }
    if (result.status === "won" && result.accuracy >= 0.95) {
      statements.push(questProgressStatement(db, user.id, today, "accuracy_95", 1));
    }

    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    await c.env.CACHE.delete(`leaderboard:${gameId}:week`);
    await c.env.CACHE.delete(`leaderboard:${gameId}:all`);

    const body: FinishSessionResponse = {
      result,
      rewards: {
        xpGained: reward.xp,
        coinsGained: reward.coins,
        newStars: reward.newStars,
        unlockedUnitId,
        levelUp: newLevel > (profile?.level ?? 1),
        level: newLevel,
        xp: newXp,
        coins: newCoins,
        streakDays: streak,
      },
    };
    return c.json(body);
  });
