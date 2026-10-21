import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RAW_DIR = join(ROOT, "content", "raw");
export const SETS_DIR = join(ROOT, "content", "sets");

export function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

/** Minimal RFC 4180 CSV parser (handles quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function toCsv(rows: Record<string, string | number | boolean>[], columns: string[]): string {
  const esc = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return `${[columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(","))].join("\n")}\n`;
}

export function readText(path: string) {
  return readFileSync(path, "utf8");
}
export function writeText(path: string, text: string) {
  ensureDir(dirname(path));
  writeFileSync(path, text);
}

export const SET_COLUMNS = [
  "unit",
  "lemma",
  "pos",
  "cefr",
  "meaning_vi",
  "ipa",
  "topic",
  "source",
  "reviewed",
];

export interface SetRow {
  unit: number;
  lemma: string;
  pos: string;
  cefr: string;
  meaning_vi: string;
  ipa: string;
  topic: string;
  source: string;
  reviewed: boolean;
}

export function readSet(slug: string): SetRow[] {
  return parseCsv(readText(join(SETS_DIR, `${slug}.csv`))).map((r) => ({
    unit: Number(r.unit),
    lemma: r.lemma ?? "",
    pos: r.pos ?? "",
    cefr: r.cefr ?? "",
    meaning_vi: r.meaning_vi ?? "",
    ipa: r.ipa ?? "",
    topic: r.topic ?? "",
    source: r.source ?? "",
    reviewed: r.reviewed === "true",
  }));
}
