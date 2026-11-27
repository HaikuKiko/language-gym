/**
 * Marks on a student's own text (Marking kit): where each correction sits,
 * paragraph marks, line-by-line text, and words guessed when reading
 * handwriting (never corrected). Used by every writing tool and its reports.
 */


/** One correction from a marking (any marking scheme): matches CorrectionSchema on the server. */
export type Correction = { original: string; corrected: string; explanation: string; type: string };

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

/**
 * Curly quotes and apostrophes count as straight ones when matching, and a
 * line break as a space (so a mistake can run on to the next line). The
 * length stays the same, so positions found apply to the text itself.
 */
function normalise(value: string): string {
  return value
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\n/g, ' ');
}

/**
 * Writing copied line by line from the paper, as running text: each line
 * break inside a paragraph becomes a space (an empty line between
 * paragraphs stays). Same length, so corrections found in one are in the
 * same place in the other.
 */
export function joinLines(text: string): string {
  return text.replace(/(?<!\n)\n(?!\n)/g, ' ');
}

/** How many lines of writing a text has (empty lines between paragraphs don't count). */
export function writtenLines(text: string): number {
  return text.split('\n').filter((line) => line.trim()).length;
}

/** The guessed words that are still in the text (the teacher may have corrected some). */
export function guessesStillIn(text: string, guessed: string[]): string[] {
  return guessAnchorsFrom(text, guessed).map((a) => a.original);
}

/** Whether a word is one of the guessed (hard-to-read) words. */
function isGuessed(words: string, guessed: string[]): boolean {
  const target = normalise(words.trim()).toLowerCase().replace(/[.,!?;:"]+$/g, '');
  return guessed.some((w) => normalise(w.trim()).toLowerCase() === target);
}

/**
 * Leaves out corrections of a guessed word on its own: it may be our
 * misreading of the handwriting, not the student's mistake.
 */
export function withoutGuessCorrections(corrections: Correction[], guessed: string[]): Correction[] {
  if (guessed.length === 0) return corrections;
  return corrections.filter((c) => !isGuessed(c.original, guessed));
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

/** Splits text so that words guessed from a photo can be highlighted. */
export function guessParts(text: string, guessed: string[]): { text: string; guess: boolean }[] {
  const words = guessed.map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return [{ text, guess: false }];
  const escaped = words.sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  const parts: { text: string; guess: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), guess: false });
    parts.push({ text: match[0], guess: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), guess: false });
  return parts;
}
