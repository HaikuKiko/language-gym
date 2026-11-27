/**
 * make-quiz: Claude writes grammar quizzes from the week's grammar, for a live
 * class quiz (teachers only).
 *
 * Make a set:  POST { name, levels: [{ level, grammar }], quizzes, per_quiz, mix?, images? }
 *              images: photos of the grammar page, [{ image (base64), media_type }].
 *              mix: "even" (default), or a level that gets most of the questions.
 *              Saves a quiz set and its questions (tables quiz_sets, quiz_questions)
 *              -> 200 { set_id, made_today }
 * New question: POST { mode: "remake", question_id }
 *              Replaces one question with a new one on the same grammar and level.
 *              -> 200 { question }
 *
 * The Anthropic API key is the ANTHROPIC_API_KEY secret. Limits are the
 * settings below (not secrets).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ===========================================================================
// Limits and settings: change them here (they are not read from secrets).
// ===========================================================================

/** Quiz sets a teacher can make a day. */
const SETS_PER_DAY = 10;
/** "New question" taps allowed in one set. */
const REMAKES_PER_SET = 40;
/** Most quizzes in a set, and most questions in a quiz. */
const MAX_QUIZZES = 6;
const MAX_PER_QUIZ = 15;
/** Most levels mixed in one set. */
const MAX_LEVELS = 3;
/** Longest grammar text per level (characters). */
const MAX_GRAMMAR_LENGTH = 4000;
/** Most photos of the grammar page, and their size (base64 of a 5 MB image). */
const MAX_PHOTOS = 4;
const MAX_IMAGE_BASE64_LENGTH = Math.floor((5 * 1024 * 1024 * 4) / 3);
/** The model that writes the questions, and how hard it thinks. */
const MODEL = "claude-opus-5-5";
const EFFORT = "medium";
/** Everyday topics for the example sentences: each quiz gets different ones, so the quizzes differ. */
const TOPICS = [
  "food and cooking",
  "travel and holidays",
  "family and friends",
  "school and study",
  "work and jobs",
  "sport and free time",
  "shopping and money",
  "home and the city",
  "weather and nature",
  "films, music and the internet",
  "health and the body",
  "animals",
];

// ===========================================================================

const KINDS = ["choose", "right-wrong", "find-mistake"] as const;
const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

const QuestionSchema = z.object({
  level: z.string(),
  kind: z.enum(KINDS),
  prompt: z.string(),
  options: z.array(z.string()),
  answer: z.number().int(),
  why: z.string(),
});
type Question = z.infer<typeof QuestionSchema>;
const QuizSchema = z.object({ questions: z.array(QuestionSchema) });

const SYSTEM_PROMPT = `You write grammar quiz questions for a live class quiz that teenagers and adults play on their phones, like a game show. The students are learners of English at CEFR levels A1 to C2. They studied this grammar in the morning; the quiz in the afternoon checks and practises it.

Question kinds (use a mix, about half "choose"):
- "choose": a sentence with one gap written as ___ (three underscores). 3 or 4 short options; exactly one is correct. The wrong options are typical learner mistakes with the same grammar (wrong tense, wrong form, wrong word), never silly.
- "right-wrong": one sentence, in double quotes, that is either correct or has one mistake in the target grammar. options are exactly ["Right", "Wrong"]. About half are right.
- "find-mistake": a sentence with exactly one mistake in the target grammar. options are 3 or 4 short parts copied exactly from the sentence (a word or two each), in the order they appear; the answer is the wrong part.

Rules:
- Test only the grammar given for each level. Words and topics must suit that level: short sentences, common words, for A1 and A2 very simple.
- Every question must have exactly one correct answer that a teacher would agree with. Avoid answers that depend on British vs American English or on context that is not given.
- "answer" is the 0-based index of the correct option.
- "why" is one short sentence in easy English (at the question's level) that explains the answer, e.g. "We use since with a point in time (2019)." For a mistake, give the correction.
- No names of real people, brands or anything upsetting. Use varied, everyday names from many countries.
- Never repeat a sentence. Keep prompts under 120 characters and options under 30 characters.`;

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

type LevelGrammar = { level: string; grammar: string };
type Photo = { image: string; media_type: ImageMediaType };

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Checks a question and tidies it: drops it if broken, and mixes the order of
 * the options for "choose" (Claude often puts the right one first).
 */
function tidy(q: Question, levels: string[]): Question | null {
  const options = q.options.map((o) => o.trim()).filter(Boolean);
  if (!levels.includes(q.level)) return null;
  if (!q.prompt.trim() || q.prompt.length > 300) return null;
  if (q.answer < 0 || q.answer >= options.length) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;
  if (q.kind === "right-wrong") {
    if (options.length !== 2 || options[0] !== "Right" || options[1] !== "Wrong") return null;
    return { ...q, prompt: q.prompt.trim(), options, why: q.why.trim() };
  }
  if (options.length < 2 || options.length > 4) return null;
  if (q.kind === "choose") {
    const right = options[q.answer];
    const order = shuffled(options);
    return { ...q, prompt: q.prompt.trim(), options: order, answer: order.indexOf(right), why: q.why.trim() };
  }
  return { ...q, prompt: q.prompt.trim(), options, why: q.why.trim() };
}

function grammarText(levels: LevelGrammar[], photos: number): string {
  return [
    ...levels.map(
      (l) =>
        `<grammar level="${l.level}">\n${l.grammar.trim() || "(see the photo)"}\n</grammar>`,
    ),
    ...(photos > 0
      ? [
        `The teacher also sent ${photos === 1 ? "a photo" : `${photos} photos`} of the grammar page. Use the grammar in it for the level it belongs to (if it doesn't say, the levels' typed notes may help).`,
      ]
      : []),
  ].join("\n\n");
}

function photoBlocks(photos: Photo[]): Anthropic.ImageBlockParam[] {
  return photos.map((p) => ({
    type: "image",
    source: { type: "base64", media_type: p.media_type, data: p.image },
  }));
}

/** How many questions of each level a quiz gets. */
function levelCounts(levels: string[], perQuiz: number, mix: string): Map<string, number> {
  const counts = new Map(levels.map((l) => [l, 0]));
  if (levels.includes(mix) && levels.length > 1) {
    // About two thirds for the chosen level, the rest shared.
    const main = Math.round((perQuiz * 2) / 3);
    counts.set(mix, main);
    const others = levels.filter((l) => l !== mix);
    others.forEach((l, i) => counts.set(l, Math.floor((perQuiz - main) / others.length) + (i < (perQuiz - main) % others.length ? 1 : 0)));
  } else {
    levels.forEach((l, i) => counts.set(l, Math.floor(perQuiz / levels.length) + (i < perQuiz % levels.length ? 1 : 0)));
  }
  return counts;
}

type MadeQuiz = { ok: true; questions: Question[] } | { ok: false; reason: string };

/** One quiz, written by Claude. */
async function writeQuiz(
  client: Anthropic,
  input: { levels: LevelGrammar[]; photos: Photo[]; counts: Map<string, number>; quiz: number; quizzes: number },
): Promise<MadeQuiz> {
  const want = [...input.counts].filter(([, n]) => n > 0).map(([l, n]) => `${n} at ${l}`).join(", ");
  const total = [...input.counts.values()].reduce((a, b) => a + b, 0);
  const topics = [0, 1].map((k) => TOPICS[((input.quiz - 1) * 2 + k) % TOPICS.length]).join(" and ");
  const text = [
    grammarText(input.levels, input.photos.length),
    "",
    `Write quiz ${input.quiz} of ${input.quizzes}: ${total} questions (${want}).`,
    `Mix the levels through the quiz (not all of one level first) and use all the grammar points for each level.`,
    `To keep the quizzes different from each other, set this quiz's sentences mostly around ${topics}.`,
  ].join("\n");
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [...photoBlocks(input.photos), { type: "text", text }] }],
    output_config: { effort: EFFORT, format: zodOutputFormat(QuizSchema) },
  });
  if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
  if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, reason: "unreadable" };
  const levels = input.levels.map((l) => l.level);
  const questions = response.parsed_output.questions
    .map((q) => tidy(q, levels))
    .filter((q): q is Question => q !== null);
  return { ok: true, questions };
}

function claudeError(error: unknown): Response {
  if (error instanceof Anthropic.RateLimitError) {
    return fail(503, "busy", "The quiz maker is busy. Please try again in a minute.");
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Anthropic API error", error.status, error.message);
    return fail(502, "upstream_error", "The quiz maker is not available right now. Please try again later.");
  }
  console.error("Unexpected error", error);
  return fail(500, "server_error", "Something went wrong. Please try again.");
}

function startOfToday(): string {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  return since.toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return fail(503, "not_configured", "The quiz maker is not set up yet.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return fail(401, "not_signed_in", "Please sign in first.");
  const userId = userData.user.id;
  const { data: teacher } = await userClient.rpc("is_teacher");
  if (teacher !== true) return fail(403, "teachers_only", "Only teachers can make quizzes. Please log in as a teacher.");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "The request was not valid JSON.");
  }

  const admin: SupabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anthropic = new Anthropic({ apiKey });

  // ---- "New question": replace one question ------------------------------
  if (body.mode === "remake") {
    const questionId = typeof body.question_id === "string" ? body.question_id : "";
    const { data: old } = await admin.from("quiz_questions").select().eq("id", questionId).maybeSingle();
    if (!old) return fail(404, "not_found", "That question is gone.");
    const { data: set } = await admin.from("quiz_sets").select().eq("id", old.set_id).maybeSingle();
    if (!set || set.host_id !== userId) return fail(404, "not_found", "That question is gone.");
    if (set.remakes >= REMAKES_PER_SET) {
      return fail(429, "limit_reached", `That's ${REMAKES_PER_SET} new questions for this week. Edit the question instead.`);
    }
    const grammar = (set.grammar ?? {}) as Record<string, string>;
    const { data: others } = await admin.from("quiz_questions").select("prompt").eq("set_id", set.id);
    try {
      const response = await anthropic.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            grammarText([{ level: old.level, grammar: grammar[old.level] ?? "" }], 0),
            "",
            `Write 1 new question at ${old.level}, of the kind "${old.kind}", to replace this one: ${JSON.stringify(old.prompt)}.`,
            `Don't reuse any of these sentences: ${JSON.stringify((others ?? []).map((o) => o.prompt))}`,
          ].join("\n"),
        }],
        output_config: { effort: "low", format: zodOutputFormat(QuizSchema) },
      });
      const fresh = response.parsed_output?.questions.map((q) => tidy(q, [old.level])).find((q) => q !== null);
      if (!fresh) return fail(502, "unreadable", "Couldn't make a new question. Please try again.");
      const { data: saved, error } = await admin
        .from("quiz_questions")
        .update({ kind: fresh.kind, prompt: fresh.prompt, options: fresh.options, answer: fresh.answer, why: fresh.why })
        .eq("id", old.id)
        .select()
        .single();
      if (error) return fail(500, "save_failed", error.message);
      await admin.from("quiz_sets").update({ remakes: set.remakes + 1 }).eq("id", set.id);
      return reply(200, { question: saved });
    } catch (e) {
      return claudeError(e);
    }
  }

  // ---- Make a set of quizzes ---------------------------------------------
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const quizzes = Number(body.quizzes);
  const perQuiz = Number(body.per_quiz);
  const mix = typeof body.mix === "string" ? body.mix : "even";
  const levels: LevelGrammar[] = Array.isArray(body.levels)
    ? body.levels
      .filter((l): l is LevelGrammar => typeof l?.level === "string" && typeof l?.grammar === "string")
      .map((l) => ({ level: l.level.trim().slice(0, 4), grammar: l.grammar.slice(0, MAX_GRAMMAR_LENGTH) }))
    : [];
  const photos: Photo[] = Array.isArray(body.images)
    ? body.images.filter(
      (p): p is Photo =>
        typeof p?.image === "string" && p.image.length <= MAX_IMAGE_BASE64_LENGTH &&
        (IMAGE_MEDIA_TYPES as readonly string[]).includes(p?.media_type),
    )
    : [];
  if (!name) return fail(400, "bad_request", "Give the week a name.");
  if (levels.length === 0 || levels.length > MAX_LEVELS) return fail(400, "bad_request", `Choose 1 to ${MAX_LEVELS} levels.`);
  if (new Set(levels.map((l) => l.level)).size !== levels.length) return fail(400, "bad_request", "Each level only once, please.");
  if (photos.length > MAX_PHOTOS) return fail(400, "bad_request", `At most ${MAX_PHOTOS} photos.`);
  if (photos.length === 0 && levels.some((l) => l.grammar.trim().length < 3)) {
    return fail(400, "bad_request", "Type the grammar for each level (or add a photo of it).");
  }
  if (!Number.isInteger(quizzes) || quizzes < 1 || quizzes > MAX_QUIZZES) {
    return fail(400, "bad_request", `Choose 1 to ${MAX_QUIZZES} quizzes.`);
  }
  if (!Number.isInteger(perQuiz) || perQuiz < 3 || perQuiz > MAX_PER_QUIZ) {
    return fail(400, "bad_request", `Choose 3 to ${MAX_PER_QUIZ} questions.`);
  }

  const { count } = await admin
    .from("quiz_sets")
    .select("id", { count: "exact", head: true })
    .eq("host_id", userId)
    .gte("created_at", startOfToday());
  const madeToday = count ?? 0;
  if (madeToday >= SETS_PER_DAY) {
    return fail(429, "limit_reached", `You've made ${SETS_PER_DAY} quiz weeks today. Please try again tomorrow.`);
  }

  // The quizzes are written at the same time (faster), each around its own topics.
  const counts = levelCounts(levels.map((l) => l.level), perQuiz, mix);
  let made: MadeQuiz[];
  try {
    made = await Promise.all(
      Array.from({ length: quizzes }, (_, i) =>
        writeQuiz(anthropic, { levels, photos, counts, quiz: i + 1, quizzes })),
    );
  } catch (e) {
    return claudeError(e);
  }
  if (made.some((m) => !m.ok)) {
    return fail(502, "unreadable", "Couldn't make the quizzes from that grammar. Please check it and try again.");
  }

  const { data: set, error: setError } = await admin
    .from("quiz_sets")
    .insert({
      host_id: userId,
      name,
      levels: levels.map((l) => l.level),
      grammar: Object.fromEntries(levels.map((l) => [l.level, l.grammar.trim()])),
      quiz_count: quizzes,
    })
    .select("id")
    .single();
  if (setError || !set) return fail(500, "save_failed", setError?.message ?? "Could not save.");

  const rows = made.flatMap((m, i) =>
    m.ok
      ? m.questions.slice(0, perQuiz).map((q, position) => ({
        set_id: set.id,
        quiz: i + 1,
        position,
        level: q.level,
        kind: q.kind,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        why: q.why,
      }))
      : []
  );
  const { error: rowsError } = await admin.from("quiz_questions").insert(rows);
  if (rowsError) {
    await admin.from("quiz_sets").delete().eq("id", set.id);
    return fail(500, "save_failed", rowsError.message);
  }
  return reply(200, { set_id: set.id, made_today: madeToday + 1 });
});
