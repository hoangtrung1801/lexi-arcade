import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono } from "hono";
import type { QuestItem, QuestsResponse } from "../../shared/api";
import { vnDate } from "../../shared/progress";
import { DAILY_QUESTS } from "../../shared/rules";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware";
import { ensureQuestStatements } from "../quests";

async function loadQuests(env: AppEnv["Bindings"], userId: string): Promise<QuestsResponse> {
  const db = getDb(env);
  const date = vnDate(Date.now());
  const ensure = ensureQuestStatements(db, userId, date);
  await db.batch(ensure as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  const rows = await db
    .select()
    .from(schema.dailyQuests)
    .where(and(eq(schema.dailyQuests.userId, userId), eq(schema.dailyQuests.date, date)));
  const quests: QuestItem[] = DAILY_QUESTS.map((q) => {
    const r = rows.find((x) => x.questKey === q.key);
    return {
      key: q.key,
      title: q.title,
      target: q.target,
      reward: q.reward,
      progress: r?.progress ?? 0,
      claimed: r?.claimed ?? false,
    };
  });
  return { date, quests };
}

export const quests = new Hono<AppEnv>()
  .use(requireUser)
  .get("/today", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    return c.json(await loadQuests(c.env, user.id));
  })
  .post("/:key/claim", async (c) => {
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const def = DAILY_QUESTS.find((q) => q.key === c.req.param("key"));
    if (!def) return c.json({ error: "not-found" }, 404);
    const db = getDb(c.env);
    const date = vnDate(Date.now());
    await loadQuests(c.env, user.id);

    // Conditional update makes the claim atomic: only one request can flip claimed.
    const claimed = await db
      .update(schema.dailyQuests)
      .set({ claimed: true })
      .where(
        and(
          eq(schema.dailyQuests.userId, user.id),
          eq(schema.dailyQuests.date, date),
          eq(schema.dailyQuests.questKey, def.key),
          eq(schema.dailyQuests.claimed, false),
          sql`${schema.dailyQuests.progress} >= ${schema.dailyQuests.target}`,
        ),
      )
      .returning({ key: schema.dailyQuests.questKey });
    if (claimed.length === 0) return c.json({ error: "not-claimable" }, 409);

    await db
      .update(schema.profiles)
      .set({ coins: sql`${schema.profiles.coins} + ${def.reward}` })
      .where(eq(schema.profiles.userId, user.id));
    return c.json(await loadQuests(c.env, user.id));
  });
