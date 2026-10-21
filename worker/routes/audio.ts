import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb, schema } from "../db";
import type { AppEnv } from "../env";

export const audio = new Hono<AppEnv>().get("/:wordId", async (c) => {
  const wordId = Number(c.req.param("wordId"));
  if (!Number.isInteger(wordId)) return c.json({ error: "bad-request" }, 400);
  const w = await getDb(c.env)
    .select({ key: schema.words.audioKey })
    .from(schema.words)
    .where(eq(schema.words.id, wordId))
    .get();
  if (!w?.key) return c.json({ error: "not-found" }, 404);
  const obj = await c.env.AUDIO.get(w.key);
  if (!obj) return c.json({ error: "not-found" }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "audio/mpeg",
      "cache-control": "public, max-age=31536000, immutable",
      etag: obj.httpEtag,
    },
  });
});
