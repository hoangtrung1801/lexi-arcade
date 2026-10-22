/**
 * Downloads raw inputs into content/raw (git-ignored):
 *  - Oxford 3000/5000 CSVs (winterdl/oxford-5000-vocabulary-audio-definition): A1–C1
 *  - Octanove C1/C2 vocabulary profile (openlanguageprofiles/olp-en-cefrj, CC BY-SA 4.0): C2
 *  - kaikki.org Wiktionary extract per lemma (IPA + Vietnamese translations)
 * Usage: pnpm tsx scripts/content/fetch.ts [--limit N]
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, parseCsv, RAW_DIR, readText, writeText } from "./lib";

const OXFORD_BASE =
  "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/master/data";
const RAW_FILES: Record<string, string> = {
  "oxford_3000.csv": `${OXFORD_BASE}/oxford_3000.csv`,
  "oxford_5000.csv": `${OXFORD_BASE}/oxford_5000.csv`,
  "octanove_c1c2.csv":
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
};

async function get(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch {}
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

export function kaikkiUrl(lemma: string) {
  const w = lemma.toLowerCase();
  const a = w.slice(0, 1);
  const ab = w.length > 1 ? w.slice(0, 2) : `${w}-`;
  return `https://kaikki.org/dictionary/English/meaning/${a}/${ab}/${encodeURIComponent(w)}.jsonl`;
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
  ensureDir(join(RAW_DIR, "kaikki"));

  for (const [name, url] of Object.entries(RAW_FILES)) {
    if (existsSync(join(RAW_DIR, name))) continue;
    console.log(`Downloading ${name}…`);
    const csv = await get(url);
    if (!csv) throw new Error(`could not download ${name}`);
    writeText(join(RAW_DIR, name), csv);
  }

  const words = [
    ...parseCsv(readText(join(RAW_DIR, "oxford_5000.csv")))
      .filter((r) => ["a1", "a2", "b1", "b2", "c1"].includes(r.cefr ?? ""))
      .map((r) => r.word ?? ""),
    ...parseCsv(readText(join(RAW_DIR, "octanove_c1c2.csv")))
      .filter((r) => r.CEFR === "C2")
      .map((r) => r.headword ?? ""),
  ];
  const lemmas = [
    ...new Set(
      words
        .map((w) => w.trim())
        .filter((w) => /^[A-Za-z]{2,}$/.test(w))
        .map((w) => w.toLowerCase()),
    ),
  ].slice(0, limit);

  let done = 0;
  let missing = 0;
  const queue = lemmas.filter((l) => !existsSync(join(RAW_DIR, "kaikki", `${l}.jsonl`)));
  console.log(`${lemmas.length} lemmas, ${queue.length} to fetch from kaikki.org`);
  const workers = Array.from({ length: 4 }, async () => {
    for (let l = queue.shift(); l !== undefined; l = queue.shift()) {
      const body = await get(kaikkiUrl(l));
      if (body === null) missing++;
      writeText(join(RAW_DIR, "kaikki", `${l}.jsonl`), body ?? "");
      if (++done % 100 === 0) console.log(`  ${done} fetched`);
    }
  });
  await Promise.all(workers);
  console.log(`Done. ${missing} lemmas had no Wiktionary page.`);
}

main();
