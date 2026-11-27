import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { GameAwards } from '@/components/game-awards';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { GameClock, WordCardView } from '@/components/word-card-view';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { remainingMs, type LiveParticipant, type LiveSession } from '@/lib/live-session';
import { useSessionBackend } from '@/lib/session-backend';
import { errorMessage } from '@/lib/supabase';
import {
  HINT,
  WORD_GAMES,
  finishCard,
  groupOf,
  groupProgress,
  type GroupProgress,
  type HintData,
  type WordGameKind,
} from '@/lib/word-game';

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
  // The word (as "group:card") whose meaning this phone has opened.
  const [hintFor, setHintFor] = useState<string | null>(null);
  // Explain It: the word just guessed, waiting for "Who guessed it?".
  const [choosingFor, setChoosingFor] = useState<number | null>(null);

  const meNow: LiveParticipant = {
    ...me,
    got_cards: [...new Set([...(me.got_cards ?? []), ...myGot])],
    skipped_cards: [...new Set([...(me.skipped_cards ?? []), ...mySkipped])],
  };
  const withMine = participants.map((p) => (p.id === me.id ? meNow : p));

  async function tap(group: GroupProgress, guessed: boolean, guesserId: string | null = null) {
    const card = group.card;
    setError(null);
    setChoosingFor(null);
    (guessed ? setMyGot : setMySkipped)((list) => [...list, card]);
    try {
      await finishCard(backend, session, kind, group, meNow, guessed, guesserId);
    } catch (e) {
      (guessed ? setMyGot : setMySkipped)((list) => list.filter((n) => n !== card));
      setError(errorMessage(e));
    }
  }

  async function openHint(group: GroupProgress) {
    setHintFor(`${group.index}:${group.card}`);
    if (!group.word) return;
    const data: HintData = { round: 0, group: group.index, card: group.card, word: group.word.word };
    await backend.logEvent(session.id, me.id, HINT, data).catch(() => {});
  }

  async function leave() {
    await backend.removeParticipant(me.id).catch(() => {});
    if (backend.demo) return;
    router.replace({
      pathname: '/join/[code]',
      params: { code: session.code },
    });
  }

  if (session.status === 'finished') {
    return (
      <Screen>
        <View style={styles.message}>
          <ThemedText type="subtitle">Game over!</ThemedText>
          <ThemedText themeColor="textSecondary">Thanks for playing, {me.name}!</ThemedText>
        </View>
        {session.roster.length > 0 && <GameAwards kind={kind} session={session} myId={me.id} />}
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
          <ThemedText themeColor="textSecondary">
            The game has started. You&apos;ll be put in a group in a moment.
          </ThemedText>
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
          <ThemedText themeColor="textSecondary">
            Your group guessed {group.score} {group.score === 1 ? 'word' : 'words'}.
          </ThemedText>
        </View>
      ) : myTurn && kind === 'explain-it' && choosingFor === group.card ? (
        <View style={styles.choose}>
          <ThemedText type="subtitle" style={styles.centered}>
            ✓ Who guessed it?
          </ThemedText>
          <View style={styles.names}>
            {group.members
              .filter((m) => m.id !== me.id)
              .map((m) => (
                <Button key={m.id} label={m.name} onPress={() => tap(group, true, m.id)} style={styles.name} />
              ))}
          </View>
          <Button label="Not sure" variant="secondary" onPress={() => tap(group, true, null)} />
          <Button label="Back" variant="secondary" onPress={() => setChoosingFor(null)} />
        </View>
      ) : seesWord && group.word ? (
        <>
          <ThemedText type="smallBold" style={{ color: theme.accent, letterSpacing: 1 }}>
            {myTurn ? 'EXPLAIN IT TO YOUR GROUP' : `DESCRIBE IT TO ${playerName.toUpperCase()}`}
          </ThemedText>
          <WordCardView
            card={group.word}
            showHint={hintFor === `${group.index}:${group.card}`}
            onHint={canTap ? () => openHint(group) : undefined}
          />
          <View style={styles.buttons}>
            <Button
              label="Skip"
              variant="secondary"
              disabled={!canTap}
              onPress={() => tap(group, false)}
              style={styles.button}
            />
            <Button
              label={myTurn ? 'Got it ✓' : `${playerName} got it ✓`}
              disabled={!canTap}
              onPress={() =>
                kind === 'explain-it' && group.members.length > 1 ? setChoosingFor(group.card) : tap(group, true)
              }
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
  choose: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  names: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  name: {
    flexGrow: 1,
    flexBasis: 120,
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
