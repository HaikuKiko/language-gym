import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { TeacherOnly } from '@/components/teacher-only';
import { ThemedText } from '@/components/themed-text';
import { WritingFeedbackView } from '@/components/writing-feedback';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatScore, levelStep, scoreFor } from '@/lib/class-scores';
import {
  addStudents,
  assignPage,
  loadClass,
  suggestStudents,
  type ClassStudent,
  type SchoolClass,
} from '@/lib/classes';
import {
  AREAS,
  knownStudentNames,
  fullTranscript,
  loadClassSet,
  pagesOf,
  pagePhotoUrls,
  pageTitle,
  renamePage,
  studentKey,
  type ClassSet,
  type ClassSetPage,
} from '@/lib/class-sets';
import { errorMessage } from '@/lib/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** How often to look again while the page is still being read or marked. */
const REFRESH_MS = 3000;
/** Most name suggestions shown at once. */
const MAX_SUGGESTIONS = 6;

// ===========================================================================

/** One student in a class set: the name, the levels per area, and the feedback. */
function ClassSetPageRouteScreen() {
  const theme = useTheme();
  const { id, page: pageParam } = useLocalSearchParams<{ id: string; page: string }>();
  const pageNumber = Number(pageParam);
  const [set, setSet] = useState<ClassSet | null>(null);
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [page, setPage] = useState<ClassSetPage | null | undefined>(undefined);
  /** The student's pages (the first and any that continue it), and their photos. */
  const [parts, setParts] = useState<ClassSetPage[]>([]);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await loadClassSet(String(id));
      const found = loaded?.pages.find((p) => p.page_number === pageNumber) ?? null;
      setSet(loaded?.set ?? null);
      setPage(found);
      const all = found && loaded ? pagesOf(found, loaded.pages) : [];
      setParts(all);
      if (loaded?.set.class_id) {
        const classData = await loadClass(loaded.set.class_id);
        setSchoolClass(classData?.schoolClass ?? null);
        setStudents(classData?.students ?? []);
      }
      if (all.length > 0) pagePhotoUrls(all).then(setPhotos);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, pageNumber]);

  useEffect(() => {
    load();
  }, [load]);

  // Still being read or marked (on the class set screen): look again shortly.
  const pending = !!page && page.status !== 'done' && page.status !== 'error';
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [pending, load]);

  const back = (
    <Button
      label="Back to the class set"
      variant="secondary"
      onPress={() => router.replace({ pathname: '/class-sets/[id]', params: { id: String(id) } })}
    />
  );

  if (error || page === undefined) {
    return (
      <Screen>
        {error ? <ThemedText themeColor="warning">{error}</ThemedText> : <ActivityIndicator color={theme.accent} />}
        {back}
      </Screen>
    );
  }
  if (page === null || set === null) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">This page isn&apos;t in the class set.</ThemedText>
        {back}
      </Screen>
    );
  }

  // The student's whole writing, over all their pages.
  const text = fullTranscript(page, parts.length > 0 ? parts : [page]);

  const header = (
    <>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {['CLASS WRITING', schoolClass?.name ?? set.class_name, set.title].filter(Boolean).join(' · ')}
      </ThemedText>
      {schoolClass ? (
        <StudentPicker
          page={page}
          students={students}
          onChange={setPage}
          onStudentsChange={setStudents}
          classId={schoolClass.id}
        />
      ) : (
        <NameEditor page={page} onRenamed={setPage} />
      )}
      {schoolClass && page.area_levels && <ScoreCard page={page} target={schoolClass.target_level} />}
      <View style={styles.photoRow}>
        {parts.map((part) =>
          photos[part.page_number] ? (
            <Pressable
              key={part.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Page ${part.page_number}, tap to enlarge`}
              onPress={() => setBigPhoto(photos[part.page_number])}
              style={[styles.thumb, { borderColor: theme.border }]}>
              <Image source={{ uri: photos[part.page_number] }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          ) : null,
        )}
        {page.area_levels && !schoolClass && (
          <View style={[styles.areas, { backgroundColor: theme.backgroundElement }]}>
            {AREAS.map((area) => (
              <View key={area} style={styles.areaRow}>
                <ThemedText type="small">{area}</ThemedText>
                <ThemedText type="smallBold">{page.area_levels?.[area] ?? '–'}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
      <Modal visible={!!bigPhoto} transparent animationType="fade" onRequestClose={() => setBigPhoto(null)}>
        <Pressable accessibilityRole="button" onPress={() => setBigPhoto(null)} style={styles.overlay}>
          {bigPhoto && <Image source={{ uri: bigPhoto }} style={styles.big} contentFit="contain" />}
          <ThemedText style={styles.closeHint}>Tap to close</ThemedText>
        </Pressable>
      </Modal>
    </>
  );

  if (page.status !== 'done' || !page.feedback) {
    return (
      <Screen>
        {header}
        <ThemedText themeColor={page.status === 'error' ? 'warning' : 'textSecondary'}>
          {page.status === 'error'
            ? page.error
            : page.status === 'waiting'
              ? 'Waiting to be read and marked…'
              : page.status === 'reading'
                ? 'Reading the page…'
                : 'Marking…'}
        </ThemedText>
        {text ? (
          <View style={[styles.areas, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">The writing</ThemedText>
            <ThemedText selectable>{text}</ThemedText>
          </View>
        ) : null}
        {back}
      </Screen>
    );
  }

  return (
    <WritingFeedbackView
      response={{ feedback: page.feedback, remainingToday: 0 }}
      text={text}
      header={header}
      footer={back}
      showUsage={false}
      reportTitle={`Writing feedback: ${pageTitle(page)}`}
    />
  );
}

/** The score out of 10, and each area's level against the class's target. */
function ScoreCard({ page, target }: { page: ClassSetPage; target: SchoolClass['target_level'] }) {
  const theme = useTheme();
  const score = scoreFor(page.area_levels, target);
  const targetStep = levelStep(target) ?? 0;
  return (
    <View style={[styles.scoreCard, { backgroundColor: theme.hero }]}>
      <View style={styles.scoreHalf}>
        <ThemedText type="smallBold" style={{ color: theme.onHeroMuted }}>
          SCORE
        </ThemedText>
        <ThemedText style={[styles.bigScore, { color: theme.onHero }]}>
          {score !== null ? formatScore(score) : '–'}
          <ThemedText style={{ color: theme.onHeroMuted }}> / 10</ThemedText>
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
          Target {target}
        </ThemedText>
      </View>
      <View style={styles.scoreAreas}>
        {AREAS.map((a) => {
          const level = page.area_levels?.[a];
          const step = levelStep(level);
          const below = step !== null && step < targetStep;
          return (
            <View key={a} style={styles.areaRow}>
              <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                {a}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: below ? theme.markABg : theme.onHero }}>
                {level ?? '–'}
                {below ? ' ↓' : ''}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Who wrote this page: the student matched from the class list, or a choice
 * of the closest names (a misread name still finds the right student), or a
 * new student added to the class.
 */
function StudentPicker({
  page,
  students,
  classId,
  onChange,
  onStudentsChange,
}: {
  page: ClassSetPage;
  students: ClassStudent[];
  classId: string;
  onChange: (page: ClassSetPage) => void;
  onStudentsChange: (students: ClassStudent[]) => void;
}) {
  const theme = useTheme();
  const current = students.find((s) => s.id === page.student_id) ?? null;
  const written = page.sheet?.student_name ?? '';
  const [choosing, setChoosing] = useState(!page.student_id);
  const [newName, setNewName] = useState(written || page.student_name);
  const [error, setError] = useState<string | null>(null);

  async function choose(student: ClassStudent) {
    setError(null);
    try {
      onChange(await assignPage(page, student));
      setChoosing(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function addNew() {
    setError(null);
    try {
      const [added] = await addStudents(classId, [newName]);
      const student = added ?? students.find((s) => s.student_key === studentKey(newName));
      if (!student) return;
      if (added) onStudentsChange([...students, added].sort((a, b) => a.name.localeCompare(b.name)));
      await choose(student);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!choosing && current) {
    return (
      <View style={styles.nameRow}>
        <View style={styles.flex}>
          <ThemedText type="subtitle">{current.name}</ThemedText>
          {written && studentKey(written) !== current.student_key ? (
            <ThemedText type="small" themeColor="textSecondary">
              The sheet says &quot;{written}&quot;
            </ThemedText>
          ) : null}
        </View>
        <Button label="Change" variant="secondary" onPress={() => setChoosing(true)} />
      </View>
    );
  }

  const suggestions = suggestStudents(written || page.student_name, students);
  return (
    <View style={[styles.nameBox, { backgroundColor: theme.markABg }]}>
      <ThemedText type="smallBold">Page {page.page_number}: who wrote this?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {written ? `The sheet says "${written}".` : 'There is no name on the sheet.'}
        {suggestions.length > 0 ? ' Closest names in the class first:' : ''}
      </ThemedText>
      {suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip key={s.id} label={s.name} selected={s.id === page.student_id} onPress={() => choose(s)} />
          ))}
        </View>
      )}
      <ThemedText type="smallBold">Or a new student in this class</ThemedText>
      <TextInput
        value={newName}
        onChangeText={setNewName}
        placeholder="The student's name"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="New student's name"
        style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
      />
      <View style={styles.chips}>
        <Button label="Add as a new student" variant="secondary" disabled={!newName.trim()} onPress={addNew} />
        {current && <Button label="Cancel" variant="secondary" onPress={() => setChoosing(false)} />}
      </View>
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/** The student's name: edit it, with names from earlier class sets suggested. */
function NameEditor({ page, onRenamed }: { page: ClassSetPage; onRenamed: (page: ClassSetPage) => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(!page.student_name.trim());
  const [name, setName] = useState(page.student_name);
  const [known, setKnown] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) knownStudentNames().then(setKnown);
  }, [editing]);

  async function save(value: string) {
    if (!value.trim()) return;
    setSaving(true);
    onRenamed(await renamePage(page, value));
    setName(value.trim());
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <View style={styles.nameRow}>
        <ThemedText type="subtitle" style={styles.flex}>
          {pageTitle(page)}
        </ThemedText>
        <Button label="Change name" variant="secondary" onPress={() => setEditing(true)} />
      </View>
    );
  }

  const typed = studentKey(name);
  const suggestions = known
    .filter((n) => studentKey(n) !== typed && (!typed || studentKey(n).includes(typed)))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <View style={[styles.nameBox, { backgroundColor: theme.markABg }]}>
      <ThemedText type="smallBold">
        {page.student_name.trim() ? "Change the student's name" : `Page ${page.page_number}: whose writing is this?`}
      </ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="The student's name"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="The student's name"
        autoFocus
        onSubmitEditing={() => save(name)}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
      />
      {suggestions.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Already in your class sets (use the same name so their work stays together):
          </ThemedText>
          <View style={styles.chips}>
            {suggestions.map((n) => (
              <Chip key={n} label={n} selected={false} onPress={() => save(n)} />
            ))}
          </View>
        </>
      )}
      <View style={styles.chips}>
        <Button label={saving ? 'Saving…' : 'Save the name'} disabled={!name.trim() || saving} onPress={() => save(name)} />
        {page.student_name.trim() ? (
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        ) : null}
      </View>
      {page.status === 'done' && page.cefr_level ? <Pill label={`Level ${page.cefr_level}`} tone="accent" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 24,
  },
  scoreHalf: {
    flexGrow: 1,
    flexBasis: 120,
    alignItems: 'center',
    gap: Spacing.half,
  },
  bigScore: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: 800,
  },
  scoreAreas: {
    flexGrow: 1,
    flexBasis: 160,
    justifyContent: 'center',
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  nameBox: {
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
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  thumb: {
    width: 90,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  areas: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  areaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  big: {
    width: '100%',
    height: '90%',
  },
  closeHint: {
    color: '#ffffff',
    marginTop: Spacing.two,
  },
});

/** Teachers only (see TeacherOnly). */
export default function ClassSetPageRoute() {
  return (
    <TeacherOnly>
      <ClassSetPageRouteScreen />
    </TeacherOnly>
  );
}
