import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { MeResponse } from "../../shared/api";
import { xpForLevel } from "../../shared/progress";
import { ensureProfile } from "../auth";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware";

const patchBody = z.object({
  displayName: z.string().trim().min(1).max(24).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

async function buildMe(c: {
  env: AppEnv["Bindings"];
  var: AppEnv["Variables"];
}): Promise<MeResponse> {
  const user = c.var.user;
  if (!user) return { user: null };
  const db = getDb(c.env);
  await ensureProfile(c.env, user.id, user.name);
  const p = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id))
    .get();
  if (!p) return { user: null };
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(p.settingsJson);
  } catch {}
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: p.displayName,
      image: user.image,
      level: p.level,
      xp: p.xp,
      xpForCurrent: xpForLevel(p.level),
      xpForNext: xpForLevel(p.level + 1),
      coins: p.coins,
      streakDays: p.streakDays,
      settings,
    },
  };
}

export const me = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await buildMe(c)))
  .patch("/settings", requireUser, async (c) => {
    const parsed = patchBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    const user = c.var.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const db = getDb(c.env);
    await ensureProfile(c.env, user.id, user.name);
    const cur = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .get();
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(cur?.settingsJson ?? "{}");
    } catch {}
    await db
      .update(schema.profiles)
      .set({
        displayName: parsed.data.displayName ?? cur?.displayName ?? user.name,
        settingsJson: JSON.stringify({ ...settings, ...(parsed.data.settings ?? {}) }),
      })
      .where(eq(schema.profiles.userId, user.id));
    return c.json(await buildMe(c));
  });
