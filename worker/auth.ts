import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Env } from "./env";

export function createAuth(env: Env) {
  const db = getDb(env);
  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureProfile(env, user.id, user.name);
          },
        },
      },
    },
  });
}

export async function ensureProfile(env: Env, userId: string, name: string) {
  const db = getDb(env);
  const existing = await db
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .get();
  if (existing) return;
  await db
    .insert(schema.profiles)
    .values({ userId, displayName: name || "Player" })
    .onConflictDoNothing();
}
