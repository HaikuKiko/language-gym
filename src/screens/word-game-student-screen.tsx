import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { GameAwards } from '@/components/game-awards';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { GameClock, WordCardView } from '@/components/word-card-view';
import { Spacing } from '@/core/ui/theme';
import { useNow } from '@/core/app/use-now';
import { useTeamNames } from '@/hooks/use-team-names';
import { useTheme } from '@/core/ui/use-theme';
import { remainingMs, type LiveParticipant, type LiveSession } from '@/lib/live-session';
import { useSessionBackend } from '@/lib/session-backend';
import { errorMessage } from '@/core/app/supabase';
import {
  GUESS_WRONG,
  HINT,
  TEAM_NAME,
  TEAM_NAME_MAX_LENGTH,
  WORD_GAMES,
  checkGuess,
  finishCard,
  groupLabel,
  isTyping,
  groupOf,
  groupProgress,
  type GroupProgress,
  type GuessWrongData,
  type HintData,
  type TeamNameData,
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
  const typing = isTyping(session);
  const { names: teams, reload: reloadTeams } = useTeamNames(session);

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

  /** Typing: checks a guess. Right finishes the word; a wrong guess is saved for the awards. */
  async function guess(group: GroupProgress, text: string): Promise<'right' | 'almost' | 'wrong'> {
    if (!group.word) return 'wrong';
    const result = checkGuess(text, group.word.word);
    if (result === 'right') {
      await tap(group, true, me.id);
    } else {
      const data: GuessWrongData = {
        round: 0,
        group: group.index,
        card: group.card,
        word: group.word.word,
        guess: text.trim().slice(0, 60),
        almost: result === 'almost',
      };
      await backend.logEvent(session.id, me.id, GUESS_WRONG, data).catch(() => {});
    }
    return result;
  }

  async function nameTeam(group: GroupProgress, name: string) {
    const data: TeamNameData = { round: 0, group: group.index, name: name.trim().slice(0, TEAM_NAME_MAX_LENGTH) };
    try {
      await backend.logEvent(session.id, me.id, TEAM_NAME, data);
      await reloadTeams();
    } catch (e) {
      setError(errorMessage(e));
    }
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
          {groupLabel(teams, 0, group.index)} · {heading}
        </Text>
        <Text style={[styles.headerSub, { color: theme.onHeroMuted }]}>
          {game.emoji} {game.name} · {group.score} {group.score === 1 ? 'word' : 'words'} so far
        </Text>
      </View>

      <TeamName name={teams.get(`0:${group.index}`) ?? null} onSave={(name) => nameTeam(group, name)} />

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
            {!typing && (
              <Button
                label={myTurn ? 'Got it ✓' : `${playerName} got it ✓`}
                disabled={!canTap}
                onPress={() =>
                  kind === 'explain-it' && group.members.length > 1 ? setChoosingFor(group.card) : tap(group, true)
                }
                style={styles.buttonWide}
              />
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {typing
              ? kind === 'hot-seat'
                ? `${playerName} types the word on their phone. Skip if it's too hard.`
                : "Your group types the word on their phones. Skip if it's too hard."
              : myTurn
                ? 'Tap "Got it" when someone says the word.'
                : `Anyone describing can tap "Got it" when ${playerName} says the word.`}
          </ThemedText>
        </>
      ) : (
        <View style={styles.listen}>
          <Text style={styles.emoji}>{kind === 'hot-seat' ? '🙈' : '👂'}</Text>
          <ThemedText type="subtitle" style={styles.centered}>
            {typing
              ? 'Listen and type the word'
              : kind === 'hot-seat'
                ? 'Listen and guess the word'
                : 'Listen and shout your guess!'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {kind === 'hot-seat' ? "Your group can see it. You can't." : `Only ${playerName} can see the word.`}
          </ThemedText>
          {typing && canTap && <GuessBox key={`${group.index}:${group.card}`} onGuess={(text) => guess(group, text)} />}
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

/** Typing: the guesser types the word; spelling counts. */
function GuessBox({ onGuess }: { onGuess: (text: string) => Promise<'right' | 'almost' | 'wrong'> }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [result, setResult] = useState<'almost' | 'wrong' | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const outcome = await onGuess(text);
    setBusy(false);
    if (outcome !== 'right') {
      setResult(outcome);
      setText('');
    }
  }

  return (
    <View style={styles.guess}>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setResult(null);
        }}
        onSubmitEditing={check}
        placeholder="Type the word"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoFocus
        style={[styles.input, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.background }]}
      />
      <Button label={busy ? 'Checking…' : 'Check'} disabled={busy || !text.trim()} onPress={check} />
      {result && (
        <ThemedText
          type="smallBold"
          themeColor={result === 'almost' ? 'warning' : 'textSecondary'}
          style={styles.centered}>
          {result === 'almost' ? 'Almost! Check your spelling.' : 'Not quite. Try again!'}
        </ThemedText>
      )}
    </View>
  );
}

/** The team's name, which anyone in the group can set or change. */
function TeamName({ name, onSave }: { name: string | null; onSave: (name: string) => Promise<void> }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  async function save() {
    if (!text.trim()) return;
    setEditing(false);
    await onSave(text);
  }

  if (!editing) {
    return (
      <Button
        variant="secondary"
        label={name ? `✏️ Team ${name}: change the name` : '✏️ Name your team'}
        onPress={() => {
          setText(name ?? '');
          setEditing(true);
        }}
      />
    );
  }
  return (
    <View style={styles.teamRow}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={save}
        maxLength={TEAM_NAME_MAX_LENGTH}
        placeholder="Your team's name"
        placeholderTextColor={theme.textSecondary}
        autoFocus
        style={[
          styles.input,
          styles.teamInput,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
        ]}
      />
      <Button label="Save" disabled={!text.trim()} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  guess: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  input: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 20,
  },
  teamRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  teamInput: {
    flex: 1,
    fontSize: 16,
  },
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
