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
  /** Hard-to-read words that were guessed; check them against the paper. */
  guessedWords: string[];
  note: string;
  remainingToday: number;
  /** How many photos this person has had read today, including this one. */
  usedToday?: number;
  /** True when the same photo was read before on this device and the earlier reading was reused. */
  fromCache?: boolean;
  /** How many pages (photos) were read together. */
  pages: number;
};

// The last photo a teacher had read on this device, so uploading the same
// photo again is instant and doesn't count again. Only one is kept.
const LAST_PHOTO_KEY = 'language-gym:last-teacher-photo';

async function photoKey(base64: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(base64));
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fall through to a simple hash.
  }
  let h = 2166136261;
  for (let i = 0; i < base64.length; i++) h = Math.imul(h ^ base64.charCodeAt(i), 16777619);
  return `${base64.length}-${(h >>> 0).toString(16)}`;
}

function loadLastPhoto(): { key: string; reading: PhotoReading } | null {
  try {
    const raw = globalThis.localStorage?.getItem(LAST_PHOTO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastPhoto(key: string, reading: PhotoReading) {
  try {
    globalThis.localStorage?.setItem(LAST_PHOTO_KEY, JSON.stringify({ key, reading }));
  } catch {
    // Storage full or blocked: just don't cache.
  }
}

/** Marks Claude leaves where it could not read a word. */
export const UNREADABLE_MARK = '[?]';

/**
 * Reads one or more photos (the pages of one piece of writing, in order) into
 * a single transcript. All the pages together count as one photo reading.
 */
export async function readPhoto(
  images: { base64: string; mediaType: string }[],
  options: { teacher?: boolean } = {},
): Promise<PhotoReading> {
  if (images.length === 0) throw new Error('Please choose a photo.');
  const key = options.teacher ? await photoKey(images.map((i) => i.base64).join('|')) : null;
  if (key) {
    const last = loadLastPhoto();
    if (last && last.key === key) return { ...last.reading, usedToday: undefined, fromCache: true };
  }

  const client = requireSupabase();
  await ensureSignedIn();

  const { data, error } = await client.functions.invoke('assess-writing', {
    body: {
      mode: 'transcribe',
      ...(images.length === 1
        ? { image: images[0].base64, media_type: images[0].mediaType }
        : { images: images.map((i) => ({ image: i.base64, media_type: i.mediaType })) }),
      ...(options.teacher ? { teacher: true } : {}),
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('We could not read the photo right now. Please try again later.');
  }

  const reading: PhotoReading = {
    transcript: data.transcript,
    legibility: data.legibility,
    containsWriting: data.contains_writing,
    guessedWords: Array.isArray(data.guessed_words) ? data.guessed_words : [],
    note: data.note,
    remainingToday: data.remaining_today,
    usedToday: typeof data.used_today === 'number' ? data.used_today : undefined,
    pages: images.length,
  };
  if (key && reading.containsWriting) saveLastPhoto(key, reading);
  return reading;
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
  notes: { number: number; correction: Correction; found: boolean; start?: number }[];
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
    ...found.map((item, i) => ({
      number: i + 1,
      correction: item.correction,
      found: true,
      start: item.range!.start,
    })),
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

// ---------------------------------------------------------------------------
// Underlining old mistakes while the student edits
// ---------------------------------------------------------------------------

/** A mistake from the last feedback and where it was in that text. */
export type MistakeAnchor = { original: string; start: number };

export function anchorsFrom(marked: MarkedText): MistakeAnchor[] {
  return marked.notes
    .filter((note) => note.found && note.start !== undefined)
    .map((note) => ({ original: note.correction.original, start: note.start! }));
}

/** Where each anchor's words are now, if they are still near where they were. */
function findAnchorRanges(
  text: string,
  anchors: MistakeAnchor[],
  originalLength: number,
  taken: { start: number; end: number }[] = [],
): { start: number; end: number }[] {
  const searchable = normalise(text);
  const drift = Math.abs(text.length - originalLength) + 12;
  const ranges: { start: number; end: number }[] = [];

  for (const anchor of anchors) {
    const target = normalise(anchor.original);
    if (!target) continue;
    let best: number | null = null;
    let from = 0;
    for (;;) {
      const at = searchable.indexOf(target, from);
      if (at === -1) break;
      const clash = [...taken, ...ranges].some((r) => at < r.end && at + target.length > r.start);
      // Whole words only, so "evening" stops matching once it becomes "evenings".
      const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
      const cutsWord =
        (isWordChar(target[0]) && isWordChar(searchable[at - 1])) ||
        (isWordChar(target[target.length - 1]) && isWordChar(searchable[at + target.length]));
      if (!clash && !cutsWord && Math.abs(at - anchor.start) <= drift) {
        if (best === null || Math.abs(at - anchor.start) < Math.abs(best - anchor.start)) best = at;
      }
      from = at + 1;
    }
    if (best !== null) ranges.push({ start: best, end: best + target.length });
  }
  return ranges;
}

export type MarkKind = 'mistake' | 'guess';

/**
 * Splits the text being edited into plain, underlined (a mistake from the
 * last feedback) and highlighted (a word guessed from a photo) parts. A mark
 * stays only while its exact words are still near where they were, so it
 * goes away when the words are changed.
 */
export function markParts(
  text: string,
  mistakes: { anchors: MistakeAnchor[]; length: number } | null,
  guesses: { anchors: MistakeAnchor[]; length: number } | null,
): { text: string; kind: MarkKind | null }[] {
  const mistakeRanges = mistakes ? findAnchorRanges(text, mistakes.anchors, mistakes.length) : [];
  const guessRanges = guesses ? findAnchorRanges(text, guesses.anchors, guesses.length, mistakeRanges) : [];
  const ranges = [
    ...mistakeRanges.map((r) => ({ ...r, kind: 'mistake' as const })),
    ...guessRanges.map((r) => ({ ...r, kind: 'guess' as const })),
  ].sort((a, b) => a.start - b.start);

  const parts: { text: string; kind: MarkKind | null }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), kind: null });
    parts.push({ text: text.slice(range.start, range.end), kind: range.kind });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), kind: null });
  return parts;
}

/**
 * Where each guessed word from a photo sits in the transcript, in order, so
 * it can be highlighted. Words are matched whole where possible.
 */
export function guessAnchorsFrom(transcript: string, guessed: string[]): MistakeAnchor[] {
  const anchors: MistakeAnchor[] = [];
  let from = 0;
  for (const word of guessed) {
    const target = word.trim();
    if (!target) continue;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'gu');
    re.lastIndex = from;
    const match = re.exec(transcript) ?? new RegExp(re.source, 'gu').exec(transcript);
    if (!match) continue;
    const start = match.index + match[1].length;
    anchors.push({ original: target, start });
    from = start + target.length;
  }
  return anchors;
}
