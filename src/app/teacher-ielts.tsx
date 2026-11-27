import { countWords } from '@/core/app/text';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BusyOverlay } from '@/core/ui/busy-overlay';
import { CalibrationCard } from '@/components/calibration-card';
import { ShareCalibrationCard } from '@/components/share-calibration-card';
import { Button } from '@/core/ui/button';
import { IeltsFeedbackView } from '@/components/ielts-feedback';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { WritingBox } from '@/components/writing-box';
import { Spacing } from '@/core/ui/theme';
import { useSavedState } from '@/core/app/use-saved-state';
import { useTheme } from '@/core/ui/use-theme';
import { useWritingDraft } from '@/hooks/use-writing-draft';
import { aiMarking, linkCalibration } from '@/lib/calibration';
import {
  IELTS_HARD_MIN_WORDS,
  IELTS_MAX_WORDS,
  IELTS_MIN_WORDS,
  requestTeacherIeltsFeedback,
  type IeltsResponse,
} from '@/lib/ielts';
import { pickPhoto } from '@/core/media/photo';
import { errorMessage, supabase } from '@/core/app/supabase';
import {
  guessesStillIn,
  joinLines,
  readPhoto,
  writingProblem,
  writtenLines,
  type PhotoReading,
} from '@/lib/writing';

/**
 * Teachers mark any IELTS Writing Task 2 essay: type or paste the question
 * (or leave it empty and it is worked out from the essay), type or scan the
 * essay, and get the same band scores students see.
 */
export default function TeacherIeltsRoute() {
  const theme = useTheme();
  const [question, setQuestion] = useSavedState('teacher-ielts:question', '');
  const [busy, setBusy] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown after every 5 photos or essays, so teachers can keep track.
  const [usage, setUsage] = useState<string | null>(null);
  const [result, setResult] = useSavedState<IeltsResponse | null>('teacher-ielts:result', null);
  // The link made with "Share results", and this teacher's own saved marks.
  const [sharedCode, setSharedCode] = useState<string | null>(null);
  const [myMarkId, setMyMarkId] = useState<number | null>(null);
  const draft = useWritingDraft('teacher-ielts', { teacher: true, lineByLine: true, onError: setError, onRead: noteUsage });
  const text = draft.text;
  const reading = readingQuestion || draft.reading;
  // Read from photos line by line: shown with line numbers, sent as running text.
  const lineByLine = draft.photo?.lineByLine === true;
  const guessed = guessesStillIn(text, draft.photo?.guessedWords ?? []);

  const words = countWords(text);
  const problem =
    supabase === null
      ? 'Marking is not set up yet.'
      : writingProblem(text, { minWords: IELTS_HARD_MIN_WORDS, maxWords: IELTS_MAX_WORDS, teacher: true });

  /** Every 5 photos, a reminder of how many have been read today. */
  function noteUsage(read: PhotoReading) {
    if (!read.fromCache && read.usedToday && read.usedToday % 5 === 0) {
      setUsage(`You have read ${read.usedToday} photos today.`);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await requestTeacherIeltsFeedback(question, lineByLine ? joinLines(text) : text, guessed);
      if (!response.cached && response.usedToday && response.usedToday % 5 === 0) {
        setUsage(
          `You have marked ${response.usedToday} essays today (the limit is ${response.usedToday + response.remainingToday}).`,
        );
      }
      setResult(response);
      setSharedCode(null);
      setMyMarkId(null);
      draft.showMistakes(response.feedback.corrections);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  /** Reads a photo of the question into the question box. */
  async function scanQuestion() {
    setError(null);
    try {
      const image = await pickPhoto('library');
      if (!image) return;
      setReadingQuestion(true);
      const read = await readPhoto([image], { teacher: true });
      noteUsage(read);
      if (!read.containsWriting || !read.transcript.trim()) {
        setError('We could not find any writing in that photo. Please try another one.');
      } else {
        setQuestion(read.transcript);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setReadingQuestion(false);
  }

  if (result) {
    return (
      <IeltsFeedbackView
        response={result}
        text={text}
        guessedWords={guessed}
        pageLines={lineByLine ? [writtenLines(text)] : undefined}
        subtitle={question.trim() ? 'Teacher marking' : 'Teacher marking · question worked out from the essay'}
        improveLabel="Back to the essay"
        onImprove={() => setResult(null)}
        extra={
          <>
            <CalibrationCard
              marking={aiMarking(result.feedback)}
              question={question}
              essay={text}
              sharedCode={sharedCode}
              onSaved={setMyMarkId}
            />
            <ShareCalibrationCard
              feedback={result.feedback}
              question={question}
              essay={text}
              photos={draft.pagePhotos}
              onShared={(code) => {
                setSharedCode(code);
                // Marks saved before sharing join the shared essay too.
                if (myMarkId !== null) linkCalibration(myMarkId, code);
              }}
            />
          </>
        }
      />
    );
  }

  const inputStyle = { color: theme.text, backgroundColor: theme.backgroundElement };

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">Mark an IELTS essay</ThemedText>
        <ThemedText themeColor="textSecondary">
          Writing Task 2 band scores for any essay and any question. No student account needed.
        </ThemedText>
      </View>

      {usage && (
        <View style={[styles.usage, { backgroundColor: theme.markABg }]}>
          <ThemedText type="smallBold">{usage}</ThemedText>
          <Button label="OK" variant="secondary" onPress={() => setUsage(null)} />
        </View>
      )}

      <View style={styles.section}>
        <ThemedText type="smallBold">The question (optional)</ThemedText>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          multiline
          placeholder="Type or paste the Task 2 question. Leave empty to work it out from the essay."
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="The question"
          textAlignVertical="top"
          maxLength={1500}
          style={[styles.question, inputStyle]}
        />
        <Button
          label={readingQuestion ? 'Reading the question…' : 'Scan the question'}
          variant="secondary"
          disabled={reading || busy}
          onPress={scanQuestion}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <ThemedText type="smallBold">The essay</ThemedText>
          <ThemedText type="small" style={{ color: words > 0 && words < IELTS_MIN_WORDS ? theme.warning : theme.textSecondary }}>
            {words} words{words > 0 && words < IELTS_MIN_WORDS ? ` (under ${IELTS_MIN_WORDS})` : ''}
          </ThemedText>
        </View>
        <WritingBox
          draft={draft}
          disabled={busy || readingQuestion}
          placeholder="Type or paste the essay, or scan the handwriting…"
          label="The essay"
        />
      </View>

      <View style={styles.section}>
        <Button
          label={busy ? 'Marking…' : 'Get band scores'}
          disabled={busy || problem !== null}
          onPress={submit}
        />
        {problem && !busy && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {problem}
          </ThemedText>
        )}
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Marked by an AI (Claude) as a guide, not an official IELTS result. The essay is only saved if you add your own marks.
        </ThemedText>
        <Button label="Calibration: AI compared with teachers" variant="secondary" onPress={() => router.push('/calibration')} />
        <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
      </View>
      <BusyOverlay
        visible={reading}
        title={readingQuestion ? 'Reading the question…' : 'Reading the handwriting…'}
        detail="This usually takes 10 to 20 seconds."
      />
      <BusyOverlay visible={busy} title="Marking the essay…" detail="This usually takes 20 to 40 seconds." />
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
  question: {
    minHeight: 96,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderRadius: Spacing.three,
    fontSize: 16,
    lineHeight: 24,
  },
  centered: {
    textAlign: 'center',
  },
  usage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
