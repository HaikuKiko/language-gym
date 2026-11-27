/**
 * Grammar quizzes: the teacher gives the week's grammar for each level, Claude
 * writes several quizzes (edge function make-quiz), and the class plays them
 * live on phones (the quiz engine in src/core/live/quiz.ts). Points add up on
 * a leaderboard for the week (the quiz set) and over SCORE_DAYS.
 *
 * Where things are kept: tables quiz_sets and quiz_questions (teacher's own);
 * a live quiz is a session with the flags quiz:<set id>, quiz-number:<n> and
 * quiz-seconds:<s>; answers are on each participant row; final scores go to
 * player_scores (activity "quiz", board = the set's id).
 */
import { callFunction } from '@/core/app/functions';
import { requireSupabase } from '@/core/app/supabase';
import { LEVELS } from '@/core/content/levels';
import type { PreparedPhoto } from '@/core/media/photo';
import { questionSecondsFlag, type QuizQuestion } from '@/core/live/quiz';
import { createSession, flagValue, type LiveSession } from '@/core/live/session';

// ===========================================================================
// Settings (the make-quiz function has its own limits at the top of its file)
// ===========================================================================

/** Choices on the "make quizzes" screen, and the defaults. */
export const QUIZ_COUNTS = [2, 3, 4, 5] as const;
export const DEFAULT_QUIZ_COUNT = 4;
export const QUESTIONS_PER_QUIZ = [8, 10, 12] as const;
export const DEFAULT_QUESTIONS_PER_QUIZ = 10;
/** The levels a new week starts with (the afternoon class mixes A1 and A2). */
export const DEFAULT_LEVELS = ['A1', 'A2'] as const;
/** Most levels in one week (must match MAX_LEVELS in make-quiz). */
export const MAX_QUIZ_LEVELS = 3;
/** Longest grammar text per level (must match MAX_GRAMMAR_LENGTH in make-quiz). */
export const MAX_GRAMMAR_LENGTH = 4000;
/** Photos of the grammar page (must match MAX_PHOTOS in make-quiz). */
export const MAX_GRAMMAR_PHOTOS = 4;

// ===========================================================================

/** The leaderboard activity name for quizzes (table player_scores). */
export const QUIZ_ACTIVITY = 'quiz';

const SET_FLAG = 'quiz:';
const NUMBER_FLAG = 'quiz-number:';

export type QuizSet = {
  id: string;
  name: string;
  levels: string[];
  grammar: Record<string, string>;
  quiz_count: number;
  created_at: string;
};

export type SavedQuestion = QuizQuestion & { set_id: string; quiz: number; position: number };

/** The quiz this session plays, or null when it isn't a quiz. */
export function quizOf(session: LiveSession): { setId: string; number: number } | null {
  const setId = flagValue(session, SET_FLAG);
  if (!setId) return null;
  return { setId, number: Number(flagValue(session, NUMBER_FLAG)) || 1 };
}

export function quizFlags(setId: string, number: number, seconds: number): string[] {
  return [`${SET_FLAG}${setId}`, `${NUMBER_FLAG}${number}`, questionSecondsFlag(seconds)];
}

/** A name for a new week: "Week of 30 Nov" (the coming Monday, or today if it is Monday). */
export function defaultWeekName(today = new Date()): string {
  const monday = new Date(today);
  monday.setDate(today.getDate() + ((8 - today.getDay()) % 7));
  return `Week of ${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/** Levels in CEFR order. */
export function sortLevels(levels: readonly string[]): string[] {
  return [...levels].sort((a, b) => LEVELS.indexOf(a as never) - LEVELS.indexOf(b as never));
}

// ---------------------------------------------------------------------------
// Making and editing
// ---------------------------------------------------------------------------

export type NewQuizSet = {
  name: string;
  levels: { level: string; grammar: string }[];
  quizzes: number;
  perQuiz: number;
  /** "even", or the level that gets most questions. */
  mix: string;
  photos: PreparedPhoto[];
};

/** Claude writes the quizzes and they are saved; returns the new set's id. */
export async function makeQuizSet(input: NewQuizSet): Promise<string> {
  const data = await callFunction<{ set_id: string }>(
    'make-quiz',
    {
      name: input.name,
      levels: input.levels,
      quizzes: input.quizzes,
      per_quiz: input.perQuiz,
      mix: input.mix,
      images: input.photos.map((p) => ({ image: p.base64, media_type: p.mediaType })),
    },
    "Couldn't make the quizzes right now. Please try again later.",
  );
  return data.set_id;
}

/** Replaces one question with a new one from Claude. */
export async function remakeQuestion(id: string): Promise<SavedQuestion> {
  const data = await callFunction<{ question: SavedQuestion }>(
    'make-quiz',
    { mode: 'remake', question_id: id },
    "Couldn't make a new question right now. Please try again later.",
  );
  return data.question;
}

export async function fetchQuizSets(): Promise<QuizSet[]> {
  const { data, error } = await requireSupabase()
    .from('quiz_sets')
    .select('id, name, levels, grammar, quiz_count, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as QuizSet[];
}

export async function fetchQuizSet(id: string): Promise<QuizSet | null> {
  const { data, error } = await requireSupabase()
    .from('quiz_sets')
    .select('id, name, levels, grammar, quiz_count, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as QuizSet | null;
}

/** A set's questions (all quizzes, or one), in order. */
export async function fetchQuestions(setId: string, quiz?: number): Promise<SavedQuestion[]> {
  let query = requireSupabase()
    .from('quiz_questions')
    .select('id, set_id, quiz, position, level, kind, prompt, options, answer, why')
    .eq('set_id', setId);
  if (quiz !== undefined) query = query.eq('quiz', quiz);
  const { data, error } = await query.order('quiz').order('position');
  if (error) throw new Error(error.message);
  return data as SavedQuestion[];
}

export async function updateQuestion(
  id: string,
  changes: Partial<Pick<QuizQuestion, 'prompt' | 'options' | 'answer' | 'why'>>,
): Promise<void> {
  const { error } = await requireSupabase().from('quiz_questions').update(changes).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await requireSupabase().from('quiz_questions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteQuizSet(id: string): Promise<void> {
  const { error } = await requireSupabase().from('quiz_sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Starts a live quiz: a session with a join code. */
export async function createQuizSession(set: QuizSet, number: number, seconds: number, questions: number) {
  return createSession({
    level: sortLevels(set.levels)[0] as LiveSession['level'],
    week: null,
    roundMinutes: 1,
    roundCount: questions,
    autoAdvance: false,
    flags: quizFlags(set.id, number, seconds),
  });
}
