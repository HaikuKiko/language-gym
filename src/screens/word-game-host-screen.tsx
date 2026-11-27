import { router } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { GameAwards } from '@/components/game-awards';
import { JoinCodeHero } from '@/core/live/join-code-hero';
import { LateJoinQr } from '@/core/live/late-join-qr';
import { LobbyButtons, StudentRoster } from '@/core/live/lobby';
import { useHostActions } from '@/core/live/use-host-actions';
import { ErrorNote } from '@/core/ui/notice';
import { Pill } from '@/core/ui/pill';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { GameClock, WordCardView } from '@/components/word-card-view';
import { Spacing } from '@/core/ui/theme';
import { useNow } from '@/core/app/use-now';
import { useTeamNames } from '@/hooks/use-team-names';
import { endSession, formatCode, pauseTimer, remainingMs, startTimer, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { useSessionBackend } from '@/lib/session-backend';
import { errorMessage } from '@/core/app/supabase';
import {
  EXTRA_TIME_MS,
  TEAM_NAME,
  isTyping,
  type TeamNameData,
  GAME_STARTED,
  WORD_GAMES,
  addLateJoiners,
  addTime,
  groupProgress,
  groupSizeOf,
  startWordGame,
  type WordGameKind,
} from '@/lib/word-game';

type Props = {
  kind: WordGameKind;
  session: LiveSession;
  participants: LiveParticipant[];
  onSession: (session: LiveSession) => void;
  onParticipants: (participants: LiveParticipant[]) => void;
};

/** The teacher's screen for a word game: join code, then every group's progress, then the results. */
export function WordGameHostScreen({ kind, session, participants, onSession, onParticipants }: Props) {
  const now = useNow();
  const backend = useSessionBackend();
  const game = WORD_GAMES[kind];
  const { save, remove, error, setError } = useHostActions({ backend, session, participants, onSession, onParticipants });

  const { names: teams, reload: reloadTeams } = useTeamNames(session);

  /** The teacher removes a team name (e.g. a rude one). */
  async function clearTeamName(group: number) {
    const data: TeamNameData = { round: 0, group, name: '' };
    await backend.logEvent(session.id, null, TEAM_NAME, data).catch((e) => setError(errorMessage(e)));
    await reloadTeams();
  }

  async function start() {
    await save(startWordGame(session, participants, Date.now()));
    // The start time, from the database's clock, for timing the first words.
    await backend.logEvent(session.id, null, GAME_STARTED, {}).catch(() => {});
  }

  const playing = session.status === 'playing';
  const timeUp = playing && session.ends_at !== null && remainingMs(session, now) <= 0;

  // When the game clock runs out, this screen ends the game.
  const finish = useEffectEvent(() => save(endSession()));
  useEffect(() => {
    if (timeUp) finish();
  }, [timeUp]);

  // Students who join after the start are put into a group.
  const lateIds = playing
    ? participants
        .filter((p) => !session.roster.some((r) => r.id === p.id))
        .map((p) => p.id)
        .join(',')
    : '';
  const addLate = useEffectEvent(() => {
    const changes = addLateJoiners(session, participants);
    if (changes) save(changes);
  });
  useEffect(() => {
    if (lateIds) addLate();
  }, [lateIds]);

  const title = (
    <View style={styles.topBar}>
      <ThemedText type="smallBold">
        {game.emoji} {game.name}
      </ThemedText>
      <Pill label={playing ? `Join code ${formatCode(session.code)}` : `Level ${session.level}`} tone="accent" />
    </View>
  );

  if (session.status === 'finished') {
    return (
      <Screen>
        {title}
        <ThemedText type="subtitle">Game over!</ThemedText>
        {session.roster.length > 0 && <GameAwards kind={kind} session={session} teacher />}
        {backend.demo ? (
          <Button
            label="Back to the setup"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/word-game'))}
          />
        ) : (
          <Button label="Back to the dashboard" onPress={() => router.replace('/dashboard')} />
        )}
      </Screen>
    );
  }

  if (session.status === 'lobby') {
    const size = groupSizeOf(session);
    return (
      <Screen>
        {title}
        <JoinCodeHero code={session.code} demo={backend.demo} />
        <StudentRoster participants={participants} onRemove={remove} />
        <View style={styles.chips}>
          <Pill label={`Level ${session.level}`} />
          <Pill label={`Groups of about ${size}`} />
          <Pill label={`${session.round_minutes} min game`} />
          <Pill label={isTyping(session) ? 'Guessers type the word' : 'Guessers say the word'} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {game.summary}
        </ThemedText>
        <LobbyButtons
          studentCount={participants.length}
          startLabel="Start the game"
          cancelLabel="Cancel game"
          onStart={start}
          onCancel={() => save(endSession())}
          error={error}
        />
      </Screen>
    );
  }

  const progress = groupProgress(session, participants);
  const running = session.ends_at !== null;
  const role = kind === 'hot-seat' ? 'Guessing' : 'Explaining';

  return (
    <Screen>
      {title}
      <ThemedView type="backgroundElement" style={[styles.card, styles.clockCard]}>
        <View style={styles.clockRow}>
          <GameClock session={session} now={now} large />
          <LateJoinQr code={session.code} demo={backend.demo} />
        </View>
        <View style={styles.buttons}>
          <Button
            label={running ? 'Pause' : 'Resume'}
            onPress={() => save(running ? pauseTimer(session, Date.now()) : startTimer(session, Date.now()))}
          />
          <Button
            label="+1 minute"
            variant="secondary"
            onPress={() => save(addTime(session, Date.now(), EXTRA_TIME_MS))}
          />
        </View>
      </ThemedView>

      <View style={styles.groups}>
        {progress.map((g) => (
          <ThemedView key={g.index} type="backgroundElement" style={[styles.card, styles.group]}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">
                {g.index + 1}. {teams.get(`0:${g.index}`) ?? 'No team name yet'}
              </ThemedText>
              <Pill label={`${g.score} ${g.score === 1 ? 'word' : 'words'}`} tone="accent" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {g.members.map((m) => (m.id === g.player?.id ? `${m.name} (${role.toLowerCase()})` : m.name)).join(' · ')}
            </ThemedText>
            {g.word && <WordCardView card={g.word} compact />}
            {teams.has(`0:${g.index}`) && (
              <Pressable accessibilityRole="button" onPress={() => clearTeamName(g.index)}>
                <ThemedText type="small" themeColor="textSecondary">
                  ✕ Clear the team name
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        ))}
      </View>

      <View style={styles.section}>
        <Button label="End the game now" variant="secondary" onPress={() => save(endSession())} />
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  clockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  clockCard: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowBetween: {
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
  buttons: {
    flexDirection: 'row',
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
  },
});
