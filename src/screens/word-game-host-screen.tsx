import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { GameAwards } from '@/components/game-awards';
import { JoinCodeHero } from '@/components/join-code-hero';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GameClock, WordCardView } from '@/components/word-card-view';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import {
  endSession,
  formatCode,
  pauseTimer,
  remainingMs,
  startTimer,
  type LiveParticipant,
  type LiveSession,
} from '@/lib/live-session';
import { useSessionBackend } from '@/lib/session-backend';
import { errorMessage } from '@/lib/supabase';
import {
  EXTRA_TIME_MS,
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
  const theme = useTheme();
  const backend = useSessionBackend();
  const game = WORD_GAMES[kind];
  const [error, setError] = useState<string | null>(null);

  async function save(changes: Parameters<typeof backend.updateSession>[1]) {
    try {
      const saved = await backend.updateSession(session, changes);
      if (saved) onSession(saved);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function start() {
    await save(startWordGame(session, participants, Date.now()));
    // The start time, from the database's clock, for timing the first words.
    await backend.logEvent(session.id, null, GAME_STARTED, {}).catch(() => {});
  }

  async function remove(participant: LiveParticipant) {
    try {
      await backend.removeParticipant(participant.id);
      onParticipants(participants.filter((p) => p.id !== participant.id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
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

  const errorText = error && (
    <ThemedText type="small" themeColor="warning" style={styles.centered}>
      {error}
    </ThemedText>
  );

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
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.rowBetween}>
            <ThemedText type="smallBold">Students</ThemedText>
            <Pill label={String(participants.length)} tone="accent" />
          </View>
          {participants.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              Waiting for students to join…
            </ThemedText>
          ) : (
            <View style={styles.chips}>
              {participants.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name}`}
                  onPress={() => remove(p)}
                  style={({ pressed }) => [
                    styles.student,
                    { backgroundColor: theme.background },
                    pressed && styles.pressed,
                  ]}>
                  <Avatar id={p.id} name={p.name} size={28} />
                  <ThemedText type="small">{p.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ✕
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </ThemedView>
        <View style={styles.chips}>
          <Pill label={`Level ${session.level}`} />
          <Pill label={`Groups of about ${size}`} />
          <Pill label={`${session.round_minutes} min game`} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {game.summary}
        </ThemedText>
        <View style={styles.section}>
          <Button
            label="Start the game"
            disabled={participants.length < 2}
            onPress={start}
          />
          {participants.length < 2 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              At least two students need to join before you can start.
            </ThemedText>
          )}
          <Button label="Cancel game" variant="secondary" onPress={() => save(endSession())} />
          {errorText}
        </View>
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
        <GameClock session={session} now={now} large />
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
              <ThemedText type="smallBold">Group {g.index + 1}</ThemedText>
              <Pill label={`${g.score} ${g.score === 1 ? 'word' : 'words'}`} tone="accent" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {g.members.map((m) => (m.id === g.player?.id ? `${m.name} (${role.toLowerCase()})` : m.name)).join(' · ')}
            </ThemedText>
            {g.word && <WordCardView card={g.word} compact />}
          </ThemedView>
        ))}
      </View>

      <View style={styles.section}>
        <Button label="End the game now" variant="secondary" onPress={() => save(endSession())} />
        {errorText}
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
  student: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
    borderRadius: Spacing.four,
    minHeight: 36,
  },
  pressed: {
    opacity: 0.7,
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
  centered: {
    textAlign: 'center',
  },
});
