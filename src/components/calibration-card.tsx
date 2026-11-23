import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CODE_NAMES,
  CODES,
  deleteCalibration,
  formatBand,
  overallFrom,
  saveCalibration,
  type AiMarking,
  type Bands,
  type Code,
} from '@/lib/calibration';
import { errorMessage } from '@/lib/supabase';

const CHOICES = [3, 4, 5, 6, 7, 8, 9];

/**
 * "Your marks": the teacher taps the band they would give for each criterion
 * and saves it, building an ongoing check of how the AI's marks compare with
 * the teachers'. Under a teacher's own marking the AI's bands show next to
 * the choices. On a shared essay (blind) they stay hidden until the marks are
 * saved, and then show side by side.
 */
export function CalibrationCard({
  marking,
  question,
  essay,
  blind = false,
  sharedCode,
  earlier,
}: {
  marking: AiMarking;
  question: string;
  essay: string;
  /** Hide the AI's bands until the teacher has saved theirs. */
  blind?: boolean;
  /** The shared essay these marks are for (/calibrate/<code>). */
  sharedCode?: string;
  /** Marks this device saved before for the same shared essay. */
  earlier?: { id: number; teacher: Bands } | null;
}) {
  const theme = useTheme();
  const ai = marking.ai;
  const [bands, setBands] = useState<Partial<Record<Code, number>>>(earlier?.teacher ?? {});
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(earlier?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const complete = CODES.every((c) => bands[c] !== undefined);

  async function save() {
    if (!complete) return;
    setSaving(true);
    setError(null);
    try {
      const id = await saveCalibration({
        question,
        essay,
        marking,
        teacher: { tr: bands.tr!, cc: bands.cc!, lr: bands.lr!, gra: bands.gra! },
        sharedCode,
      });
      setSavedId(id);
    } catch (e) {
      setError(errorMessage(e));
    }
    setSaving(false);
  }

  async function undo() {
    if (savedId === null) return;
    await deleteCalibration(savedId).catch(() => {});
    setSavedId(null);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.markABg }]}>
      <ThemedText type="smallBold" style={styles.title}>
        {blind ? 'Your marks' : 'Your marks (optional)'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {blind
          ? "Tap the band you would give for each one. You will see the AI's bands after you save."
          : "Tap the band you would give for each one. It builds an ongoing check of the AI's marking."}
      </ThemedText>

      {CODES.map((code) => (
        <View key={code} style={styles.criterion}>
          <View style={styles.row}>
            <ThemedText type="smallBold">{CODE_NAMES[code]}</ThemedText>
            {!blind && (
              <ThemedText type="small" themeColor="textSecondary">
                AI: {ai[code]}
              </ThemedText>
            )}
          </View>
          <View style={styles.choices}>
            {CHOICES.map((n) => {
              const selected = bands[code] === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: savedId !== null }}
                  accessibilityLabel={`${CODE_NAMES[code]}: band ${n}`}
                  disabled={savedId !== null}
                  onPress={() => setBands({ ...bands, [code]: n })}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: selected ? theme.accent : theme.background,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}>
                  <ThemedText style={[styles.choiceText, { color: selected ? theme.onAccent : theme.text }]}>{n}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.row}>
        <ThemedText type="smallBold">Your overall</ThemedText>
        <ThemedText type="smallBold">
          {complete
            ? `${formatBand(overallFrom({ tr: bands.tr!, cc: bands.cc!, lr: bands.lr!, gra: bands.gra! }))}${
                blind ? '' : `  (AI: ${formatBand(marking.aiOverall)})`
              }`
            : '–'}
        </ThemedText>
      </View>

      {savedId === null ? (
        <>
          <Button
            label={saving ? 'Saving…' : complete ? 'Save my marks' : 'Choose all four bands'}
            disabled={!complete || saving}
            onPress={save}
          />
          <ThemedText type="small" style={{ color: theme.markA }}>
            Saves the essay, the question and both sets of bands.
          </ThemedText>
        </>
      ) : (
        <>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Saved. Thank you!
          </ThemedText>
          {blind && complete && (
            <Comparison
              teacher={{ tr: bands.tr!, cc: bands.cc!, lr: bands.lr!, gra: bands.gra! }}
              ai={ai}
              aiOverall={marking.aiOverall}
            />
          )}
          <Button label="See the calibration" onPress={() => router.push('/calibration')} />
          <Button label="Undo" variant="secondary" onPress={undo} />
        </>
      )}
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/** Your bands next to the AI's, with differences in orange. */
function Comparison({ teacher, ai, aiOverall }: { teacher: Bands; ai: Bands; aiOverall: number }) {
  const theme = useTheme();
  const teacherOverall = overallFrom(teacher);
  const rows: { name: string; you: string; them: string; differs: boolean; bold?: boolean }[] = [
    ...CODES.map((code) => ({
      name: CODE_NAMES[code],
      you: String(teacher[code]),
      them: String(ai[code]),
      differs: teacher[code] !== ai[code],
    })),
    {
      name: 'Overall',
      you: formatBand(teacherOverall),
      them: formatBand(aiOverall),
      differs: teacherOverall !== aiOverall,
      bold: true,
    },
  ];
  return (
    <View style={[styles.table, { backgroundColor: theme.background }]}>
      <View style={styles.tableRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.tableName}>
          {' '}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.tableCell}>
          You
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.tableCell}>
          AI
        </ThemedText>
      </View>
      {rows.map((r) => (
        <View key={r.name} style={[styles.tableRow, { borderTopColor: theme.border }, styles.tableLine]}>
          <ThemedText type={r.bold ? 'smallBold' : 'small'} style={styles.tableName}>
            {r.name}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.tableCell}>
            {r.you}
          </ThemedText>
          <ThemedText type="smallBold" style={[styles.tableCell, r.differs && { color: theme.warning }]}>
            {r.them}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tableLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tableName: {
    flex: 1,
  },
  tableCell: {
    width: 48,
    textAlign: 'center',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  criterion: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  choices: {
    flexDirection: 'row',
    gap: 6,
  },
  choice: {
    flex: 1,
    minWidth: 36,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: 17,
    fontWeight: 700,
  },
});
