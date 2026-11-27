import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRETEND_STUDENT_CHOICES } from '@/lib/pretend-students';

/**
 * In the lobby of a real session: add pretend students, so the teacher can
 * test the session on their own phone (see `usePretendStudents`).
 */
export function PretendStudentsPanel({
  onAdd,
  busy,
  error,
  wordGame = false,
}: {
  /** Word games: the pretend students guess words instead of finding partners. */
  wordGame?: boolean;
  onAdd: (count: number) => void;
  busy: boolean;
  error: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold">Testing on your own?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Join with your phone (scan the code), then add pretend students. They join and{' '}
        {wordGame ? 'take their turns with the words' : 'find their partner'} by themselves while this page is open.
      </ThemedText>
      <View style={styles.row}>
        <ThemedText type="small">{busy ? 'Adding…' : 'Add pretend students:'}</ThemedText>
        {PRETEND_STUDENT_CHOICES.map((n) => (
          <Chip
            key={n}
            label={String(n)}
            accessibilityLabel={`Add ${n} pretend ${n === 1 ? 'student' : 'students'}`}
            onPress={busy ? undefined : () => onAdd(n)}
          />
        ))}
      </View>
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
