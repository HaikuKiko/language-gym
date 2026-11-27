import { useEffect, useState } from 'react';

import { errorMessage } from '@/core/app/supabase';
import type { QuizQuestion } from '@/core/live/quiz';
import type { LiveSession } from '@/core/live/session';
import { quizOf } from '@/lib/grammar-quiz';
import { useSessionBackend } from '@/lib/session-backend';

/**
 * The questions of the quiz a session plays (loaded once). Students can read
 * them only while the quiz is running, so they are kept for the end screen.
 */
export function useQuizQuestions(session: LiveSession) {
  const backend = useSessionBackend();
  const quiz = quizOf(session);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const setId = quiz?.setId;
  const number = quiz?.number;

  useEffect(() => {
    if (!setId || !number) return;
    let cancelled = false;
    setError(null);
    backend
      .loadQuizQuestions(setId, number)
      .then((list) => !cancelled && setQuestions(list))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [backend, setId, number, attempt]);

  return { questions, error, retry: () => setAttempt((n) => n + 1) };
}
