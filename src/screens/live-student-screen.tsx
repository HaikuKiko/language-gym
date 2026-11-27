import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { GrammarHint } from '@/components/grammar-card';
import { LiveTimer } from '@/components/live-timer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { PRODUCT_NAME } from '@/constants/product';
import { Spacing } from '@/constants/theme';
import { findWeek } from '@/data/weeks';
import { useNow } from '@/hooks/use-now';
import { useCustomSets, useFunQuestions, useQuestions, useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/hooks/use-theme';
import {
  findingStatus,
  isFriending,
  isTakingTurns,
  questionForRound,
  customSetId,
  questionForStudent,
  turnFor,
  type LiveParticipant,
  type LiveSession,
} from '@/lib/live-session';
import { groupsForRound } from '@/lib/round-robin';
import { useSessionBackend } from '@/lib/session-backend';
import { errorMessage } from '@/lib/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** Taking turns: questions the asker can use to keep their partner talking. */
/** Shown when a question has no follow-ups of its own. */
const FOLLOW_UPS = ['Why?', 'What happened next?', 'How did you feel?', 'Can you give an example?', 'Tell me more about…'];
/** Taking turns: how long "Swap!" shows when the next turn starts. */
const SWAP_NOTICE_MS = 4000;
/**
 * Follow-up questions: always light with dark text, in dark mode too, so they
 * are easy to read on a phone in class. A tapped one ("asked") turns green.
 */
const FOLLOW_UP_COLOURS = {
  panel: '#FFF1E3',
  label: '#7A2E05',
  chip: '#FFFFFF',
  chipBorder: '#C2410C',
  chipText: '#5C2203',
  askedChip: '#1A8F52',
  askedText: '#FFFFFF',
  hint: '#5C4636',
};

// ===========================================================================

type LiveStudentScreenProps = {
  session: LiveSession;
  participants: LiveParticipant[];
  /** This student's own entry in the session. */
  me: LiveParticipant;
};

/** What a student sees on their own phone. */
export function LiveStudentScreen({ session, participants, me }: LiveStudentScreenProps) {
  const now = useNow();
  const backend = useSessionBackend();
  const theme = useTheme();
  const questions = useQuestions();
  const funQuestions = useFunQuestions();
  const customSets = useCustomSets();
  const custom = customSets.find((s) => s.id === customSetId(session)) ?? null;
  const friending = isFriending(session);
  const weeks = useWeeks();
  // The teacher sets one level for everyone.
  const level = session.level;
  // The round this phone tapped "We found each other!", shown straight away
  // while the change reaches the other phones.
  const [tappedRound, setTappedRound] = useState<number | null>(null);
  const [tapError, setTapError] = useState<string | null>(null);
  // Follow-ups this phone tapped as asked, shown straight away while saving.
  const [askedLocal, setAskedLocal] = useState<string[] | null>(null);
  const askedNow = askedLocal ?? me.asked_follow_ups ?? [];

  async function tapFollowUp(key: string) {
    const before = askedNow;
    setAskedLocal(before.includes(key) ? before.filter((k) => k !== key) : [...before, key]);
    try {
      await backend.toggleFollowUp({ ...me, asked_follow_ups: before }, key);
    } catch (e) {
      setAskedLocal(before);
      setTapError(errorMessage(e));
    }
  }

  async function found() {
    const round = session.round;
    setTappedRound(round);
    setTapError(null);
    try {
      await backend.markFound(me.id, round);
    } catch (e) {
      setTappedRound(null);
      setTapError(errorMessage(e));
    }
  }

  async function leave() {
    await backend.removeParticipant(me.id).catch(() => {});
    if (backend.demo) return;
    // Students only ever go back to the session's join page, never the teacher page.
    router.replace({ pathname: '/join/[code]', params: { code: session.code } });
  }

  if (session.status === 'finished') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Session complete</ThemedText>
          <ThemedText themeColor="textSecondary">
            Thanks for taking part, {me.name}! You can close this page.
          </ThemedText>
        </View>
        {friending && !backend.demo && (
          // The landing page (never the teachers' dashboard).
          <Pressable accessibilityRole="link" onPress={() => router.push('/')}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              Teacher or group leader? Run this with your own group →
            </ThemedText>
          </Pressable>
        )}
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
    ? questionForStudent(session, funQuestions, me.id, customSets)
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

  // Taking turns: one person talks while their partner asks, then they swap.
  const group = groups[groupIndex];
  if (friending && isTakingTurns(session) && group.length > 1) {
    const { turn, turns, turnMs, leftMs, sinceStartMs } = turnFor(session, group.length, now);
    const talker = group[turn];
    const asker = group[(turn + 1) % group.length];
    const role = talker.id === me.id ? 'talk' : asker.id === me.id ? 'ask' : 'listen';
    const askerQuestion = questionForStudent(session, funQuestions, asker.id, customSets);
    const running = session.ends_at !== null && leftMs > 0;
    const swapping = running && turn > 0 && sinceStartMs < SWAP_NOTICE_MS;
    const seconds = Math.ceil(leftMs / 1000);
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const turnWord = turns === 2 ? (turn === 0 ? 'First half' : 'Second half') : `Turn ${turn + 1} of ${turns}`;

    return (
      <Screen>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.centered}>
          {roundTitle} · {turnWord}
        </ThemedText>

        {swapping && (
          <View style={[styles.swap, { backgroundColor: theme.noticeBg }]}>
            <Text style={styles.swapText}>🔄 Swap!</Text>
          </View>
        )}

        <View style={[styles.partnerCard, { backgroundColor: role === 'talk' ? theme.success : theme.hero }]}>
          <Text style={[styles.bigLabel, { color: role === 'talk' ? theme.onSuccess : theme.onHeroMuted }]}>
            {role === 'talk'
              ? 'YOUR TURN TO TALK'
              : role === 'ask'
                ? `YOU ASK · ${talker.name.toUpperCase()} TALKS`
                : 'LISTEN: YOUR TURN COMES NEXT'}
          </Text>
          <Text style={[styles.partnerName, { color: role === 'talk' ? theme.onSuccess : theme.onHero }]}>
            {role === 'talk' ? `Talk to ${asker.name}` : role === 'ask' ? talker.name : `${talker.name} is talking`}
          </Text>
        </View>

        {/* Only the asker sees the question; the others listen for it. */}
        <View style={[styles.questionCard, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.bigLabel, { color: theme.grammarLabel }]}>
            {role === 'ask' ? `ASK ${talker.name.toUpperCase()}` : `LISTEN TO ${asker.name.toUpperCase()}'S QUESTION`}
          </Text>
          <Text style={[styles.questionText, { color: theme.grammarText }]}>
            {role === 'ask'
              ? askerQuestion
                ? askerQuestion.text
                : 'There are no questions at this level yet.'
              : role === 'talk'
                ? `${asker.name} will ask you a question. Listen, then answer.`
                : `${asker.name} is asking ${talker.name} a question. Listen to the answer.`}
          </Text>
        </View>

        {role === 'talk' ? (
          <View style={styles.tips}>
            <ThemedText type="smallBold">Keep talking for the whole time!</ThemedText>
            <ThemedText>• Say why.</ThemedText>
            <ThemedText>• Give an example or a story.</ThemedText>
            <ThemedText>• Say how you felt.</ThemedText>
          </View>
        ) : (
          <View style={[styles.followUps, { backgroundColor: FOLLOW_UP_COLOURS.panel }]}>
            <Text style={[styles.bigLabel, { color: FOLLOW_UP_COLOURS.label }]}>
              KEEP {talker.name.toUpperCase()} TALKING: ASK
            </Text>
            <View style={styles.chips}>
              {(askerQuestion?.followUps?.length ? askerQuestion.followUps : FOLLOW_UPS).map((f, i) => {
                const key = `${session.round}.${turn}.${i}`;
                const asked = askedNow.includes(key);
                return (
                  <Pressable
                    key={f}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: asked }}
                    accessibilityLabel={`${f} ${asked ? '(asked, tap to undo)' : '(tap when you have asked it)'}`}
                    onPress={() => tapFollowUp(key)}
                    style={({ pressed }) => [
                      styles.followChip,
                      asked
                        ? { backgroundColor: FOLLOW_UP_COLOURS.askedChip, borderColor: FOLLOW_UP_COLOURS.askedChip }
                        : { backgroundColor: FOLLOW_UP_COLOURS.chip, borderColor: FOLLOW_UP_COLOURS.chipBorder },
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.followText,
                        { color: asked ? FOLLOW_UP_COLOURS.askedText : FOLLOW_UP_COLOURS.chipText },
                      ]}>
                      {asked ? `✓ ${f}` : f}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.followHint, { color: FOLLOW_UP_COLOURS.hint }]}>
              Tap a question when you have asked it.
            </Text>
          </View>
        )}

        <View style={styles.turnTimer}>
          <ThemedText style={styles.turnClock}>{clock}</ThemedText>
          <View style={[styles.turnTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.turnFill,
                { backgroundColor: theme.accent, width: `${Math.min(100, Math.max(0, (1 - leftMs / turnMs) * 100))}%` },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {!running && session.ends_at === null
              ? 'Waiting for the timer to start'
              : turn < turns - 1
                ? role === 'talk'
                  ? 'Your turn ends, then you swap'
                  : `${talker.name} talks until the swap`
                : 'Last turn of this round'}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {`${PRODUCT_NAME}${custom ? ` · ${custom.name}` : plan ? ` · ${plan.topic}` : ''}`}
        </ThemedText>
      </Screen>
    );
  }

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
          ? `${PRODUCT_NAME}${custom ? ` · ${custom.name}` : plan ? ` · ${plan.topic}` : ''}`
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
  swap: {
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  swapText: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 800,
    color: '#111',
  },
  tips: {
    gap: Spacing.one,
  },
  followUps: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  followChip: {
    // A long follow-up wraps inside its chip instead of running off the phone.
    maxWidth: '100%',
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#fff',
  },
  followHint: {
    fontSize: 14,
    fontWeight: 600,
  },
  followText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: 700,
  },
  turnTimer: {
    gap: Spacing.one,
    alignItems: 'stretch',
  },
  turnClock: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: 800,
    textAlign: 'center',
  },
  turnTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  turnFill: {
    height: '100%',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ translateY: 3 }],
  },

});
