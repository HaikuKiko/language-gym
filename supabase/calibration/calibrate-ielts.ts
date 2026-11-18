/**
 * Calibration check: how close are the app's IELTS Task 2 bands to yours?
 *
 * 1. Make a CSV (see template.csv) with one essay per row and your bands:
 *      id, prompt, essay_type, essay, tr, cc, lr, gra, overall
 *    essay_type and overall are optional. Excel/Google Sheets "Save as CSV" works.
 * 2. Score the essays (needs an Anthropic API key; essays go only to Claude,
 *    nothing is saved in Supabase):
 *      ANTHROPIC_API_KEY=sk-ant-... deno run -A \
 *        --config supabase/functions/assess-writing/deno.json \
 *        supabase/calibration/calibrate-ielts.ts my-marks.csv
 *    This writes my-marks.results.csv (your bands next to the app's) and prints
 *    the agreement report.
 * 3. To see the report again without scoring again:
 *      deno run -A --config supabase/functions/assess-writing/deno.json \
 *        supabase/calibration/calibrate-ielts.ts --report my-marks.results.csv
 *
 * Options: --effort low|medium|high (default: the app's setting), to compare.
 */
import Anthropic from "@anthropic-ai/sdk";

import {
  assessIeltsTask2,
  CRITERION_CODES,
  ESSAY_TYPES,
  type EssayType,
  IELTS_CRITERIA,
  IELTS_EFFORT,
  roundOverall,
} from "../functions/assess-writing/ielts.ts";
import { agreement, type Pair, parseCsv, toCsv } from "./stats.ts";

const CODES = IELTS_CRITERIA.map((c) => CRITERION_CODES[c]);

const RESULT_COLUMNS = [
  "id",
  ...CODES.flatMap((c) => [c, `app_${c}`]),
  "overall",
  "app_overall",
  "word_count",
  "app_length_penalty",
  "app_confidence",
  "error",
];

function band(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function teacherOverall(row: Record<string, string>): number | null {
  const given = band(row.overall);
  if (given !== null) return given;
  const bands = CODES.map((c) => band(row[c]));
  if (bands.some((b) => b === null)) return null;
  return roundOverall((bands as number[]).reduce((a, b) => a + b, 0) / bands.length);
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function signed(x: number): string {
  return `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;
}

export function report(rows: Record<string, string>[]): string {
  const lines: string[] = [];
  const scored = rows.filter((r) => !r.error);
  lines.push(`Essays scored: ${scored.length} of ${rows.length}`);
  lines.push("");
  lines.push("Criterion                         n  Same band  Within 1  Avg diff  Avg size");
  for (const name of IELTS_CRITERIA) {
    const code = CRITERION_CODES[name];
    const pairs: Pair[] = [];
    for (const r of scored) {
      const t = band(r[code]);
      const a = band(r[`app_${code}`]);
      if (t !== null && a !== null) pairs.push({ teacher: t, ai: a });
    }
    const s = agreement(pairs, 1);
    lines.push(
      `${name.padEnd(32)} ${String(s.n).padStart(2)}  ${pct(s.exact).padStart(9)}  ${pct(s.within).padStart(8)}  ${
        signed(s.mean_difference).padStart(8)
      }  ${s.mean_absolute_difference.toFixed(2).padStart(8)}`,
    );
  }
  const overall: Pair[] = [];
  for (const r of scored) {
    const t = band(r.overall);
    const a = band(r.app_overall);
    if (t !== null && a !== null) overall.push({ teacher: t, ai: a });
  }
  const o = agreement(overall, 0.5);
  lines.push("");
  lines.push(
    `Overall band: same ${pct(o.exact)}, within 0.5 ${pct(o.within)}, average difference ${
      signed(o.mean_difference)
    }, average size ${o.mean_absolute_difference.toFixed(2)} (n = ${o.n})`,
  );
  lines.push("");
  lines.push("Avg diff is the app minus you: + means the app marks higher than you, - lower.");
  return lines.join("\n");
}

async function main() {
  const args = [...Deno.args];
  const reportOnly = args.includes("--report");
  const effortIndex = args.indexOf("--effort");
  const effort = effortIndex >= 0 ? args[effortIndex + 1] : IELTS_EFFORT;
  if (!["low", "medium", "high"].includes(effort)) throw new Error("--effort must be low, medium or high");
  const positional = args.filter((a, i) => !a.startsWith("--") && !(effortIndex >= 0 && i === effortIndex + 1));
  const file = positional[0];
  if (!file) {
    console.error("Usage: calibrate-ielts.ts [--effort medium] essays.csv   |   --report essays.results.csv");
    Deno.exit(1);
  }

  const rows = parseCsv(await Deno.readTextFile(file));
  if (reportOnly) {
    console.log(report(rows));
    return;
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY first.");
  const client = new Anthropic({ apiKey });

  const results: Record<string, string | number | null>[] = [];
  for (const [i, row] of rows.entries()) {
    const id = row.id || String(i + 1);
    const out: Record<string, string | number | null> = { id, overall: teacherOverall(row) };
    for (const c of CODES) out[c] = band(row[c]);
    if (!row.essay?.trim() || !row.prompt?.trim()) {
      out.error = "missing essay or prompt";
      results.push(out);
      continue;
    }
    const essayType = ESSAY_TYPES.includes(row.essay_type?.trim() as EssayType)
      ? (row.essay_type.trim() as EssayType)
      : null;
    console.error(`Scoring ${id} (${i + 1}/${rows.length})...`);
    try {
      const result = await assessIeltsTask2(client, {
        text: row.essay,
        prompt: row.prompt,
        essayType,
        effort: effort as "low" | "medium" | "high",
      });
      if (!result.ok) {
        out.error = result.reason;
      } else {
        const f = result.feedback;
        for (const c of f.criteria) out[`app_${c.code}`] = c.band;
        out.app_overall = f.overall_band;
        out.word_count = f.word_count;
        out.app_length_penalty = f.length_penalty_applied ? "yes" : "no";
        out.app_confidence = f.confidence;
      }
    } catch (error) {
      out.error = error instanceof Error ? error.message.slice(0, 200) : "error";
    }
    results.push(out);
  }

  const outFile = file.replace(/\.csv$/i, "") + ".results.csv";
  await Deno.writeTextFile(outFile, toCsv(results, RESULT_COLUMNS));
  console.log(report(parseCsv(toCsv(results, RESULT_COLUMNS))));
  console.log(`\nSaved: ${outFile}`);
}

if (import.meta.main) await main();
