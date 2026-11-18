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
  /** Missing from feedback made before paragraph advice was added. */
  paragraphing?: { comment: string; new_paragraph_before: string[] };
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

// ---------------------------------------------------------------------------
// Marking corrections on the student's own text
// ---------------------------------------------------------------------------

export type Correction = WritingFeedback['corrections'][number];

export type MarkedText = {
  /**
   * The student's text in order. Parts with a note carry its number; a
   * paragraph mark has empty text and shows where a new paragraph could start.
   */
  segments: { text: string; number: number | null; paragraphMark?: boolean }[];
  /** One note per correction, numbered in reading order. */
  notes: { number: number; correction: Correction; found: boolean }[];
  /** How many of the suggested paragraph starts were found and marked. */
  paragraphMarks: number;
};

/** Curly quotes and apostrophes count as straight ones when matching. */
function normalise(value: string): string {
  return value.replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"');
}

/**
 * Finds each correction's original words in the student's text, without
 * changing the text. Notes are numbered in the order their words appear;
 * any whose words can't be found are listed after, unmarked. Paragraph
 * suggestions are marked just before the words they quote.
 */
export function markCorrections(
  text: string,
  corrections: Correction[],
  paragraphStarts: string[] = [],
): MarkedText {
  // Same length as the text, so positions found here apply to the text too.
  const searchable = [normalise(text), normalise(text).toLowerCase()];
  const taken: { start: number; end: number }[] = [];
  const overlaps = (start: number, end: number) =>
    taken.some((range) => start < range.end && end > range.start);

  function locate(needle: string): { start: number; end: number } | null {
    const target = normalise(needle.trim());
    if (!target) return null;
    for (const [i, haystack] of searchable.entries()) {
      const wanted = i === 0 ? target : target.toLowerCase();
      let from = 0;
      for (;;) {
        const start = haystack.indexOf(wanted, from);
        if (start === -1) break;
        const end = start + wanted.length;
        if (!overlaps(start, end)) return { start, end };
        from = start + 1;
      }
    }
    return null;
  }

  const located = corrections.map((correction) => {
    const range = locate(correction.original);
    if (range) taken.push(range);
    return { correction, range };
  });

  const found = located
    .filter((item) => item.range !== null)
    .sort((a, b) => a.range!.start - b.range!.start);
  const missing = located.filter((item) => item.range === null);

  const notes: MarkedText['notes'] = [
    ...found.map((item, i) => ({ number: i + 1, correction: item.correction, found: true })),
    ...missing.map((item, i) => ({
      number: found.length + i + 1,
      correction: item.correction,
      found: false,
    })),
  ];

  // Paragraph marks go before the quoted words; they may sit inside nothing
  // else, so a mark that would split a correction moves to its start.
  const marks = new Set<number>();
  for (const quote of paragraphStarts) {
    const target = normalise(quote.trim()).toLowerCase();
    if (!target) continue;
    const at = searchable[1].indexOf(target);
    if (at <= 0) continue;
    const inside = found.find((item) => at > item.range!.start && at < item.range!.end);
    marks.add(inside ? inside.range!.start : at);
  }

  const cuts = [
    ...found.map((item, i) => ({ at: item.range!.start, end: item.range!.end, number: i + 1 })),
    ...[...marks].map((at) => ({ at, end: at, number: 0 })),
  ].sort((a, b) => a.at - b.at || a.number - b.number);

  const segments: MarkedText['segments'] = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.at > cursor) segments.push({ text: text.slice(cursor, cut.at), number: null });
    if (cut.number === 0) {
      segments.push({ text: '', number: null, paragraphMark: true });
    } else {
      segments.push({ text: text.slice(cut.at, cut.end), number: cut.number });
    }
    cursor = Math.max(cursor, cut.end);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), number: null });

  return { segments, notes, paragraphMarks: marks.size };
}
