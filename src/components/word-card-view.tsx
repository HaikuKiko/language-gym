import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { WordCard } from '@/data/word-cards';
import { formatClock } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { remainingMs, type LiveSession } from '@/lib/live-session';

/** A word card: the word, and the words you can't say. */
export function WordCardView({ card, compact = false }: { card: WordCard; compact?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.card}>
      <View style={[styles.word, { backgroundColor: theme.accentSoft }, compact && styles.wordCompact]}>
        <Text style={[styles.wordText, { color: theme.grammarText }, compact && styles.wordTextCompact]}>
          {card.word}
        </Text>
      </View>
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
