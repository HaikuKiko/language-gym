import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { friendlyConnectionMessage } from '@/core/app/connection';
import { useLiveSession } from '@/core/live/use-live-session';
import { LiveHostScreen } from '@/screens/live-host-screen';
import { LiveStudentScreen } from '@/screens/live-student-screen';
import { WordGameHostScreen } from '@/screens/word-game-host-screen';
import { WordGameStudentScreen } from '@/screens/word-game-student-screen';
import { wordGameKind } from '@/lib/word-game';
import { quizOf } from '@/lib/grammar-quiz';
import { QuizHostScreen } from '@/screens/quiz-host-screen';
import { QuizStudentScreen } from '@/screens/quiz-student-screen';

/** A phone session: shows the host's controls or the student's view. */
export default function LiveSessionRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { state, applySession, applyParticipants, retry } = useLiveSession(code);

  if (state.status === 'loading') {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Connecting…</ThemedText>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Can&apos;t open this session</ThemedText>
          <ThemedText themeColor="textSecondary">{friendlyConnectionMessage(state.message)}</ThemedText>
        </View>
        <Button label="Try again" onPress={retry} />
        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/join/[code]', params: { code: String(code) } })}
        />
      </Screen>
    );
  }

  const { session, participants, userId } = state;
  const game = wordGameKind(session);
  const quiz = quizOf(session);

  if (session.host_id === userId && quiz) {
    return (
      <QuizHostScreen
        session={session}
        participants={participants}
        onSession={applySession}
        onParticipants={applyParticipants}
      />
    );
  }

  if (session.host_id === userId && game) {
    return (
      <WordGameHostScreen
        kind={game}
        session={session}
        participants={participants}
        onSession={applySession}
        onParticipants={applyParticipants}
      />
    );
  }

  if (session.host_id === userId) {
    return (
      <LiveHostScreen
        session={session}
        participants={participants}
        onSession={applySession}
        onParticipants={applyParticipants}
      />
    );
  }

  const me = participants.find((p) => p.user_id === userId);

  if (!me) {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">You&apos;re not in this session</ThemedText>
          <ThemedText themeColor="textSecondary">
            Enter your name to join.
          </ThemedText>
        </View>
        <Button
          label="Join this session"
          onPress={() => router.replace({ pathname: '/join/[code]', params: { code: session.code } })}
        />
      </Screen>
    );
  }

  if (quiz) return <QuizStudentScreen session={session} participants={participants} me={me} />;
  if (game) return <WordGameStudentScreen kind={game} session={session} participants={participants} me={me} />;

  return <LiveStudentScreen session={session} participants={participants} me={me} />;
}

const styles = StyleSheet.create({
  message: {
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
});
