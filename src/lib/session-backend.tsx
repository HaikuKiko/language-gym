/**
 * The live-session backend for Talk Rounds, the word games and the quizzes:
 * the core actions (src/core/live/backend.tsx) plus their own.
 */
import { SUPABASE_CORE_BACKEND, createSessionBackend, type CoreSessionBackend } from '@/core/live/backend';
import { saveAnswer, type QuizQuestion } from '@/core/live/quiz';
import { saveScores } from '@/core/live/scores';
import { fetchQuestions } from '@/lib/grammar-quiz';
import { toggleFollowUp } from '@/lib/talk-rounds';
import { recordCard } from '@/lib/word-game';

export type SessionBackend = CoreSessionBackend & {
  /** Word games: a student taps "Got it" or "Skip". */
  recordCard: typeof recordCard;
  /** Take turns: a student taps a follow-up question they asked. */
  toggleFollowUp: typeof toggleFollowUp;
  /** Quizzes: the questions of quiz `number` in a set. */
  loadQuizQuestions: (setId: string, number: number) => Promise<QuizQuestion[]>;
  /** Quizzes: a student's answer (false when too late or already answered). */
  answerQuiz: typeof saveAnswer;
  /** End of a game: everyone's points, for the leaderboard across games. */
  saveScores: typeof saveScores;
};

export const { useSessionBackend, SessionBackendProvider } = createSessionBackend<SessionBackend>({
  ...SUPABASE_CORE_BACKEND,
  recordCard,
  toggleFollowUp,
  loadQuizQuestions: (setId, number) => fetchQuestions(setId, number),
  answerQuiz: saveAnswer,
  saveScores,
});
