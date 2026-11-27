import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { ErrorNote } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';

type FinishedScreenProps = {
  roundsPlayed: number;
  studentCount: number;
  onRestart: () => void;
  restartLabel?: string;
  error?: string | null;
};

export function FinishedScreen({
  roundsPlayed,
  studentCount,
  onRestart,
  restartLabel = 'New session',
  error = null,
}: FinishedScreenProps) {
  return (
    <Screen>
      <View style={styles.summary}>
        <ThemedText type="subtitle">Session complete</ThemedText>
        <ThemedText themeColor="textSecondary">
          {studentCount} students · {roundsPlayed} {roundsPlayed === 1 ? 'round' : 'rounds'}
        </ThemedText>
      </View>
      <ErrorNote message={error} />
      <Button label={restartLabel} onPress={onRestart} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.one,
    paddingVertical: Spacing.five,
  },
});
