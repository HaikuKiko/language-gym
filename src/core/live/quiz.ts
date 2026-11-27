/**
 * Live quizzes (Live classroom kit): multiple-choice questions on the board,
 * answers on phones, points for right and fast answers, streaks, and the
 * ranking. Any kind of quiz can use it (grammar now; vocabulary later).
 *
 * How a quiz uses the session row: `round` is the question (0-based) and
 * `round_count` how many there are; `stage` "discussion" means the question is
 * open, "changeover" means its answer is showing. The question clock is
 * `ends_at`. Each student's answers are on their own participant row
 * (`quiz_answers`), saved through the answer_quiz database function so an
 * answer counts once and only while the question is open.
 */
import { requireSupabase } from '@/core/app/supabase';
import {
  flagValue,
  remainingMs,
  timestampAfter,
  type LiveParticipant,
  type LiveSession,
  type SessionChanges,
} from '@/core/live/session';

// ===========================================================================
// Settings
// ===========================================================================

/** Seconds per question the teacher can choose from, and the default. */
export const QUESTION_SECONDS = [10, 20, 30, 45] as const;
export const DEFAULT_QUESTION_SECONDS = 20;
/** Points for a right answer: from MAX_POINTS (instant) down to MIN_POINTS (at the last second). */
export const MAX_POINTS = 1000;
export const MIN_POINTS = 500;
/** Streak bonus: this much for each right answer in a row after the first, up to STREAK_BONUS_MAX. */
export const STREAK_BONUS = 100;
export const STREAK_BONUS_MAX = 500;
/** How many names the board shows after each question. */
export const LEADERS_SHOWN = 5;

// ===========================================================================

export type QuizQuestionKind = 'choose' | 'right-wrong' | 'find-mistake';

export type QuizQuestion = {
  id: string;
  /** e.g. "A1"; shown as a label. */
  level: string;
  kind: QuizQuestionKind;
  prompt: string;
  options: string[];
  /** Index of the right option. */
  answer: number;
  /** One line on why that answer is right. */
  why: string;
};

/** What each kind of question asks, shown above it. */
export const QUESTION_KIND_LABELS: Record<QuizQuestionKind, string> = {
  choose: 'Choose the answer',
  'right-wrong': 'Right or wrong?',
  'find-mistake': 'Find the mistake',
};

export type QuizAnswer = { c: number; ms: number };

const SECONDS_FLAG = 'quiz-seconds:';

/** The flag for the seconds per question. */
export function questionSecondsFlag(seconds: number): string {
  return `${SECONDS_FLAG}${seconds}`;
}

export function questionSeconds(session: LiveSession): number {
  return Number(flagValue(session, SECONDS_FLAG)) || DEFAULT_QUESTION_SECONDS;
}

// ---------------------------------------------------------------------------
// The host's steps
// ---------------------------------------------------------------------------

/** Opens question `index`: the clock starts. */
export function openQuestion(session: LiveSession, index: number, now: number): SessionChanges {
  return {
    status: 'playing',
    round: index,
    stage: 'discussion',
    ends_at: timestampAfter(now, questionSeconds(session) * 1000),
    remaining_ms: null,
    roster: session.roster,
  };
}

/** Closes the question and shows its answer. */
export function showAnswer(): SessionChanges {
  return { stage: 'changeover', ends_at: null, remaining_ms: 0 };
}

export function isQuestionOpen(session: LiveSession, now: number): boolean {
  return session.status === 'playing' && session.stage === 'discussion' && remainingMs(session, now) > 0;
}

export function isLastQuestion(session: LiveSession): boolean {
  return session.round >= session.round_count - 1;
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export function answerOf(p: LiveParticipant, question: number): QuizAnswer | null {
  return p.quiz_answers?.[String(question)] ?? null;
}

/** How many students chose each option. */
export function answerCounts(participants: readonly LiveParticipant[], question: number, options: number): number[] {
  const counts = Array.from({ length: options }, () => 0);
  for (const p of participants) {
    const a = answerOf(p, question);
    if (a && a.c >= 0 && a.c < options) counts[a.c] += 1;
  }
  return counts;
}

export function answeredCount(participants: readonly LiveParticipant[], question: number): number {
  return participants.filter((p) => answerOf(p, question) !== null).length;
}

/** Saves a student's answer (Supabase). False when it was too late or already answered. */
export async function saveAnswer(participantId: string, question: number, choice: number, ms: number): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('answer_quiz', {
    p_participant_id: participantId,
    p_question: question,
    p_choice: choice,
    p_ms: Math.round(ms),
  });
  if (error) throw new Error(error.message);
  return data === true;
}

// ---------------------------------------------------------------------------
// Points and ranking
// ---------------------------------------------------------------------------

/** Points for one right answer given after `ms`, with `seconds` on the clock. */
export function pointsForTime(ms: number, seconds: number): number {
  const fraction = Math.min(1, Math.max(0, ms / (seconds * 1000)));
  return Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * fraction);
}

export type QuestionResult = { right: boolean; answered: boolean; points: number; streak: number };

export type PlayerScore = {
  id: string;
  name: string;
  points: number;
  right: number;
  answered: number;
  /** Right answers in a row at the end (for "🔥 3"). */
  streak: number;
  bestStreak: number;
  /** Average time of the right answers, in ms (null if none). */
  averageMs: number | null;
  /** One entry per question asked so far. */
  results: QuestionResult[];
};

/**
 * Everyone's score after the first `upTo` questions (default: all), highest
 * first. Ties: more right answers, then faster.
 */
export function quizScores(
  questions: readonly QuizQuestion[],
  participants: readonly LiveParticipant[],
  seconds: number,
  upTo = questions.length,
): PlayerScore[] {
  const scores = participants.map((p) => {
    let streak = 0;
    let bestStreak = 0;
    let points = 0;
    let right = 0;
    let answered = 0;
    let rightMs = 0;
    const results: QuestionResult[] = [];
    questions.slice(0, upTo).forEach((q, i) => {
      const a = answerOf(p, i);
      const isRight = a !== null && a.c === q.answer;
      let got = 0;
      if (a) answered += 1;
      if (isRight) {
        streak += 1;
        right += 1;
        rightMs += a.ms;
        got = pointsForTime(a.ms, seconds) + Math.min(STREAK_BONUS_MAX, (streak - 1) * STREAK_BONUS);
        points += got;
      } else {
        streak = 0;
      }
      bestStreak = Math.max(bestStreak, streak);
      results.push({ right: isRight, answered: a !== null, points: got, streak });
    });
    return {
      id: p.id,
      name: p.name,
      points,
      right,
      answered,
      streak,
      bestStreak,
      averageMs: right > 0 ? rightMs / right : null,
      results,
    };
  });
  return scores.sort(
    (a, b) => b.points - a.points || b.right - a.right || (a.averageMs ?? Infinity) - (b.averageMs ?? Infinity),
  );
}

/** 1-based places; equal points share a place. */
export function placeOf(scores: readonly PlayerScore[], id: string): number | null {
  const me = scores.find((s) => s.id === id);
  if (!me) return null;
  return scores.filter((s) => s.points > me.points).length + 1;
}

export type QuestionStats = { question: QuizQuestion; index: number; right: number; answered: number };

/** Each question with how many got it right, hardest first. */
export function hardestQuestions(
  questions: readonly QuizQuestion[],
  participants: readonly LiveParticipant[],
): QuestionStats[] {
  return questions
    .map((question, index) => {
      const answers = participants.map((p) => answerOf(p, index)).filter((a): a is QuizAnswer => a !== null);
      return { question, index, answered: answers.length, right: answers.filter((a) => a.c === question.answer).length };
    })
    .filter((s) => s.answered > 0)
    .sort((a, b) => a.right / a.answered - b.right / b.answered);
}
