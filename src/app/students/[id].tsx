import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { TeacherOnly } from '@/components/teacher-only';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pageResult, targetLabel } from '@/lib/class-scores';
import { AREAS, isIeltsFeedback } from '@/lib/class-sets';
import { loadStudentHistory, renameStudent, type ClassStudent, type HistoryEntry, type SchoolClass } from '@/lib/classes';
import { errorMessage } from '@/lib/supabase';

/** One student: every piece of their writing, newest first, with the score and the level per area. */
function StudentRouteScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [student, setStudent] = useState<ClassStudent | null | undefined>(undefined);
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    try {
      const loaded = await loadStudentHistory(String(id));
      setStudent(loaded?.student ?? null);
      setSchoolClass(loaded?.schoolClass ?? null);
      setHistory(loaded?.history ?? []);
      setName(loaded?.student.name ?? '');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!student) return;
    setError(null);
    try {
      setStudent(await renameStudent(student, name));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (student === undefined) {
    return (
      <Screen>
        {error ? <ThemedText themeColor="warning">{error}</ThemedText> : <ActivityIndicator color={theme.accent} />}
      </Screen>
    );
  }
  if (student === null) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">This student isn&apos;t in your classes.</ThemedText>
        <Button label="Back to class writing" variant="secondary" onPress={() => router.replace('/class-sets')} />
      </Screen>
    );
  }


  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {schoolClass ? `STUDENT · ${schoolClass.name}` : 'STUDENT'}
        </ThemedText>
        {editing ? (
          <View style={styles.section}>
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel="The student's name"
              autoFocus
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <View style={styles.chips}>
              <Button label="Save the name" disabled={!name.trim()} onPress={save} />
              <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
            </View>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <ThemedText type="subtitle" style={styles.flex}>
              {student.name}
            </ThemedText>
            <Button label="Change name" variant="secondary" onPress={() => setEditing(true)} />
          </View>
        )}
        {schoolClass && <Pill label={`Class ${targetLabel(schoolClass).toLowerCase()}`} tone="accent" />}
      </View>

      {error && <ThemedText themeColor="warning">{error}</ThemedText>}

      <ThemedText type="smallBold">Writing so far</ThemedText>
      {history.length === 0 && (
        <ThemedText themeColor="textSecondary">No marked writing yet.</ThemedText>
      )}
      {history.map(({ page, set }) => {
        const result = pageResult(page, schoolClass);
        const ielts = isIeltsFeedback(page.feedback) ? page.feedback : null;
        return (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/class-sets/[id]/[page]', params: { id: set.id, page: String(page.page_number) } })
            }
            style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <View style={styles.nameRow}>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{set.title || 'Class writing'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(set.created_at).toLocaleDateString()}
                </ThemedText>
              </View>
              {result && <ThemedText style={styles.score}>{result.big}</ThemedText>}
            </View>
            {ielts && (
              <View style={styles.areas}>
                {ielts.criteria.map((c) => (
                  <View key={c.code} style={styles.area}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {c.code.toUpperCase()}
                    </ThemedText>
                    <ThemedText type="smallBold">{c.band}</ThemedText>
                  </View>
                ))}
              </View>
            )}
            {page.area_levels && (
              <View style={styles.areas}>
                {AREAS.map((a) => (
                  <View key={a} style={styles.area}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {a}
                    </ThemedText>
                    <ThemedText type="smallBold">{page.area_levels?.[a] ?? '–'}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary">
        A chart of progress in each area comes next, once there is writing from a few weeks.
      </ThemedText>
      {schoolClass && (
        <Button
          label={`Back to ${schoolClass.name}`}
          variant="secondary"
          onPress={() => router.replace({ pathname: '/classes/[id]', params: { id: schoolClass.id } })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  score: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
  areas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  area: {
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});

/** Teachers only (see TeacherOnly). */
export default function StudentRoute() {
  return (
    <TeacherOnly>
      <StudentRouteScreen />
    </TeacherOnly>
  );
}
