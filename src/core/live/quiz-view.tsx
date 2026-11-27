/**
 * What a live quiz looks like (Live classroom kit): the question, the coloured
 * answer buttons (A–D, the same colours on the board and on phones), and the
 * bars showing how many chose each answer.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/core/ui/pill';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { QUESTION_KIND_LABELS, type QuizQuestion } from '@/core/live/quiz';

/** One colour and letter per answer; mid-tones that carry white text in light and dark mode. */
export const ANSWER_COLORS = ['#C92A2A', '#1864AB', '#9C6500', '#2B8A3E'] as const;
export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** The question: its number, level, kind and text. */
export function QuestionCard({
  question,
  index,
  total,
  large = false,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  large?: boolean;
}) {
  return (
    <View style={styles.question}>
      <View style={styles.row}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Question {index + 1} of {total} · {QUESTION_KIND_LABELS[question.kind]}
        </ThemedText>
        <Pill label={question.level} tone="accent" />
      </View>
      <ThemedText style={[styles.prompt, large && styles.promptLarge]}>{question.prompt}</ThemedText>
    </View>
  );
}

/**
 * The answers as big coloured buttons. While the answer is showing (`right`),
 * the right one gets a ✓ and the others fade; `picked` is the student's own choice.
 */
export function AnswerButtons({
  options,
  onPick,
  picked = null,
  right = null,
  disabled = false,
  columns = 2,
}: {
  options: readonly string[];
  onPick?: (choice: number) => void;
  picked?: number | null;
  right?: number | null;
  disabled?: boolean;
  columns?: 1 | 2;
}) {
  return (
    <View style={[styles.answers, columns === 1 && styles.answersColumn]}>
      {options.map((option, i) => {
        const faded = (right !== null && i !== right) || (picked !== null && right === null && i !== picked);
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${ANSWER_LETTERS[i]}: ${option}`}
            accessibilityState={{ disabled: disabled || !onPick, selected: picked === i }}
            disabled={disabled || !onPick}
            onPress={() => onPick?.(i)}
            style={({ pressed }) => [
              styles.answer,
              columns === 2 && styles.answerHalf,
              { backgroundColor: ANSWER_COLORS[i] },
              faded && styles.faded,
              picked === i && styles.picked,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.letter}>{ANSWER_LETTERS[i]}</Text>
            <Text style={styles.answerText}>{option}</Text>
            {right === i && <Text style={styles.answerText}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** How many chose each answer, as bars; the right one is marked. */
export function AnswerBars({
  options,
  counts,
  right,
}: {
  options: readonly string[];
  counts: readonly number[];
  right: number;
}) {
  const theme = useTheme();
  const most = Math.max(1, ...counts);
  return (
    <View style={styles.bars}>
      {options.map((option, i) => (
        <View key={i} style={styles.barRow}>
          <Text style={[styles.barLetter, { backgroundColor: ANSWER_COLORS[i] }]}>{ANSWER_LETTERS[i]}</Text>
          <View style={styles.barText}>
            <ThemedText type={i === right ? 'smallBold' : 'small'}>
              {option} {i === right ? '✓' : ''}
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: ANSWER_COLORS[i], width: `${(counts[i] / most) * 100}%` },
                  i !== right && styles.faded,
                ]}
              />
            </View>
          </View>
          <ThemedText type="smallBold" style={styles.count}>
            {counts[i]}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** The short "Why" after a question. */
export function WhyNote({ why }: { why: string }) {
  if (!why) return null;
  return (
    <ThemedView type="backgroundElement" style={styles.why}>
      <ThemedText>
        <ThemedText type="smallBold">Why: </ThemedText>
        {why}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  question: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  prompt: { fontSize: 22, lineHeight: 30, fontWeight: 700 },
  promptLarge: { fontSize: 30, lineHeight: 40 },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  answersColumn: { flexDirection: 'column', flexWrap: 'nowrap' },
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  answerHalf: { flexGrow: 1, flexBasis: '45%' },
  letter: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    width: 28,
    height: 28,
    lineHeight: 28,
    textAlign: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  answerText: { color: '#fff', fontSize: 19, fontWeight: 700, flexShrink: 1 },
  faded: { opacity: 0.35 },
  picked: { borderWidth: 4, borderColor: '#fff' },
  pressed: { opacity: 0.8 },
  bars: { gap: Spacing.two },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLetter: {
    color: '#fff',
    fontWeight: 800,
    width: 26,
    height: 26,
    lineHeight: 26,
    textAlign: 'center',
    borderRadius: 13,
    overflow: 'hidden',
  },
  barText: { flex: 1, gap: Spacing.one },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  count: { minWidth: 24, textAlign: 'right' },
  why: { padding: Spacing.three, borderRadius: Spacing.three },
});
