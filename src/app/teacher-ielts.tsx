import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BusyOverlay } from '@/components/busy-overlay';
import { Button } from '@/components/button';
import { IeltsFeedbackView } from '@/components/ielts-feedback';
import { MarkedTextInput } from '@/components/marked-text-input';
import { PhotoNote } from '@/components/photo-note';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  IELTS_HARD_MIN_WORDS,
  IELTS_MAX_WORDS,
  IELTS_MIN_WORDS,
  requestTeacherIeltsFeedback,
  type IeltsResponse,
} from '@/lib/ielts';
import { pickPhoto } from '@/lib/photo';
import { errorMessage, supabase } from '@/lib/supabase';
import {
  UNREADABLE_MARK,
  anchorsFrom,
  guessAnchorsFrom,
  countWords,
  markCorrections,
  readPhoto,
  type MistakeAnchor,
  type PhotoReading,
} from '@/lib/writing';

/**
 * Teachers mark any IELTS Writing Task 2 essay: type or paste the question
 * (or leave it empty and it is worked out from the essay), type or scan the
 * essay, and get the same band scores students see.
 */
export default function TeacherIeltsRoute() {
  const theme = useTheme();
  const [question, setQuestion] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<'question' | 'essay' | null>(null);
  const [photo, setPhoto] = useState<PhotoReading | null>(null);
  const [guesses, setGuesses] = useState<{ anchors: MistakeAnchor[]; length: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown after every 5 photos or essays, so teachers can keep track.
  const [usage, setUsage] = useState<string | null>(null);
  const [result, setResult] = useState<IeltsResponse | null>(null);
  const [marks, setMarks] = useState<{ anchors: MistakeAnchor[]; length: number } | null>(null);

  const words = countWords(text);
  const unreadable = text.split(UNREADABLE_MARK).length - 1;
  const problem =
    supabase === null
      ? 'Marking is not set up yet.'
      : unreadable > 0
        ? `Replace the ${unreadable === 1 ? '[?] mark' : `${unreadable} [?] marks`} with the words on the paper.`
        : words < IELTS_HARD_MIN_WORDS
          ? `Add the essay (at least ${IELTS_HARD_MIN_WORDS} words).`
          : words > IELTS_MAX_WORDS
            ? `The essay is too long: ${IELTS_MAX_WORDS} words at most (${words} now).`
            : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await requestTeacherIeltsFeedback(question, text);
      if (response.usedToday && response.usedToday % 5 === 0) {
        setUsage(
          `You have marked ${response.usedToday} essays today (the limit is ${response.usedToday + response.remainingToday}).`,
        );
      }
      setResult(response);
      setMarks({
        anchors: anchorsFrom(markCorrections(text, response.feedback.corrections)),
        length: text.length,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  async function scan(target: 'question' | 'essay', source: 'camera' | 'library') {
    setError(null);
    try {
      const image = await pickPhoto(source);
      if (!image) return;
      setReading(target);
      const read = await readPhoto(image, { teacher: true });
      if (read.usedToday && read.usedToday % 5 === 0) {
        setUsage(`You have read ${read.usedToday} photos today.`);
      }
      if (!read.containsWriting || !read.transcript.trim()) {
        setError('We could not find any writing in that photo. Please try another one.');
      } else if (target === 'question') {
        setQuestion(read.transcript);
      } else {
        setText(read.transcript);
        setPhoto(
          read.fromCache
            ? { ...read, note: `Same photo as last time, so we used the earlier reading (no wait). ${read.note}` }
            : read,
        );
        setGuesses({
          anchors: guessAnchorsFrom(read.transcript, read.guessedWords),
          length: read.transcript.length,
        });
        setMarks(null);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setReading(null);
  }

  if (result) {
    return (
      <IeltsFeedbackView
        response={result}
        text={text}
        subtitle={question.trim() ? 'Teacher marking' : 'Teacher marking · question worked out from the essay'}
        improveLabel="Back to the essay"
        onImprove={() => setResult(null)}
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
          label={reading === 'question' ? 'Reading the question…' : 'Scan the question'}
          variant="secondary"
          disabled={reading !== null || busy}
          onPress={() => scan('question', 'library')}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <ThemedText type="smallBold">The essay</ThemedText>
          <ThemedText type="small" style={{ color: words > 0 && words < IELTS_MIN_WORDS ? theme.warning : theme.textSecondary }}>
            {words} words{words > 0 && words < IELTS_MIN_WORDS ? ` (under ${IELTS_MIN_WORDS})` : ''}
          </ThemedText>
        </View>
        <View style={styles.photoButtons}>
          <Button
            label={reading === 'essay' ? 'Reading the photo…' : 'Take a photo'}
            variant="secondary"
            disabled={reading !== null || busy}
            onPress={() => scan('essay', 'camera')}
            style={styles.photoButton}
          />
          <Button
            label="Choose a photo"
            variant="secondary"
            disabled={reading !== null || busy}
            onPress={() => scan('essay', 'library')}
            style={styles.photoButton}
          />
        </View>
        {photo && <PhotoNote photo={photo} />}
        <MarkedTextInput
          value={text}
          onChangeText={setText}
          placeholder="Type or paste the essay, or scan the handwriting…"
          accessibilityLabel="The essay"
          anchors={marks?.anchors ?? []}
          originalLength={marks?.length ?? text.length}
          guesses={guesses}
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
          Marked by an AI (Claude) as a guide, not an official IELTS result. The essay is not saved.
        </ThemedText>
        <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
      </View>
      <BusyOverlay
        visible={reading !== null}
        title={reading === 'question' ? 'Reading the question…' : 'Reading the handwriting…'}
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
  photoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoButton: {
    flexGrow: 1,
    flexBasis: 140,
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
