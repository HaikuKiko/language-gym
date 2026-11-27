/**
 * Reading a photo of handwriting (Marking kit), and the checks every writing
 * box shares before a text is sent for marking.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';
import { countWords } from '@/core/app/text';
import type { MistakeAnchor } from '@/core/marking/marks';


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
  /** True when the same photo was read before and the earlier reading was reused (no reading used). */
  fromCache?: boolean;
  /** How many pages (photos) were read together. */
  pages: number;
  /** The transcript keeps the lines of the paper (teachers, when asked). */
  lineByLine?: boolean;
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
 * Why the writing can't be sent yet, or null when it can. The same checks
 * for every writing screen: no [?] left from a photo, and the word limits.
 */
export function writingProblem(
  text: string,
  rules: { minWords: number; maxWords: number; teacher?: boolean },
): string | null {
  const words = countWords(text);
  const unreadable = text.split(UNREADABLE_MARK).length - 1;
  if (unreadable > 0) {
    const marks = unreadable === 1 ? 'the [?] mark' : `the ${unreadable} [?] marks`;
    return `Replace ${marks} with the words ${rules.teacher ? 'on the paper' : 'you wrote'}.`;
  }
  if (words < rules.minWords) {
    return rules.teacher
      ? `Add the essay (at least ${rules.minWords} words).`
      : `Write at least ${rules.minWords} words (${words} so far).`;
  }
  if (words > rules.maxWords) return `Please shorten it to ${rules.maxWords} words or fewer (${words} now).`;
  return null;
}

/** Where marks sit in a text, and how long that text was then. */
export type TextMarks = { anchors: MistakeAnchor[]; length: number };

/**
 * Reads one or more photos (the pages of one piece of writing, in order) into
 * a single transcript. All the pages together count as one photo reading.
 */
export async function readPhoto(
  images: { base64: string; mediaType: string }[],
  options: { teacher?: boolean; lineByLine?: boolean } = {},
): Promise<PhotoReading> {
  if (images.length === 0) throw new Error('Please choose a photo.');
  const lineByLine = !!options.teacher && !!options.lineByLine;
  const key = options.teacher
    ? await photoKey((lineByLine ? 'lines|' : '') + images.map((i) => i.base64).join('|'))
    : null;
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
      ...(lineByLine ? { line_by_line: true } : {}),
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
    fromCache: data.cached === true,
    pages: images.length,
    lineByLine: data.line_by_line === true,
  };
  if (key && reading.containsWriting) saveLastPhoto(key, reading);
  return reading;
}

