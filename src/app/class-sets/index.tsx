import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadClassSets, type ClassSet } from '@/lib/class-sets';
import { errorMessage } from '@/lib/supabase';

/** The teacher's class sets, newest first, and a way to mark a new one. */
export default function ClassSetsRoute() {
  const theme = useTheme();
  const [sets, setSets] = useState<ClassSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSets(await loadClassSets());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">Class sets</ThemedText>
        <ThemedText themeColor="textSecondary">
          Upload a scan of a class&apos;s writing: one page per student. Each page is read and marked, and saved under
          the student&apos;s name.
        </ThemedText>
      </View>

      <Button label="Mark a new class set" onPress={() => router.push('/class-sets/new')} />

      {error && (
        <>
          <ThemedText themeColor="warning">{error}</ThemedText>
          <Button label="Try again" variant="secondary" onPress={load} />
        </>
      )}
      {sets === null && !error && <ActivityIndicator color={theme.accent} />}
      {sets !== null && sets.length === 0 && (
        <ThemedText themeColor="textSecondary">No class sets yet on this device.</ThemedText>
      )}
      {sets?.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/class-sets/[id]', params: { id: s.id } })}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
          <View style={styles.rowText}>
            <ThemedText type="smallBold">{s.title || 'Class set'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[s.class_name, new Date(s.created_at).toLocaleDateString(), `${s.page_count} pages`]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </View>
          <Pill label={s.level} tone="accent" />
        </Pressable>
      ))}

      <ThemedText type="small" themeColor="textSecondary">
        Class sets are kept on the device that made them (teachers don&apos;t have accounts yet).
      </ThemedText>
      <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
