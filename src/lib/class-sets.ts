/**
 * Class sets: a teacher uploads a scan (PDF) or photos of a class's writing,
 * one page per student. Each page is read (with the name, task and grammar
 * focus from the printed sheet), given General English feedback, and saved
 * under the student's name, so each student's progress can be charted later.
 *
 * Tables class_sets and class_set_pages, photos in the class-set-photos
 * bucket (see supabase/updates/2026-11-23-class-sets.sql). Teachers have no
 * accounts yet, so a class set belongs to the device that made it.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Level } from '@/data/questions';
import { matchStudent, type ClassStudent } from '@/lib/classes';
import type { PreparedPhoto } from '@/lib/photo';
import { requestTeacherIeltsFeedback, type IeltsFeedback } from '@/lib/ielts';
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';
import {
  MIN_WORDS,
  countWords,
  joinLines,
  requestFeedback,
  type AreaLevel,
  type CefrLevel,
  type WritingFeedback,
} from '@/lib/writing';

// ===========================================================================
// Settings
// ===========================================================================

/** Most pages (students) in one class set. */
export const MAX_CLASS_SET_PAGES = 40;
/** Pages read and marked at the same time. */
const PAGES_AT_ONCE = 2;
/**
 * TEMPORARY, for testing: true = a class set is read and marked one student
 * at a time ("Do the next student"), so the teacher can look at each before
 * more are done. Set to false to read every page and use "Mark all" again.
 */
export const ONE_STUDENT_AT_A_TIME = true;
/** Longest side of each page image sent to Claude (the same as photos). */
const PAGE_MAX_SIDE = 1568;
/** The storage bucket for the pages' photos. */
const PHOTO_BUCKET = 'class-set-photos';
/** How long the page photo links made when a screen opens keep working. */
const PHOTO_LINK_SECONDS = 24 * 60 * 60;
/** pdf.js, loaded from a CDN only when a PDF is chosen (web only). */
const PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_JS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
/** Opening a PDF: give up (with a message) if loading the PDF reader or one page takes longer than this. */
const PDF_STEP_TIMEOUT_MS = 60_000;

// ===========================================================================

/** The four areas of General English feedback, in order. */
export const AREAS = ['Content', 'Organisation', 'Grammar', 'Vocabulary'] as const;
export type Area = (typeof AREAS)[number];

/** What a class (and its class sets) is marked for. */
export type Course = 'general' | 'ielts';

export type ClassSet = {
  id: string;
  /** General English (levels, score out of 10) or IELTS Writing Task 2 (bands). */
  course: Course;
  created_at: string;
  /** The class it belongs to (missing only on the first sets, made before classes). */
  class_id: string | null;
  title: string;
  class_name: string;
  level: Level;
  task: string;
  grammar_focus: string;
  file_name: string;
  page_count: number;
};

export type SheetDetails = {
  student_name: string;
  class_name: string;
  sheet_date: string;
  task: string;
  grammar_focus: string;
  guessed_words: string[];
  legibility: string;
  note: string;
  /** The transcript keeps the lines of the paper (pages read after line-by-line reading came in). */
  line_by_line?: boolean;
};

export type PageStatus = 'waiting' | 'reading' | 'marking' | 'done' | 'error';

export type ClassSetPage = {
  id: string;
  set_id: string;
  page_number: number;
  student_name: string;
  student_key: string;
  /** The student in the class (null until matched or chosen). */
  student_id: string | null;
  photo_path: string;
  status: PageStatus;
  error: string | null;
  transcript: string | null;
  sheet: SheetDetails | null;
  /** General English feedback, or IELTS feedback in an IELTS class set. */
  feedback: WritingFeedback | IeltsFeedback | null;
  cefr_level: CefrLevel | null;
  /** IELTS class sets: the overall band. */
  band: number | null;
  area_levels: Partial<Record<Area, AreaLevel>> | null;
  /**
   * For a student's second (third…) page: the page number of their first
   * page, which holds the feedback for all of them. Null on first pages.
   */
  continues_page: number | null;
  /** On a first page: the whole writing as corrected by the teacher (null = as read). */
  edited_text: string | null;
  /** On a first page: the teacher has checked the reading against the paper. */
  reading_checked: boolean;
};

/** Whether feedback is IELTS band scores (an IELTS class set). */
export function isIeltsFeedback(f: WritingFeedback | IeltsFeedback | null | undefined): f is IeltsFeedback {
  return !!f && (f as IeltsFeedback).track === 'ielts';
}

/**
 * Whether a page is the first page of a student's writing: it shows the
 * printed sheet (a name, class, date or grammar focus). A page with none of
 * these, like the back of a sheet, continues the student before it.
 */
export function isFirstPage(sheet: SheetDetails | null): boolean {
  if (!sheet) return true;
  return !!(sheet.student_name || sheet.class_name || sheet.sheet_date || sheet.grammar_focus);
}

/** One entry per student: the first pages, in order. */
export function studentPages(pages: ClassSetPage[]): ClassSetPage[] {
  return pages.filter((p) => p.continues_page == null).sort((a, b) => a.page_number - b.page_number);
}

/** A student's pages: their first page and the pages that continue it. */
export function pagesOf(first: ClassSetPage, pages: ClassSetPage[]): ClassSetPage[] {
  return [first, ...pages.filter((p) => p.continues_page === first.page_number)].sort(
    (a, b) => a.page_number - b.page_number,
  );
}

/** A student's whole writing, over all their pages (as corrected by the teacher, if they did). */
export function fullTranscript(first: ClassSetPage, pages: ClassSetPage[]): string {
  if (first.edited_text != null) return first.edited_text;
  return readTranscript(first, pages);
}

/**
 * Whether a student's pages were read line by line (one printed line for each
 * handwritten line). Sets read before that show the writing as paragraphs.
 */
export function isLineByLine(first: ClassSetPage, pages: ClassSetPage[]): boolean {
  return pagesOf(first, pages).every((p) => p.sheet?.line_by_line === true);
}

/** How many lines of writing each of a student's pages has (to number lines page by page). */
export function pageLineCounts(first: ClassSetPage, pages: ClassSetPage[]): number[] {
  return pagesOf(first, pages)
    .map((p) => (p.transcript ?? '').split('\n').filter((line) => line.trim()).length)
    .filter((count) => count > 0);
}

/** A student's writing exactly as read from their pages. */
function readTranscript(first: ClassSetPage, pages: ClassSetPage[]): string {
  return pagesOf(first, pages)
    .map((p) => (p.transcript ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** The key a student's work is saved under: the name in lower case, single spaces. */
export function studentKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** "Page 3 (no name)" for pages without a name yet. */
export function pageTitle(page: Pick<ClassSetPage, 'student_name' | 'page_number'>): string {
  return page.student_name.trim() || `Page ${page.page_number} (no name)`;
}

// ---------------------------------------------------------------------------
// Turning a PDF into page images (web)
// ---------------------------------------------------------------------------

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfDocument> };
};
type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy?: () => Promise<void> };
type PdfPage = {
  cleanup?: () => void;
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};

let pdfJsLoading: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  const existing = (globalThis as { pdfjsLib?: PdfJs }).pdfjsLib;
  if (existing) return Promise.resolve(existing);
  pdfJsLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDF_JS;
    script.onload = () => {
      const lib = (globalThis as { pdfjsLib?: PdfJs }).pdfjsLib;
      if (!lib) return reject(new Error('Could not open PDFs here.'));
      lib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER;
      resolve(lib);
    };
    script.onerror = () => {
      pdfJsLoading = null;
      reject(new Error('Could not open PDFs here. Check the internet connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return pdfJsLoading;
}

/** True where a PDF can be turned into pages (in a browser). */
export const CAN_READ_PDF = Platform.OS === 'web';

/** Waits for a step of opening a PDF, but not for ever. */
function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Opening the PDF got stuck (${what}). Try again, or try on a computer, or use "Choose photos".`)),
      PDF_STEP_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Opens the file chooser; null if nothing is chosen. */
function chooseFile(accept: string): Promise<File | null> {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // Some browsers (iPad Safari) only report the chosen file when the input is on the page.
    input.style.display = 'none';
    document.body.appendChild(input);
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

/**
 * Lets the teacher choose a PDF (web only) and returns its pages as JPEG
 * photos. onFile: a file was chosen; onProgress: pages turned into photos so far.
 */
export async function choosePdfPages(
  onFile?: () => void,
  onProgress?: (done: number, total: number) => void,
): Promise<{ fileName: string; pages: PreparedPhoto[] } | null> {
  const file = await chooseFile('application/pdf,.pdf');
  if (!file) return null;
  onFile?.();

  const pdfjs = await withTimeout(loadPdfJs(), 'loading the PDF reader');
  const data = new Uint8Array(await withTimeout(file.arrayBuffer(), 'reading the file'));
  const pdf = await withTimeout(pdfjs.getDocument({ data }).promise, 'opening the file');
  if (pdf.numPages > MAX_CLASS_SET_PAGES) {
    throw new Error(`That PDF has ${pdf.numPages} pages. A class set can have up to ${MAX_CLASS_SET_PAGES}.`);
  }
  onProgress?.(0, pdf.numPages);

  const pages: PreparedPhoto[] = [];
  // One canvas for every page, so small devices don't run out of memory.
  const canvas = document.createElement('canvas');
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await withTimeout(pdf.getPage(n), `page ${n}`);
      const base = page.getViewport({ scale: 1 });
      const scale = PAGE_MAX_SIDE / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not draw the PDF pages.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await withTimeout(page.render({ canvasContext: context, viewport }).promise, `page ${n}`);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      pages.push({ base64: dataUrl.replace(/^data:[^,]+,/, ''), mediaType: 'image/jpeg' });
      page.cleanup?.();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    pdf.destroy?.().catch(() => undefined);
  }
  return { fileName: file.name, pages };
}

// ---------------------------------------------------------------------------
// Saving and loading
// ---------------------------------------------------------------------------

/** Page images of sets made on this device in this visit, so they need not be downloaded again. */
const pageImages = new Map<string, PreparedPhoto>();
const imageKey = (setId: string, pageNumber: number) => `${setId}#${pageNumber}`;

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the page photo.'));
    reader.readAsDataURL(blob);
  });
  return dataUrl.replace(/^data:[^,]+,/, '');
}

/** Saves a new class set and its page photos; returns the set's id. */
export async function createClassSet(
  input: {
    classId: string;
    course: Course;
    title: string;
    className: string;
    level: Level;
    task: string;
    grammarFocus: string;
    fileName: string;
  },
  pages: PreparedPhoto[],
  onProgress?: (uploaded: number) => void,
): Promise<string> {
  const client = requireSupabase();
  const userId = await ensureSignedIn();
  if (pages.length === 0) throw new Error('Choose a scan or some photos first.');
  if (pages.length > MAX_CLASS_SET_PAGES) {
    throw new Error(`A class set can have up to ${MAX_CLASS_SET_PAGES} pages.`);
  }

  const { data: set, error } = await client
    .from('class_sets')
    .insert({
      class_id: input.classId,
      course: input.course,
      title: input.title.trim(),
      class_name: input.className.trim(),
      level: input.level,
      task: input.task.trim(),
      grammar_focus: input.grammarFocus.trim(),
      file_name: input.fileName,
      page_count: pages.length,
    })
    .select('id')
    .single();
  if (error || !set) {
    console.error('Creating the class set failed', error?.message);
    throw new Error('The class set could not be saved. Please try again.');
  }

  const rows = [];
  for (const [i, page] of pages.entries()) {
    const pageNumber = i + 1;
    const path = `${userId}/${set.id}/page-${pageNumber}.jpg`;
    const { error: uploadError } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, base64ToBytes(page.base64), { contentType: page.mediaType });
    if (uploadError) {
      console.error('Page upload failed', uploadError.message);
      throw new Error('The pages could not be uploaded. Please try again.');
    }
    pageImages.set(imageKey(set.id, pageNumber), page);
    rows.push({ set_id: set.id, page_number: pageNumber, photo_path: path });
    onProgress?.(pageNumber);
  }

  const { error: pagesError } = await client.from('class_set_pages').insert(rows);
  if (pagesError) {
    console.error('Saving the pages failed', pagesError.message);
    throw new Error('The pages could not be saved. Please try again.');
  }
  return set.id as string;
}

export async function loadClassSets(): Promise<ClassSet[]> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client.from('class_sets').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Your class sets could not be loaded. Please try again.');
  return (data ?? []) as ClassSet[];
}

export async function loadClassSet(id: string): Promise<{ set: ClassSet; pages: ClassSetPage[] } | null> {
  const client = requireSupabase();
  await ensureSignedIn();
  const [{ data: set, error }, { data: pages, error: pagesError }] = await Promise.all([
    client.from('class_sets').select('*').eq('id', id).maybeSingle(),
    client.from('class_set_pages').select('*').eq('set_id', id).order('page_number'),
  ]);
  if (error || pagesError) throw new Error('The class set could not be loaded. Please try again.');
  if (!set) return null;
  return { set: set as ClassSet, pages: (pages ?? []) as ClassSetPage[] };
}

/** Links to the pages' photos, by page number. */
export async function pagePhotoUrls(pages: ClassSetPage[]): Promise<Record<number, string>> {
  const withPhotos = pages.filter((p) => p.photo_path);
  if (withPhotos.length === 0) return {};
  const { data } = await requireSupabase()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(
      withPhotos.map((p) => p.photo_path),
      PHOTO_LINK_SECONDS,
    );
  const urls: Record<number, string> = {};
  (data ?? []).forEach((d, i) => {
    if (d.signedUrl) urls[withPhotos[i].page_number] = d.signedUrl;
  });
  return urls;
}

async function savePage(id: string, changes: Partial<ClassSetPage>): Promise<void> {
  const { error } = await requireSupabase()
    .from('class_set_pages')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('Saving the page failed', error.message);
}

/** Changes the student's name on a page (and so the key their work is saved under). */
/**
 * Deletes a class set: its pages (and so their scores in students' history)
 * go with it, and so do the scanned page photos.
 */
export async function deleteClassSet(set: ClassSet, pages: ClassSetPage[]): Promise<void> {
  const client = requireSupabase();
  const paths = pages.map((p) => p.photo_path).filter((path): path is string => !!path);
  const { error } = await client.from('class_sets').delete().eq('id', set.id);
  if (error) throw new Error('The class set could not be deleted. Please try again.');
  // The photos are no use without the set; a photo that stays behind does no harm.
  if (paths.length > 0) await client.storage.from(PHOTO_BUCKET).remove(paths).catch(() => undefined);
}

export async function renamePage(page: ClassSetPage, name: string): Promise<ClassSetPage> {
  const changes = { student_name: name.trim().replace(/\s+/g, ' '), student_key: studentKey(name) };
  await savePage(page.id, changes);
  return { ...page, ...changes };
}

/** Every student name used in this teacher's class sets, for suggestions. */
export async function knownStudentNames(): Promise<string[]> {
  const { data } = await requireSupabase()
    .from('class_set_pages')
    .select('student_name, student_key')
    .neq('student_key', '')
    .limit(2000);
  const byKey = new Map<string, string>();
  for (const row of data ?? []) if (!byKey.has(row.student_key)) byKey.set(row.student_key, row.student_name);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Reading and marking
// ---------------------------------------------------------------------------

async function readSheet(image: PreparedPhoto): Promise<SheetDetails & { transcript: string; contains_writing: boolean }> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client.functions.invoke('assess-writing', {
    body: { mode: 'transcribe', image: image.base64, media_type: image.mediaType, teacher: true, sheet: true },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('This page could not be read. Try again.');
  }
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    transcript: text(data.transcript),
    contains_writing: data.contains_writing !== false,
    student_name: text(data.student_name),
    class_name: text(data.class_name),
    sheet_date: text(data.sheet_date),
    task: text(data.task),
    grammar_focus: text(data.grammar_focus),
    guessed_words: Array.isArray(data.guessed_words) ? data.guessed_words : [],
    legibility: text(data.legibility),
    note: text(data.note),
    line_by_line: data.line_by_line === true,
  };
}

async function pageImage(page: ClassSetPage): Promise<PreparedPhoto> {
  const kept = pageImages.get(imageKey(page.set_id, page.page_number));
  if (kept) return kept;
  const { data, error } = await requireSupabase().storage.from(PHOTO_BUCKET).download(page.photo_path);
  if (error || !data) throw new Error('The page photo could not be loaded.');
  return { base64: await blobToBase64(data), mediaType: 'image/jpeg' };
}

/** The words guessed while reading a student's pages (to check against the paper). */
export function guessedWords(first: ClassSetPage, pages: ClassSetPage[]): string[] {
  const words = pagesOf(first, pages).flatMap((p) => p.sheet?.guessed_words ?? []);
  return [...new Set(words.map((w) => w.trim()).filter(Boolean))];
}

/** Whether a student's reading still needs checking (guessed words not yet checked). */
export function needsChecking(first: ClassSetPage, pages: ClassSetPage[]): boolean {
  return !first.reading_checked && guessedWords(first, pages).length > 0;
}

/** Whether every page has been read (or could not be). */
export function allRead(pages: ClassSetPage[]): boolean {
  return pages.every((p) => p.transcript !== null || p.status === 'error');
}

/** Students read and ready to mark (or to mark again after an error, with retry). */
export function waitingToMark(pages: ClassSetPage[], retryErrors = false): ClassSetPage[] {
  if (!allRead(pages) || needsGrouping(pages)) return [];
  return studentPages(pages).filter(
    (p) => p.transcript !== null && p.status !== 'done' && (retryErrors || p.status !== 'error'),
  );
}

/**
 * The teacher has checked a student's reading. A changed text is kept; if
 * the writing was already marked, it is marked again.
 */
export async function saveReading(
  set: ClassSet,
  first: ClassSetPage,
  pages: ClassSetPage[],
  text: string,
  onChange: (page: ClassSetPage) => void,
): Promise<void> {
  const update = pageUpdater(onChange);
  const changed = text.trim() !== fullTranscript(first, pages).trim();
  const edited_text = changed ? (text.trim() === readTranscript(first, pages).trim() ? null : text) : first.edited_text;
  let current = await update(first, { reading_checked: true, edited_text });
  if (changed && current.status === 'done') {
    current = await update(current, { status: 'waiting', feedback: null, cefr_level: null, area_levels: null, band: null });
    await markStudent(set, current, pages, onChange);
  }
}

/** Saves changes to a page and tells the screen. */
function pageUpdater(onChange: (page: ClassSetPage) => void) {
  return async (page: ClassSetPage, changes: Partial<ClassSetPage>): Promise<ClassSetPage> => {
    const updated = { ...page, ...changes };
    onChange(updated);
    await savePage(page.id, changes);
    return updated;
  };
}

/** Step 1: reads one page (the writing, and the name, task and grammar on the sheet). */
async function readPage(
  page: ClassSetPage,
  onChange: (page: ClassSetPage) => void,
  students: ClassStudent[],
): Promise<ClassSetPage> {
  const update = pageUpdater(onChange);
  let current = await update(page, { status: 'reading', error: null });
  try {
    const sheet = await readSheet(await pageImage(current));
    const { transcript, contains_writing: hasWriting, ...details } = sheet;
    // The student: matched to the class list (allowing for misread letters),
    // unless the teacher has already chosen one.
    const match = current.student_id || !details.student_name ? null : matchStudent(details.student_name, students);
    current = await update(current, {
      status: 'waiting',
      transcript: hasWriting ? transcript : '',
      sheet: details,
      ...(current.student_id
        ? {}
        : match
          ? { student_id: match.id, student_name: match.name, student_key: match.student_key }
          : { student_name: details.student_name, student_key: studentKey(details.student_name) }),
    });
  } catch (e) {
    current = await update(current, { status: 'error', error: e instanceof Error ? e.message : 'Something went wrong.' });
  }
  return current;
}

/**
 * Which student each page belongs to: for each page, the page number of the
 * student's first page, or null for a first page. A page without the printed
 * sheet continues the student before it. Null when pages are still unread.
 */
function plannedGroups(pages: ClassSetPage[], readSoFar = false): Map<string, number | null> | null {
  let sorted = [...pages].sort((a, b) => a.page_number - b.page_number);
  if (readSoFar) {
    // Only the pages read so far, in order (one student at a time).
    const unread = sorted.findIndex((p) => p.transcript === null);
    if (unread !== -1) sorted = sorted.slice(0, unread);
  } else if (pages.some((p) => p.transcript === null)) return null;
  const plan = new Map<string, number | null>();
  let first: number | null = null;
  for (const page of sorted) {
    if (first !== null && !isFirstPage(page.sheet)) {
      plan.set(page.id, first);
    } else {
      plan.set(page.id, null);
      first = page.page_number;
    }
  }
  return plan;
}

/** Whether the pages are not yet put with their students as they should be. */
export function needsGrouping(pages: ClassSetPage[]): boolean {
  const plan = plannedGroups(pages);
  return !!plan && pages.some((p) => (p.continues_page ?? null) !== plan.get(p.id));
}

/**
 * Step 2: puts each page with its student. A later page is "done" with no
 * feedback of its own; a student whose pages changed is marked again.
 */
async function groupPages(
  pages: ClassSetPage[],
  onChange: (page: ClassSetPage) => void,
  readSoFar = false,
): Promise<ClassSetPage[]> {
  const plan = plannedGroups(pages, readSoFar);
  if (!plan) return pages;
  const update = pageUpdater(onChange);
  const changedFirsts = new Set<number>();
  for (const p of pages) {
    if (!plan.has(p.id)) continue;
    const wanted = plan.get(p.id) ?? null;
    if ((p.continues_page ?? null) === wanted) continue;
    if (wanted !== null) changedFirsts.add(wanted);
    if (p.continues_page != null) changedFirsts.add(p.continues_page);
  }
  const result: ClassSetPage[] = [];
  for (const page of pages) {
    if (!plan.has(page.id)) {
      result.push(page);
      continue;
    }
    const wanted = plan.get(page.id) ?? null;
    let current = page;
    if (wanted !== null) {
      if ((page.continues_page ?? null) !== wanted || page.status !== 'done') {
        current = await update(page, { continues_page: wanted, status: 'done', error: null, feedback: null, cefr_level: null, area_levels: null, band: null });
      }
    } else if ((page.continues_page ?? null) !== null || (changedFirsts.has(page.page_number) && page.status !== 'waiting')) {
      current = await update(page, { continues_page: null, status: 'waiting', feedback: null, cefr_level: null, area_levels: null, band: null, edited_text: null, reading_checked: false });
    }
    result.push(current);
  }
  return result;
}

/** Step 3: marks one student's writing (all their pages together). */
export async function markStudent(
  set: ClassSet,
  first: ClassSetPage,
  pages: ClassSetPage[],
  onChange: (page: ClassSetPage) => void,
): Promise<void> {
  const update = pageUpdater(onChange);
  let current = first;
  try {
    const text = fullTranscript(first, pages);
    if (!text) {
      await update(current, { status: 'error', error: 'No writing found on this page.' });
      return;
    }
    const words = countWords(text);
    if (words < MIN_WORDS) {
      await update(current, { status: 'error', error: `Too short for feedback (${words} words; at least ${MIN_WORDS}).` });
      return;
    }
    current = await update(current, { status: 'marking', error: null });
    const lineByLine = isLineByLine(first, pages);
    if (set.course === 'ielts') {
      // IELTS: band scores against the Task 2 question (from the sheet, or typed in).
      const response = await requestTeacherIeltsFeedback(
        current.sheet?.task || set.task,
        lineByLine ? joinLines(text) : text,
        guessedWords(first, pages),
      );
      // The class's target band is added when the feedback is shown (it may change).
      const f = response.feedback;
      await update(current, { status: 'done', feedback: f, band: f.overall_band, cefr_level: null, area_levels: null });
      return;
    }
    const response = await requestFeedback({
      // Read line by line: sent as running text, so lines don't look like paragraphs.
      text: lineByLine ? joinLines(text) : text,
      level: set.level,
      task: current.sheet?.task || set.task,
      focusGrammar: current.sheet?.grammar_focus || set.grammar_focus,
      guessedWords: guessedWords(first, pages),
      // The teacher copies the corrections onto the paper: every mistake.
      everyMistake: true,
    });
    const f = response.feedback;
    const area_levels: Partial<Record<Area, AreaLevel>> = {};
    for (const c of f.criteria) if ((AREAS as readonly string[]).includes(c.criterion)) area_levels[c.criterion as Area] = c.level;
    await update(current, { status: 'done', feedback: f, cefr_level: f.cefr_level, area_levels });
  } catch (e) {
    await update(current, { status: 'error', error: e instanceof Error ? e.message : 'Something went wrong.' });
  }
}

/** Runs the jobs a few at a time. */
async function fewAtATime<T>(items: T[], job: (item: T) => Promise<unknown>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(PAGES_AT_ONCE, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await job(item);
  });
  await Promise.all(workers);
}

/**
 * Reads every page, puts each page with its student (a student's writing may
 * run over several pages), then (with `mark`) marks each student's writing. Pages left
 * half-done by an earlier visit are picked up again.
 */
export async function processClassSet(
  set: ClassSet,
  pages: ClassSetPage[],
  onChange: (page: ClassSetPage) => void,
  options: { retryErrors?: boolean; students?: ClassStudent[]; mark?: boolean } = {},
): Promise<void> {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const track = (page: ClassSetPage) => {
    byId.set(page.id, page);
    onChange(page);
  };

  if (ONE_STUDENT_AT_A_TIME) {
    await processNextStudent(set, byId, track, options);
    return;
  }

  // 1. Read the pages not read yet.
  const unread = pages.filter((p) => p.transcript === null && (options.retryErrors || p.status !== 'error'));
  await fewAtATime(unread, (p) => readPage(p, track, options.students ?? []));

  // 2. Put each page with its student (only once every page has been read).
  const grouped = await groupPages([...byId.values()], track);
  if (grouped.some((p) => p.transcript === null)) return;

  // 3. Mark each student's writing that is not marked yet: only when the
  // teacher asks ("Mark all"), after checking the readings.
  if (!options.mark) return;
  await fewAtATime(waitingToMark(grouped, options.retryErrors), (p) => markStudent(set, p, grouped, track));
}

/**
 * TEMPORARY (ONE_STUDENT_AT_A_TIME): reads the pages in order until the next
 * student not yet marked is complete (their pages, up to the next student's
 * first page), then marks that one student.
 */
async function processNextStudent(
  set: ClassSet,
  byId: Map<string, ClassSetPage>,
  track: (page: ClassSetPage) => void,
  options: { retryErrors?: boolean; students?: ClassStudent[] },
): Promise<void> {
  const sorted = () => [...byId.values()].sort((a, b) => a.page_number - b.page_number);
  let target: ClassSetPage | null = null;
  for (const [index, listed] of sorted().entries()) {
    let page = byId.get(listed.id) ?? listed;
    if (page.transcript === null && (options.retryErrors || page.status !== 'error')) {
      page = await readPage(page, track, options.students ?? []);
    }
    if (page.transcript === null) break; // could not be read: stop here
    const startsStudent = index === 0 || isFirstPage(page.sheet);
    if (!startsStudent) continue;
    if (target) break; // the next student starts: the one before is complete
    const unmarked = page.status !== 'done' && (options.retryErrors || page.status !== 'error');
    if (unmarked) target = page;
  }

  const grouped = await groupPages(sorted(), track, true);
  if (!target) return;
  const first = grouped.find((p) => p.id === target!.id);
  if (first && first.continues_page == null && first.transcript !== null && first.status !== 'done') {
    await markStudent(set, first, grouped, track);
  }
}

/** TEMPORARY (ONE_STUDENT_AT_A_TIME): whether there is another student to read or mark. */
export function hasNextStudent(pages: ClassSetPage[]): boolean {
  return (
    pages.some((p) => p.transcript === null && p.status !== 'error') ||
    studentPages(pages).some((p) => p.transcript !== null && p.status === 'waiting')
  );
}
