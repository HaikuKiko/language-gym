import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  biasLabel,
  calibrationStats,
  CODE_NAMES,
  CODES,
  formatBand,
  loadCalibration,
  percent,
  rowGap,
  type CalibrationRow,
} from '@/lib/calibration';
import { errorMessage } from '@/lib/supabase';

/**
 * Calibration: how the AI's IELTS marks compare with the bands teachers gave
 * the same essays ("Your marks" after Mark an IELTS essay).
 */
export default function CalibrationRoute() {
  const theme = useTheme();
  const [rows, setRows] = useState<CalibrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadCalibration()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const stats = rows ? calibrationStats(rows) : null;
  const sorted = rows ? [...rows].sort((a, b) => rowGap(b) - rowGap(a)) : [];
  const shown = showAll ? sorted : sorted.slice(0, 10);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">IELTS calibration</ThemedText>
        <ThemedText themeColor="textSecondary">
          How the AI&apos;s Task 2 marks compare with the bands teachers gave the same essays. Add your marks
          after &ldquo;Mark an IELTS essay&rdquo;.
        </ThemedText>
      </View>

      {rows === null && !error && <ActivityIndicator color={theme.accent} />}
      {error && <ThemedText themeColor="warning">{error}</ThemedText>}

      {rows !== null && !stats && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText>No marks yet. Mark an essay, then add your own bands under the results.</ThemedText>
        </ThemedView>
      )}

      {stats && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <Stat label="Essays checked" value={String(stats.count)} />
          <Stat label="Overall band: same or within 0.5" value={percent(stats.overallWithinHalf)} />
          <Stat label="Overall band: exactly the same" value={percent(stats.overallExact)} />
          <Stat label="Overall band" value={biasLabel(stats.overallBias)} />
          <ThemedText type="smallBold" style={styles.subhead}>
            Each criterion (AI compared with teachers)
          </ThemedText>
          {stats.criteria.map((c) => (
            <Stat
              key={c.code}
              label={CODE_NAMES[c.code]}
              value={biasLabel(c.bias)}
              detail={`Same band ${percent(c.exact)} · within 1 band ${percent(c.withinOne)}`}
            />
          ))}
          {stats.count < 10 && (
            <ThemedText type="small" themeColor="textSecondary">
              With fewer than 10 essays, these numbers can change a lot. Aim for 20 or more.
            </ThemedText>
          )}
        </ThemedView>
      )}

      {sorted.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Biggest differences first</ThemedText>
          {shown.map((r) => {
            const expanded = open === r.id;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setOpen(expanded ? null : r.id)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.row}>
                    <ThemedText type="smallBold">
                      AI {formatBand(r.aiOverall)} · Teacher {formatBand(r.teacherOverall)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </ThemedText>
                  </View>
                  <View style={styles.bandRow}>
                    {CODES.map((c) => (
                      <ThemedText
                        key={c}
                        type="small"
                        style={{ color: r.ai[c] === r.teacher[c] ? theme.textSecondary : theme.warning }}>
                        {c.toUpperCase()} {r.ai[c]}/{r.teacher[c]}
                      </ThemedText>
                    ))}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={expanded ? undefined : 2}>
                    {r.question ? `Q: ${r.question}\n\n` : ''}
                    {r.essay}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
          <ThemedText type="small" themeColor="textSecondary">
            Bands are shown as AI/teacher. Tap an essay to read it all.
          </ThemedText>
          {sorted.length > 10 && !showAll && (
            <Button label={`Show all ${sorted.length}`} variant="secondary" onPress={() => setShowAll(true)} />
          )}
        </View>
      )}

      <Button label="Mark an IELTS essay" onPress={() => router.replace('/teacher-ielts')} />
      <Button label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.row}>
        <ThemedText style={styles.flex}>{label}</ThemedText>
        <ThemedText type="smallBold">{value}</ThemedText>
      </View>
      {detail && (
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  subhead: {
    marginTop: Spacing.two,
  },
  stat: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flexShrink: 1,
  },
  bandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
