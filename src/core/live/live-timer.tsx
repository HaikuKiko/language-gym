import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/core/ui/progress-bar';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { formatClock } from '@/core/app/use-countdown';
import { remainingMs, stageDurationMs, type LiveSession } from '@/core/live/session';

/** The shared countdown for a phone session, as seen by host and students. */
export function LiveTimer({
  session,
  now,
  compact = false,
}: {
  session: LiveSession;
  now: number;
  /** A smaller clock, for screens with more to show. */
  compact?: boolean;
}) {
  const remaining = remainingMs(session, now);
  const finished = remaining <= 0;
  const running = session.ends_at !== null && !finished;

  const label = finished
    ? null
    : !running
      ? session.auto_advance || session.remaining_ms !== session.round_minutes * 60 * 1000
        ? 'Paused'
        : 'Waiting for the timer to start'
      : session.stage === 'changeover'
        ? 'Find your partner'
        : 'Talk';

  return (
    <View style={styles.timer}>
      {label && (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      )}
      <ThemedText
        accessibilityRole="timer"
        themeColor={finished ? 'warning' : 'text'}
        style={[styles.clock, compact && styles.compactClock]}>
        {finished ? "Time's up" : formatClock(Math.ceil(remaining / 1000))}
      </ThemedText>
      <ProgressBar fraction={remaining / stageDurationMs(session)} />
    </View>
  );
}

const styles = StyleSheet.create({
  timer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  compactClock: {
    fontSize: 56,
    lineHeight: 64,
  },
  clock: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
});
