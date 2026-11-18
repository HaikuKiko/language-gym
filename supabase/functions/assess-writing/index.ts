/**
 * assess-writing: a student sends a piece of writing and gets back a CEFR
 * level estimate and feedback from Claude.
 *
 * The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret
 * (Supabase dashboard -> Edge Functions -> Secrets). Each signed-in user (guest
 * students included) can submit DAILY_LIMIT pieces a day (default 5). Only the
 * word count, level and token usage are stored, not the writing itself.
 *
 * Request:  POST { text, level, task?, week? }   (with the user's auth token)
 * Response: 200 { feedback, remaining_today }
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

import {
  assessWriting,
  countWords,
  MAX_WORDS,
  MIN_WORDS,
  MODEL,
  STUDENT_LEVELS,
  type StudentLevel,
} from "./assess.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function fail(status: number, error: string, message: string): Response {
  return reply(status, { error, message });
}

const dailyLimit = Number(Deno.env.get("DAILY_LIMIT") ?? "5");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return fail(503, "not_configured", "Writing feedback is not set up yet. Please try again later.");
  }

  // Who is asking: the user behind the token the app sent.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return fail(401, "not_signed_in", "Please sign in first.");
  const userId = userData.user.id;

  // Check the request.
  let body: { text?: unknown; level?: unknown; task?: unknown; week?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "The request was not valid JSON.");
  }
  const text = typeof body.text === "string" ? body.text : "";
  const level = STUDENT_LEVELS.includes(body.level as StudentLevel)
    ? (body.level as StudentLevel)
    : null;
  const task = typeof body.task === "string" ? body.task.slice(0, 500) : undefined;
  const week =
    typeof body.week === "number" && Number.isInteger(body.week) && body.week >= 1 && body.week <= 16
      ? body.week
      : null;

  if (!level) return fail(400, "bad_request", "Choose your level.");
  const words = countWords(text);
  if (words < MIN_WORDS) {
    return fail(400, "too_short", `Please write at least ${MIN_WORDS} words.`);
  }
  if (words > MAX_WORDS) {
    return fail(400, "too_long", `Please write ${MAX_WORDS} words or fewer.`);
  }

  // The daily limit, counted with the service role so students can't skip it.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await admin
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (countError) return fail(500, "server_error", "Something went wrong. Please try again.");
  const usedToday = count ?? 0;
  if (usedToday >= dailyLimit) {
    return fail(
      429,
      "daily_limit",
      `You have used all ${dailyLimit} feedback checks for today. Try again tomorrow.`,
    );
  }

  // This week's grammar point, so the feedback can pay attention to it.
  let focusGrammar: string | undefined;
  if (week) {
    const { data: weekRow } = await admin
      .from("weeks")
      .select("grammar")
      .eq("level", level)
      .eq("week", week)
      .maybeSingle();
    focusGrammar = weekRow?.grammar ?? undefined;
  }

  const anthropic = new Anthropic({ apiKey });
  let result;
  try {
    result = await assessWriting(anthropic, { text, level, task, focusGrammar });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return fail(503, "busy", "The feedback service is busy. Please try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error", error.status, error.message);
      return fail(502, "upstream_error", "Feedback is not available right now. Please try again later.");
    }
    console.error("Unexpected error", error);
    return fail(500, "server_error", "Something went wrong. Please try again.");
  }

  if (!result.ok) {
    console.error("Assessment failed", result.reason, result.detail ?? "");
    return fail(
      422,
      "no_feedback",
      result.reason === "refused"
        ? "We couldn't give feedback on this piece of writing. Please try a different text."
        : "We couldn't finish the feedback this time. Please try again.",
    );
  }

  const { error: insertError } = await admin.from("writing_submissions").insert({
    user_id: userId,
    level,
    week,
    word_count: words,
    cefr_level: result.feedback.cefr_level,
    model: MODEL,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
  });
  if (insertError) console.error("Could not record submission", insertError.message);

  return reply(200, {
    feedback: result.feedback,
    remaining_today: Math.max(0, dailyLimit - usedToday - 1),
  });
});
