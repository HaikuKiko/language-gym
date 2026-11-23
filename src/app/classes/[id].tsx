import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { TeacherOnly } from '@/components/teacher-only';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TARGET_LEVELS, formatScore, scoreFor, type TargetLevel } from '@/lib/class-scores';
import type { ClassSet, ClassSetPage } from '@/lib/class-sets';
import { addStudents, loadClass, updateClass, type ClassStudent, type SchoolClass } from '@/lib/classes';
import { errorMessage } from '@/lib/supabase';

/** One class: its target level, its students (with their latest score) and its writing. */
function ClassRouteScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{
    schoolClass: SchoolClass;
    students: ClassStudent[];
    sets: ClassSet[];
    pages: ClassSetPage[];
  } | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNames, setNewNames] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await loadClass(String(id));
      setMissing(!loaded);
      setData(loaded);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNames() {
    if (!data) return;
    setError(null);
    try {
      await addStudents(data.schoolClass.id, newNames.split(/\n|,/));
      setNewNames('');
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function setTarget(target: TargetLevel) {
    if (!data) return;
    await updateClass(data.schoolClass.id, { target_level: target }).catch((e) => setError(errorMessage(e)));
    setEditingTarget(false);
    load();
  }

  if (missing) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">This class isn&apos;t in your classes.</ThemedText>
        <Button label="Back to class writing" variant="secondary" onPress={() => router.replace('/class-sets')} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        {error ? <ThemedText themeColor="warning">{error}</ThemedText> : <ActivityIndicator color={theme.accent} />}
      </Screen>
    );
  }

  const { schoolClass, students, sets, pages } = data;
  const setDate = new Map(sets.map((s) => [s.id, s.created_at]));
  // Each student's most recent marked writing, for their latest score.
  const latest = new Map<string, ClassSetPage>();
  for (const p of pages) {
    if (!p.student_id || p.status !== 'done') continue;
    const current = latest.get(p.student_id);
    if (!current || (setDate.get(p.set_id) ?? '') > (setDate.get(current.set_id) ?? '')) latest.set(p.student_id, p);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          CLASS
        </ThemedText>
        <ThemedText type="subtitle">{schoolClass.name}</ThemedText>
        <View style={styles.chips}>
          <Pill label={`Target ${schoolClass.target_level}`} tone="accent" />
          <Pill label={`${students.length} students`} />
          {!editingTarget && (
            <Button label="Change target" variant="secondary" onPress={() => setEditingTarget(true)} />
          )}
        </View>
        {editingTarget && (
          <View style={styles.chips}>
            {TARGET_LEVELS.map((l) => (
              <Chip key={l} label={l} selected={l === schoolClass.target_level} onPress={() => setTarget(l)} />
            ))}
          </View>
        )}
      </View>

      <Button
        label={`Mark new writing for ${schoolClass.name}`}
        onPress={() => router.push({ pathname: '/class-sets/new', params: { class: schoolClass.id } })}
      />

      {error && <ThemedText themeColor="warning">{error}</ThemedText>}

      <View style={styles.section}>
        <ThemedText type="smallBold">Students</ThemedText>
        {students.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            No students yet. Add them below, or they are added as you check the names on marked writing.
          </ThemedText>
        )}
        {students.map((s) => {
          const last = latest.get(s.id);
          const score = last ? scoreFor(last.area_levels, schoolClass.target_level) : null;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/students/[id]', params: { id: s.id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.flex}>
                {s.name}
              </ThemedText>
              {score !== null ? (
                <ThemedText type="smallBold">{formatScore(score)} / 10</ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  no writing yet
                </ThemedText>
              )}
            </Pressable>
          );
        })}
        <TextInput
          value={newNames}
          onChangeText={setNewNames}
          placeholder="Add students: one name per line"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="New students"
          multiline
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        {newNames.trim() ? <Button label="Add these students" variant="secondary" onPress={saveNames} /> : null}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Writing</ThemedText>
        {sets.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing marked yet.
          </ThemedText>
        )}
        {sets.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/class-sets/[id]', params: { id: s.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{s.title || 'Class writing'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(s.created_at).toLocaleDateString()} · {s.page_count} pages
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>

      <Button label="Back to class writing" variant="secondary" onPress={() => router.replace('/class-sets')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  input: {
    minHeight: 72,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  pressed: {
    opacity: 0.7,
  },
});

/** Teachers only (see TeacherOnly). */
export default function ClassRoute() {
  return (
    <TeacherOnly>
      <ClassRouteScreen />
    </TeacherOnly>
  );
}
