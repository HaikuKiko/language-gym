import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { ErrorNote } from '@/core/ui/notice';
import { ProgressBar } from '@/core/ui/progress-bar';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { useNow } from '@/core/app/use-now';
import { errorMessage } from '@/core/app/supabase';
import { Leaderboard } from '@/core/live/leaderboard';
import { leaveSession } from '@/core/live/leave';
import { StudentLobby } from '@/core/live/lobby';
import {
  LEADERS_SHOWN,
  answerOf,
  placeOf,
  questionSeconds,
  quizScores,
  type QuizAnswer,
} from '@/core/live/quiz';
import { AnswerButtons, QuestionCard, WhyNote } from '@/core/live/quiz-view';
import { remainingMs, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { useQuizQuestions } from '@/hooks/use-quiz-questions';
import { useSessionBackend } from '@/lib/session-backend';

type Props = {
  session: LiveSession;
  participants: LiveParticipant[];
  me: LiveParticipant;
};

/** A student's phone in a live quiz. */
export function QuizStudentScreen({ session, participants, me }: Props) {
  const now = useNow();
  const theme = useTheme();
  const backend = useSessionBackend();
  const seconds = questionSeconds(session);
  const { questions, error: loadError, retry } = useQuizQuestions(session);
  // Answers from this phone, shown straight away while they reach the others.
  const [mine, setMine] = useState<Record<string, QuizAnswer>>({});
  const [late, setLate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When this phone first showed each question (the time taken counts from then).
  const shownAt = useRef(new Map<number, number>());

  const meNow: LiveParticipant = { ...me, quiz_answers: { ...(me.quiz_answers ?? {}), ...mine } };
  const withMine = participants.map((p) => (p.id === me.id ? meNow : p));
  const leave = () => leaveSession(backend, me, session);

  if (session.status === 'lobby') {
    return (
      <StudentLobby
        name={me.name}
        studentCount={participants.length}
        intro="We're playing a grammar quiz. Answer on your phone: the faster you get it right, the more points you get."
        leaveLabel="Leave the quiz"
        onLeave={leave}
      />
    );
  }

  if (!questions) {
    return (
      <Screen>
        {loadError ? (
          <>
            <ErrorNote message={`Couldn't load the questions: ${loadError}`} />
            <Button label="Try again" onPress={retry} />
          </>
        ) : (
          <ThemedText themeColor="textSecondary">Loading the quiz…</ThemedText>
        )}
      </Screen>
    );
  }

  const index = session.round;
  const scores = quizScores(questions, withMine, seconds, index + 1);
  const myScore = scores.find((s) => s.id === me.id);
  const place = placeOf(scores, me.id);

  if (session.status === 'finished') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Quiz over!</ThemedText>
          {myScore && (
            <ThemedText>
              You got {myScore.right} of {myScore.results.length} right: {myScore.points.toLocaleString()} points
              {place ? `, ${ordinal(place)} place` : ''}. Well done, {me.name}!
            </ThemedText>
          )}
        </View>
        <Leaderboard
          title="Top scores"
          limit={LEADERS_SHOWN}
          highlight={me.id}
          rows={scores.map((s) => ({ key: s.id, name: s.name, points: s.points }))}
        />
        <ThemedText type="small" themeColor="textSecondary">
          You can close this page.
        </ThemedText>
      </Screen>
    );
  }

  const question = questions[index];
  if (!question) return <Screen>{null}</Screen>;
  const myAnswer = answerOf(meNow, index);
  const open = session.stage === 'discussion';
  const left = open ? remainingMs(session, now) : 0;
  if (open && !shownAt.current.has(index)) shownAt.current.set(index, Date.now());

  async function pick(choice: number) {
    if (myAnswer) return;
    const ms = Date.now() - (shownAt.current.get(index) ?? Date.now());
    const answer = { c: choice, ms };
    setError(null);
    setMine((m) => ({ ...m, [String(index)]: answer }));
    try {
      const counted = await backend.answerQuiz(me.id, index, choice, ms);
      if (!counted) {
        setLate(index);
        setMine((m) => {
          const next = { ...m };
          delete next[String(index)];
          return next;
        });
      }
    } catch (e) {
      setMine((m) => {
        const next = { ...m };
        delete next[String(index)];
        return next;
      });
      setError(errorMessage(e));
    }
  }

  if (open) {
    return (
      <Screen>
        <View style={styles.clock}>
          <ProgressBar fraction={left / (seconds * 1000)} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {left > 0 ? `${Math.ceil(left / 1000)} s` : "Time's up"}
          </ThemedText>
        </View>
        <QuestionCard question={question} index={index} total={questions.length} />
        {myAnswer ? (
          <>
            <AnswerButtons options={question.options} picked={myAnswer.c} columns={1} />
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              Answer sent ✓ Waiting for the others…
            </ThemedText>
          </>
        ) : late === index || left <= 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            Time&apos;s up for this one. Get ready for the next!
          </ThemedText>
        ) : (
          <AnswerButtons options={question.options} onPick={pick} columns={1} />
        )}
        <ErrorNote message={error} />
      </Screen>
    );
  }

  // The answer is showing.
  const result = myScore?.results[index];
  const right = result?.right ?? false;
  return (
    <Screen>
      <ThemedView
        style={[
          styles.result,
          { backgroundColor: right ? theme.successSoft : theme.backgroundElement },
        ]}>
        <ThemedText type="subtitle" style={{ color: right ? theme.successText : theme.text }}>
          {right ? `✓ Right! +${result?.points.toLocaleString()}` : myAnswer ? '✗ Not this time' : '⏱ No answer'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {right && (result?.streak ?? 0) >= 2 ? `${result?.streak} in a row 🔥 · ` : ''}
          {myScore ? `${myScore.points.toLocaleString()} points` : ''}
          {place ? ` · ${ordinal(place)} place` : ''}
        </ThemedText>
      </ThemedView>
      <QuestionCard question={question} index={index} total={questions.length} />
      <AnswerButtons options={question.options} picked={myAnswer?.c ?? null} right={question.answer} columns={1} />
      <WhyNote why={question.why} />
    </Screen>
  );
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const styles = StyleSheet.create({
  message: { gap: Spacing.two, paddingVertical: Spacing.three },
  clock: { gap: Spacing.one, alignItems: 'center' },
  centered: { textAlign: 'center' },
  result: { padding: Spacing.three, borderRadius: Spacing.four, gap: Spacing.one, alignItems: 'center' },
});
