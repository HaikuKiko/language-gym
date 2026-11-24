import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MarkedText } from '@/lib/writing';

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

/** Splits text so that words guessed from a photo can be highlighted. */
function guessParts(text: string, guessed: string[]): { text: string; guess: boolean }[] {
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

/**
 * The student's own words, with numbered wavy underlines and ¶ marks, and
 * any words guessed from a photo in yellow.
 */
export function MarkedWriting({
  marked,
  title = 'Your writing',
  guessed = [],
}: {
  marked: MarkedText;
  title?: string;
  /** Words guessed when reading a photo of the writing, highlighted in yellow. */
  guessed?: string[];
}) {
  const theme = useTheme();
  const withGuesses = (text: string, key: number | string) =>
    guessParts(text, guessed).map((part, j) =>
      part.guess ? (
        <ThemedText key={`${key}-${j}`} style={{ backgroundColor: theme.guessBg }}>
          {part.text}
        </ThemedText>
      ) : (
        part.text
      ),
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
          Yellow: words that were hard to read on the paper and were guessed.
        </ThemedText>
      )}
    </Section>
  );
}

/** One numbered note per mistake: what they wrote, what to try, and why. */
export function CorrectionNotes({ marked }: { marked: MarkedText }) {
  const theme = useTheme();
  if (marked.notes.length === 0) return null;
  return (
    <Section title="What to look at">
      {marked.notes.map(({ number, correction }) => (
        <ThemedView key={number} type="backgroundElement" style={styles.note}>
          <NumberBadge label={String(number)} color={theme.markA} />
          <View style={styles.noteBody}>
            <ThemedText>
              <ThemedText themeColor="textSecondary">You wrote </ThemedText>
              <ThemedText style={[styles.noteWords, { color: theme.markA }]}>
                {correction.original}
              </ThemedText>
              <ThemedText themeColor="textSecondary"> → try </ThemedText>
              <ThemedText style={[styles.noteWords, { color: theme.markB }]}>
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
