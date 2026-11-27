import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { Guessed, GuessedText } from '@/core/marking/guessed';
import { guessAnchorsFrom, type MarkedText } from '@/core/marking/marks';

/** Pieces shared by the General English and IELTS feedback screens. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

export function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <ThemedText themeColor="textSecondary">•</ThemedText>
      <ThemedText style={styles.bulletText}>{text}</ThemedText>
    </View>
  );
}

/**
 * The student's own words, with numbered wavy underlines and ¶ marks, and
 * any words guessed from a photo in pink.
 */
export function MarkedWriting({
  marked,
  title = 'Your writing',
  guessed = [],
}: {
  marked: MarkedText;
  title?: string;
  /** Words guessed when reading a photo of the writing, highlighted in pink. */
  guessed?: string[];
}) {
  const theme = useTheme();
  const withGuesses = (text: string, key: number | string) => (
    <GuessedText text={text} guessed={guessed} keyPrefix={`${key}-`} />
  );
  return (
    <Section title={title}>
      <ThemedView type="backgroundElement" style={styles.studentText}>
        <ThemedText style={styles.studentTextBody}>
          {marked.segments.map((segment, i) =>
            segment.paragraphMark ? (
              <ThemedText
                key={i}
                accessibilityLabel="New paragraph here"
                style={[styles.paragraphMark, { color: theme.markA }]}>
                {'\n¶ '}
              </ThemedText>
            ) : segment.number === null ? (
              <ThemedText key={i}>{withGuesses(segment.text, i)}</ThemedText>
            ) : (
              <ThemedText key={i}>
                <ThemedText style={[styles.markedWords, { textDecorationColor: theme.markA }]}>
                  {withGuesses(segment.text, i)}
                </ThemedText>
                <ThemedText style={[styles.markNumber, { color: theme.markA }]}>
                  {` ${segment.number}`}
                </ThemedText>
              </ThemedText>
            ),
          )}
        </ThemedText>
      </ThemedView>
      {(marked.notes.length > 0 || marked.paragraphMarks > 0) && (
        <ThemedText type="small" themeColor="textSecondary">
          Your words stay as you wrote them.
          {marked.notes.length > 0 ? ' The numbers show what to look at.' : ''}
          {marked.paragraphMarks > 0 ? ' ¶ shows where a new paragraph can start.' : ''}
        </ThemedText>
      )}
      {guessed.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Pink: words that were hard to read on the paper and were guessed.
        </ThemedText>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Line by line: the writing as it is laid out on the paper (class sets)
// ---------------------------------------------------------------------------

type Range = { start: number; end: number };
type Fix = Range & { number: number; corrected: string };

/** Where the numbered corrections and the ¶ marks are in the text. */
function markPositions(marked: MarkedText): { fixes: Fix[]; paragraphs: number[] } {
  const fixes: Fix[] = [];
  const paragraphs: number[] = [];
  let at = 0;
  for (const segment of marked.segments) {
    if (segment.paragraphMark) paragraphs.push(at);
    else if (segment.number !== null) {
      const note = marked.notes.find((n) => n.number === segment.number);
      fixes.push({ start: at, end: at + segment.text.length, number: segment.number, corrected: note?.correction.corrected ?? '' });
    }
    at += segment.text.length;
  }
  return { fixes, paragraphs };
}

type Line = { start: number; end: number; text: string; label: string | null; page: number; number: number };

/**
 * The text's lines, numbered as on the paper: empty lines (between
 * paragraphs) have no number, and numbers start again on each page.
 */
function paperLines(text: string, pageLines: number[]): Line[] {
  const lines: Line[] = [];
  const severalPages = pageLines.length > 1;
  let offset = 0;
  let written = 0;
  for (const lineText of text.split('\n')) {
    const line: Line = { start: offset, end: offset + lineText.length, text: lineText, label: null, page: 1, number: 0 };
    if (lineText.trim()) {
      let page = 0;
      let before = 0;
      while (page < pageLines.length - 1 && written >= before + pageLines[page]) before += pageLines[page++];
      line.page = page + 1;
      line.number = written - before + 1;
      line.label = severalPages ? `Page ${line.page}, line ${line.number}` : `Line ${line.number}`;
      written += 1;
    }
    lines.push(line);
    offset += lineText.length + 1;
  }
  return lines;
}

/** "Line 5" (or "Page 2, line 3") for each numbered correction. */
export function correctionLines(text: string, marked: MarkedText, pageLines: number[]): Map<number, string> {
  const lines = paperLines(text, pageLines);
  const labels = new Map<number, string>();
  for (const fix of markPositions(marked).fixes) {
    const line = lines.find((l) => l.label && fix.start >= l.start && fix.start <= l.end);
    if (line?.label) labels.set(fix.number, line.label);
  }
  return labels;
}

/**
 * The student's writing line by line, as on the paper, with line numbers:
 * guessed words in pink, and each correction written in after the student's
 * words (crossed out) in green, with its number.
 */
export function LineMarkedWriting({
  text,
  marked,
  guessed = [],
  pageLines,
  title = 'Their writing, line by line (as on the paper)',
}: {
  title?: string;
  text: string;
  marked: MarkedText;
  guessed?: string[];
  /** How many lines of writing each page has. */
  pageLines: number[];
}) {
  const theme = useTheme();
  const { fixes, paragraphs } = markPositions(marked);
  const guesses: Range[] = guessAnchorsFrom(text, guessed).map((a) => ({ start: a.start, end: a.start + a.original.length }));
  const lines = paperLines(text, pageLines);

  function renderLine(line: Line) {
    const cuts = new Set([line.start, line.end]);
    for (const r of [...fixes, ...guesses]) {
      if (r.start > line.start && r.start < line.end) cuts.add(r.start);
      if (r.end > line.start && r.end < line.end) cuts.add(r.end);
    }
    for (const p of paragraphs) if (p > line.start && p < line.end) cuts.add(p);
    const points = [...cuts].sort((a, b) => a - b);
    const pieces: ReactNode[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [from, to] = [points[i], points[i + 1]];
      if (paragraphs.includes(from) && (from > line.start || line.text.trim())) {
        pieces.push(
          <ThemedText key={`p${from}`} accessibilityLabel="New paragraph here" style={[styles.paragraphMark, { color: theme.markA }]}>
            {'¶ '}
          </ThemedText>,
        );
      }
      const fix = fixes.find((f) => from >= f.start && to <= f.end);
      const guess = guesses.some((g) => from >= g.start && to <= g.end);
      const words = text.slice(from, to);
      pieces.push(
        <ThemedText
          key={`t${from}`}
          style={[
            guess && [styles.guess, { backgroundColor: theme.guessBg }],
            fix && [styles.crossedOut, { color: theme.markA, textDecorationColor: theme.markA }],
          ]}>
          {words}
        </ThemedText>,
      );
      const ending = fixes.find((f) => f.end === to && f.end > line.start);
      if (ending) {
        pieces.push(
          <ThemedText key={`f${to}`}>
            {' '}
            <ThemedText style={[styles.fixWords, { color: theme.fixText }]}>{ending.corrected}</ThemedText>
            <ThemedText style={[styles.markNumber, { color: theme.markA }]}>{` ${ending.number}`}</ThemedText>
          </ThemedText>,
        );
      }
    }
    return pieces;
  }

  return (
    <Section title={title}>
      <ThemedView type="backgroundElement" style={styles.studentText}>
        {lines.map((line, i) => {
          const pageStart = pageLines.length > 1 && line.label && line.number === 1;
          if (!line.text.trim()) return <View key={i} style={styles.gap} />;
          return (
            <View key={i}>
              {pageStart && (
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.pageHeading}>
                  Page {line.page}
                </ThemedText>
              )}
              <View style={styles.line}>
                <ThemedText themeColor="textSecondary" style={styles.lineNumber}>
                  {line.number}
                </ThemedText>
                <ThemedText selectable style={styles.lineText}>
                  {renderLine(line)}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </ThemedView>
      <View style={styles.key}>
        {guessed.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            <Guessed small text=" pink " />
            {' hard to read, so guessed: check it on the paper (not marked as a mistake)'}
          </ThemedText>
        )}
        {marked.notes.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="small" style={[styles.crossedOut, { color: theme.markA, textDecorationColor: theme.markA }]}>
              crossed out
            </ThemedText>{' '}
            <ThemedText type="small" style={[styles.fixWords, { color: theme.fixText }]}>
              green
            </ThemedText>
            {' a suggested correction'}
          </ThemedText>
        )}
        {marked.paragraphMarks > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="small" style={[styles.paragraphMark, { color: theme.markA }]}>
              ¶
            </ThemedText>
            {' start a new paragraph'}
          </ThemedText>
        )}
      </View>
    </Section>
  );
}

/** One numbered note per mistake: what they wrote, what to try, and why. */
export function CorrectionNotes({
  marked,
  title = 'What to look at',
  lineLabels,
}: {
  marked: MarkedText;
  title?: string;
  /** Where each note is on the paper ("Line 5"), by note number. */
  lineLabels?: Map<number, string>;
}) {
  const theme = useTheme();
  if (marked.notes.length === 0) return null;
  return (
    <Section title={title}>
      {marked.notes.map(({ number, correction }) => (
        <ThemedView key={number} type="backgroundElement" style={styles.note}>
          <NumberBadge label={String(number)} color={theme.markA} />
          <View style={styles.noteBody}>
            {lineLabels && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {lineLabels.get(number) ?? 'Not found in the text'}
              </ThemedText>
            )}
            <ThemedText>
              <ThemedText themeColor="textSecondary">You wrote </ThemedText>
              <ThemedText style={[styles.noteWords, { color: theme.markA }]}>
                {correction.original}
              </ThemedText>
              <ThemedText themeColor="textSecondary"> → try </ThemedText>
              <ThemedText style={[styles.noteWords, { color: lineLabels ? theme.fixText : theme.markB }]}>
                {correction.corrected}
              </ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {correction.explanation}
            </ThemedText>
          </View>
        </ThemedView>
      ))}
    </Section>
  );
}

export function ParagraphNote({ comment }: { comment: string }) {
  const theme = useTheme();
  return (
    <Section title="Paragraphs">
      <ThemedView type="backgroundElement" style={styles.note}>
        <NumberBadge label="¶" color={theme.markA} />
        <ThemedText style={styles.noteBody}>{comment}</ThemedText>
      </ThemedView>
    </Section>
  );
}

/** A numbered card, for steps and priorities. */
export function NumberedCard({ number, color, children }: { number: number; color: string; children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.note}>
      <NumberBadge label={String(number)} color={color} />
      <View style={styles.noteBody}>{children}</View>
    </ThemedView>
  );
}

function NumberBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.noteNumber, { backgroundColor: color }]}>
      <ThemedText type="smallBold" style={styles.noteNumberText}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  guess: { borderRadius: 3 },
  section: {
    gap: Spacing.two,
  },
  bullet: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletText: {
    flexShrink: 1,
  },
  studentText: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  studentTextBody: {
    fontSize: 17,
    lineHeight: 30,
  },
  markedWords: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
  },
  paragraphMark: {
    fontSize: 17,
    fontWeight: 800,
  },
  line: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  lineNumber: {
    width: 22,
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  lineText: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 30,
  },
  gap: {
    height: Spacing.two,
  },
  pageHeading: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  crossedOut: {
    textDecorationLine: 'line-through',
  },
  fixWords: {
    fontWeight: 700,
  },
  key: {
    gap: Spacing.half,
  },
  markNumber: {
    fontSize: 12,
    fontWeight: 700,
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  noteNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteNumberText: {
    color: '#ffffff',
    lineHeight: 18,
  },
  noteBody: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  noteWords: {
    fontWeight: 700,
  },
});

/**
 * The student's writing with its marks, then the corrections. With
 * `pageLines` (copied line by line from paper) it shows numbered lines and
 * "Corrections to copy onto the paper" with line numbers.
 */
export function WritingWithCorrections({
  text,
  marked,
  guessed,
  pageLines,
  title,
}: {
  text: string;
  marked: MarkedText;
  guessed: string[];
  pageLines?: number[] | null;
  /** The heading over the writing, e.g. "Your essay". */
  title?: string;
}) {
  if (pageLines) {
    return (
      <>
        <LineMarkedWriting
          title={title ? `${title}, line by line (as on the paper)` : undefined}
          text={text}
          marked={marked}
          guessed={guessed}
          pageLines={pageLines}
        />
        <CorrectionNotes
          marked={marked}
          title="Corrections to copy onto the paper"
          lineLabels={correctionLines(text, marked, pageLines)}
        />
      </>
    );
  }
  return (
    <>
      <MarkedWriting marked={marked} title={title} guessed={guessed} />
      <CorrectionNotes marked={marked} />
    </>
  );
}

/** A heading and a bulleted list; nothing when the list is empty. */
export function BulletSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Section title={title}>
      {items.map((s, i) => (
        <Bullet key={i} text={s} />
      ))}
    </Section>
  );
}

/** "You sent this before …" and how many checks are left today. */
export function usageText(cached: boolean | undefined, remainingToday: number): string {
  return `${cached ? 'You sent this before, so this is the same feedback. It did not use a check. ' : ''}${
    remainingToday === 1 ? '1 feedback check left today.' : `${remainingToday} feedback checks left today.`
  }`;
}
