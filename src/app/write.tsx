import { countWords } from '@/core/app/text';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BusyOverlay } from '@/core/ui/busy-overlay';
import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { Screen } from '@/core/ui/screen';
import { ErrorNote } from '@/core/ui/notice';
import { ThemedText } from '@/core/ui/themed-text';
import { WritingBox } from '@/core/marking/writing-box';
import { WritingFeedbackView } from '@/components/writing-feedback';
import { Spacing } from '@/core/ui/theme';
import { LEVELS, type Level } from '@/core/content/levels';
import { WEEKS_PER_LEVEL, findWeek } from '@/data/weeks';
import { useWeeks } from '@/hooks/use-questions';
import { useSavedState } from '@/core/app/use-saved-state';
import { useTheme } from '@/core/ui/use-theme';
import { useWritingDraft } from '@/core/marking/use-writing-draft';
import { errorMessage, supabase } from '@/core/app/supabase';
import { writingProblem } from '@/core/marking/photo-reading';
import { MAX_WORDS, MIN_WORDS, requestFeedback, type WritingResponse } from '@/lib/writing';



/** Students write something and get a level estimate and feedback. */
export default function WriteRoute() {
  const theme = useTheme();
  const weeks = useWeeks();
  const [level, setLevel] = useSavedState<Level>('write:level', 'A1');
  const [week, setWeek] = useSavedState<number | null>('write:week', null);
  const [task, setTask] = useSavedState('write:task', '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useSavedState<WritingResponse | null>('write:result', null);
  const draft = useWritingDraft('write', { onError: setError });
  const text = draft.text;

  const words = countWords(text);
  const plan = findWeek(weeks, level, week);
  const inputStyle = { color: theme.text, backgroundColor: theme.backgroundElement };
  const problem =
    supabase === null
      ? 'Writing feedback is not set up yet.'
      : writingProblem(text, { minWords: MIN_WORDS, maxWords: MAX_WORDS });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await requestFeedback({ text, level, task, week });
      setResult(response);
      draft.showMistakes(response.feedback.corrections);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  if (result) {
    return (
      <WritingFeedbackView
        response={result}
        text={text}
        onAgain={() => {
          setResult(null);
          draft.clear();
        }}
        onEdit={() => setResult(null)}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Writing practice</ThemedText>
        <ThemedText themeColor="textSecondary">
          Write something in English and get feedback on your level, your grammar and your
          vocabulary.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Your level</ThemedText>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} selected={l === level} onPress={() => setLevel(l)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Theme (optional)</ThemedText>
        <View style={styles.chips}>
          <Chip label="None" selected={week === null} onPress={() => setWeek(null)} />
          {Array.from({ length: WEEKS_PER_LEVEL }, (_, i) => i + 1).map((n) => (
            <Chip
              key={n}
              label={findWeek(weeks, level, n)?.topic ?? `Week ${n}`}
              accessibilityLabel={`Week ${n}: ${findWeek(weeks, level, n)?.topic ?? ''}`}
              selected={n === week}
              onPress={() => setWeek(n)}
            />
          ))}
        </View>
        {plan && (
          <ThemedText type="small" themeColor="textSecondary">
            {plan.topic}. The feedback will look at your use of: {plan.grammar}.
          </ThemedText>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">What are you writing? (optional)</ThemedText>
        <TextInput
          value={task}
          onChangeText={setTask}
          placeholder="For example: An email to a friend about your weekend"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Writing task"
          maxLength={300}
          style={[styles.input, inputStyle]}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <ThemedText type="smallBold">Your writing</ThemedText>
          <ThemedText type="small" themeColor={words > MAX_WORDS ? 'warning' : 'textSecondary'}>
            {words} / {MAX_WORDS} words
          </ThemedText>
        </View>
        <WritingBox
          draft={draft}
          disabled={busy || supabase === null}
          placeholder="Start writing here, or take a photo of your writing…"
          label="Your writing"
        />
      </View>

      <View style={styles.section}>
        <Button
          label={busy ? 'Reading your writing…' : 'Get feedback'}
          disabled={busy || problem !== null}
          onPress={submit}
        />
        {problem && !busy && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {problem}
          </ThemedText>
        )}
        <ErrorNote message={error} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Your writing and photos are checked by an AI (Claude) and are not saved. The feedback
          may contain mistakes; ask your teacher if something is unclear.
        </ThemedText>
        {/* Students arrive from a link: "Back" only goes back, never to the teacher page. */}
        {router.canGoBack() && <Button label="Back" variant="secondary" onPress={() => router.back()} />}
      </View>
      <BusyOverlay visible={draft.reading} title="Reading your handwriting…" detail="This usually takes 10 to 20 seconds." />
      <BusyOverlay visible={busy} title="Checking your writing…" detail="This usually takes 15 to 30 seconds." />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
  centered: {
    textAlign: 'center',
  },
});
