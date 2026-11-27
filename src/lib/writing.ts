/**
 * Writing feedback: sends a student's writing to the assess-writing edge
 * function (supabase/functions/assess-writing), which asks Claude for a CEFR
 * level estimate and feedback. The Anthropic API key never reaches the app.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Level } from '@/core/content/levels';
import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';

export const MIN_WORDS = 20;
export const MAX_WORDS = 600;

export type CefrLevel = 'Pre-A1' | Level;
/** An area's level can also be a "+" level. */
export type AreaLevel = CefrLevel | 'A1+' | 'A2+' | 'B1+' | 'B2+';

/** Matches FeedbackSchema in supabase/functions/assess-writing/assess.ts. */
export type WritingFeedback = {
  cefr_level: CefrLevel;
  confidence: 'low' | 'medium' | 'high';
  level_explanation: string;
  summary: string;
  strengths: string[];
  criteria: { criterion: string; level: AreaLevel; comment: string }[];
  corrections: { original: string; corrected: string; explanation: string; type: string }[];
  focus_grammar: { used_well: string[]; to_improve: string[]; comment: string } | null;
  /** Missing from feedback made before paragraph advice was added. */
  paragraphing?: { comment: string; new_paragraph_before: string[] };
  next_steps: string[];
};

export type WritingRequest = {
  text: string;
  level: Level;
  task?: string;
  week?: number | null;
  /** A grammar point to pay attention to when no week is given (e.g. from a class set's sheet). */
  focusGrammar?: string;
  /** Words guessed when reading handwriting: they may be misread, so they are never corrected. */
  guessedWords?: string[];
  /** Teacher marking (class sets): correct every mistake, not just the main ones. */
  everyMistake?: boolean;
  /** Skip the saved result and mark again ("Read and mark again"). */
  fresh?: boolean;
};

export type WritingResponse = {
  feedback: WritingFeedback;
  remainingToday: number;
  /** True when this exact writing was sent before and the saved feedback was shown (no check used). */
  cached?: boolean;
};

export async function requestFeedback(request: WritingRequest): Promise<WritingResponse> {
  const client = requireSupabase();
  await ensureSignedIn();

  const { data, error } = await client.functions.invoke('assess-writing', {
    body: {
      text: request.text,
      level: request.level,
      task: request.task?.trim() || undefined,
      week: request.week ?? undefined,
      focus_grammar: request.focusGrammar?.trim() || undefined,
      guessed_words: request.guessedWords?.length ? request.guessedWords : undefined,
      every_mistake: request.everyMistake ? true : undefined,
      fresh: request.fresh ? true : undefined,
    },
  });

  if (error) {
    // The function explains what went wrong in a { message } body.
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('Feedback is not available right now. Please try again later.');
  }

  return {
    feedback: data.feedback as WritingFeedback,
    remainingToday: data.remaining_today,
    cached: data.cached === true,
  };
}
