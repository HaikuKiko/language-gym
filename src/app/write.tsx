import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LEVELS, type Level } from '@/data/questions';
import { WEEKS_PER_LEVEL, findWeek } from '@/data/weeks';
import { useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, supabase } from '@/lib/supabase';
import {
  MAX_WORDS,
  MIN_WORDS,
  countWords,
  requestFeedback,
  type WritingResponse,
} from '@/lib/writing';

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

  const words = countWords(text);
  const plan = findWeek(weeks, level, week);
  const inputStyle = { color: theme.text, backgroundColor: theme.backgroundElement };
  const problem =
    supabase === null
      ? 'Writing feedback is not set up yet.'
      : words < MIN_WORDS
        ? `Write at least ${MIN_WORDS} words (${words} so far).`
        : words > MAX_WORDS
          ? `Please shorten it to ${MAX_WORDS} words or fewer (${words} now).`
          : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setResult(await requestFeedback({ text, level, task, week }));
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  if (result) {
    return (
      <FeedbackView
        response={result}
        onAgain={() => {
          setResult(null);
          setText('');
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
        <ThemedText type="smallBold">Week (optional)</ThemedText>
        <View style={styles.chips}>
          <Chip label="None" selected={week === null} onPress={() => setWeek(null)} />
          {Array.from({ length: WEEKS_PER_LEVEL }, (_, i) => i + 1).map((n) => (
            <Chip
              key={n}
              label={String(n)}
              accessibilityLabel={`Week ${n}`}
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
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Start writing here…"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Your writing"
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textArea, inputStyle]}
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
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Your writing is checked by an AI (Claude) and is not saved. The feedback may contain
          mistakes; ask your teacher if something is unclear.
        </ThemedText>
        <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

function FeedbackView({
  response,
  onAgain,
  onEdit,
}: {
  response: WritingResponse;
  onAgain: () => void;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const f = response.feedback;

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

      <ThemedText style={styles.summary}>{f.summary}</ThemedText>

      {f.strengths.length > 0 && (
        <Section title="What you did well">
          {f.strengths.map((s, i) => (
            <Bullet key={i} text={s} />
          ))}
        </Section>
      )}

      {f.corrections.length > 0 && (
        <Section title="Corrections">
          {f.corrections.map((c, i) => (
            <ThemedView key={i} type="backgroundElement" style={styles.correction}>
              <ThemedText style={[styles.original, { color: theme.markA }]}>{c.original}</ThemedText>
              <ThemedText style={[styles.corrected, { color: theme.markB }]}>→ {c.corrected}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {c.explanation}
              </ThemedText>
            </ThemedView>
          ))}
        </Section>
      )}

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

      {f.criteria.length > 0 && (
        <Section title="In detail">
          {f.criteria.map((c, i) => (
            <View key={i} style={styles.criterion}>
              <View style={styles.row}>
                <ThemedText type="smallBold">{c.criterion}</ThemedText>
                <Pill label={c.level} tone="accent" />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {c.comment}
              </ThemedText>
            </View>
          ))}
        </Section>
      )}

      {f.next_steps.length > 0 && (
        <Section title="What to practise next">
          {f.next_steps.map((s, i) => (
            <Bullet key={i} text={s} />
          ))}
        </Section>
      )}

      <View style={styles.section}>
        <Button label="Write something new" onPress={onAgain} />
        <Button label="Edit this writing" variant="secondary" onPress={onEdit} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {response.remainingToday === 1
            ? '1 feedback check left today.'
            : `${response.remainingToday} feedback checks left today.`}
        </ThemedText>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <ThemedText themeColor="textSecondary">•</ThemedText>
      <ThemedText style={styles.bulletText}>{text}</ThemedText>
    </View>
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
  textArea: {
    minHeight: 220,
    lineHeight: 24,
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
  correction: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  original: {
    textDecorationLine: 'line-through',
  },
  corrected: {
    fontWeight: 700,
  },
  focus: {
    padding: Spacing.four - 4,
    borderRadius: Spacing.four - 4,
    gap: Spacing.two,
  },
  criterion: {
    gap: Spacing.one,
  },
  bullet: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletText: {
    flexShrink: 1,
  },
});
