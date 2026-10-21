import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { ensureProfile } from "../auth";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";
import { DEV_COOKIE } from "../middleware";

/** Local-only fake login so the app can be exercised without Google. Gated by DEV_LOGIN. */
export const dev = new Hono<AppEnv>()
  .use(async (c, next) => {
    if (c.env.DEV_LOGIN !== "true") return c.json({ error: "not-found" }, 404);
    await next();
  })
  .post("/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? "Dev Player").slice(0, 24);
    const id = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const db = getDb(c.env);
    const now = new Date();
    await db
      .insert(schema.user)
      .values({ id, name, email: `${id}@dev.local`, emailVerified: true, createdAt: now, updatedAt: now })
      .onConflictDoNothing();
    await ensureProfile(c.env, id, name);
    setCookie(c, DEV_COOKIE, id, { path: "/", httpOnly: true, sameSite: "Lax" });
    const row = await db.select().from(schema.user).where(eq(schema.user.id, id)).get();
    return c.json({ ok: true, userId: row?.id });
  })
  .post("/logout", (c) => {
    deleteCookie(c, DEV_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });
