import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { ErrorNote } from '@/core/ui/notice';
import { Pill } from '@/core/ui/pill';
import { ProgressBar } from '@/core/ui/progress-bar';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useNow } from '@/core/app/use-now';
import { errorMessage } from '@/core/app/supabase';
import { JoinCodeHero } from '@/core/live/join-code-hero';
import { LateJoinQr } from '@/core/live/late-join-qr';
import { Leaderboard } from '@/core/live/leaderboard';
import { LobbyButtons, StudentRoster } from '@/core/live/lobby';
import { useHostActions } from '@/core/live/use-host-actions';
import {
  LEADERS_SHOWN,
  answerCounts,
  answeredCount,
  hardestQuestions,
  isLastQuestion,
  openQuestion,
  questionSeconds,
  quizScores,
  showAnswer,
  type PlayerScore,
  type QuizQuestion,
} from '@/core/live/quiz';
import { AnswerBars, AnswerButtons, QuestionCard, WhyNote } from '@/core/live/quiz-view';
import { fetchLeaderboard, type LeaderboardEntry } from '@/core/live/scores';
import { endSession, formatCode, remainingMs, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { PretendStudentsPanel } from '@/components/pretend-students-panel';
import { useQuizQuestions } from '@/hooks/use-quiz-questions';
import { QUIZ_ACTIVITY, quizOf } from '@/lib/grammar-quiz';
import { isPretendName, usePretendStudents } from '@/lib/pretend-students';
import { sessionClassId } from '@/core/classes/classes';
import { useSessionBackend } from '@/lib/session-backend';

type Props = {
  session: LiveSession;
  participants: LiveParticipant[];
  onSession: (session: LiveSession) => void;
  onParticipants: (participants: LiveParticipant[]) => void;
};

/** A score's note on the board: right answers in a row. */
function streakNote(s: PlayerScore): string | undefined {
  return s.streak >= 2 ? `🔥 ${s.streak}` : undefined;
}

/** The teacher's screen (the board) for a live quiz. */
export function QuizHostScreen({ session, participants, onSession, onParticipants }: Props) {
  const now = useNow();
  const backend = useSessionBackend();
  const quiz = quizOf(session)!;
  const seconds = questionSeconds(session);
  const { questions, error: loadError, retry } = useQuizQuestions(session);
  const { save, remove, error, setError } = useHostActions({
    backend,
    session,
    participants,
    onSession,
    onParticipants,
  });
  const pretend = usePretendStudents(session, participants, questions ?? undefined);

  const index = session.round;
  const question = questions?.[index] ?? null;
  const open = session.status === 'playing' && session.stage === 'discussion';
  const left = open ? remainingMs(session, now) : 0;
  const answered = question ? answeredCount(participants, index) : 0;
  const everyoneAnswered = open && participants.length > 0 && answered >= participants.length;
  const timeUp = open && left <= 0;

  // The answer shows when the time is up or everyone has answered.
  const reveal = useEffectEvent(() => save(showAnswer(), true));
  useEffect(() => {
    if (timeUp || everyoneAnswered) reveal();
  }, [timeUp, everyoneAnswered]);

  async function start() {
    if (!questions || questions.length === 0) return;
    await save({ ...openQuestion(session, 0, Date.now()), round_count: questions.length });
  }

  const title = (
    <View style={styles.topBar}>
      <ThemedText type="smallBold">
        ❓ Grammar quiz {quiz.number}
      </ThemedText>
      <Pill
        label={session.status === 'playing' ? `Join code ${formatCode(session.code)}` : `${seconds} s a question`}
        tone="accent"
      />
    </View>
  );

  if (loadError || !questions) {
    return (
      <Screen>
        {title}
        {loadError ? (
          <>
            <ErrorNote message={`Couldn't load the questions: ${loadError}`} />
            <Button label="Try again" onPress={retry} />
          </>
        ) : (
          <ThemedText themeColor="textSecondary">Loading the questions…</ThemedText>
        )}
      </Screen>
    );
  }

  if (session.status === 'lobby') {
    const levels = [...new Set(questions.map((q) => q.level))].join(' + ');
    return (
      <Screen>
        {title}
        <JoinCodeHero code={session.code} demo={backend.demo} />
        <StudentRoster participants={participants} onRemove={remove} />
        {!backend.demo && (
          <PretendStudentsPanel
            doing="answer the questions"
            onAdd={pretend.add}
            busy={pretend.busy}
            error={pretend.error}
          />
        )}
        <View style={styles.chips}>
          <Pill label={`${questions.length} questions`} />
          <Pill label={levels} />
          <Pill label={`${seconds} seconds each`} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Everyone answers on their phone. Right answers get up to 1,000 points (faster = more), plus a bonus for
          several right in a row.
        </ThemedText>
        {questions.length === 0 && <ErrorNote message="This quiz has no questions. Add some on the quiz page." />}
        <LobbyButtons
          studentCount={questions.length === 0 ? 0 : participants.length}
          startLabel="Start the quiz"
          cancelLabel="Cancel quiz"
          onStart={start}
          onCancel={() => save(endSession())}
          error={error}
        />
      </Screen>
    );
  }

  if (session.status === 'finished') {
    return (
      <QuizResults
        title={title}
        session={session}
        questions={questions}
        participants={participants}
        seconds={seconds}
        setError={setError}
        error={error}
      />
    );
  }

  if (!question) return <Screen>{title}</Screen>;

  const scores = quizScores(questions, participants, seconds, index + 1);

  if (open) {
    return (
      <Screen>
        {title}
        <ThemedView type="backgroundElement" style={styles.card}>
          <QuestionCard question={question} index={index} total={questions.length} large />
          <AnswerButtons options={question.options} />
        </ThemedView>
        <View style={styles.clockRow}>
          <View style={styles.clock}>
            <ThemedText style={styles.seconds}>{Math.ceil(left / 1000)}</ThemedText>
            <ProgressBar fraction={left / (seconds * 1000)} />
            <ThemedText type="smallBold">
              {answered} of {participants.length} answered
            </ThemedText>
          </View>
          <LateJoinQr code={session.code} demo={backend.demo} />
        </View>
        <Button label="Show the answer now" variant="secondary" onPress={() => save(showAnswer(), true)} />
        <ErrorNote message={error} />
      </Screen>
    );
  }

  // The answer is showing.
  const last = isLastQuestion(session);
  return (
    <Screen>
      {title}
      <ThemedView type="backgroundElement" style={styles.card}>
        <QuestionCard question={question} index={index} total={questions.length} large />
        <AnswerBars
          options={question.options}
          counts={answerCounts(participants, index, question.options.length)}
          right={question.answer}
        />
      </ThemedView>
      <WhyNote why={question.why} />
      <View style={styles.clockRow}>
        <View style={styles.fill}>
          <Leaderboard
            title="Top scores"
            limit={LEADERS_SHOWN}
            rows={scores.map((s) => ({ key: s.id, name: s.name, points: s.points, note: streakNote(s) }))}
          />
        </View>
        <LateJoinQr code={session.code} demo={backend.demo} />
      </View>
      <Button
        label={last ? 'See the final results' : 'Next question'}
        onPress={() => save(last ? endSession() : openQuestion(session, index + 1, Date.now()), true)}
      />
      {!last && <Button label="End the quiz now" variant="secondary" onPress={() => save(endSession())} />}
      <ErrorNote message={error} />
    </Screen>
  );
}

/** The end: this quiz's ranking (saved for the leaderboard), the week's leaderboard, and the hardest questions. */
function QuizResults({
  title,
  session,
  questions,
  participants,
  seconds,
  error,
  setError,
}: {
  title: React.ReactNode;
  session: LiveSession;
  questions: QuizQuestion[];
  participants: LiveParticipant[];
  seconds: number;
  error: string | null;
  setError: (error: string | null) => void;
}) {
  const backend = useSessionBackend();
  const quiz = quizOf(session)!;
  const scores = quizScores(questions, participants, seconds, session.round + 1);
  const [week, setWeek] = useState<LeaderboardEntry[] | null>(null);
  const saved = useRef(false);

  // Saves everyone's points once (pretend students and demos are not saved), then loads the week.
  const saveAndLoad = useEffectEvent(async () => {
    if (saved.current) return;
    saved.current = true;
    if (backend.demo) return;
    try {
      await backend.saveScores(
        QUIZ_ACTIVITY,
        quiz.setId,
        session.id,
        scores
          .filter((s) => !isPretendName(s.name))
          .map((s) => ({
            name: s.name,
            points: s.points,
            details: { right: s.right, questions: s.results.length, quiz: quiz.number },
          })),
        sessionClassId(session),
      );
      setWeek(await fetchLeaderboard(QUIZ_ACTIVITY, { board: quiz.setId }));
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  useEffect(() => {
    saveAndLoad();
  }, []);

  const hardest = hardestQuestions(questions, participants).slice(0, 3);

  return (
    <Screen>
      {title}
      <ThemedText type="subtitle">Quiz over!</ThemedText>
      <Leaderboard
        title={`Quiz ${quiz.number}`}
        rows={scores.map((s) => ({
          key: s.id,
          name: s.name,
          points: s.points,
          note: `${s.right}/${s.results.length} right`,
        }))}
      />
      {week && week.length > 0 && (
        <Leaderboard
          title="This week's quizzes so far"
          rows={week.map((e) => ({
            key: e.name,
            name: e.name,
            points: e.points,
            note: `${e.games} ${e.games === 1 ? 'quiz' : 'quizzes'}`,
          }))}
        />
      )}
      {hardest.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">For the teacher: hardest questions</ThemedText>
          {hardest.map((h) => (
            <ThemedText key={h.index} type="small">
              {Math.round((h.right / h.answered) * 100)}% right · Q{h.index + 1} ({h.question.level}):{' '}
              {h.question.prompt} → {h.question.options[h.question.answer]}
            </ThemedText>
          ))}
        </ThemedView>
      )}
      <ErrorNote message={error} />
      {backend.demo ? (
        <Button
          label="Back to the quizzes"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace({ pathname: '/quiz/[id]', params: { id: quiz.setId } })
          }
        />
      ) : (
        <Button
          label="Back to this week's quizzes"
          onPress={() => router.replace({ pathname: '/quiz/[id]', params: { id: quiz.setId } })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.four, gap: Spacing.three },
  clockRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three },
  clock: { flex: 1, minWidth: 180, alignItems: 'center', gap: Spacing.two },
  seconds: { fontSize: 56, lineHeight: 64, fontWeight: 800, fontVariant: ['tabular-nums'] },
  fill: { flex: 1, minWidth: 220 },
});
