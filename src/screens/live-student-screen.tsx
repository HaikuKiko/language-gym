import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GrammarCard } from '@/components/grammar-card';
import { LiveTimer } from '@/components/live-timer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { findWeek } from '@/data/weeks';
import { useNow } from '@/hooks/use-now';
import { useQuestions, useWeeks } from '@/hooks/use-questions';
import {
  questionForGroup,
  removeParticipant,
  type LiveParticipant,
  type LiveSession,
} from '@/lib/live-session';
import { groupsForRound } from '@/lib/round-robin';

type LiveStudentScreenProps = {
  session: LiveSession;
  participants: LiveParticipant[];
  /** This student's own entry in the session. */
  me: LiveParticipant;
};

/** What a student sees on their own phone. */
export function LiveStudentScreen({ session, participants, me }: LiveStudentScreenProps) {
  const now = useNow();
  const questions = useQuestions();
  const weeks = useWeeks();
  // The teacher sets one level for everyone.
  const level = session.level;

  async function leave() {
    await removeParticipant(me.id).catch(() => {});
    router.replace('/');
  }

  if (session.status === 'finished') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Session complete</ThemedText>
          <ThemedText themeColor="textSecondary">Thanks for taking part, {me.name}.</ThemedText>
        </View>
        <Button label="Back to start" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (session.status === 'lobby') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">You&apos;re in, {me.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            Waiting for your teacher to start. {participants.length}{' '}
            {participants.length === 1 ? 'student has' : 'students have'} joined so far.
          </ThemedText>
        </View>
        <Button label="Leave session" variant="secondary" onPress={leave} />
      </Screen>
    );
  }

  const groups = groupsForRound(session.roster, session.round);
  const groupIndex = groups.findIndex((group) => group.some((p) => p.id === me.id));
  const roundTitle = `Round ${session.round + 1} of ${session.round_count}`;

  if (groupIndex === -1) {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">{roundTitle}</ThemedText>
          <ThemedText themeColor="textSecondary">
            This round has already started. You&apos;ll get a partner when the next round begins.
          </ThemedText>
        </View>
        <LiveTimer session={session} now={now} />
      </Screen>
    );
  }

  const partners = groups[groupIndex].filter((p) => p.id !== me.id);
  const question = questionForGroup(session, questions, level, groupIndex, groups.length);
  const plan = findWeek(weeks, level, session.week);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          {roundTitle} · {partners.length === 1 ? 'Your partner' : 'Your partners'}
        </ThemedText>
        <ThemedText type="subtitle">
          {partners.length > 0 ? partners.map((p) => p.name).join(' & ') : 'No partner this round'}
        </ThemedText>
      </View>

      <LiveTimer session={session} now={now} compact />

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          DISCUSS
        </ThemedText>
        <ThemedText style={styles.question}>
          {question ? question.text : 'There are no questions at this level yet.'}
        </ThemedText>
      </ThemedView>

      {plan && <GrammarCard week={plan} />}

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        {level}
        {session.week != null ? ` · Week ${session.week}` : ''}
        {plan ? `: ${plan.topic}` : ''}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  message: {
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  label: {
    letterSpacing: 1,
  },
  footer: {
    textAlign: 'center',
  },
  question: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 600,
  },
});
