/**
 * A ranked list of names and points (Live classroom kit), for any game: after
 * a quiz question, at the end of a game, or across many games.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';

export type LeaderboardRow = {
  /** Highlights this row when it matches `highlight`. */
  key: string;
  name: string;
  points: number;
  /** A short note after the points, e.g. "4 quizzes" or "🔥 3". */
  note?: string;
};

const MEDALS = ['🥇', '🥈', '🥉'];

/** Equal points share a place. */
export function placesOf(rows: readonly { points: number }[]): number[] {
  return rows.map((r) => rows.filter((o) => o.points > r.points).length + 1);
}

export function Leaderboard({
  rows,
  limit,
  highlight,
  title,
  medals = true,
}: {
  rows: readonly LeaderboardRow[];
  /** Show only the first `limit` (the highlighted row is always added). */
  limit?: number;
  highlight?: string;
  title?: string;
  medals?: boolean;
}) {
  const theme = useTheme();
  const places = placesOf(rows);
  const shown = rows
    .map((row, i) => ({ row, place: places[i] }))
    .filter(({ row }, i) => limit === undefined || i < limit || row.key === highlight);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {shown.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No scores yet.
        </ThemedText>
      ) : (
        shown.map(({ row, place }) => (
          <View
            key={row.key}
            style={[
              styles.row,
              { borderColor: theme.border },
              row.key === highlight && { backgroundColor: theme.accentSoft },
            ]}>
            <ThemedText style={styles.place}>{medals && place <= 3 ? MEDALS[place - 1] : `${place}.`}</ThemedText>
            <ThemedText style={styles.name} numberOfLines={1}>
              {row.name}
            </ThemedText>
            {row.note ? (
              <ThemedText type="small" themeColor="textSecondary">
                {row.note}
              </ThemedText>
            ) : null}
            <ThemedText type="smallBold" style={styles.points}>
              {row.points.toLocaleString()}
            </ThemedText>
          </View>
        ))
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.four, gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
  },
  place: { width: 32 },
  name: { flex: 1 },
  points: { minWidth: 56, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
