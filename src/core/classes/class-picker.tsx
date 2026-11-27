import { StyleSheet, View } from 'react-native';

import { Chip } from '@/core/ui/chip';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import type { ClassInfo } from '@/core/classes/classes';

/**
 * Classes kit: one row of buttons to choose which class an activity is for.
 * Shows nothing when there are no classes (e.g. someone who is not a teacher).
 */
export function ClassPicker({
  classes,
  value,
  onChange,
  label = 'Class',
  note,
  noneNote,
  noneLabel = 'No class',
}: {
  classes: readonly ClassInfo[] | null;
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  note?: string;
  /** Shown instead of `note` while no class is chosen. */
  noneNote?: string;
  /** The "no class" choice; on a list this can be "All classes". */
  noneLabel?: string;
}) {
  if (!classes || classes.length === 0) return null;
  const shownNote = value === null && noneNote !== undefined ? noneNote : note;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>
        {classes.map((c) => (
          <Chip key={c.id} label={c.name} selected={value === c.id} onPress={() => onChange(c.id)} />
        ))}
        <Chip label={noneLabel} selected={value === null} onPress={() => onChange(null)} />
      </View>
      {shownNote ? (
        <ThemedText type="small" themeColor="textSecondary">
          {shownNote}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
