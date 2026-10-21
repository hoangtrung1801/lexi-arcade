import { eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth";
import { getDb, schema } from "./db";
import type { AppEnv } from "./env";

export const DEV_COOKIE = "lexi_dev_uid";

/** Resolves the current user (or null) into c.var.user. */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  let user = null as AppEnv["Variables"]["user"];

  if (c.env.DEV_LOGIN === "true") {
    const devId = getCookie(c, DEV_COOKIE);
    if (devId) {
      const row = await getDb(c.env)
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, devId))
        .get();
      if (row) user = { id: row.id, email: row.email, name: row.name, image: row.image };
    }
  }

  if (!user) {
    const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
    if (session?.user) {
      const u = session.user;
      user = { id: u.id, email: u.email, name: u.name, image: u.image ?? null };
    }
  }

  c.set("user", user);
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ error: "unauthorized" }, 401);
  await next();
});

type LimiterName = "RL_AUTH" | "RL_SESSIONS";

export function rateLimit(name: LimiterName) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const limiter = c.env[name];
    if (limiter) {
      const ip = c.req.header("cf-connecting-ip") ?? "local";
      const key = `${c.var.user?.id ?? ip}:${name}`;
      const { success } = await limiter.limit({ key });
      if (!success) return c.json({ error: "rate-limited" }, 429);
    }
    await next();
  });
}
