import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  aiBands,
  CODE_NAMES,
  CODES,
  deleteCalibration,
  formatBand,
  overallFrom,
  saveCalibration,
  type Code,
} from '@/lib/calibration';
import type { IeltsFeedback } from '@/lib/ielts';
import { errorMessage } from '@/lib/supabase';

const CHOICES = [3, 4, 5, 6, 7, 8, 9];

/**
 * "Your marks (optional)": under a teacher's marking, the teacher taps the
 * band they would give for each criterion and saves it, building an ongoing
 * check of how the AI's marks compare with theirs.
 */
export function CalibrationCard({
  feedback,
  question,
  essay,
}: {
  feedback: IeltsFeedback;
  question: string;
  essay: string;
}) {
  const theme = useTheme();
  const ai = aiBands(feedback);
  const [bands, setBands] = useState<Partial<Record<Code, number>>>({});
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
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
        feedback,
        teacher: { tr: bands.tr!, cc: bands.cc!, lr: bands.lr!, gra: bands.gra! },
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
        Your marks (optional)
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Tap the band you would give for each one. It builds an ongoing check of the AI&apos;s marking.
      </ThemedText>

      {CODES.map((code) => (
        <View key={code} style={styles.criterion}>
          <View style={styles.row}>
            <ThemedText type="smallBold">{CODE_NAMES[code]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              AI: {ai[code]}
            </ThemedText>
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
            ? `${formatBand(overallFrom({ tr: bands.tr!, cc: bands.cc!, lr: bands.lr!, gra: bands.gra! }))}  (AI: ${formatBand(feedback.overall_band)})`
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

const styles = StyleSheet.create({
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
