// Run: deno test --config supabase/functions/assess-writing/deno.json supabase/calibration/stats.test.ts
import { assertEquals } from "jsr:@std/assert@1.0.13";

import { report } from "./calibrate-ielts.ts";
import { agreement, parseCsv, toCsv } from "./stats.ts";

Deno.test("agreement counts exact, within tolerance and the average difference", () => {
  const a = agreement([
    { teacher: 6, ai: 6 },
    { teacher: 6, ai: 7 },
    { teacher: 7, ai: 5 },
    { teacher: 5, ai: 5 },
  ], 1);
  assertEquals(a.n, 4);
  assertEquals(a.exact, 0.5);
  assertEquals(a.within, 0.75);
  assertEquals(a.mean_difference, -0.25);
  assertEquals(a.mean_absolute_difference, 0.75);
});

Deno.test("CSV with quotes, commas and line breaks survives a round trip", () => {
  const rows = [{ id: "a", essay: 'He said "yes", then\nleft.' }];
  const back = parseCsv(toCsv(rows, ["id", "essay"]));
  assertEquals(back, rows);
});

Deno.test("reads Excel-style CSV with a byte-order mark and Windows line ends", () => {
  const rows = parseCsv('﻿ID,Essay\r\n1,"x, y"\r\n');
  assertEquals(rows, [{ id: "1", essay: "x, y" }]);
});

Deno.test("report", () => {
  const rows = parseCsv(
    [
      "id,tr,app_tr,cc,app_cc,lr,app_lr,gra,app_gra,overall,app_overall,error",
      "1,6,6,6,7,6,6,5,6,6,6,",
      "2,7,6,6,6,7,7,6,6,6.5,6,",
      "3,,,,,,,,,,,missing essay or prompt",
    ].join("\n"),
  );
  const text = report(rows);
  console.log(text);
  assertEquals(text.includes("Essays scored: 2 of 3"), true);
});
