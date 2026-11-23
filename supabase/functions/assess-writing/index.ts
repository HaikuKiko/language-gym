/**
 * assess-writing: a student sends a piece of writing and gets back a CEFR
 * level estimate and feedback from Claude. It can also read a photo of
 * handwriting and return it as text, for the student to check before asking
 * for feedback.
 *
 * The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret
 * (Supabase dashboard -> Edge Functions -> Secrets). Each signed-in user (guest
 * students included) gets DAILY_LIMIT feedback checks and PHOTO_DAILY_LIMIT
 * photo readings a day (see the settings below the imports). Usage rows store
 * only word counts, levels and tokens, never the writing or the photo.
 *
 * Results are saved for CACHE_DAYS in response_cache, under a fingerprint of
 * the request: sending the same writing or photo again returns the saved
 * result with cached: true, without calling Claude or using up a check.
 *
 * Feedback:  POST { text, level, task?, week? }            (General English)
 *            -> 200 { feedback, remaining_today }
 * IELTS:     POST { track: "ielts", prompt_id, text }      (Writing Task 2)
 *            -> 200 { feedback, remaining_today }           (feedback.track is "ielts")
 * Teacher:   POST { track: "ielts", teacher: true, question?, text }
 *            Marks any Task 2 essay against any question (or works the
 *            question out), with no enrolment; its own daily limit.
 * Photo:     POST { mode: "transcribe", image, media_type, teacher? }   (image is base64)
 *            or { mode: "transcribe", images: [{ image, media_type }, …], teacher? }: up to
 *            MAX_PAGES pages of one piece of writing, read together and counted as ONE reading.
 *            -> 200 { transcript, legibility, contains_writing, guessed_words, note,
 *                     remaining_today, used_today }
 *            teacher: true uses TEACHER_PHOTO_CAP instead of PHOTO_DAILY_LIMIT.
 *
 * "track" defaults to "general", so the app's existing requests work as
 * before. Other tracks need an active row in the tracks table and an
 * enrolment for the student (added by the teacher in the dashboard).
 * Feedback checks on every track share the same daily limit.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  assessWriting,
  countWords,
  IMAGE_MEDIA_TYPES,
  type ImageMediaType,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_PAGES,
  MAX_WORDS,
  MIN_WORDS,
  MODEL,
  STUDENT_LEVELS,
  type StudentLevel,
  SYSTEM_PROMPT,
  TRANSCRIBE_PROMPT,
  transcribeImage,
} from "./assess.ts";
import {
  assessIeltsTask2,
  ESSAY_TYPES,
  type EssayType,
  IELTS_EFFORT,
  IELTS_SYSTEM_PROMPT,
  parseTargetBand,
} from "./ielts.ts";

// ===========================================================================
// Limits and settings: change them here (they are not read from secrets).
// ===========================================================================

/** Students: feedback checks a day (General English and IELTS together). */
const DAILY_LIMIT = 50;
/** Students: photo readings a day (several pages read together count as one). */
const PHOTO_DAILY_LIMIT = 50;
/** Teacher marking ("Mark an IELTS essay"): essays marked a day. */
const TEACHER_DAILY_LIMIT = 50;
/** Teachers: photo readings a day (a safety cap). */
const TEACHER_PHOTO_CAP = 100;
/** IELTS essays can be longer than General English writing. */
const IELTS_MAX_WORDS = 700;
/**
 * Sending exactly the same writing (or photo) again within this many days
 * shows the saved result: no call to Claude, and no check used up.
 */
const CACHE_DAYS = 7;
/**
 * Part of every cache fingerprint. The prompts are already in it, so most
 * changes start a fresh cache by themselves; add 1 after any other change
 * that should give new feedback for the same writing.
 */
const CACHE_VERSION = 1;

// ===========================================================================

const TEACHER_TASK_TYPE = "task2_teacher";
const TEACHER_PHOTO_TYPE = "teacher_photo";

// ---- Saved results (the response_cache table) -----------------------------

type CacheKind = "feedback" | "ielts" | "ielts_teacher" | "transcribe";

/** A fingerprint (SHA-256) of everything that decides the result. */
async function cacheKey(kind: CacheKind, parts: unknown): Promise<string> {
  const material = JSON.stringify({ v: CACHE_VERSION, kind, model: MODEL, parts });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function cacheCutoff(): string {
  return new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** The saved result for this fingerprint, or null (also if the table is missing). */
async function readCache(admin: SupabaseClient, key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("response_cache")
    .select("response")
    .eq("key", key)
    .gte("created_at", cacheCutoff())
    .maybeSingle();
  if (error) {
    console.error("Could not read the cache", error.message);
    return null;
  }
  return (data?.response as Record<string, unknown> | undefined) ?? null;
}

/** Saves a result, and clears out ones older than CACHE_DAYS. Never fails the request. */
async function writeCache(admin: SupabaseClient, key: string, kind: CacheKind, response: Record<string, unknown>) {
  const { error } = await admin
    .from("response_cache")
    .upsert({ key, kind, response, created_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("Could not save to the cache", error.message);
    return;
  }
  await admin.from("response_cache").delete().lt("created_at", cacheCutoff());
}

/** How many rows of this task type the user has made today (UTC). */
async function usedTodayByTaskType(admin: SupabaseClient, userId: string, taskType: string): Promise<number | null> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("task_type", taskType)
    .gte("created_at", since.toISOString());
  return error ? null : (count ?? 0);
}

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
    // Several pages: { images: [{ image, media_type }, …] }; one page: { image, media_type }.
    const rawPages = Array.isArray(body.images) ? body.images : [{ image: body.image, media_type: body.media_type }];
    if (rawPages.length === 0) return fail(400, "bad_request", "Please choose a photo.");
    if (rawPages.length > MAX_PAGES) {
      return fail(400, "too_many", `Please choose ${MAX_PAGES} photos or fewer.`);
    }
    const pages: { data: string; mediaType: ImageMediaType }[] = [];
    for (const raw of rawPages) {
      const page = (raw ?? {}) as Record<string, unknown>;
      const data = typeof page.image === "string" ? page.image : "";
      const mediaType = IMAGE_MEDIA_TYPES.includes(page.media_type as ImageMediaType)
        ? (page.media_type as ImageMediaType)
        : null;
      if (!data || !mediaType) return fail(400, "bad_request", "Please choose a photo.");
      if (data.length > MAX_IMAGE_BASE64_LENGTH) {
        return fail(400, "too_large", "That photo is too large. Please try again.");
      }
      pages.push({ data, mediaType });
    }

    const teacher = body.teacher === true;
    const used = teacher
      ? await usedTodayByTaskType(admin, userId, TEACHER_PHOTO_TYPE)
      : await usedToday(admin, userId, "transcribe");
    const photoLimit = teacher ? TEACHER_PHOTO_CAP : PHOTO_DAILY_LIMIT;
    if (used === null) return fail(500, "server_error", "Something went wrong. Please try again.");

    const key = await cacheKey("transcribe", {
      prompt: TRANSCRIBE_PROMPT,
      pages: pages.map((p) => [p.mediaType, p.data]),
    });
    const saved = await readCache(admin, key);
    if (saved) {
      return reply(200, {
        ...saved,
        remaining_today: Math.max(0, photoLimit - used),
        used_today: used,
        cached: true,
      });
    }

    if (used >= photoLimit) {
      return fail(
        429,
        "daily_limit",
        `You have used all ${photoLimit} photo readings for today. You can still type your writing.`,
      );
    }

    let result;
    try {
      result = await transcribeImage(anthropic, pages);
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
      ...(teacher ? { task_type: TEACHER_PHOTO_TYPE } : {}),
      level: "-",
      word_count: countWords(result.transcript.transcript),
      model: MODEL,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    });
    if (insertError) console.error("Could not record transcription", insertError.message);
    await writeCache(admin, key, "transcribe", result.transcript);

    return reply(200, {
      ...result.transcript,
      remaining_today: Math.max(0, photoLimit - used - 1),
      used_today: used + 1,
    });
  }

  // ---- Which course (track) --------------------------------------------------
  const track = body.track === undefined || body.track === null ? "general" : body.track;
  if (typeof track !== "string") return fail(400, "bad_request", "Unknown course.");

  if (track === "ielts" && body.teacher === true) {
    return await teacherIeltsFeedback(anthropic, admin, userId, body);
  }

  if (track !== "general") {
    const { data: trackRow, error: trackError } = await admin
      .from("tracks")
      .select("id, active")
      .eq("id", track)
      .maybeSingle();
    if (trackError) return fail(500, "server_error", "Something went wrong. Please try again.");
    if (!trackRow || !trackRow.active || track !== "ielts") {
      return fail(400, "unknown_track", "Feedback for this course is not available yet.");
    }

    const { data: enrolment, error: enrolmentError } = await admin
      .from("enrolments")
      .select("target")
      .eq("user_id", userId)
      .eq("track_id", track)
      .maybeSingle();
    if (enrolmentError) return fail(500, "server_error", "Something went wrong. Please try again.");
    if (!enrolment) {
      return fail(403, "not_enrolled", "You are not enrolled on this course yet. Please ask your teacher.");
    }

    return await ieltsFeedback(anthropic, admin, userId, body, parseTargetBand(enrolment.target));
  }

  // ---- Feedback on writing (General English) ------------------------------
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

  const key = await cacheKey("feedback", {
    prompt: SYSTEM_PROMPT,
    text: text.trim(),
    level,
    task: task?.trim() ?? "",
    focusGrammar: focusGrammar ?? "",
  });
  const saved = await readCache(admin, key);
  if (saved) {
    return reply(200, { ...saved, remaining_today: Math.max(0, DAILY_LIMIT - used), cached: true });
  }

  if (used >= DAILY_LIMIT) {
    return fail(
      429,
      "daily_limit",
      `You have used all ${DAILY_LIMIT} feedback checks for today. Try again tomorrow.`,
    );
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
  await writeCache(admin, key, "feedback", { feedback: result.feedback });

  return reply(200, {
    feedback: result.feedback,
    remaining_today: Math.max(0, DAILY_LIMIT - used - 1),
  });
});

// ---- IELTS Writing Task 2 --------------------------------------------------

async function ieltsFeedback(
  anthropic: Anthropic,
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  targetBand: number | null,
): Promise<Response> {
  const text = typeof body.text === "string" ? body.text : "";
  const promptId =
    typeof body.prompt_id === "number" && Number.isInteger(body.prompt_id) && body.prompt_id > 0
      ? body.prompt_id
      : null;
  if (!promptId) return fail(400, "bad_request", "Choose a question to answer.");

  const { data: prompt, error: promptError } = await admin
    .from("writing_prompts")
    .select("id, task_type, essay_type, prompt, min_words")
    .eq("id", promptId)
    .eq("track_id", "ielts")
    .eq("active", true)
    .maybeSingle();
  if (promptError) return fail(500, "server_error", "Something went wrong. Please try again.");
  if (!prompt) return fail(400, "bad_request", "That question is not available.");
  if (prompt.task_type !== "task2") {
    return fail(400, "bad_request", "Feedback is only available for Task 2 questions so far.");
  }

  const words = countWords(text);
  if (words < MIN_WORDS) return fail(400, "too_short", `Please write at least ${MIN_WORDS} words.`);
  if (words > IELTS_MAX_WORDS) {
    return fail(400, "too_long", `Please write ${IELTS_MAX_WORDS} words or fewer.`);
  }

  const used = await usedToday(admin, userId, "feedback");
  if (used === null) return fail(500, "server_error", "Something went wrong. Please try again.");

  const essayType = ESSAY_TYPES.includes(prompt.essay_type as EssayType)
    ? (prompt.essay_type as EssayType)
    : null;

  const key = await cacheKey("ielts", {
    prompt: IELTS_SYSTEM_PROMPT,
    effort: IELTS_EFFORT,
    text: text.trim(),
    question: prompt.prompt,
    essayType,
    minWords: prompt.min_words,
    targetBand,
  });
  const saved = await readCache(admin, key);
  if (saved) {
    return reply(200, { ...saved, remaining_today: Math.max(0, DAILY_LIMIT - used), cached: true });
  }

  if (used >= DAILY_LIMIT) {
    return fail(
      429,
      "daily_limit",
      `You have used all ${DAILY_LIMIT} feedback checks for today. Try again tomorrow.`,
    );
  }

  let result;
  try {
    result = await assessIeltsTask2(anthropic, {
      text,
      prompt: prompt.prompt,
      essayType,
      minWords: prompt.min_words,
      targetBand,
    });
  } catch (error) {
    return claudeError(error);
  }

  if (!result.ok) {
    console.error("IELTS assessment failed", result.reason, result.detail ?? "");
    return fail(
      422,
      "no_feedback",
      result.reason === "refused"
        ? "We couldn't give feedback on this essay. Please try a different text."
        : "We couldn't finish the feedback this time. Please try again.",
    );
  }

  const { error: insertError } = await admin.from("writing_submissions").insert({
    user_id: userId,
    kind: "feedback",
    track_id: "ielts",
    task_type: "task2",
    prompt_id: prompt.id,
    level: "-",
    word_count: words,
    band: result.feedback.overall_band,
    model: MODEL,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
  });
  if (insertError) console.error("Could not record IELTS submission", insertError.message);
  await writeCache(admin, key, "ielts", { feedback: result.feedback });

  return reply(200, {
    feedback: result.feedback,
    remaining_today: Math.max(0, DAILY_LIMIT - used - 1),
  });
}

// ---- Teacher marking: any IELTS Task 2 essay, any question ------------------

async function teacherIeltsFeedback(
  anthropic: Anthropic,
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const text = typeof body.text === "string" ? body.text : "";
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 1500) : "";

  const words = countWords(text);
  if (words < MIN_WORDS) return fail(400, "too_short", `Please write at least ${MIN_WORDS} words.`);
  if (words > IELTS_MAX_WORDS) {
    return fail(400, "too_long", `Please write ${IELTS_MAX_WORDS} words or fewer.`);
  }

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await admin
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("task_type", TEACHER_TASK_TYPE)
    .gte("created_at", since.toISOString());
  if (countError) return fail(500, "server_error", "Something went wrong. Please try again.");
  const used = count ?? 0;

  const key = await cacheKey("ielts_teacher", {
    prompt: IELTS_SYSTEM_PROMPT,
    effort: IELTS_EFFORT,
    text: text.trim(),
    question,
  });
  const saved = await readCache(admin, key);
  if (saved) {
    return reply(200, {
      ...saved,
      remaining_today: Math.max(0, TEACHER_DAILY_LIMIT - used),
      used_today: used,
      cached: true,
    });
  }

  if (used >= TEACHER_DAILY_LIMIT) {
    return fail(429, "daily_limit", `You have marked ${TEACHER_DAILY_LIMIT} essays today. Try again tomorrow.`);
  }

  let result;
  try {
    result = await assessIeltsTask2(anthropic, { text, prompt: question, essayType: null, targetBand: null });
  } catch (error) {
    return claudeError(error);
  }
  if (!result.ok) {
    console.error("Teacher IELTS assessment failed", result.reason, result.detail ?? "");
    return fail(422, "no_feedback", "We couldn't finish the marking this time. Please try again.");
  }

  const { error: insertError } = await admin.from("writing_submissions").insert({
    user_id: userId,
    kind: "feedback",
    track_id: "ielts",
    task_type: TEACHER_TASK_TYPE,
    level: "-",
    word_count: words,
    band: result.feedback.overall_band,
    model: MODEL,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
  });
  if (insertError) console.error("Could not record teacher marking", insertError.message);
  await writeCache(admin, key, "ielts_teacher", { feedback: result.feedback });

  return reply(200, {
    feedback: result.feedback,
    remaining_today: Math.max(0, TEACHER_DAILY_LIMIT - used - 1),
    used_today: used + 1,
  });
}
