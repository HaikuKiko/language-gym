import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BusyOverlay } from '@/components/busy-overlay';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LEVELS, type Level } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { CAN_READ_PDF, MAX_CLASS_SET_PAGES, choosePdfPages, createClassSet } from '@/lib/class-sets';
import { pickPhotos, type PreparedPhoto } from '@/lib/photo';
import { errorMessage } from '@/lib/supabase';

/** Upload a scan (or photos) of a class's writing and choose the level for the feedback. */
export default function NewClassSetRoute() {
  const theme = useTheme();
  const [pages, setPages] = useState<PreparedPhoto[]>([]);
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState<Level>('A2');
  const [task, setTask] = useState('');
  const [grammarFocus, setGrammarFocus] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [uploaded, setUploaded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  async function choosePdf() {
    setError(null);
    setPreparing(true);
    try {
      const chosen = await choosePdfPages();
      if (chosen) {
        setPages(chosen.pages);
        setFileName(chosen.fileName);
        if (!title) setTitle(chosen.fileName.replace(/\.pdf$/i, ''));
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setPreparing(false);
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
    setError(null);
    setUploaded(0);
    try {
      const id = await createClassSet(
        { title, className, level, task, grammarFocus, fileName },
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
        <TextInput
          value={className}
          onChangeText={setClassName}
          placeholder="For example: 3A"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Class"
          style={inputStyle}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Level for the feedback</ThemedText>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} selected={l === level} onPress={() => setLevel(l)} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          The feedback is written so students at this level can read it.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Task (optional)</ThemedText>
        <TextInput
          value={task}
          onChangeText={setTask}
          placeholder="Leave empty to read it from each sheet"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Task"
          multiline
          style={[inputStyle, styles.multiline]}
        />
        <ThemedText type="smallBold">Grammar focus (optional)</ThemedText>
        <TextInput
          value={grammarFocus}
          onChangeText={setGrammarFocus}
          placeholder="Leave empty to read it from each sheet"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Grammar focus"
          style={inputStyle}
        />
      </View>

      <View style={styles.section}>
        <Button
          label={pages.length > 0 ? `Read and mark ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : 'Read and mark'}
          disabled={pages.length === 0 || uploaded !== null}
          onPress={start}
        />
        {pages.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Uses {pages.length} photo readings and {pages.length} feedback checks.
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
