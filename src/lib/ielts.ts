/**
 * IELTS Writing Task 2: the questions the teacher has set, and band-score
 * feedback from the assess-writing edge function (track "ielts").
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { ensureSignedIn, requireSupabase } from '@/lib/supabase';
import type { Correction } from '@/lib/writing';

export const IELTS_MIN_WORDS = 250;
export const IELTS_MAX_WORDS = 700;
/** The server refuses anything shorter than this. */
export const IELTS_HARD_MIN_WORDS = 20;
export const TASK2_MINUTES = 40;

export type EssayType =
  | 'opinion'
  | 'discussion'
  | 'advantages_disadvantages'
  | 'problem_solution'
  | 'two_part';

export const ESSAY_TYPE_NAMES: Record<EssayType, string> = {
  opinion: 'Opinion',
  discussion: 'Discussion',
  advantages_disadvantages: 'Advantages & disadvantages',
  problem_solution: 'Problem & solution',
  two_part: 'Two-part question',
};

export type WritingPrompt = {
  id: number;
  essayType: EssayType | null;
  topic: string;
  prompt: string;
  minWords: number;
};

export type IeltsCriterion = {
  criterion: string;
  code: 'tr' | 'cc' | 'lr' | 'gra';
  band: number;
  band_before_length: number;
  comment: string;
  next_band: string;
};

/** Matches IeltsFeedback in supabase/functions/assess-writing/ielts.ts. */
export type IeltsFeedback = {
  track: 'ielts';
  task_type: 'task2';
  confidence: 'low' | 'medium' | 'high';
  task_check: { parts: { part: string; covered: 'fully' | 'partly' | 'not' }[]; position_comment: string };
  criteria: IeltsCriterion[];
  summary: string;
  strengths: string[];
  corrections: Correction[];
  paragraphing: { comment: string; new_paragraph_before: string[] };
  to_reach_target: string[];
  overall_band: number;
  target_band: number | null;
  word_count: number;
  min_words: number;
  length_penalty_applied: boolean;
};

export type IeltsResponse = { feedback: IeltsFeedback; remainingToday: number };

/** Short names for the tiles; the full names are used everywhere else. */
export const CRITERION_SHORT: Record<IeltsCriterion['code'], string> = {
  tr: 'Task Response',
  cc: 'Coherence & Cohesion',
  lr: 'Lexical Resource',
  gra: 'Grammatical Range & Accuracy',
};

/** Shows a band as IELTS does: 6 -> "6.0", 6.5 -> "6.5". */
export function formatBand(band: number): string {
  return band.toFixed(1);
}

/** The questions the teacher has set for IELTS, newest first. */
export async function loadAssignedPrompts(): Promise<WritingPrompt[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('writing_prompts')
    .select('id, essay_type, topic, prompt, min_words')
    .eq('track_id', 'ielts')
    .eq('task_type', 'task2')
    .eq('assigned', true)
    .order('assigned_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error('Could not load your question. Please try again.');
  return (data ?? []).map((row) => ({
    id: row.id,
    essayType: (row.essay_type as EssayType | null) ?? null,
    topic: row.topic,
    prompt: row.prompt,
    minWords: row.min_words,
  }));
}

export async function requestIeltsFeedback(promptId: number, text: string): Promise<IeltsResponse> {
  const client = requireSupabase();
  await ensureSignedIn();

  const { data, error } = await client.functions.invoke('assess-writing', {
    body: { track: 'ielts', prompt_id: promptId, text },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('Feedback is not available right now. Please try again later.');
  }

  return { feedback: data.feedback as IeltsFeedback, remainingToday: data.remaining_today };
}
