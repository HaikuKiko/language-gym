// Run: deno test supabase/functions/assess-writing/ielts.test.ts
import { assertEquals } from "jsr:@std/assert@1.0.13";

import { type IeltsClaudeOutput, parseTargetBand, roundOverall, scoreEssay } from "./ielts.ts";

function output(tr: number, cc: number, lr: number, gra: number): IeltsClaudeOutput {
  const c = (criterion: IeltsClaudeOutput["criteria"][number]["criterion"], band: number) => ({
    criterion,
    band,
    comment: "",
    next_band: "",
  });
  return {
    confidence: "high",
    task_check: { parts: [], position_comment: "" },
    criteria: [
      c("Grammatical Range and Accuracy", gra), // order should not matter
      c("Task Response", tr),
      c("Coherence and Cohesion", cc),
      c("Lexical Resource", lr),
    ],
    summary: "",
    strengths: [],
    corrections: [],
    paragraphing: { comment: "", new_paragraph_before: [] },
    to_reach_target: [],
  };
}

Deno.test("overall band rounds down to the nearest half band", () => {
  assertEquals(roundOverall(6), 6);
  assertEquals(roundOverall(6.25), 6);
  assertEquals(roundOverall(6.5), 6.5);
  assertEquals(roundOverall(6.75), 6.5);
});

Deno.test("scores the four criteria and the overall band", () => {
  const s = scoreEssay(output(7, 6, 6, 6), 280, 250)!;
  assertEquals(s.criteria.map((c) => c.code), ["tr", "cc", "lr", "gra"]);
  assertEquals(s.criteria.map((c) => c.band), [7, 6, 6, 6]);
  assertEquals(s.overall_band, 6); // 6.25 rounds down
  assertEquals(s.length_penalty_applied, false);
});

Deno.test("under the word limit lowers Task Response only", () => {
  const s = scoreEssay(output(7, 7, 6, 6), 230, 250)!;
  assertEquals(s.criteria.map((c) => c.band), [6, 7, 6, 6]);
  assertEquals(s.criteria[0].band_before_length, 7);
  assertEquals(s.overall_band, 6); // 6.25
  assertEquals(s.length_penalty_applied, true);
});

Deno.test("exactly 250 words is not under the limit", () => {
  assertEquals(scoreEssay(output(6, 6, 6, 6), 250, 250)!.length_penalty_applied, false);
});

Deno.test("bands are kept between 0 and 9", () => {
  const s = scoreEssay(output(12, -1, 6, 6), 300, 250)!;
  assertEquals(s.criteria.map((c) => c.band), [9, 0, 6, 6]);
});

Deno.test("a missing or repeated criterion is rejected", () => {
  const o = output(6, 6, 6, 6);
  o.criteria[0].criterion = "Task Response"; // now TR twice, GRA missing
  assertEquals(scoreEssay(o, 300, 250), null);
});

Deno.test("target bands", () => {
  assertEquals(parseTargetBand("6.5"), 6.5);
  assertEquals(parseTargetBand(" 7 "), 7);
  assertEquals(parseTargetBand("6.3"), null);
  assertEquals(parseTargetBand(""), null);
  assertEquals(parseTargetBand(null), null);
  assertEquals(parseTargetBand("B2"), null);
});
