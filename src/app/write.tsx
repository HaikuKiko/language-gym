import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Bullet, CorrectionNotes, MarkedWriting, ParagraphNote, Section } from '@/components/feedback-parts';
import { MarkedTextInput } from '@/components/marked-text-input';
import { PhotoNote } from '@/components/photo-note';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LEVELS, type Level } from '@/data/questions';
import { WEEKS_PER_LEVEL, findWeek } from '@/data/weeks';
import { useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/hooks/use-theme';
import { pickPhoto } from '@/lib/photo';
import { errorMessage, supabase } from '@/lib/supabase';
import {
  MAX_WORDS,
  MIN_WORDS,
  UNREADABLE_MARK,
  anchorsFrom,
  countWords,
  markCorrections,
  readPhoto,
  requestFeedback,
  type MistakeAnchor,
  type PhotoReading,
  type WritingResponse,
} from '@/lib/writing';

/** A plain-English line under each area's name, for lower levels. */
const CRITERION_HINTS: Record<string, string> = {
  Content: 'Did you answer the task?',
  'Communicative achievement': 'Is it right for the reader?',
  Organisation: 'Order, paragraphs and linking words',
  Language: 'Grammar and words',
};

/** Students write something and get a level estimate and feedback. */
export default function WriteRoute() {
  const theme = useTheme();
  const weeks = useWeeks();
  const [level, setLevel] = useState<Level>('A1');
  const [week, setWeek] = useState<number | null>(null);
  const [task, setTask] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WritingResponse | null>(null);
  const [reading, setReading] = useState(false);
  const [photo, setPhoto] = useState<PhotoReading | null>(null);
  // Mistakes from the last feedback, underlined while the student edits.
  const [marks, setMarks] = useState<{ anchors: MistakeAnchor[]; length: number } | null>(null);

  const words = countWords(text);
  const plan = findWeek(weeks, level, week);
  const inputStyle = { color: theme.text, backgroundColor: theme.backgroundElement };
  const unreadable = text.split(UNREADABLE_MARK).length - 1;
  const problem =
    supabase === null
      ? 'Writing feedback is not set up yet.'
      : unreadable > 0
        ? `Replace the ${unreadable === 1 ? '[?] mark' : `${unreadable} [?] marks`} with the words you wrote.`
        : words < MIN_WORDS
        ? `Write at least ${MIN_WORDS} words (${words} so far).`
        : words > MAX_WORDS
          ? `Please shorten it to ${MAX_WORDS} words or fewer (${words} now).`
          : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await requestFeedback({ text, level, task, week });
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

  async function scan(source: 'camera' | 'library') {
    setError(null);
    try {
      const image = await pickPhoto(source);
      if (!image) return;
      setReading(true);
      const reading = await readPhoto(image);
      if (!reading.containsWriting || !reading.transcript.trim()) {
        setError('We could not find any writing in that photo. Please try another one.');
      } else {
        setText(reading.transcript);
        setPhoto(reading);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setReading(false);
  }

  if (result) {
    return (
      <FeedbackView
        response={result}
        text={text}
        onAgain={() => {
          setResult(null);
          setText('');
          setPhoto(null);
          setMarks(null);
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
        <View style={styles.photoButtons}>
          <Button
            label={reading ? 'Reading your photo…' : 'Take a photo'}
            variant="secondary"
            disabled={reading || busy || supabase === null}
            onPress={() => scan('camera')}
            style={styles.photoButton}
          />
          <Button
            label="Choose a photo"
            variant="secondary"
            disabled={reading || busy || supabase === null}
            onPress={() => scan('library')}
            style={styles.photoButton}
          />
        </View>
        {photo && <PhotoNote photo={photo} />}
        <MarkedTextInput
          value={text}
          onChangeText={setText}
          placeholder="Start writing here, or take a photo of your writing…"
          accessibilityLabel="Your writing"
          anchors={marks?.anchors ?? []}
          originalLength={marks?.length ?? text.length}
        />
        {marks && marks.anchors.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Orange lines show the mistakes from your feedback. They go away when you change those
            words.
          </ThemedText>
        )}
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
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Your writing and photos are checked by an AI (Claude) and are not saved. The feedback
          may contain mistakes; ask your teacher if something is unclear.
        </ThemedText>
        <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

function FeedbackView({
  response,
  text,
  onAgain,
  onEdit,
}: {
  response: WritingResponse;
  /** The writing the feedback is about, shown exactly as the student wrote it. */
  text: string;
  onAgain: () => void;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const f = response.feedback;
  const marked = markCorrections(text, f.corrections, f.paragraphing?.new_paragraph_before);

  return (
    <Screen>
      <View style={[styles.levelCard, { backgroundColor: theme.hero }]}>
        <ThemedText type="smallBold" style={[styles.levelLabel, { color: theme.onHeroMuted }]}>
          ESTIMATED LEVEL
        </ThemedText>
        <ThemedText style={[styles.levelValue, { color: theme.onHero }]}>{f.cefr_level}</ThemedText>
        <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
          {f.confidence === 'high'
            ? 'Clear evidence'
            : f.confidence === 'medium'
              ? 'Good evidence'
              : 'Only a rough estimate: write a bit more for a better one'}
        </ThemedText>
        <ThemedText style={[styles.levelReason, { color: theme.onHero }]}>
          {f.level_explanation}
        </ThemedText>
      </View>

      {f.criteria.length > 0 && (
        <Section title="Your level in each area">
          <View style={styles.criteriaGrid}>
            {f.criteria.map((c, i) => (
              <ThemedView key={i} type="backgroundElement" style={styles.criterionTile}>
                <View style={styles.criterionHeader}>
                  <ThemedText type="smallBold" style={styles.criterionName}>
                    {c.criterion}
                  </ThemedText>
                  <Pill label={c.level} tone="accent" />
                </View>
                {CRITERION_HINTS[c.criterion] ? (
                  <ThemedText type="small" style={{ color: theme.grammarLabel }}>
                    {CRITERION_HINTS[c.criterion]}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {c.comment}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </Section>
      )}

      <ThemedText style={styles.summary}>{f.summary}</ThemedText>

      {f.strengths.length > 0 && (
        <Section title="What you did well">
          {f.strengths.map((s, i) => (
            <Bullet key={i} text={s} />
          ))}
        </Section>
      )}

      <MarkedWriting marked={marked} />

      <CorrectionNotes marked={marked} />

      {f.paragraphing?.comment ? <ParagraphNote comment={f.paragraphing.comment} /> : null}

      {f.focus_grammar && (
        <View style={[styles.focus, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.grammarLabel }}>
            THIS WEEK&apos;S GRAMMAR
          </ThemedText>
          <ThemedText style={{ color: theme.grammarText }}>{f.focus_grammar.comment}</ThemedText>
          {f.focus_grammar.used_well.map((s, i) => (
            <Bullet key={`w${i}`} text={`✓ ${s}`} />
          ))}
          {f.focus_grammar.to_improve.map((s, i) => (
            <Bullet key={`i${i}`} text={`→ ${s}`} />
          ))}
        </View>
      )}

      {f.next_steps.length > 0 && (
        <Section title="What to practise next">
          {f.next_steps.map((s, i) => (
            <Bullet key={i} text={s} />
          ))}
        </Section>
      )}

      <View style={styles.section}>
        <Button label="Try again: fix it yourself" onPress={onEdit} />
        <Button label="Write something new" variant="secondary" onPress={onAgain} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {response.remainingToday === 1
            ? '1 feedback check left today.'
            : `${response.remainingToday} feedback checks left today.`}
        </ThemedText>
      </View>
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
  levelCard: {
    padding: Spacing.four,
    borderRadius: 28,
    gap: Spacing.one,
    alignItems: 'center',
  },
  levelLabel: {
    letterSpacing: 1.5,
  },
  levelValue: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: 800,
  },
  levelReason: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  summary: {
    fontSize: 18,
    lineHeight: 26,
  },
  focus: {
    padding: Spacing.four - 4,
    borderRadius: Spacing.four - 4,
    gap: Spacing.two,
  },
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  criterionTile: {
    flexGrow: 1,
    flexBasis: 160,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  criterionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  criterionName: {
    flexShrink: 1,
    minWidth: 0,
  },
});
