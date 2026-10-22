/**
 * Builds content/sets/{a1,a2,b1,b2,c1,c2}.csv from:
 *  - content/raw/oxford_3000.csv      (lemma, part of speech, CEFR level only): A1–B2
 *  - content/raw/oxford_5000.csv      (same columns): C1 words not already in A1–B2
 *  - content/raw/octanove_c1c2.csv    (Octanove profile, CC BY-SA 4.0): C2 words not in Oxford 5000
 *  - content/raw/kaikki/*.jsonl       (IPA + Vietnamese translations from Wiktionary)
 *  - content/meanings-vi.txt          (machine-written Vietnamese meaning + topic, reviewed=false)
 * Definitions/examples from the Oxford file are intentionally NOT used (copyright).
 * Existing set files are kept (they may hold manual reviews); --force rebuilds them too.
 * Usage: pnpm content:build [--force]
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SETS, TOPICS } from "../../content/topics";
import {
  parseCsv,
  RAW_DIR,
  ROOT,
  readText,
  SET_COLUMNS,
  SETS_DIR,
  type SetRow,
  toCsv,
  writeText,
} from "./lib";

const POS_ABBR: Record<string, string> = {
  noun: "n",
  verb: "v",
  adjective: "adj",
  adverb: "adv",
  pronoun: "pron",
  preposition: "prep",
  determiner: "det",
  number: "num",
  exclamation: "excl",
  conjunction: "conj",
  "modal verb": "modal",
  "ordinal number": "ord",
  "auxiliary verb": "aux",
  "linking verb": "link",
  "definite article": "art",
  "infinitive marker": "to",
  vern: "v", // typo in the Octanove list
};

interface Wikt {
  ipa: string;
  vi: string[];
}

function readWiktionary(lemma: string): Wikt {
  const path = join(RAW_DIR, "kaikki", `${lemma.toLowerCase()}.jsonl`);
  const out: Wikt = { ipa: "", vi: [] };
  if (!existsSync(path)) return out;
  // General-American > untagged > Received-Pronunciation; other regional variants are ignored.
  let best = "";
  let bestScore = 0;
  for (const line of readText(path).split("\n")) {
    if (!line.trim()) continue;
    let e: {
      lang_code?: string;
      sounds?: { ipa?: string; tags?: string[] }[];
      translations?: { lang_code?: string; word?: string }[];
    };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.lang_code !== "en") continue;
    for (const s of e.sounds ?? []) {
      if (!s.ipa?.startsWith("/")) continue;
      const tags = s.tags ?? [];
      const score = tags.includes("General-American")
        ? 3
        : tags.length === 0
          ? 2
          : tags.every((t) => t === "Received-Pronunciation")
            ? 1
            : 0.5; // other dialects: used only if nothing better exists
      if (score > bestScore) {
        best = s.ipa;
        bestScore = score;
      }
    }
    for (const t of e.translations ?? []) {
      if (t.lang_code === "vi" && t.word && !out.vi.includes(t.word)) out.vi.push(t.word);
    }
  }
  out.ipa = best;
  return out;
}

function readMeanings(): Map<string, { meaning: string; topic: string }> {
  const map = new Map<string, { meaning: string; topic: string }>();
  for (const line of readText(join(ROOT, "content", "meanings-vi.txt")).split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [lemma, meaning, topic] = line.split("|");
    if (lemma && meaning && topic) map.set(lemma.toLowerCase(), { meaning, topic });
  }
  return map;
}

/** Split n words into k near-equal chunks, k = round(n / target). */
function chunkSizes(n: number, target = 12): number[] {
  let k = Math.max(1, Math.round(n / target));
  if (n / k > target + 2) k++;
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

function main() {
  const force = process.argv.includes("--force");

  const meanings = readMeanings();
  const idsPath = join(ROOT, "content", "ids.json");
  const ids: Record<string, number> = existsSync(idsPath) ? JSON.parse(readText(idsPath)) : {};
  let nextId = Math.max(0, ...Object.values(ids)) + 1;

  // A word belongs to its easiest level. Its parts of speech come from the A entries when it
  // has any (A1/A2 words keep the senses learners meet first), else from the B entries.
  const LEVELS = ["a1", "a2", "b1", "b2"];
  const entries = new Map<string, { lemma: string; cefr: string; type: string }[]>();
  for (const r of parseCsv(readText(join(RAW_DIR, "oxford_3000.csv")))) {
    const cefr = r.cefr ?? "";
    if (!LEVELS.includes(cefr)) continue;
    const lemma = (r.word ?? "").trim();
    if (!/^[A-Za-z]{2,14}$/.test(lemma)) continue;
    const key = lemma.toLowerCase();
    entries.set(key, [...(entries.get(key) ?? []), { lemma, cefr, type: (r.type ?? "").trim() }]);
  }
  const byLemma = new Map<string, { lemma: string; pos: string[]; cefr: string }>();
  for (const [key, es] of entries) {
    const cefr = LEVELS.find((l) => es.some((e) => e.cefr === l)) ?? "b2";
    const group = cefr.startsWith("a") ? "a" : "b";
    const pos: string[] = [];
    for (const e of es.filter((x) => x.cefr.startsWith(group))) {
      const p = POS_ABBR[e.type] ?? e.type;
      if (p && !pos.includes(p)) pos.push(p);
    }
    byLemma.set(key, { lemma: es[0]?.lemma ?? key, pos, cefr });
  }

  // C1: the Oxford 5000 additions. C2: Octanove's C2 list minus anything Oxford rates lower.
  // Only words with an English Wiktionary entry are kept, which drops typos in the sources.
  const hasWiktionary = (lemma: string) => readWiktionary(lemma).ipa !== "";
  const addUpper = (lemma: string, type: string, cefr: string) => {
    const key = lemma.toLowerCase();
    if (!/^[A-Za-z]{2,14}$/.test(lemma)) return;
    const w = byLemma.get(key);
    if (w && w.cefr !== cefr) return;
    const p = POS_ABBR[type] ?? type;
    if (w) {
      if (p && !w.pos.includes(p)) w.pos.push(p);
    } else if (hasWiktionary(lemma)) byLemma.set(key, { lemma, pos: p ? [p] : [], cefr });
  };
  const oxford5000 = parseCsv(readText(join(RAW_DIR, "oxford_5000.csv")));
  const inOxford = new Set(oxford5000.map((r) => (r.word ?? "").trim().toLowerCase()));
  for (const r of oxford5000) {
    if (r.cefr === "c1") addUpper((r.word ?? "").trim(), (r.type ?? "").trim(), "c1");
  }
  for (const r of parseCsv(readText(join(RAW_DIR, "octanove_c1c2.csv")))) {
    const lemma = (r.headword ?? "").trim();
    if (r.CEFR === "C2" && !inOxford.has(lemma.toLowerCase())) {
      addUpper(lemma, (r.pos ?? "").trim(), "c2");
    }
  }

  let fromLlm = 0;
  let fromWikt = 0;
  let missing = 0;
  for (const set of SETS) {
    if (existsSync(join(SETS_DIR, `${set.slug}.csv`)) && !force) {
      console.log(`${set.slug}: kept existing content/sets/${set.slug}.csv`);
      continue;
    }
    const words = [...byLemma.values()].filter((w) => w.cefr === set.cefr);
    const rows: Omit<SetRow, "unit">[] = words.map((w) => {
      const wikt = readWiktionary(w.lemma);
      const m = meanings.get(w.lemma.toLowerCase());
      let meaning = m?.meaning ?? "";
      let source = "llm";
      if (meaning) fromLlm++;
      else if (wikt.vi[0]) {
        meaning = wikt.vi[0];
        source = "wiktionary";
        fromWikt++;
      } else missing++;
      return {
        lemma: w.lemma,
        pos: w.pos.join("/"),
        cefr: w.cefr,
        meaning_vi: meaning,
        ipa: wikt.ipa,
        topic: m?.topic ?? "misc",
        source,
        reviewed: false,
      };
    });

    const out: SetRow[] = [];
    let unit = 0;
    let carry: Omit<SetRow, "unit">[] = [];
    TOPICS.forEach((topic, ti) => {
      const group = [
        ...carry,
        ...rows
          .filter((r) => r.topic === topic.key)
          .sort((a, b) => a.lemma.length - b.lemma.length || a.lemma.localeCompare(b.lemma)),
      ];
      carry = [];
      // A tiny leftover group is merged into the next topic instead of becoming its own unit.
      if (group.length < 8 && ti < TOPICS.length - 1) {
        carry = group;
        return;
      }
      let i = 0;
      for (const size of group.length ? chunkSizes(group.length) : []) {
        unit++;
        for (const r of group.slice(i, i + size)) out.push({ ...r, unit });
        i += size;
      }
    });
    writeText(join(SETS_DIR, `${set.slug}.csv`), toCsv(out as never, SET_COLUMNS));
    console.log(`${set.slug}: ${out.length} words in ${unit} units`);
  }

  for (const w of byLemma.values()) {
    const key = w.lemma.toLowerCase();
    if (!(key in ids)) ids[key] = nextId++;
  }
  writeText(idsPath, `${JSON.stringify(ids, null, 0).replaceAll(",", ",\n")}\n`);
  console.log(`meanings: ${fromLlm} llm, ${fromWikt} wiktionary fallback, ${missing} missing`);
}

main();
