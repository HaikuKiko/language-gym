import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { GrammarHint } from '@/components/grammar-card';
import { LiveTimer } from '@/components/live-timer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { findWeek } from '@/data/weeks';
import { useNow } from '@/hooks/use-now';
import { useFunQuestions, useQuestions, useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/hooks/use-theme';
import {
  findingStatus,
  isFriending,
  markFound,
  questionForRound,
  questionForStudent,
  removeParticipant,
  type LiveParticipant,
  type LiveSession,
} from '@/lib/live-session';
import { groupsForRound } from '@/lib/round-robin';
import { errorMessage } from '@/lib/supabase';

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
  const funQuestions = useFunQuestions();
  const friending = isFriending(session);
  const weeks = useWeeks();
  // The teacher sets one level for everyone.
  const level = session.level;
  // The round this phone tapped "We found each other!", shown straight away
  // while the change reaches the other phones.
  const [tappedRound, setTappedRound] = useState<number | null>(null);
  const [tapError, setTapError] = useState<string | null>(null);

  async function found() {
    const round = session.round;
    setTappedRound(round);
    setTapError(null);
    try {
      await markFound(me.id, round);
    } catch (e) {
      setTappedRound(null);
      setTapError(errorMessage(e));
    }
  }

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
        {session.stage === 'discussion' && <LiveTimer session={session} now={now} />}
      </Screen>
    );
  }

  const partners = groups[groupIndex].filter((p) => p.id !== me.id);
  const partnerNames = partners.map((p) => p.name).join(' & ');
  const question = friending
    ? questionForStudent(session, funQuestions, me.id)
    : questionForRound(session, questions, level);
  const plan = findWeek(weeks, level, session.week);

  // ---- First: find your partner (no question yet) ---------------------------
  if (session.stage === 'changeover') {
    const status = findingStatus(session, participants);
    const weFound = (status.groups[groupIndex]?.found ?? false) || tappedRound === session.round;

    if (partners.length === 0) {
      return (
        <Screen>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.centered}>
            {roundTitle}
          </ThemedText>
          <View style={styles.message}>
            <ThemedText type="subtitle">No partner this round</ThemedText>
            <ThemedText themeColor="textSecondary">You&apos;ll get a partner in the next round.</ThemedText>
          </View>
        </Screen>
      );
    }

    return (
      <Screen>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.centered}>
          {roundTitle}
        </ThemedText>

        <View style={[styles.partnerCard, styles.findCard, { backgroundColor: theme.hero }]}>
          <Text style={[styles.bigLabel, { color: theme.onHeroMuted }]}>
            {weFound
              ? partners.length > 1
                ? 'YOUR PARTNERS'
                : 'YOUR PARTNER'
              : partners.length > 1
                ? 'FIND YOUR PARTNERS'
                : 'FIND YOUR PARTNER'}
          </Text>
          <Text style={[styles.partnerName, styles.findName, { color: theme.onHero }]}>{partnerNames}</Text>
        </View>

        {weFound ? (
          <>
            <View style={[styles.doneBox, { backgroundColor: theme.successSoft }]}>
              <Text style={[styles.doneText, { color: theme.successText }]}>✓ You found each other</Text>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              Waiting for the others to find their partners…
            </ThemedText>
            <ThemedText type="smallBold" style={styles.centered}>
              {status.ready} of {status.total} {status.total === 1 ? 'pair' : 'pairs'} ready
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Say hello while you wait!
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="subtitle" style={styles.centered}>
              Found {partnerNames}? Tap the button
            </ThemedText>
            <Text style={[styles.arrow, { color: theme.success }]}>↓</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="We found each other!"
              onPress={found}
              style={({ pressed }) => [
                styles.foundButton,
                { backgroundColor: theme.success, borderColor: theme.successText },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.foundButtonText, { color: theme.onSuccess }]}>👋 We found each other!</Text>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Only one of you needs to tap.
            </ThemedText>
            {tapError && (
              <ThemedText type="small" themeColor="warning" style={styles.centered}>
                {tapError}
              </ThemedText>
            )}
          </>
        )}
      </Screen>
    );
  }

  // ---- Then: the question ------------------------------------------------------

  return (
    <Screen>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.centered}>
        {roundTitle}
      </ThemedText>

      <View style={[styles.partnerCard, { backgroundColor: theme.hero }]}>
        <Text style={[styles.bigLabel, { color: theme.onHeroMuted }]}>TALK WITH</Text>
        <Text style={[styles.partnerName, { color: theme.onHero }]}>
          {partners.length > 0 ? partnerNames : 'No partner this round'}
        </Text>
      </View>

      <View style={[styles.questionCard, { backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.bigLabel, { color: theme.grammarLabel }]}>
          {friending && partners.length > 0 ? `YOUR QUESTION: ASK ${partnerNames.toUpperCase()}` : 'TALK ABOUT'}
        </Text>
        <Text style={[styles.questionText, { color: theme.grammarText }]}>
          {question ? question.text : 'There are no questions at this level yet.'}
        </Text>
      </View>

      {friending && partners.length > 0 && (
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          {partners.length > 1
            ? `${partnerNames} have different questions for you. Take turns.`
            : `${partnerNames} has a different question for you. Take turns.`}
        </ThemedText>
      )}

      <LiveTimer session={session} now={now} compact />

      {plan && !friending && <GrammarHint week={plan} />}

      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {friending
          ? `Speed friending${plan ? ` · ${plan.topic}` : ''}`
          : `${level}${session.week != null ? ` · Week ${session.week}` : ''}${plan ? `: ${plan.topic}` : ''}`}
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
  findCard: {
    paddingVertical: Spacing.five,
  },
  findName: {
    fontSize: 48,
    lineHeight: 56,
  },
  doneBox: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 18,
    fontWeight: 700,
  },
  foundButton: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    alignItems: 'center',
    borderBottomWidth: 6,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
  },
  arrow: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: 800,
    textAlign: 'center',
  },
  foundButtonText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ translateY: 3 }],
  },

});
