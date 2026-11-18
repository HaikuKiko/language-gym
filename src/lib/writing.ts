/**
 * Writing feedback: sends a student's writing to the assess-writing edge
 * function (supabase/functions/assess-writing), which asks Claude for a CEFR
 * level estimate and feedback. The Anthropic API key never reaches the app.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Level } from '@/data/questions';
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';

export const MIN_WORDS = 20;
export const MAX_WORDS = 600;

export type CefrLevel = 'Pre-A1' | Level;

/** Matches FeedbackSchema in supabase/functions/assess-writing/assess.ts. */
export type WritingFeedback = {
  cefr_level: CefrLevel;
  confidence: 'low' | 'medium' | 'high';
  level_explanation: string;
  summary: string;
  strengths: string[];
  criteria: { criterion: string; level: CefrLevel; comment: string }[];
  corrections: { original: string; corrected: string; explanation: string; type: string }[];
  focus_grammar: { used_well: string[]; to_improve: string[]; comment: string } | null;
  next_steps: string[];
};

export type WritingRequest = {
  text: string;
  level: Level;
  task?: string;
  week?: number | null;
};

export type WritingResponse = { feedback: WritingFeedback; remainingToday: number };

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function requestFeedback(request: WritingRequest): Promise<WritingResponse> {
  const client = requireSupabase();
  await ensureSignedIn();

  const { data, error } = await client.functions.invoke('assess-writing', {
    body: {
      text: request.text,
      level: request.level,
      task: request.task?.trim() || undefined,
      week: request.week ?? undefined,
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

  return { feedback: data.feedback as WritingFeedback, remainingToday: data.remaining_today };
}

// ---------------------------------------------------------------------------
// Reading a photo of handwriting
// ---------------------------------------------------------------------------

export type PhotoReading = {
  transcript: string;
  legibility: 'good' | 'partial' | 'poor';
  containsWriting: boolean;
  note: string;
  remainingToday: number;
};

/** Marks Claude leaves where it could not read a word. */
export const UNREADABLE_MARK = '[?]';

export async function readPhoto(image: { base64: string; mediaType: string }): Promise<PhotoReading> {
  const client = requireSupabase();
  await ensureSignedIn();

  const { data, error } = await client.functions.invoke('assess-writing', {
    body: { mode: 'transcribe', image: image.base64, media_type: image.mediaType },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('We could not read the photo right now. Please try again later.');
  }

  return {
    transcript: data.transcript,
    legibility: data.legibility,
    containsWriting: data.contains_writing,
    note: data.note,
    remainingToday: data.remaining_today,
  };
}
