/**
 * Agreement between the teacher's bands and the app's bands, and a small CSV
 * reader/writer (essays contain commas, quotes and line breaks).
 */

export type Pair = { teacher: number; ai: number };

export type Agreement = {
  n: number;
  /** Share of essays with exactly the same band (0-1). */
  exact: number;
  /** Share within the tolerance: 1 band for criteria, 0.5 for the overall band (0-1). */
  within: number;
  tolerance: number;
  /** Average of (app - teacher). Positive means the app marks higher than you. */
  mean_difference: number;
  /** Average size of the difference, ignoring direction. */
  mean_absolute_difference: number;
};

export function agreement(pairs: Pair[], tolerance: number): Agreement {
  const n = pairs.length;
  if (n === 0) {
    return { n, exact: 0, within: 0, tolerance, mean_difference: 0, mean_absolute_difference: 0 };
  }
  const diffs = pairs.map((p) => p.ai - p.teacher);
  return {
    n,
    exact: diffs.filter((d) => d === 0).length / n,
    within: diffs.filter((d) => Math.abs(d) <= tolerance + 1e-9).length / n,
    tolerance,
    mean_difference: diffs.reduce((a, b) => a + b, 0) / n,
    mean_absolute_difference: diffs.reduce((a, b) => a + Math.abs(b), 0) / n,
  };
}

/** Parses CSV (RFC 4180: quoted fields, "" for a quote, line breaks inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, ""); // Excel adds a byte-order mark
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function toCsv(rows: Record<string, string | number | null>[], columns: string[]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c] ?? null)).join(","))].join("\n") +
    "\n";
}
