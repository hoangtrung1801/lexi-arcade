import { and, eq, sql } from "drizzle-orm";
import { DAILY_QUESTS } from "../shared/rules";
import type { Db } from "./db";
import { schema } from "./db";

/** Statements that make sure today's quest rows exist (idempotent). */
export function ensureQuestStatements(db: Db, userId: string, date: string) {
  return DAILY_QUESTS.map((q) =>
    db
      .insert(schema.dailyQuests)
      .values({ userId, date, questKey: q.key, progress: 0, target: q.target })
      .onConflictDoNothing(),
  );
}

export function questProgressStatement(
  db: Db,
  userId: string,
  date: string,
  key: string,
  delta: number,
) {
  return db
    .update(schema.dailyQuests)
    .set({
      progress: sql`min(${schema.dailyQuests.target}, ${schema.dailyQuests.progress} + ${delta})`,
    })
    .where(
      and(
        eq(schema.dailyQuests.userId, userId),
        eq(schema.dailyQuests.date, date),
        eq(schema.dailyQuests.questKey, key),
      ),
    );
}
