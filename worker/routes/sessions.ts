import { and, asc, eq, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono } from "hono";
import { z } from "zod";
import type { FinishSessionResponse, StartSessionResponse } from "../../shared/api";
import { levelFromXp, nextStreak, roundRewards, vnDate, vnWeek } from "../../shared/progress";
import { GUEST_UNIT_LIMIT, MAX_DUE_RATIO } from "../../shared/rules";
import { computeResult } from "../../shared/scoring";
import { srsUpdate } from "../../shared/srs";
import type { GameEvent } from "../../shared/types";
import { validateEvents } from "../../shared/validate";
import { ensureProfile } from "../auth";
import { GAME_ID, getUnit, getUnitWords, getWordsByIds, isUnitUnlocked } from "../content";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";
import { rateLimit, requireUser } from "../middleware";
import { ensureQuestStatements, questProgressStatement } from "../quests";

const startBody = z.object({
  unitId: z.number().int().positive(),
  difficulty: z.enum(["easy", "normal", "hard"]),
});

const eventSchema = z.discriminatedUnion("type", [
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
const finishBody = z.object({ events: z.array(eventSchema).max(20000) });

export const sessions = new Hono<AppEnv>()
  .use(requireUser, rateLimit("RL_SESSIONS"))
  .post("/", async (c) => {
    const parsed = startBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    const { unitId, difficulty } = parsed.data;
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const db = getDb(c.env);

    const unit = await getUnit(db, unitId);
    if (!unit) return c.json({ error: "not-found" }, 404);
    if (!(await isUnitUnlocked(db, user.id, unit, GUEST_UNIT_LIMIT))) {
      return c.json({ error: "locked" }, 403);
    }
    await ensureProfile(c.env, user.id, user.name);

    const unitWords = await getUnitWords(c.env, db, unitId);
    if (unitWords.length === 0) return c.json({ error: "empty-unit" }, 409);

    // Mix in due words from other units: at most 30% of the final round.
    const maxDue = Math.floor((unitWords.length * MAX_DUE_RATIO) / (1 - MAX_DUE_RATIO));
    let dueWordIds: number[] = [];
    if (maxDue > 0) {
      const unitIds = unitWords.map((w) => w.id);
      const rows = await db
        .select({ wordId: schema.userWordProgress.wordId })
        .from(schema.userWordProgress)
        .where(
          and(
            eq(schema.userWordProgress.userId, user.id),
            lte(schema.userWordProgress.dueAt, Date.now()),
            sql`${schema.userWordProgress.lastSeenAt} > 0`,
            notInArray(schema.userWordProgress.wordId, unitIds),
          ),
        )
        .orderBy(asc(schema.userWordProgress.dueAt))
        .limit(maxDue);
      dueWordIds = rows.map((r) => r.wordId);
    }
    const dueWords = await getWordsByIds(db, dueWordIds);
    const words = [...unitWords, ...dueWords];

    const sessionId = crypto.randomUUID();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    await db.insert(schema.gameSessions).values({
      id: sessionId,
      userId: user.id,
      gameId: GAME_ID,
      unitId,
      difficulty,
      seed,
      wordIdsJson: JSON.stringify(words.map((w) => w.id)),
      startedAt: Date.now(),
    });

    const body: StartSessionResponse = {
      sessionId,
      seed,
      difficulty,
      unitId,
      words,
      dueWordIds: dueWords.map((w) => w.id),
    };
    return c.json(body);
  })
  .post("/:id/finish", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const parsed = finishBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    const events = parsed.data.events as GameEvent[];
    const db = getDb(c.env);
    const sessionId = c.req.param("id");

    const sess = await db
      .select()
      .from(schema.gameSessions)
      .where(and(eq(schema.gameSessions.id, sessionId), eq(schema.gameSessions.userId, user.id)))
      .get();
    if (!sess) return c.json({ error: "not-found" }, 404);
    if (sess.status !== "started") return c.json({ error: "already-finished" }, 409);

    const now = Date.now();
    const wordIds: number[] = JSON.parse(sess.wordIdsJson);
    const words = await getWordsByIds(db, wordIds);

    const check = validateEvents(events, words, now - sess.startedAt);
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

    const result = computeResult(events, words);

    const [profile, unitProg, wordProg, nextUnit] = await Promise.all([
      db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get(),
      db
        .select()
        .from(schema.userUnitProgress)
        .where(
          and(
            eq(schema.userUnitProgress.userId, user.id),
            eq(schema.userUnitProgress.unitId, sess.unitId),
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
        })
        .where(eq(schema.gameSessions.id, sessionId)),
      db
        .insert(schema.userUnitProgress)
        .values({
          userId: user.id,
          unitId: sess.unitId,
          bestStars: result.stars,
          bestScore: result.score,
          bestWpm: result.wpm,
          plays: 1,
          completedAt: result.stars >= 1 ? now : null,
        })
        .onConflictDoUpdate({
          target: [schema.userUnitProgress.userId, schema.userUnitProgress.unitId],
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
          .values({ week: vnWeek(now), userId: user.id, gameId: GAME_ID, score: result.score })
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
    await c.env.CACHE.delete(`leaderboard:${GAME_ID}:week`);
    await c.env.CACHE.delete(`leaderboard:${GAME_ID}:all`);

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
