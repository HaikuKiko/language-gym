import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BusyOverlay } from '@/components/busy-overlay';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { TeacherOnly } from '@/components/teacher-only';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { feedbackLevel, targetLabel } from '@/lib/class-scores';
import { CAN_READ_PDF, MAX_CLASS_SET_PAGES, choosePdfPages, createClassSet } from '@/lib/class-sets';
import { loadClasses, type SchoolClass } from '@/lib/classes';
import { pickPhotos, type PreparedPhoto } from '@/lib/photo';
import { errorMessage } from '@/lib/supabase';

/** Upload a scan (or photos) of a class's writing for one of the teacher's classes. */
function NewClassSetRouteScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ class?: string }>();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [classId, setClassId] = useState<string | null>(params.class ?? null);
  const [pages, setPages] = useState<PreparedPhoto[]>([]);
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [grammarFocus, setGrammarFocus] = useState('');
  const [preparing, setPreparing] = useState(false);
  /** Opening a PDF: pages turned into photos so far (null while choosing the file). */
  const [opened, setOpened] = useState<{ done: number; total: number } | null>(null);
  const [uploaded, setUploaded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];
  const chosenClass = classes?.find((c) => c.id === classId) ?? null;
  const ielts = chosenClass?.course === 'ielts';

  useEffect(() => {
    loadClasses()
      .then((loaded) => {
        setClasses(loaded);
        if (loaded.length === 1) setClassId((current) => current ?? loaded[0].id);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  async function choosePdf() {
    setError(null);
    setPreparing(true);
    setOpened(null);
    try {
      const chosen = await choosePdfPages(
        () => setOpened({ done: 0, total: 0 }),
        (done, total) => setOpened({ done, total }),
      );
      if (chosen) {
        setPages(chosen.pages);
        setFileName(chosen.fileName);
        if (!title) setTitle(chosen.fileName.replace(/\.pdf$/i, ''));
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setPreparing(false);
    setOpened(null);
  }

  async function choosePhotos() {
    setError(null);
    setPreparing(true);
    try {
      const chosen = await pickPhotos('library', MAX_CLASS_SET_PAGES);
      if (chosen.length > 0) {
        setPages(chosen);
        setFileName(`${chosen.length} photos`);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setPreparing(false);
  }

  async function start() {
    if (!chosenClass) return;
    setError(null);
    setUploaded(0);
    try {
      const id = await createClassSet(
        {
          classId: chosenClass.id,
          course: chosenClass.course,
          title,
          className: chosenClass.name,
          level: feedbackLevel(chosenClass.target_level),
          task,
          grammarFocus,
          fileName,
        },
        pages,
        setUploaded,
      );
      router.replace({ pathname: '/class-sets/[id]', params: { id, start: '1' } });
    } catch (e) {
      setError(errorMessage(e));
      setUploaded(null);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">Mark a class set</ThemedText>
        <ThemedText themeColor="textSecondary">
          One page = one student. The name, the task and the grammar focus are read from each sheet.
        </ThemedText>
      </View>

      <View style={[styles.drop, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
        {pages.length > 0 ? (
          <ThemedText type="smallBold" style={styles.centered}>
            {fileName} · {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </ThemedText>
        ) : (
          <ThemedText style={styles.centered}>Choose the scan of the class&apos;s writing.</ThemedText>
        )}
        {opened && (
          <View style={styles.opening}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {opened.total === 0
                ? 'Opening the PDF…'
                : `Opening page ${Math.min(opened.done + 1, opened.total)} of ${opened.total}…`}
            </ThemedText>
            <ProgressBar fraction={opened.total === 0 ? 0 : opened.done / opened.total} />
          </View>
        )}
        <View style={styles.buttons}>
          {CAN_READ_PDF && (
            <Button
              label={preparing ? 'Opening…' : 'Choose a PDF'}
              variant="secondary"
              disabled={preparing}
              onPress={choosePdf}
              style={styles.button}
            />
          )}
          <Button
            label="Choose photos"
            variant="secondary"
            disabled={preparing}
            onPress={choosePhotos}
            style={styles.button}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Title (optional)</ThemedText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="For example: The First Time"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Title"
          style={inputStyle}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Class</ThemedText>
        <View style={styles.chips}>
          {classes?.map((c) => (
            <Chip key={c.id} label={c.name} selected={c.id === classId} onPress={() => setClassId(c.id)} />
          ))}
        </View>
        {classes?.length === 0 ? (
          <ThemedText type="small" themeColor="warning">
            Add your classes first (Class writing → Add a class).
          </ThemedText>
        ) : chosenClass?.course === 'ielts' ? (
          <ThemedText type="small" themeColor="textSecondary">
            IELTS Writing Task 2 · {targetLabel(chosenClass)}: each essay gets band scores, compared with the target.
          </ThemedText>
        ) : chosenClass ? (
          <ThemedText type="small" themeColor="textSecondary">
            Target {chosenClass.target_level}: scores are worked out against it, and the feedback is written for{' '}
            {feedbackLevel(chosenClass.target_level)} students.
          </ThemedText>
        ) : (
          <ThemedText type="small" style={{ color: theme.markA }}>
            Choose the class.
          </ThemedText>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{ielts ? 'The Task 2 question' : 'Task (optional)'}</ThemedText>
        <TextInput
          value={task}
          onChangeText={setTask}
          placeholder={
            ielts
              ? 'Type or paste the question. Leave empty to read it from each sheet, or work it out from the essay.'
              : 'Leave empty to read it from each sheet'
          }
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Task"
          multiline
          style={[inputStyle, styles.multiline]}
        />
        {!ielts && (
          <>
            <ThemedText type="smallBold">Grammar focus (optional)</ThemedText>
            <TextInput
              value={grammarFocus}
              onChangeText={setGrammarFocus}
              placeholder="Leave empty to read it from each sheet"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Grammar focus"
              style={inputStyle}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Button
          label={pages.length > 0 ? `Read and mark ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : 'Read and mark'}
          disabled={pages.length === 0 || !chosenClass || uploaded !== null}
          onPress={start}
        />
        {pages.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Uses {pages.length} photo readings and up to {pages.length} {ielts ? 'IELTS markings' : 'feedback checks'}.
          </ThemedText>
        )}
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <Button label="Back" variant="secondary" onPress={() => router.replace('/class-sets')} />
      </View>

      <BusyOverlay
        visible={uploaded !== null}
        title={`Uploading page ${Math.min((uploaded ?? 0) + 1, pages.length)} of ${pages.length}…`}
        detail="Then each page is read and marked."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  opening: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  drop: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    flexBasis: 140,
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
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  centered: {
    textAlign: 'center',
  },
});

/** Teachers only (see TeacherOnly). */
export default function NewClassSetRoute() {
  return (
    <TeacherOnly>
      <NewClassSetRouteScreen />
    </TeacherOnly>
  );
}
