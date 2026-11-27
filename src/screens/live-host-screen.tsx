import { router, type Href } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Avatar } from '@/core/ui/avatar';
import { GrammarCard } from '@/components/grammar-card';
import { JoinCodeHero } from '@/core/live/join-code-hero';
import { LateJoinQr } from '@/core/live/late-join-qr';
import { LobbyButtons, StudentRoster } from '@/core/live/lobby';
import { PretendStudentsPanel } from '@/components/pretend-students-panel';
import { usePretendStudents } from '@/lib/pretend-students';
import { useHostActions } from '@/core/live/use-host-actions';
import { ErrorNote } from '@/core/ui/notice';
import { LiveTimer } from '@/core/live/live-timer';
import { Pill } from '@/core/ui/pill';
import { ProgressBar } from '@/core/ui/progress-bar';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { WeekFocus } from '@/components/week-focus';
import { PRODUCT_NAME } from '@/constants/product';
import { Spacing } from '@/core/ui/theme';
import { useNow } from '@/core/app/use-now';
import { findWeek } from '@/data/weeks';
import { useCustomSets, useQuestions, useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/core/ui/use-theme';
import { endSession, formatCode, pauseTimer, remainingMs, resetTimer, startTimer, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { findingStatus, setGroupFound } from '@/core/live/ready-check';
import { turnFor } from '@/core/live/turns';
import { beginDiscussion, isFriending, isRoundRobin, roundRobinRounds, nextRound, customSetId, isTakingTurns, questionForRound, startSession } from '@/lib/talk-rounds';
import { groupsForRound, type Group } from '@/core/live/groups';
import { useSessionBackend } from '@/lib/session-backend';
import { FinishedScreen } from '@/screens/finished-screen';

type LiveHostScreenProps = {
  session: LiveSession;
  participants: LiveParticipant[];
  onSession: (session: LiveSession) => void;
  onParticipants: (participants: LiveParticipant[]) => void;
};

/** What the teacher sees: the join code, then the controls for each round. */
export function LiveHostScreen({
  session,
  participants,
  onSession,
  onParticipants,
}: LiveHostScreenProps) {
  const now = useNow();
  const questions = useQuestions();
  const friending = isFriending(session);
  const customSets = useCustomSets();
  const custom = customSets.find((s) => s.id === customSetId(session)) ?? null;
  const plan = findWeek(useWeeks(), session.level, session.week);
  const theme = useTheme();
  const backend = useSessionBackend();
  const { save, remove, error } = useHostActions({ backend, session, participants, onSession, onParticipants });
  const pretend = usePretendStudents(session, participants);

  // Automatic mode: this screen moves the session on when the clock runs out.
  const playing = session.status === 'playing';
  const expired =
    playing && session.auto_advance && session.ends_at !== null && remainingMs(session, now) <= 0;

  const advance = useEffectEvent(() => {
    const current = Date.now();
    save(
      session.stage === 'changeover'
        ? beginDiscussion(session, current)
        : nextRound(session, participants, current),
      true,
    );
  });

  useEffect(() => {
    if (expired) advance();
  }, [expired, session.round, session.stage]);

  // Every pair has found each other: in automatic mode, start the round.
  const finding = playing && session.stage === 'changeover';
  const everyoneFound = finding && findingStatus(session, participants).allFound;
  const startRound = useEffectEvent(() => save(beginDiscussion(session, Date.now()), true));

  useEffect(() => {
    if (everyoneFound && session.auto_advance) startRound();
  }, [everyoneFound, session.auto_advance, session.round]);

  if (session.status === 'finished') {
    return (
      <FinishedScreen
        roundsPlayed={session.roster.length > 0 ? session.round + 1 : 0}
        studentCount={session.roster.length}
        restartLabel="Back to start"
        onRestart={() => router.replace(friending ? '/' : '/dashboard')}
      />
    );
  }

  const header = (status: string) => (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <View style={[styles.brandMark, { backgroundColor: theme.accent }]} />
        <ThemedText type="smallBold">{friending ? PRODUCT_NAME : 'Language Gym'}</ThemedText>
      </View>
      <Pill label={status} tone="accent" />
    </View>
  );

  if (session.status === 'lobby') {
    return (
      <Screen>
        {header('Waiting for students')}

        <JoinCodeHero code={session.code} demo={backend.demo} />

        <StudentRoster participants={participants} onRemove={remove} />

        {!backend.demo && <PretendStudentsPanel onAdd={pretend.add} busy={pretend.busy} error={pretend.error} />}

        <View style={styles.pills}>
          {friending && <Pill label={PRODUCT_NAME} tone="accent" />}
          <Pill label={`Level ${session.level}`} />
          {custom ? (
            <Pill label={custom.name} />
          ) : (
            session.week != null && <Pill label={friending ? (plan?.topic ?? `Theme ${session.week}`) : `Week ${session.week}`} />
          )}
          {isRoundRobin(session) ? (
            <Pill
              label={
                participants.length >= 2
                  ? `Round robin: ${roundRobinRounds(participants.length)} rounds`
                  : 'Round robin'
              }
            />
          ) : (
            <Pill
              label={`${session.round_count} ${session.round_count === 1 ? 'round' : 'rounds'}`}
            />
          )}
          <Pill label={`${session.round_minutes} min each`} />
          <Pill label={session.auto_advance ? 'Automatic timer' : 'Manual timer'} />
        </View>

        {plan && !friending && (plan.grammar || plan.help) ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">Pre-teach before you start</ThemedText>
            <GrammarCard week={plan} />
            <ThemedText type="small" themeColor="textSecondary">
              Students see a short version of this on their phones, with sentence starters.
            </ThemedText>
          </View>
        ) : null}

        <LobbyButtons
          studentCount={participants.length}
          startLabel="Start session"
          cancelLabel="Cancel session"
          onStart={() => save(startSession(session, participants, Date.now()))}
          onCancel={() => save(endSession())}
          error={error}
        />
      </Screen>
    );
  }

  const groups = groupsForRound(session.roster, session.round);
  const lastRound = session.round + 1 >= session.round_count;
  const remaining = remainingMs(session, now);
  const running = session.ends_at !== null && remaining > 0;
  const rosterIds = new Set(session.roster.map((p) => p.id));
  const waiting = participants.filter((p) => !rosterIds.has(p.id));
  const question = friending ? null : questionForRound(session, questions, session.level);

  return (
    <Screen>
      {header(backend.demo ? 'Demo' : `Join code ${formatCode(session.code)}`)}

      <View style={styles.section}>
        <View style={styles.roundRow}>
          <View style={styles.roundTitle}>
            <ThemedText type="subtitle">
              Round {session.round + 1} of {session.round_count}
            </ThemedText>
            <WeekFocus level={session.level} week={session.week} friending={friending} customName={custom?.name} />
          </View>
          {/* Students who arrive late scan this and join from the next round. */}
          <LateJoinQr code={session.code} demo={backend.demo} />
        </View>
        <View style={styles.steps}>
          {Array.from({ length: session.round_count }, (_, i) => (
            <View
              key={i}
              style={[
                styles.step,
                { backgroundColor: i <= session.round ? theme.accent : theme.backgroundSelected },
              ]}
            />
          ))}
        </View>
      </View>

      {finding ? (
        <FindingPartners
          session={session}
          participants={participants}
          waitingToJoin={waiting}
          onMark={(group, found) => save(setGroupFound(session, group, found))}
          onStart={() => save(beginDiscussion(session, Date.now()), true)}
        />
      ) : (
        <>
        <View style={[styles.questionCard, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={[styles.questionLabel, { color: theme.grammarLabel }]}>
            {friending ? 'QUESTIONS' : 'EVERYONE\'S QUESTION'}
          </ThemedText>
          <ThemedText style={[styles.questionText, { color: theme.grammarText }]}>
            {friending
              ? 'Everyone has their own question on their phone. Partners take turns asking.'
              : question
                ? question.text
                : 'There are no questions at this level yet.'}
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={[styles.card, styles.timerCard]}>
          <LiveTimer session={session} now={now} />
          {isTakingTurns(session) && (
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {turnFor(session, 2, now).turn === 0
                ? 'First half: one partner talks, the other asks'
                : 'Second half: they swap'}
            </ThemedText>
          )}
          <View style={styles.centeredRow}>
            {remaining > 0 && (
              <Button
                label={running ? 'Pause' : session.auto_advance ? 'Resume' : 'Start timer'}
                onPress={() =>
                  save(running ? pauseTimer(session, Date.now()) : startTimer(session, Date.now()))
                }
              />
            )}
            <Button label="Reset" variant="secondary" onPress={() => save(resetTimer(session))} />
          </View>
        </ThemedView>

        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <ThemedText type="smallBold">Partners</ThemedText>
          </View>
          <View style={styles.groups}>
            {groups.map((group) => {
              return (
                <ThemedView
                  key={group.map((p) => p.id).join('+')}
                  type="backgroundElement"
                  style={[styles.card, styles.group]}>
                  <View style={styles.groupPeople}>
                    <View style={styles.avatars}>
                      {group.map((p, i) => (
                        <View
                          key={p.id}
                          style={[
                            styles.avatarRing,
                            { borderColor: theme.backgroundElement },
                            i > 0 && styles.avatarOverlap,
                          ]}>
                          <Avatar id={p.id} name={p.name} />
                        </View>
                      ))}
                    </View>
                    <ThemedText type="smallBold" style={styles.groupNames}>
                      {group.map((p) => p.name).join('  ·  ')}
                    </ThemedText>
                  </View>
                </ThemedView>
              );
            })}
          </View>
          {waiting.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Joining next round: {waiting.map((p) => p.name).join(', ')}
            </ThemedText>
          )}
        </View>
        </>
      )}

      {plan && !friending ? <GrammarCard week={plan} /> : null}

      <View style={styles.section}>
        <Button
          label={lastRound ? 'Finish session' : 'Next round'}
          onPress={() => save(nextRound(session, participants, Date.now()))}
        />
        {!lastRound && (
          <Button label="End session" variant="secondary" onPress={() => save(endSession())} />
        )}
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}

/**
 * The start of each round: who has found their partner, and who we are
 * still waiting for. The teacher can mark a pair as found, or start anyway.
 */
function FindingPartners({
  session,
  participants,
  waitingToJoin,
  onMark,
  onStart,
}: {
  session: LiveSession;
  participants: LiveParticipant[];
  waitingToJoin: LiveParticipant[];
  onMark: (group: Group, found: boolean) => void;
  onStart: () => void;
}) {
  const theme = useTheme();
  const { groups, ready, total, allFound } = findingStatus(session, participants);
  // Pairs still looking come first, so they are easy to spot.
  const ordered = [...groups.filter((g) => !g.found), ...groups.filter((g) => g.found)];
  const names = (group: Group) => group.map((p) => p.name).join(group.length > 2 ? ', ' : ' & ');
  const missing = groups.filter((g) => !g.found).map((g) => names(g.group));

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">
        {allFound ? 'Everyone has found their partner' : `Finding partners… ${ready} of ${total} ready`}
      </ThemedText>
      <ProgressBar fraction={total > 0 ? ready / total : 0} />
      {missing.length > 0 && (
        <ThemedText type="smallBold" style={{ color: theme.markA }}>
          Waiting for: {missing.join(' · ')}
        </ThemedText>
      )}
      <View style={styles.groups}>
        {ordered.map(({ group, found }) => (
          <Pressable
            key={group.map((p) => p.id).join('+')}
            accessibilityRole="button"
            accessibilityLabel={`${names(group)}: ${found ? 'found, tap to undo' : 'waiting, tap to mark as found'}`}
            onPress={() => onMark(group, !found)}
            style={({ pressed }) => [
              styles.findGroup,
              found
                ? { backgroundColor: theme.successSoft, borderColor: theme.successSoft }
                : { backgroundColor: theme.markABg, borderColor: theme.markA },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.groupNames, { color: found ? theme.successText : theme.markA }]}>
              {names(group)}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: found ? theme.successText : theme.markA }}>
              {found ? '✓' : 'waiting'}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Tap a pair to mark them as found (if a phone is flat).{' '}
        {session.auto_advance
          ? `${isFriending(session) ? 'The questions appear' : 'The question appears'} on every phone as soon as all pairs are ready.`
          : 'Start the round when everyone is ready.'}
      </ThemedText>
      {waitingToJoin.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Joining next round: {waitingToJoin.map((p) => p.name).join(', ')}
        </ThemedText>
      )}
      <Button
        label={allFound ? 'Start the round' : 'Start the round anyway'}
        variant={allFound ? 'primary' : 'secondary'}
        onPress={onStart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  findGroup: {
    flexGrow: 1,
    flexBasis: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  questionCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  questionLabel: {
    letterSpacing: 1.5,
  },
  questionText: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: 700,
  },
  section: {
    gap: Spacing.two,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  roundTitle: {
    flex: 1,
    gap: Spacing.two,
  },
  steps: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  step: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  timerCard: {
    alignItems: 'center',
    gap: Spacing.four,
  },
  centeredRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  groups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  group: {
    flexGrow: 1,
    flexBasis: 260,
    gap: Spacing.two,
  },
  groupPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 18,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  groupNames: {
    flexShrink: 1,
  },
});
