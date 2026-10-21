/** Content checks. Errors exit 1; warnings only print. Usage: pnpm content:validate */
import { SETS, TOPIC_TITLE } from "../../content/topics";
import { readSet } from "./lib";

let errors = 0;
let warnings = 0;
const err = (m: string) => {
  errors++;
  console.error(`ERROR  ${m}`);
};
const warn = (m: string) => {
  warnings++;
  console.warn(`warn   ${m}`);
};

const seen = new Map<string, string>();
for (const set of SETS) {
  const rows = readSet(set.slug);
  if (rows.length === 0) err(`${set.slug}: empty`);
  const units = new Map<number, number>();
  for (const r of rows) {
    const key = r.lemma.toLowerCase();
    if (!/^[A-Za-z]+$/.test(r.lemma)) err(`${set.slug}: "${r.lemma}" has characters that are hard to type`);
    if (r.lemma.length < 2 || r.lemma.length > 14) err(`${set.slug}: "${r.lemma}" length out of range`);
    if (seen.has(key)) err(`duplicate lemma "${r.lemma}" (${seen.get(key)} and ${set.slug})`);
    seen.set(key, set.slug);
    if (!r.meaning_vi.trim()) err(`${set.slug}: "${r.lemma}" has no Vietnamese meaning`);
    if (!r.ipa) warn(`${set.slug}: "${r.lemma}" has no IPA`);
    if (!TOPIC_TITLE[r.topic]) err(`${set.slug}: "${r.lemma}" has unknown topic "${r.topic}"`);
    if (!Number.isInteger(r.unit) || r.unit < 1) err(`${set.slug}: "${r.lemma}" has bad unit`);
    units.set(r.unit, (units.get(r.unit) ?? 0) + 1);
  }
  for (const [u, n] of units) if (n < 8 || n > 16) warn(`${set.slug}: unit ${u} has ${n} words`);
  const unreviewed = rows.filter((r) => !r.reviewed).length;
  console.log(`${set.slug}: ${rows.length} words, ${units.size} units, ${unreviewed} not reviewed yet`);
}

console.log(`${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
