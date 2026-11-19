import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { GrammarHint } from '@/components/grammar-card';
import { LiveTimer } from '@/components/live-timer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { findWeek } from '@/data/weeks';
import { useNow } from '@/hooks/use-now';
import { useQuestions, useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/hooks/use-theme';
import {
  questionForRound,
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
  const theme = useTheme();
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
  const question = questionForRound(session, questions, level);
  const plan = findWeek(weeks, level, session.week);

  return (
    <Screen>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.centered}>
        {roundTitle}
      </ThemedText>

      <View style={[styles.partnerCard, { backgroundColor: theme.hero }]}>
        <Text style={[styles.bigLabel, { color: theme.onHeroMuted }]}>
          {partners.length > 1 ? 'TALK WITH YOUR PARTNERS' : 'TALK WITH YOUR PARTNER'}
        </Text>
        <Text style={[styles.partnerName, { color: theme.onHero }]}>
          {partners.length > 0 ? partners.map((p) => p.name).join(' & ') : 'No partner this round'}
        </Text>
      </View>

      <View style={[styles.questionCard, { backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.bigLabel, { color: theme.grammarLabel }]}>THE QUESTION</Text>
        <Text style={[styles.questionText, { color: theme.grammarText }]}>
          {question ? question.text : 'There are no questions at this level yet.'}
        </Text>
      </View>

      <LiveTimer session={session} now={now} compact />

      {plan && <GrammarHint week={plan} />}

      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
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
  centered: {
    textAlign: 'center',
  },
  partnerCard: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  questionCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  bigLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
    letterSpacing: 1.5,
  },
  partnerName: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 800,
    textAlign: 'center',
  },
  questionText: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: 700,
  },

});
