/**
 * Generates SQL from content/sets/*.csv and applies it with `wrangler d1 execute`.
 * Word ids come from content/ids.json (stable across re-seeds); unit id = setId * 1000 + unit.
 * Sentence Express sentences come from content/sentences/<set>.tsv;
 * sentence id = setId * 100000 + unit * 100 + its position in the unit.
 * Usage: pnpm content:seed [--remote] [--env staging] [--sql-only]
 */
import { join } from "node:path";
import { SETS, TOPIC_TITLE } from "../../content/topics";
import { ROOT, readSet, readText, writeText } from "./lib";
import { parseTarget, wrangler } from "./target";

const q = (s: string | null) => (s === null || s === "" ? "NULL" : `'${s.replaceAll("'", "''")}'`);

function main() {
  const ids: Record<string, number> = JSON.parse(readText(join(ROOT, "content", "ids.json")));
  const sql: string[] = [];
  const unitWords: string[] = [];

  for (const set of SETS) {
    sql.push(
      `INSERT INTO word_sets (id, slug, name, cefr, sort_order) VALUES (${set.id}, ${q(set.slug)}, ${q(set.name)}, ${q(set.cefr)}, ${set.sortOrder}) ` +
        "ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, cefr=excluded.cefr, sort_order=excluded.sort_order;",
    );
  }

  const unitsSql: string[] = [];
  const sentencesSql: string[] = [];
  const wordsSql: string[] = [];
  for (const set of SETS) {
    const rows = readSet(set.slug);
    const unitNums = [...new Set(rows.map((r) => r.unit))].sort((a, b) => a - b);
    const topicUnits = new Map<string, number[]>();
    for (const u of unitNums) {
      const topic = rows.find((r) => r.unit === u)?.topic ?? "misc";
      topicUnits.set(topic, [...(topicUnits.get(topic) ?? []), u]);
    }
    for (const u of unitNums) {
      const inUnit = rows.filter((r) => r.unit === u);
      const topic = inUnit[0]?.topic ?? "misc";
      const sameTopic = topicUnits.get(topic) ?? [];
      const title =
        (TOPIC_TITLE[topic] ?? topic) +
        (sameTopic.length > 1 ? ` · ${sameTopic.indexOf(u) + 1}` : "");
      const unitId = set.id * 1000 + u;
      unitsSql.push(
        `INSERT INTO units (id, set_id, idx, title_vi, topic, word_count) VALUES (${unitId}, ${set.id}, ${u}, ${q(title)}, ${q(topic)}, ${inUnit.length}) ` +
          "ON CONFLICT(id) DO UPDATE SET set_id=excluded.set_id, idx=excluded.idx, title_vi=excluded.title_vi, topic=excluded.topic, word_count=excluded.word_count;",
      );
      inUnit.forEach((r, i) => {
        const id = ids[r.lemma.toLowerCase()];
        if (!id) throw new Error(`no id for ${r.lemma}; run content:build`);
        wordsSql.push(
          `INSERT INTO words (id, lemma, pos, ipa, meaning_vi, cefr, source, reviewed) VALUES (${id}, ${q(r.lemma)}, ${q(r.pos)}, ${q(r.ipa)}, ${q(r.meaning_vi)}, ${q(r.cefr)}, ${q(r.source)}, ${r.reviewed ? 1 : 0}) ` +
            "ON CONFLICT(id) DO UPDATE SET lemma=excluded.lemma, pos=excluded.pos, ipa=excluded.ipa, meaning_vi=excluded.meaning_vi, cefr=excluded.cefr, source=excluded.source, reviewed=excluded.reviewed;",
        );
        unitWords.push(
          `INSERT INTO unit_words (unit_id, word_id, sort_order) VALUES (${unitId}, ${id}, ${i});`,
        );
      });
    }
    unitsSql.push(`DELETE FROM units WHERE set_id = ${set.id} AND idx > ${unitNums.length};`);

    const lines = readText(join(ROOT, "content", "sentences", `${set.slug}.tsv`))
      .split("\n")
      .slice(1)
      .filter((l) => l.trim());
    const perUnit = new Map<number, number>();
    for (const line of lines) {
      const [unitStr, keyword, en, vi] = line.split("\t");
      const u = Number(unitStr);
      const wordId = ids[(keyword ?? "").toLowerCase()];
      if (!wordId || !en || !vi || !unitNums.includes(u))
        throw new Error(`bad sentence line in ${set.slug}.tsv: ${line}`);
      const i = perUnit.get(u) ?? 0;
      perUnit.set(u, i + 1);
      const id = set.id * 100000 + u * 100 + i;
      sentencesSql.push(
        `INSERT INTO sentences (id, unit_id, word_id, en, vi, sort_order) VALUES (${id}, ${set.id * 1000 + u}, ${wordId}, ${q(en)}, ${q(vi)}, ${i});`,
      );
    }
  }

  const all = [
    ...sql,
    ...wordsSql,
    ...unitsSql.filter((s) => s.startsWith("INSERT")),
    `DELETE FROM unit_words WHERE unit_id IN (SELECT id FROM units WHERE set_id IN (${SETS.map((s) => s.id).join(",")}));`,
    ...unitWords,
    `DELETE FROM sentences WHERE unit_id IN (SELECT id FROM units WHERE set_id IN (${SETS.map((s) => s.id).join(",")}));`,
    ...sentencesSql,
    ...unitsSql.filter((s) => s.startsWith("DELETE")),
  ];
  const file = join(ROOT, ".tmp", "seed.sql");
  writeText(file, `${all.join("\n")}\n`);
  console.log(`wrote ${all.length} statements to .tmp/seed.sql`);

  if (process.argv.includes("--sql-only")) return;
  const t = parseTarget(process.argv);
  wrangler([
    "d1",
    "execute",
    t.dbName,
    "--file",
    file,
    t.remote ? "--remote" : "--local",
    ...(t.env ? ["--env", t.env] : []),
  ]);
}

main();
