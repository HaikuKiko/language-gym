import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Week } from '@/data/weeks';
import { useTheme } from '@/hooks/use-theme';

type Segment = { text: string; mark: 'a' | 'b' | null };

/**
 * Splits "[If I won] money, I {would buy} a house" into plain and highlighted
 * parts: [square brackets] are mark "a", {curly brackets} are mark "b".
 * Unmatched brackets are shown as typed.
 */
export function parseMarks(source: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\[([^\[\]{}]*)\]|\{([^\[\]{}]*)\}/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: source.slice(last, index), mark: null });
    segments.push(
      match[1] !== undefined ? { text: match[1], mark: 'a' } : { text: match[2], mark: 'b' },
    );
    last = index + match[0].length;
  }
  if (last < source.length) segments.push({ text: source.slice(last), mark: null });
  return segments;
}

/** A line of text with its [..] and {..} parts in bold, in two colours. */
export function MarkedText({ source, style }: { source: string; style: TextStyle | TextStyle[] }) {
  const theme = useTheme();
  return (
    <Text style={style}>
      {parseMarks(source).map((part, i) => (
        <Fragment key={i}>
          {part.mark === null ? (
            part.text
          ) : (
            <Text
              style={[
                styles.mark,
                { color: part.mark === 'a' ? theme.markA : theme.markB },
              ]}>
              {part.text}
            </Text>
          )}
        </Fragment>
      ))}
    </Text>
  );
}

/** The pattern as coloured blocks, e.g. [If + past simple] , [would + verb]. */
export function Pattern({ source }: { source: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pattern, { backgroundColor: theme.background }]}>
      {parseMarks(source).map((part, i) =>
        part.mark === null ? (
          part.text.trim() ? (
            <Text key={i} style={[styles.patternText, { color: theme.grammarText }]}>
              {part.text.trim()}
            </Text>
          ) : null
        ) : (
          <Text
            key={i}
            style={[
              styles.patternText,
              styles.patternChip,
              part.mark === 'a'
                ? { color: theme.markA, backgroundColor: theme.markABg }
                : { color: theme.markB, backgroundColor: theme.markBBg },
            ]}>
            {part.text}
          </Text>
        ),
      )}
    </View>
  );
}

/** This week's grammar point with its pattern, examples and a sentence starter. */
export function GrammarCard({ week }: { week: Week }) {
  const theme = useTheme();
  const help = week.help;
  if (!week.grammar && !help) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
      <View style={styles.heading}>
        <Text style={[styles.label, { color: theme.grammarLabel }]}>THIS WEEK&apos;S GRAMMAR</Text>
        {week.grammar ? (
          <Text style={[styles.title, { color: theme.grammarText }]}>{week.grammar}</Text>
        ) : null}
        {help?.use ? (
          <Text style={[styles.use, { color: theme.grammarMuted }]}>{help.use}</Text>
        ) : null}
      </View>

      {help?.pattern ? <Pattern source={help.pattern} /> : null}

      {help && help.examples.length > 0 ? (
        <View style={styles.examples}>
          {help.examples.map((example, i) => (
            <View key={i} style={styles.example}>
              <Text style={[styles.exampleText, { color: theme.grammarMuted }]}>•</Text>
              <MarkedText
                source={example}
                style={[styles.exampleText, styles.exampleBody, { color: theme.grammarText }]}
              />
            </View>
          ))}
        </View>
      ) : null}

      {help?.starter ? (
        <View style={[styles.starter, { borderTopColor: theme.grammarLine }]}>
          <Text style={[styles.label, { color: theme.grammarLabel }]}>TRY STARTING WITH</Text>
          <MarkedText
            source={`“${help.starter}”`}
            style={[styles.starterText, { color: theme.grammarText }]}
          />
        </View>
      ) : null}

      {week.also ? (
        <Text style={[styles.also, { color: theme.grammarMuted }]}>
          <Text style={styles.alsoLabel}>Also this week: </Text>
          {week.also}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  hintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  hintTitle: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  hintGrammar: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 600,
  },
  hintToggle: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: 700,
  },
  hintBody: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.four - 4,
    borderRadius: Spacing.four - 4,
    gap: 14,
  },
  heading: {
    gap: Spacing.half,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  use: {
    fontSize: 16,
    lineHeight: 22,
  },
  pattern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  patternText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: 600,
  },
  patternChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
    overflow: 'hidden',
  },
  examples: {
    gap: 10,
  },
  example: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  exampleText: {
    fontSize: 18,
    lineHeight: 26,
  },
  exampleBody: {
    flexShrink: 1,
  },
  mark: {
    fontWeight: 700,
  },
  starter: {
    gap: Spacing.one,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  also: {
    fontSize: 14,
    lineHeight: 20,
  },
  alsoLabel: {
    fontWeight: 700,
  },
  starterText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
  },
});

/**
 * The short version for students' phones: the grammar point in one line, and
 * a tap to see the pattern and a sentence starter. The full card (use,
 * examples, "also this week") is for the teacher's screen.
 */
export function GrammarHint({ week }: { week: Week }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const help = week.help;
  if (!week.grammar && !help) return null;
  const hasMore = !!(help?.pattern || help?.starter || help?.examples.length);

  return (
    <View style={[styles.hint, { backgroundColor: theme.accentSoft }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        disabled={!hasMore}
        onPress={() => setOpen(!open)}
        style={styles.hintHeader}>
        <View style={styles.hintTitle}>
          <Text style={[styles.label, { color: theme.grammarLabel }]}>TRY TO USE</Text>
          <Text style={[styles.hintGrammar, { color: theme.grammarText }]}>{week.grammar}</Text>
        </View>
        {hasMore ? (
          <Text style={[styles.hintToggle, { color: theme.grammarLabel }]}>{open ? 'Hide ▴' : 'Help ▾'}</Text>
        ) : null}
      </Pressable>
      {open && help ? (
        <View style={styles.hintBody}>
          {help.pattern ? <Pattern source={help.pattern} /> : null}
          {help.starter ? (
            <MarkedText source={`“${help.starter}”`} style={[styles.starterText, { color: theme.grammarText }]} />
          ) : help.examples[0] ? (
            <MarkedText source={help.examples[0]} style={[styles.exampleText, { color: theme.grammarText }]} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
