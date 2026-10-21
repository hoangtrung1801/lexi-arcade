import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { LeaderboardEntry, LeaderboardResponse } from "../../shared/api";
import { vnWeek } from "../../shared/progress";
import { GAME_ID } from "../content";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";

export const leaderboard = new Hono<AppEnv>().get("/", async (c) => {
  const game = c.req.query("game") === GAME_ID || !c.req.query("game") ? GAME_ID : null;
  if (!game) return c.json({ error: "unknown-game" }, 404);
  const period = c.req.query("period") === "all" ? "all" : "week";
  const key = `leaderboard:${game}:${period}`;

  const cached = await c.env.CACHE.get<LeaderboardResponse>(key, "json");
  if (cached) return c.json(cached);

  const db = getDb(c.env);
  const total = sql<number>`sum(${schema.weeklyScores.score})`;
  const base = db
    .select({
      userId: schema.weeklyScores.userId,
      displayName: schema.profiles.displayName,
      score: total,
    })
    .from(schema.weeklyScores)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.weeklyScores.userId));

  const rows = await (period === "week"
    ? base.where(sql`${schema.weeklyScores.week} = ${vnWeek(Date.now())} and ${schema.weeklyScores.gameId} = ${game}`)
    : base.where(eq(schema.weeklyScores.gameId, game))
  )
    .groupBy(schema.weeklyScores.userId, schema.profiles.displayName)
    .orderBy(desc(total))
    .limit(20);

  const entries: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    displayName: r.displayName,
    score: Number(r.score),
  }));
  const body: LeaderboardResponse = { game, period, entries };
  await c.env.CACHE.put(key, JSON.stringify(body), { expirationTtl: 60 });
  return c.json(body);
});
