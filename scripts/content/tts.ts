/**
 * Generates pronunciation audio with Workers AI (MeloTTS) and uploads it to R2.
 * Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI permission).
 * Usage: pnpm content:tts [--remote] [--env staging] [--limit N]
 * Output: content/raw/audio/{wordId}.mp3 -> R2 key audio/{wordId}.mp3, words.audio_key updated.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SETS } from "../../content/topics";
import { RAW_DIR, ROOT, readSet, readText, writeText } from "./lib";
import { parseTarget, wrangler } from "./target";

const MODEL = "@cf/myshell-ai/melotts";

async function synth(account: string, token: string, text: string): Promise<Buffer> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt: text, lang: "en" }),
  });
  if (!res.ok) throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { result?: { audio?: string } };
  const b64 = json.result?.audio;
  if (!b64) throw new Error("no audio in response");
  return Buffer.from(b64, "base64");
}

async function main() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN");
  const t = parseTarget(process.argv);
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;

  const ids: Record<string, number> = JSON.parse(readText(join(ROOT, "content", "ids.json")));
  const dir = join(RAW_DIR, "audio");
  mkdirSync(dir, { recursive: true });

  const lemmas = SETS.flatMap((s) => readSet(s.slug).map((r) => r.lemma)).slice(0, limit);
  const updates: string[] = [];
  for (const lemma of lemmas) {
    const id = ids[lemma.toLowerCase()];
    if (!id) continue;
    const file = join(dir, `${id}.mp3`);
    if (!existsSync(file)) {
      writeFileSync(file, await synth(account, token, lemma));
      console.log(`synth ${lemma}`);
    }
    wrangler([
      "r2",
      "object",
      "put",
      `${t.bucket}/audio/${id}.mp3`,
      "--file",
      file,
      "--content-type",
      "audio/mpeg",
      t.remote ? "--remote" : "--local",
      ...(t.env ? ["--env", t.env] : []),
    ]);
    updates.push(`UPDATE words SET audio_key = 'audio/${id}.mp3' WHERE id = ${id};`);
  }

  const sqlFile = join(ROOT, ".tmp", "audio.sql");
  writeText(sqlFile, `${updates.join("\n")}\n`);
  wrangler(["d1", "execute", t.dbName, "--file", sqlFile, t.remote ? "--remote" : "--local", ...(t.env ? ["--env", t.env] : [])]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
