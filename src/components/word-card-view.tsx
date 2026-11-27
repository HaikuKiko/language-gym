import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { WordCard } from '@/data/word-cards';
import { formatClock } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { remainingMs, type LiveSession } from '@/lib/live-session';

/** Hint colours (a soft yellow, the same in light and dark mode). */
const HINT_BG = '#FFF6D6';
const HINT_BORDER = '#E9B200';
const HINT_TEXT = '#5C4300';

/**
 * A word card: the word, and the words you can't say. With `onHint`, a
 * "Don't know this word?" button opens its meaning (`showHint`).
 */
export function WordCardView({
  card,
  compact = false,
  showHint = false,
  onHint,
}: {
  card: WordCard;
  compact?: boolean;
  showHint?: boolean;
  onHint?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.card}>
      <View style={[styles.word, { backgroundColor: theme.accentSoft }, compact && styles.wordCompact]}>
        <Text style={[styles.wordText, { color: theme.grammarText }, compact && styles.wordTextCompact]}>
          {card.word}
        </Text>
      </View>
      {card.hint && showHint ? (
        <View style={[styles.hint, { backgroundColor: HINT_BG, borderColor: HINT_BORDER }]}>
          <Text style={[styles.hintLabel, { color: HINT_TEXT }]}>WHAT IT MEANS</Text>
          <Text style={[styles.hintText, { color: HINT_TEXT }]}>{card.hint}</Text>
        </View>
      ) : card.hint && onHint ? (
        <Pressable
          accessibilityRole="button"
          onPress={onHint}
          style={({ pressed }) => [styles.hint, styles.hintButton, { borderColor: HINT_BORDER }, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.hintLabel, { color: theme.text }]}>💡 Don&apos;t know this word?</Text>
        </Pressable>
      ) : null}
      <View style={[styles.banned, { borderColor: theme.warning }]}>
        <ThemedText type="smallBold" style={{ color: theme.warning, letterSpacing: 1 }}>
          DON&apos;T SAY
        </ThemedText>
        <View style={styles.chips}>
          {card.banned.map((w) => (
            <View key={w} style={[styles.chip, { backgroundColor: theme.markABg }]}>
              <Text style={[styles.chipText, { color: theme.markA }]}>{w}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** The game clock: time left, or "Paused" / "Time's up". */
export function GameClock({ session, now, large = false }: { session: LiveSession; now: number; large?: boolean }) {
  const theme = useTheme();
  const left = remainingMs(session, now);
  const paused = session.ends_at === null && left > 0;
  return (
    <View style={styles.clock}>
      <Text style={[large ? styles.clockLarge : styles.clockSmall, { color: theme.text }]}>
        ⏱ {formatClock(Math.ceil(left / 1000))}
      </Text>
      {paused && (
        <ThemedText type="smallBold" themeColor="warning">
          Paused
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  word: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  wordCompact: {
    paddingVertical: Spacing.two,
  },
  wordText: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 800,
    textAlign: 'center',
  },
  wordTextCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  hint: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: 2,
  },
  hintButton: {
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  hintLabel: {
    fontSize: 13,
    fontWeight: 800,
  },
  hintText: {
    fontSize: 16,
    lineHeight: 22,
  },
  banned: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.two,
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
  },
  chipText: {
    fontSize: 16,
    fontWeight: 600,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  clockLarge: {
    fontSize: 44,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  clockSmall: {
    fontSize: 18,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
});
