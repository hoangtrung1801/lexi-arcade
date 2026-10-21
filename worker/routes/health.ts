import { count } from "drizzle-orm";
import { Hono } from "hono";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";

export const health = new Hono<AppEnv>().get("/", async (c) => {
  const db = getDb(c.env);
  const [row] = await db.select({ n: count() }).from(schema.wordSets);
  return c.json({ ok: true, sets: row?.n ?? 0, time: new Date().toISOString() });
});
