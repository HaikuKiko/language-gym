/**
 * Sharing a marked IELTS essay's results with other teachers: the essay, the
 * question, the AI's full feedback and the photos of the pages are saved
 * under a short code. /calibrate/<code> shows the results and everyone's
 * marks so far, and lets another teacher add theirs. Rows live in the
 * shared_essays table, photos in the shared-essay-photos storage bucket.
 * Nothing expires.
 */
import { getAppAddress } from '@/components/join-qr-code';
import { aiMarking, type AiMarking } from '@/lib/calibration';
import type { IeltsFeedback } from '@/lib/ielts';
import type { PreparedPhoto } from '@/lib/photo';
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** The storage bucket for the photos of shared essays. */
const PHOTO_BUCKET = 'shared-essay-photos';
/** Letters and digits in the code, leaving out ones that are easy to confuse (0/O, 1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Length of the code in the link. */
const CODE_LENGTH = 6;
/** How long the photo links made when the page opens keep working. */
const PHOTO_LINK_SECONDS = 24 * 60 * 60;
/** The model that marked the essay, kept with it like calibration_marks. */
const MARKING_MODEL = 'claude-haiku-5-5';

// ===========================================================================

export type SharedEssay = {
  code: string;
  question: string;
  essay: string;
  marking: AiMarking;
  /** The AI's full feedback (missing on the first few shared before 23 Nov). */
  feedback: IeltsFeedback | null;
  /** Links to the photos of the pages, page 1 first (may be empty). */
  photoUrls: string[];
};

function newCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The link another teacher opens, or null if the app's address is unknown. */
export function calibrateUrl(code: string): string | null {
  const address = getAppAddress();
  return address ? `${address}/calibrate/${code}` : null;
}

/** Saves the essay (and its photos) for other teachers, and returns its code. */
export async function shareEssay(input: {
  question: string;
  essay: string;
  feedback: IeltsFeedback;
  photos: PreparedPhoto[];
}): Promise<string> {
  const client = requireSupabase();
  await ensureSignedIn();
  const code = newCode();

  const photoPaths: string[] = [];
  for (const [i, photo] of input.photos.entries()) {
    const path = `${code}/page-${i + 1}.jpg`;
    const { error } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, base64ToBytes(photo.base64), { contentType: photo.mediaType });
    if (error) {
      console.error('Photo upload failed', error.message);
      throw new Error('The photos could not be uploaded. Please try again.');
    }
    photoPaths.push(path);
  }

  const { ai, aiOverall, wordCount } = aiMarking(input.feedback);
  const { error } = await client.from('shared_essays').insert({
    code,
    question: input.question.trim(),
    essay: input.essay.trim(),
    word_count: wordCount,
    model: MARKING_MODEL,
    ai_tr: ai.tr,
    ai_cc: ai.cc,
    ai_lr: ai.lr,
    ai_gra: ai.gra,
    ai_overall: aiOverall,
    photo_paths: photoPaths,
    feedback: input.feedback,
  });
  if (error) {
    console.error('Sharing failed', error.message);
    throw new Error('The essay could not be shared. Please try again.');
  }
  return code;
}

/** The shared essay for a code, or null if there is none. */
export async function loadSharedEssay(code: string): Promise<SharedEssay | null> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client.from('shared_essays').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) {
    console.error('Loading the shared essay failed', error.message);
    throw new Error('The essay could not be loaded. Please try again.');
  }
  if (!data) return null;

  const paths: string[] = data.photo_paths ?? [];
  let photoUrls: string[] = [];
  if (paths.length > 0) {
    const { data: signed } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_LINK_SECONDS);
    photoUrls = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
  }

  return {
    code: data.code,
    question: data.question ?? '',
    essay: data.essay,
    marking: {
      ai: { tr: data.ai_tr, cc: data.ai_cc, lr: data.ai_lr, gra: data.ai_gra },
      aiOverall: Number(data.ai_overall),
      wordCount: data.word_count,
    },
    feedback: (data.feedback as IeltsFeedback | null) ?? null,
    photoUrls,
  };
}
