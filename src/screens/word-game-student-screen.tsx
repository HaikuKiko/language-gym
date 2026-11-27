import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { GameClock, WordCardView } from '@/components/word-card-view';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { remainingMs, type LiveParticipant, type LiveSession } from '@/lib/live-session';
import { useSessionBackend } from '@/lib/session-backend';
import { errorMessage } from '@/lib/supabase';
import { WORD_GAMES, groupOf, groupProgress, recordCard, type WordGameKind } from '@/lib/word-game';
import { Results } from '@/screens/word-game-host-screen';

type Props = {
  kind: WordGameKind;
  session: LiveSession;
  participants: LiveParticipant[];
  me: LiveParticipant;
};

/** A student's phone in a word game. */
export function WordGameStudentScreen({ kind, session, participants, me }: Props) {
  const now = useNow();
  const theme = useTheme();
  const backend = useSessionBackend();
  const game = WORD_GAMES[kind];
  // Taps from this phone, shown straight away while they reach the other phones.
  const [myGot, setMyGot] = useState<number[]>([]);
  const [mySkipped, setMySkipped] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const meNow: LiveParticipant = {
    ...me,
    got_cards: [...new Set([...(me.got_cards ?? []), ...myGot])],
    skipped_cards: [...new Set([...(me.skipped_cards ?? []), ...mySkipped])],
  };
  const withMine = participants.map((p) => (p.id === me.id ? meNow : p));

  async function tap(card: number, guessed: boolean) {
    setError(null);
    (guessed ? setMyGot : setMySkipped)((list) => [...list, card]);
    try {
      await recordCard(meNow, card, guessed);
    } catch (e) {
      (guessed ? setMyGot : setMySkipped)((list) => list.filter((n) => n !== card));
      setError(errorMessage(e));
    }
  }

  async function leave() {
    await backend.removeParticipant(me.id).catch(() => {});
    router.replace({ pathname: '/join/[code]', params: { code: session.code } });
  }

  if (session.status === 'finished') {
    const progress = groupProgress(session, withMine);
    const mine = groupOf(progress, me.id);
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Game over!</ThemedText>
          {mine && (
            <ThemedText themeColor="textSecondary">
              Your group guessed {mine.score} {mine.score === 1 ? 'word' : 'words'}. Thanks for playing, {me.name}!
            </ThemedText>
          )}
        </View>
        {progress.length > 0 && session.roster.length > 0 && <Results progress={progress} myGroup={mine?.index} />}
        <ThemedText type="small" themeColor="textSecondary">
          You can close this page.
        </ThemedText>
      </Screen>
    );
  }

  if (session.status === 'lobby') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">You&apos;re in, {me.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            We&apos;re playing {game.emoji} {game.name}. {game.summary}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Waiting for your teacher to start. {participants.length}{' '}
            {participants.length === 1 ? 'student has' : 'students have'} joined so far.
          </ThemedText>
        </View>
        <Button label="Leave the game" variant="secondary" onPress={leave} />
      </Screen>
    );
  }

  const group = groupOf(groupProgress(session, withMine), me.id);
  if (!group || !group.player) {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Joining a group…</ThemedText>
          <ThemedText themeColor="textSecondary">The game has started. You&apos;ll be put in a group in a moment.</ThemedText>
        </View>
      </Screen>
    );
  }

  const myTurn = group.player.id === me.id;
  const playerName = group.player.name;
  const left = remainingMs(session, now);
  const paused = session.ends_at === null;
  const over = left <= 0;
  const canTap = !paused && !over;
  // Hot Seat: the guesser can't see the word. Explain It: only the explainer can.
  const seesWord = kind === 'hot-seat' ? !myTurn : myTurn;

  const heading =
    kind === 'hot-seat'
      ? myTurn
        ? "You're guessing!"
        : `${playerName} is guessing`
      : myTurn
        ? 'Your turn to explain'
        : `${playerName} is explaining`;

  return (
    <Screen>
      <View style={[styles.header, { backgroundColor: theme.hero }]}>
        <Text style={[styles.headerTitle, { color: theme.onHero }]}>
          Group {group.index + 1} · {heading}
        </Text>
        <Text style={[styles.headerSub, { color: theme.onHeroMuted }]}>
          {game.emoji} {game.name} · {group.score} {group.score === 1 ? 'word' : 'words'} so far
        </Text>
      </View>

      <GameClock session={session} now={now} />

      {over ? (
        <View style={styles.message}>
          <ThemedText type="subtitle">Time&apos;s up!</ThemedText>
          <ThemedText themeColor="textSecondary">Your group guessed {group.score} {group.score === 1 ? 'word' : 'words'}.</ThemedText>
        </View>
      ) : seesWord && group.word ? (
        <>
          <ThemedText type="smallBold" style={{ color: theme.accent, letterSpacing: 1 }}>
            {myTurn ? 'EXPLAIN IT TO YOUR GROUP' : `DESCRIBE IT TO ${playerName.toUpperCase()}`}
          </ThemedText>
          <WordCardView card={group.word} />
          <View style={styles.buttons}>
            <Button label="Skip" variant="secondary" disabled={!canTap} onPress={() => tap(group.card, false)} style={styles.button} />
            <Button
              label={myTurn ? 'Got it ✓' : `${playerName} got it ✓`}
              disabled={!canTap}
              onPress={() => tap(group.card, true)}
              style={styles.buttonWide}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {myTurn
              ? 'Tap "Got it" when someone says the word.'
              : `Anyone describing can tap "Got it" when ${playerName} says the word.`}
          </ThemedText>
        </>
      ) : (
        <View style={styles.listen}>
          <Text style={styles.emoji}>{kind === 'hot-seat' ? '🙈' : '👂'}</Text>
          <ThemedText type="subtitle" style={styles.centered}>
            {kind === 'hot-seat' ? 'Listen and guess the word' : 'Listen and shout your guess!'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {kind === 'hot-seat' ? "Your group can see it. You can't." : `Only ${playerName} can see the word.`}
          </ThemedText>
        </View>
      )}

      {paused && !over && (
        <ThemedText type="smallBold" themeColor="warning" style={styles.centered}>
          Your teacher has paused the game.
        </ThemedText>
      )}

      {group.nextPlayer && group.members.length > 1 && !over && (
        <View style={[styles.next, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Next {kind === 'hot-seat' ? 'guesser' : 'to explain'}:{' '}
            {group.nextPlayer.id === me.id ? 'you!' : group.nextPlayer.name}
          </ThemedText>
        </View>
      )}

      {error && (
        <ThemedText type="small" themeColor="warning" style={styles.centered}>
          {error}
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  header: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.half,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  headerSub: {
    fontSize: 14,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
  buttonWide: {
    flex: 2,
  },
  listen: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  emoji: {
    fontSize: 56,
  },
  next: {
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
});
