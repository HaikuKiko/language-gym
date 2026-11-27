import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { Pill } from '@/core/ui/pill';
import { Screen } from '@/core/ui/screen';
import { TeacherOnly } from '@/core/app/teacher-only';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import {
  IELTS_TARGET_BANDS,
  TARGET_LEVELS,
  formatBandValue,
  targetLabel,
  type TargetLevel,
} from '@/lib/class-scores';
import { loadClassSets, type ClassSet, type Course } from '@/lib/class-sets';
import { createClass, loadClasses, type SchoolClass } from '@/lib/classes';
import { errorMessage } from '@/core/app/supabase';

/** Class writing: the teacher's classes, and each class's marked writing. */
function ClassWritingRouteScreen() {
  const theme = useTheme();
  const [classes, setClasses] = useState<(SchoolClass & { studentCount: number })[] | null>(null);
  const [sets, setSets] = useState<ClassSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState<TargetLevel>('A2+');
  const [course, setCourse] = useState<Course>('general');
  const [targetBand, setTargetBand] = useState<number>(6.5);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loadedClasses, loadedSets] = await Promise.all([loadClasses(), loadClassSets()]);
      setClasses(loadedClasses);
      setSets(loadedSets);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setError(null);
    try {
      await createClass(
        name,
        course === 'ielts' ? { course: 'ielts', band: targetBand } : { course: 'general', level: target },
      );
      setName('');
      setAdding(false);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const className = (id: string | null) => classes?.find((c) => c.id === id)?.name;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">Class writing</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your classes and their writing. Upload a scan for a class: each page is read, marked against the
          class&apos;s target (a level, scored out of 10, or an IELTS band), and saved under the student.
        </ThemedText>
      </View>


      {error && <ThemedText themeColor="warning">{error}</ThemedText>}
      {classes === null && !error && <ActivityIndicator color={theme.accent} />}

      <View style={styles.section}>
        <ThemedText type="smallBold">Your classes</ThemedText>
        {classes?.length === 0 && (
          <ThemedText themeColor="textSecondary">No classes yet. Add your first class below.</ThemedText>
        )}
        {classes?.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/classes/[id]', params: { id: c.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold">{c.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {c.studentCount} {c.studentCount === 1 ? 'student' : 'students'}
              </ThemedText>
            </View>
            <Pill label={c.course === 'ielts' ? `IELTS · ${targetLabel(c)}` : targetLabel(c)} tone="accent" />
          </Pressable>
        ))}

        {adding ? (
          <View style={[styles.addBox, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold">New class</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Class name, e.g. 3A"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Class name"
              autoFocus
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
            />
            <ThemedText type="smallBold">Course</ThemedText>
            <View style={styles.chips}>
              <Chip label="General English" selected={course === 'general'} onPress={() => setCourse('general')} />
              <Chip label="IELTS Writing Task 2" selected={course === 'ielts'} onPress={() => setCourse('ielts')} />
            </View>
            {course === 'ielts' ? (
              <>
                <ThemedText type="smallBold">Target band</ThemedText>
                <View style={styles.chips}>
                  {IELTS_TARGET_BANDS.map((b) => (
                    <Chip key={b} label={formatBandValue(b)} selected={b === targetBand} onPress={() => setTargetBand(b)} />
                  ))}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Each essay gets IELTS band scores (Task 2), compared with this target.
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="smallBold">Target level</ThemedText>
                <View style={styles.chips}>
                  {TARGET_LEVELS.map((l) => (
                    <Chip key={l} label={l} selected={l === target} onPress={() => setTarget(l)} />
                  ))}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  The level the class is working towards. Writing at this level in all four areas scores 7 out of 10.
                </ThemedText>
              </>
            )}
            <View style={styles.chips}>
              <Button label="Save the class" disabled={!name.trim()} onPress={add} />
              <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} />
            </View>
          </View>
        ) : (
          <Button label="Add a class" variant="secondary" onPress={() => setAdding(true)} />
        )}
      </View>

      {sets.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Recent writing</ThemedText>
          {sets.slice(0, 10).map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/class-sets/[id]', params: { id: s.id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{s.title || 'Class writing'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[className(s.class_id) ?? s.class_name, new Date(s.created_at).toLocaleDateString(), `${s.page_count} pages`]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
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
  note: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
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
  addBox: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});

/** Teachers only (see TeacherOnly). */
export default function ClassWritingRoute() {
  return (
    <TeacherOnly>
      <ClassWritingRouteScreen />
    </TeacherOnly>
  );
}
