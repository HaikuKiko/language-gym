import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Pill } from '@/core/ui/pill';
import { ProgressBar } from '@/core/ui/progress-bar';
import { Screen } from '@/core/ui/screen';
import { TeacherOnly } from '@/core/app/teacher-only';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { pageResult, targetLabel } from '@/lib/class-scores';
import { loadClass, type ClassStudent, type SchoolClass } from '@/lib/classes';
import {
  deleteClassSet,
  loadClassSet,
  pagePhotoUrls,
  pageTitle,
  allRead,
  guessedWords,
  hasNextStudent,
  needsChecking,
  ONE_STUDENT_AT_A_TIME,
  needsGrouping,
  pagesOf,
  processClassSet,
  studentPages,
  waitingToMark,
  type ClassSet,
  type ClassSetPage,
} from '@/lib/class-sets';
import { errorMessage } from '@/core/app/supabase';

const STATUS_TEXT: Record<ClassSetPage['status'], string> = {
  waiting: 'waiting',
  reading: 'reading…',
  marking: 'marking…',
  done: '',
  error: '',
};

/** One class set: every page (student), marked one after another. */
function ClassSetRouteScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [set, setSet] = useState<ClassSet | null | undefined>(undefined);
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [pages, setPages] = useState<ClassSetPage[]>([]);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const started = useRef(false);

  const onChange = useCallback((page: ClassSetPage) => {
    setPages((current) => current.map((p) => (p.id === page.id ? page : p)));
  }, []);

  const run = useCallback(
    async (
      loadedSet: ClassSet,
      loadedPages: ClassSetPage[],
      students: ClassStudent[],
      options: { retryErrors?: boolean; mark?: boolean } = {},
    ) => {
      setWorking(true);
      await processClassSet(loadedSet, loadedPages, onChange, { ...options, students });
      setWorking(false);
    },
    [onChange],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await loadClassSet(String(id));
      setSet(loaded?.set ?? null);
      if (!loaded) return;
      setPages(loaded.pages);
      pagePhotoUrls(loaded.pages).then(setPhotos);
      const classData = loaded.set.class_id ? await loadClass(loaded.set.class_id) : null;
      setSchoolClass(classData?.schoolClass ?? null);
      setStudents(classData?.students ?? []);
      // Read whatever is not read yet (also after a refresh) and put pages with
      // their student (also in sets made before that). Marking waits for "Mark all".
      // Testing one student at a time: only a new set starts by itself.
      const start = ONE_STUDENT_AT_A_TIME
        ? loaded.pages.every((p) => p.transcript === null && p.status !== 'error')
        : !allRead(loaded.pages) || needsGrouping(loaded.pages);
      if (!started.current && start) {
        started.current = true;
        run(loaded.set, loaded.pages, classData?.students ?? []);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, run]);

  useEffect(() => {
    load();
  }, [load]);

  if (error || set === undefined) {
    return (
      <Screen>
        <ThemedText type="subtitle">Class set</ThemedText>
        {error ? (
          <>
            <ThemedText themeColor="warning">{error}</ThemedText>
            <Button label="Try again" onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </Screen>
    );
  }
  if (set === null) {
    return (
      <Screen>
        <ThemedText type="subtitle">Class set</ThemedText>
        <ThemedText themeColor="textSecondary">This writing isn&apos;t on this device or account.</ThemedText>
        <Button label="Back to class writing" variant="secondary" onPress={() => router.replace('/class-sets')} />
      </Screen>
    );
  }

  // One entry per student; a student's writing may run over several pages.
  const firsts = studentPages(pages);
  const read = pages.filter((p) => p.transcript !== null || p.status === 'error').length;
  const reading = read < pages.length;
  const done = firsts.filter((p) => p.status === 'done').length;
  const failed = firsts.filter((p) => p.status === 'error');
  const finished = done + failed.length;
  const toMark = working ? [] : waitingToMark(pages);
  const marking = firsts.some((p) => p.status === 'marking');
  const toCheck = firsts.filter((p) => p.status !== 'done' && needsChecking(p, pages)).length;
  // Pages whose student still needs choosing: no name, or (in a class) not matched to a student.
  const needsName = (p: ClassSetPage) => !p.student_name.trim() || (!!set.class_id && !p.student_id);
  const noName = firsts.filter(needsName).length;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {['CLASS WRITING', schoolClass?.name ?? set.class_name, new Date(set.created_at).toLocaleDateString()]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
        <ThemedText type="subtitle">{set.title || 'Class set'}</ThemedText>
        <View style={styles.pills}>
          {set.course === 'ielts' && <Pill label="IELTS Writing Task 2" />}
          {schoolClass ? (
            <Pill label={targetLabel(schoolClass)} tone="accent" />
          ) : (
            <Pill label={`Feedback for ${set.level}`} tone="accent" />
          )}
          {!reading && firsts.length !== pages.length && (
            <Pill label={`${firsts.length} ${firsts.length === 1 ? 'student' : 'students'}`} />
          )}
          <Pill label={`${pages.length} pages`} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">
          {ONE_STUDENT_AT_A_TIME && reading
            ? working
              ? `Testing: doing the next student… (${read} of ${pages.length} pages read)`
              : `Testing: one student at a time. ${done} marked, ${pages.length - read} pages not read yet.`
            : reading
            ? `Reading the pages… ${read} of ${pages.length}`
            : marking
              ? `Marking… ${finished} of ${firsts.length} done`
              : finished < firsts.length
                ? `All ${pages.length} pages read. ${toCheck > 0 ? 'Check the pink words, then mark.' : 'Ready to mark.'}`
                : `All ${firsts.length} marked`}
        </ThemedText>
        <ProgressBar
          fraction={reading ? read / Math.max(1, pages.length) : firsts.length > 0 ? finished / firsts.length : 0}
        />
        {noName > 0 && (
          <ThemedText type="small" style={{ color: theme.markA }}>
            {noName === 1 ? '1 piece of writing needs' : `${noName} pieces of writing need`} the student checking: tap to choose who wrote it.
          </ThemedText>
        )}
      </View>

      {firsts.map((page) => {
        const count = pagesOf(page, pages).length;
        const named = !needsName(page);
        const result = page.status === 'done' ? pageResult(page, schoolClass) : null;
        const guesses = guessedWords(page, pages);
        const check = page.status !== 'done' && page.transcript !== null && needsChecking(page, pages);
        const orange = !named || check;
        return (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            accessibilityLabel={`${pageTitle(page)}${result ? `, ${result.big} ${result.small}` : ''}`}
            onPress={() =>
              router.push({ pathname: '/class-sets/[id]/[page]', params: { id: set.id, page: String(page.page_number) } })
            }
            style={({ pressed }) => [
              styles.row,
              !orange
                ? { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement }
                : { backgroundColor: theme.markABg, borderColor: theme.markA },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.thumb, { borderColor: theme.border }]}>
              {photos[page.page_number] && (
                <Image source={{ uri: photos[page.page_number] }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>
            <View style={styles.rowText}>
              <ThemedText type="smallBold" style={!named ? { color: theme.markA } : undefined}>
                {page.student_name.trim() && !named ? `${page.student_name}?` : pageTitle(page)}
                {!named ? ' ✎' : ''}
              </ThemedText>
              {count > 1 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Pages {page.page_number}–{page.page_number + count - 1}
                </ThemedText>
              )}
              {page.status === 'error' && (
                <ThemedText type="small" themeColor="warning">
                  {page.error}
                </ThemedText>
              )}
              {page.status === 'waiting' && page.transcript !== null && !reading && (
                <ThemedText type="smallBold" style={{ color: check ? theme.markA : theme.successText }}>
                  {check
                    ? `${guesses.length} guessed ${guesses.length === 1 ? 'word' : 'words'} to check`
                    : page.reading_checked
                      ? '✓ Checked'
                      : '✓ All clear'}
                </ThemedText>
              )}
            </View>
            {result ? (
              <View style={styles.scoreBox}>
                <ThemedText style={styles.score}>{result.big}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {result.small}
                </ThemedText>
              </View>
            ) : page.status === 'waiting' && page.transcript !== null ? null : (
              <ThemedText type="small" themeColor="textSecondary">
                {STATUS_TEXT[page.status]}
              </ThemedText>
            )}
          </Pressable>
        );
      })}

      <View style={styles.section}>
        {ONE_STUDENT_AT_A_TIME && !working && hasNextStudent(pages) && (
          <>
            <Button label="Do the next student" onPress={() => run(set, pages, students, { mark: true })} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Testing: each tap reads and marks one more student, so you can look at each one first.
            </ThemedText>
          </>
        )}
        {toMark.length > 0 && !ONE_STUDENT_AT_A_TIME && (
          <>
            <Button label={`Mark all ${toMark.length}`} onPress={() => run(set, pages, students, { mark: true })} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {toCheck > 0
                ? "Tap a student to check the pink words against the paper. You can also mark straight away: the pink words stay highlighted in each student's feedback."
                : 'Tap a student to see their writing.'}
            </ThemedText>
          </>
        )}
        {failed.length > 0 && !working && (
          <Button
            label={`Try the ${failed.length} unfinished again`}
            variant={toMark.length > 0 ? 'secondary' : 'primary'}
            onPress={() => run(set, pages, students, { retryErrors: true, mark: true })}
          />
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Tap a student to see their feedback, check the reading or change the name. Marked by an AI (Claude) as a
          guide.
        </ThemedText>
        <DeleteClassSet
          set={set}
          pages={pages}
          disabled={working}
          onDeleted={() =>
            schoolClass
              ? router.replace({ pathname: '/classes/[id]', params: { id: schoolClass.id } })
              : router.replace('/class-sets')
          }
        />
        {schoolClass ? (
          <Button
            label={`Back to ${schoolClass.name}`}
            variant="secondary"
            onPress={() => router.replace({ pathname: '/classes/[id]', params: { id: schoolClass.id } })}
          />
        ) : (
          <Button label="Back to class writing" variant="secondary" onPress={() => router.replace('/class-sets')} />
        )}
      </View>
    </Screen>
  );
}

/** "Delete this class set", with an "Are you sure?" step. */
function DeleteClassSet({
  set,
  pages,
  disabled,
  onDeleted,
}: {
  set: ClassSet;
  pages: ClassSetPage[];
  disabled: boolean;
  onDeleted: () => void;
}) {
  const theme = useTheme();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteClassSet(set, pages);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (!asking) {
    return <Button label="Delete this class set" variant="secondary" disabled={disabled} onPress={() => setAsking(true)} />;
  }
  return (
    <View style={[styles.deleteBox, { borderColor: theme.warning }]}>
      <ThemedText type="smallBold">Delete “{set.title}”?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        This removes all {pages.length} {pages.length === 1 ? 'page' : 'pages'}, their feedback and their scores in each
        student&apos;s history. It can&apos;t be undone. The class and its students stay.
      </ThemedText>
      <Button label={busy ? 'Deleting…' : 'Yes, delete it'} disabled={busy} onPress={remove} />
      <Button label="No, keep it" variant="secondary" disabled={busy} onPress={() => setAsking(false)} />
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deleteBox: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.one,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  thumb: {
    width: 36,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    textAlign: 'center',
  },
  scoreBox: {
    alignItems: 'center',
    minWidth: 44,
  },
  score: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: 800,
  },
});

/** Teachers only (see TeacherOnly). */
export default function ClassSetRoute() {
  return (
    <TeacherOnly>
      <ClassSetRouteScreen />
    </TeacherOnly>
  );
}
