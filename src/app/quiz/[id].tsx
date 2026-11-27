import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ConfirmButton } from '@/core/ui/confirm-button';
import { ErrorNote } from '@/core/ui/notice';
import { Pill } from '@/core/ui/pill';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { TeacherOnly } from '@/core/app/teacher-only';
import { ClassPicker } from '@/core/classes/class-picker';
import { useClasses } from '@/core/classes/classes';
import { errorMessage } from '@/core/app/supabase';
import { Leaderboard } from '@/core/live/leaderboard';
import { DEFAULT_QUESTION_SECONDS, QUESTION_KIND_LABELS, QUESTION_SECONDS } from '@/core/live/quiz';
import { ANSWER_COLORS, ANSWER_LETTERS } from '@/core/live/quiz-view';
import { fetchLeaderboard, type LeaderboardEntry } from '@/core/live/scores';
import {
  QUIZ_ACTIVITY,
  createQuizSession,
  deleteQuestion,
  deleteQuizSet,
  fetchQuestions,
  fetchQuizSet,
  remakeQuestion,
  setQuizSetClass,
  sortLevels,
  updateQuestion,
  type QuizSet,
  type SavedQuestion,
} from '@/lib/grammar-quiz';

/** One week of quizzes: check and change the questions, play a quiz, and the week's leaderboard. */
function QuizSetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classes = useClasses();
  const [set, setSet] = useState<QuizSet | null>(null);
  const [questions, setQuestions] = useState<SavedQuestion[] | null>(null);
  const [quiz, setQuiz] = useState(1);
  const [seconds, setSeconds] = useState<number>(DEFAULT_QUESTION_SECONDS);
  const [week, setWeek] = useState<LeaderboardEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loadedSet, loadedQuestions] = await Promise.all([fetchQuizSet(String(id)), fetchQuestions(String(id))]);
      setSet(loadedSet);
      setQuestions(loadedQuestions);
      setWeek(await fetchLeaderboard(QUIZ_ACTIVITY, { board: String(id) }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!set || !questions) {
    return (
      <Screen>
        {error ? <ErrorNote message={error} /> : <ThemedText themeColor="textSecondary">Loading…</ThemedText>}
        <Button label="Back" variant="secondary" onPress={() => router.replace('/quiz')} />
      </Screen>
    );
  }

  const inQuiz = questions.filter((q) => q.quiz === quiz);
  const replace = (q: SavedQuestion) => setQuestions((list) => list?.map((o) => (o.id === q.id ? q : o)) ?? null);

  async function play() {
    if (!set) return;
    setBusy(true);
    setError(null);
    try {
      const session = await createQuizSession(set, quiz, seconds, inQuiz.length);
      router.push({ pathname: '/session/[code]', params: { code: session.code } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.section}>
        <ThemedText type="subtitle">{set.name}</ThemedText>
        <View style={styles.chips}>
          {sortLevels(set.levels).map((l) => (
            <Pill key={l} label={`${l}: ${set.grammar[l] || 'from the photo'}`} />
          ))}
        </View>
      </View>

      <ClassPicker
        classes={classes}
        value={set.class_id ?? null}
        onChange={async (classId) => {
          const before = set.class_id ?? null;
          setSet({ ...set, class_id: classId });
          try {
            await setQuizSetClass(set.id, classId);
          } catch (e) {
            setSet({ ...set, class_id: before });
            setError(errorMessage(e));
          }
        }}
        note="Points from these quizzes go on this class's leaderboard."
      />

      <View style={styles.chips}>
        {Array.from({ length: set.quiz_count }, (_, i) => i + 1).map((n) => (
          <Chip key={n} label={`Quiz ${n}`} selected={n === quiz} onPress={() => setQuiz(n)} />
        ))}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Seconds for each question</ThemedText>
        <View style={styles.chips}>
          {QUESTION_SECONDS.map((s) => (
            <Chip key={s} label={`${s} s`} selected={s === seconds} onPress={() => setSeconds(s)} />
          ))}
        </View>
        <Button
          label={busy ? 'Starting…' : `▶ Play Quiz ${quiz} (${inQuiz.length} questions)`}
          disabled={busy || inQuiz.length === 0}
          onPress={play}
        />
        <Button
          label="Try it first with pretend students"
          variant="secondary"
          disabled={inQuiz.length === 0}
          onPress={() =>
            router.push({
              pathname: '/demo',
              params: { quiz: set.id, number: String(quiz), seconds: String(seconds), students: '3' },
            })
          }
        />
        <ErrorNote message={error} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">
          Quiz {quiz}: check the questions
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tap ✏️ to change a question, 🔄 for a new one from Claude, or ✕ to remove it.
        </ThemedText>
        {inQuiz.map((q, i) => (
          <QuestionRow
            key={q.id}
            question={q}
            number={i + 1}
            onChanged={replace}
            onRemoved={() => setQuestions((list) => list?.filter((o) => o.id !== q.id) ?? null)}
          />
        ))}
      </View>

      {week && week.length > 0 && (
        <Leaderboard
          title="This week's leaderboard"
          rows={week.map((e) => ({
            key: e.name,
            name: e.name,
            points: e.points,
            note: `${e.games} ${e.games === 1 ? 'quiz' : 'quizzes'}`,
          }))}
        />
      )}

      <View style={styles.section}>
        <Button label="Back to all weeks" variant="secondary" onPress={() => router.replace('/quiz')} />
        <ConfirmButton
          label="Delete this week"
          title="Delete this week's quizzes?"
          detail="The questions are deleted. Scores already played stay on the leaderboard."
          yesLabel="Yes, delete"
          tone="danger"
          onConfirm={async () => {
            try {
              await deleteQuizSet(set.id);
              router.replace('/quiz');
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        />
      </View>
    </Screen>
  );
}

/** One question in the list: read it, change it, replace it or remove it. */
function QuestionRow({
  question,
  number,
  onChanged,
  onRemoved,
}: {
  question: SavedQuestion;
  number: number;
  onChanged: (q: SavedQuestion) => void;
  onRemoved: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }];

  if (editing) {
    const fixedOptions = draft.kind === 'right-wrong';
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">
          {number}. {QUESTION_KIND_LABELS[draft.kind]} ({draft.level})
        </ThemedText>
        <TextInput
          value={draft.prompt}
          onChangeText={(prompt) => setDraft({ ...draft, prompt })}
          multiline
          maxLength={300}
          accessibilityLabel="Question"
          style={inputStyle}
        />
        {draft.options.map((option, i) => (
          <View key={i} style={styles.optionRow}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: draft.answer === i }}
              accessibilityLabel={`Make ${ANSWER_LETTERS[i]} the right answer`}
              onPress={() => setDraft({ ...draft, answer: i })}
              style={[styles.letter, { backgroundColor: ANSWER_COLORS[i] }, draft.answer !== i && styles.faded]}>
              <Text style={styles.letterText}>{draft.answer === i ? '✓' : ANSWER_LETTERS[i]}</Text>
            </Pressable>
            <TextInput
              value={option}
              editable={!fixedOptions}
              onChangeText={(text) =>
                setDraft({ ...draft, options: draft.options.map((o, j) => (j === i ? text : o)) })
              }
              maxLength={60}
              accessibilityLabel={`Answer ${ANSWER_LETTERS[i]}`}
              style={[inputStyle, styles.fill]}
            />
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Tap a letter to make it the right answer.
        </ThemedText>
        <TextInput
          value={draft.why}
          onChangeText={(why) => setDraft({ ...draft, why })}
          placeholder="Why (one short line)"
          placeholderTextColor={theme.textSecondary}
          maxLength={200}
          accessibilityLabel="Why"
          style={inputStyle}
        />
        <View style={styles.chips}>
          <Button
            label={busy ? 'Saving…' : 'Save'}
            disabled={busy || !draft.prompt.trim() || draft.options.some((o) => !o.trim())}
            onPress={() =>
              run(async () => {
                const changes = {
                  prompt: draft.prompt.trim(),
                  options: draft.options.map((o) => o.trim()),
                  answer: draft.answer,
                  why: draft.why.trim(),
                };
                await updateQuestion(question.id, changes);
                onChanged({ ...question, ...changes });
                setEditing(false);
              })
            }
          />
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        </View>
        <ErrorNote message={error} />
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.headRow}>
        <ThemedText type="smallBold" style={styles.fill}>
          {number}. {QUESTION_KIND_LABELS[question.kind]}
        </ThemedText>
        <Pill label={question.level} tone="accent" />
      </View>
      <ThemedText>{question.prompt}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {question.options.map((o, i) => (i === question.answer ? `✓ ${o}` : o)).join('  ·  ')}
      </ThemedText>
      {question.why ? (
        <ThemedText type="small" themeColor="textSecondary">
          Why: {question.why}
        </ThemedText>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label="✏️ Change"
          onPress={busy ? undefined : () => {
            setDraft(question);
            setEditing(true);
          }}
        />
        <Chip
          label={busy ? 'Working…' : '🔄 New question'}
          onPress={busy ? undefined : () => run(async () => onChanged(await remakeQuestion(question.id)))}
        />
        <Chip
          label="✕ Remove"
          onPress={busy ? undefined : () => run(async () => {
            await deleteQuestion(question.id);
            onRemoved();
          })}
        />
      </View>
      <ErrorNote message={error} />
    </ThemedView>
  );
}

export default function QuizSetRoute() {
  return (
    <TeacherOnly>
      <QuizSetScreen />
    </TeacherOnly>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  card: { padding: Spacing.three, borderRadius: Spacing.four, gap: Spacing.two },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  fill: { flex: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  letter: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: '#fff', fontWeight: 800, fontSize: 16 },
  faded: { opacity: 0.4 },
  input: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    fontSize: 16,
  },
});
