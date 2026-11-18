/**
 * assess-writing: a student sends a piece of writing and gets back a CEFR
 * level estimate and feedback from Claude. It can also read a photo of
 * handwriting and return it as text, for the student to check before asking
 * for feedback.
 *
 * The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret
 * (Supabase dashboard -> Edge Functions -> Secrets). Each signed-in user (guest
 * students included) gets DAILY_LIMIT feedback checks and DAILY_LIMIT photo
 * readings a day (default 5 of each). Only word counts, levels and token
 * usage are stored, never the writing or the photo.
 *
 * Feedback:  POST { text, level, task?, week? }
 *            -> 200 { feedback, remaining_today }
 * Photo:     POST { mode: "transcribe", image, media_type }   (image is base64)
 *            -> 200 { transcript, legibility, contains_writing, note, remaining_today }
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  assessWriting,
  countWords,
  IMAGE_MEDIA_TYPES,
  type ImageMediaType,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_WORDS,
  MIN_WORDS,
  MODEL,
  STUDENT_LEVELS,
  type StudentLevel,
  transcribeImage,
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

const dailyLimitSetting = Deno.env.get("DAILY_LIMIT");
const parsedLimit = Number.parseInt((dailyLimitSetting ?? "5").trim(), 10);
const dailyLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;
// Shows in the function logs, to check the setting Supabase passes in.
console.log(`Daily limit: ${dailyLimit} (DAILY_LIMIT setting: ${JSON.stringify(dailyLimitSetting ?? null)})`);

type Kind = "feedback" | "transcribe";

/** How many times this user has used this kind of check today (UTC). */
async function usedToday(admin: SupabaseClient, userId: string, kind: Kind): Promise<number | null> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", since.toISOString());
  return error ? null : (count ?? 0);
}

/** Turns an error from the Claude call into a reply for the student. */
function claudeError(error: unknown): Response {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "The request was not valid JSON.");
  }

  // Limits are counted with the service role so students can't skip them.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anthropic = new Anthropic({ apiKey });

  // ---- Reading a photo of handwriting ------------------------------------
  if (body.mode === "transcribe") {
    const image = typeof body.image === "string" ? body.image : "";
    const mediaType = IMAGE_MEDIA_TYPES.includes(body.media_type as ImageMediaType)
      ? (body.media_type as ImageMediaType)
      : null;
    if (!image || !mediaType) return fail(400, "bad_request", "Please choose a photo.");
    if (image.length > MAX_IMAGE_BASE64_LENGTH) {
      return fail(400, "too_large", "That photo is too large. Please try again.");
    }

    const used = await usedToday(admin, userId, "transcribe");
    if (used === null) return fail(500, "server_error", "Something went wrong. Please try again.");
    if (used >= dailyLimit) {
      return fail(
        429,
        "daily_limit",
        `You have used all ${dailyLimit} photo readings for today. You can still type your writing.`,
      );
    }

    let result;
    try {
      result = await transcribeImage(anthropic, { data: image, mediaType });
    } catch (error) {
      return claudeError(error);
    }
    if (!result.ok) {
      console.error("Transcription failed", result.reason, result.detail ?? "");
      return fail(422, "no_transcript", "We couldn't read that photo. Please try another one or type your writing.");
    }

    const { error: insertError } = await admin.from("writing_submissions").insert({
      user_id: userId,
      kind: "transcribe",
      level: "-",
      word_count: countWords(result.transcript.transcript),
      model: MODEL,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    });
    if (insertError) console.error("Could not record transcription", insertError.message);

    return reply(200, {
      ...result.transcript,
      remaining_today: Math.max(0, dailyLimit - used - 1),
    });
  }

  // ---- Feedback on writing ------------------------------------------------
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

  const used = await usedToday(admin, userId, "feedback");
  if (used === null) return fail(500, "server_error", "Something went wrong. Please try again.");
  if (used >= dailyLimit) {
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

  let result;
  try {
    result = await assessWriting(anthropic, { text, level, task, focusGrammar });
  } catch (error) {
    return claudeError(error);
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
    kind: "feedback",
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
    remaining_today: Math.max(0, dailyLimit - used - 1),
  });
});
