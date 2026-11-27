import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { LEVELS, type Level } from '@/data/questions';
import { cardsForLevel, WORD_CARDS } from '@/data/word-cards';
import { createSession } from '@/lib/live-session';
import { DEFAULT_ROUND_SETTINGS } from '@/lib/session';
import { errorMessage } from '@/core/app/supabase';
import {
  DEFAULT_GAME_MINUTES,
  GAME_MINUTES,
  GROUP_SIZES,
  WORD_GAMES,
  isWordGameKind,
  wordGameFlags,
  type WordGameKind,
} from '@/lib/word-game';

/** The demo is short, whatever game length is chosen. */
const DEMO_MINUTES = 2;

/** The teacher sets up a word game (Hot Seat or Explain It) and gets a join code. */
export default function WordGameSetupRoute() {
  const params = useLocalSearchParams<{ game?: string }>();
  const [kind, setKind] = useState<WordGameKind>(isWordGameKind(params.game) ? params.game : 'hot-seat');
  const [level, setLevel] = useState<Level>('B1');
  const [groupSize, setGroupSize] = useState<number>(WORD_GAMES[kind].defaultGroupSize);
  const [minutes, setMinutes] = useState<number>(DEFAULT_GAME_MINUTES);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const game = WORD_GAMES[kind];

  function choose(next: WordGameKind) {
    setKind(next);
    setGroupSize(WORD_GAMES[next].defaultGroupSize);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const session = await createSession(
        {
          ...DEFAULT_ROUND_SETTINGS,
          mode: 'conversation',
          level,
          week: null,
          roundMinutes: minutes,
          roundCount: 1,
          roundRobin: false,
          autoAdvance: true,
        },
        wordGameFlags(kind, groupSize, typing),
      );
      router.replace({
        pathname: '/session/[code]',
        params: { code: session.code },
      });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.section}>
        <ThemedText type="subtitle">Word games</ThemedText>
        <View style={styles.chips}>
          {(Object.keys(WORD_GAMES) as WordGameKind[]).map((k) => (
            <Chip
              key={k}
              label={`${WORD_GAMES[k].emoji} ${WORD_GAMES[k].name}`}
              selected={k === kind}
              onPress={() => choose(k)}
            />
          ))}
        </View>
        <ThemedText themeColor="textSecondary">{game.summary}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Groups go at their own speed. The group that guesses the most words before the time runs out wins.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Level</ThemedText>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} selected={l === level} onPress={() => setLevel(l)} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {cardsForLevel(WORD_CARDS, level).length} words at {level}. Every group gets different words of the same
          level.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Group size</ThemedText>
        <View style={styles.chips}>
          {GROUP_SIZES.map((n) => (
            <Chip key={n} label={String(n)} selected={n === groupSize} onPress={() => setGroupSize(n)} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          About {groupSize} students in each group. The app makes the groups when you start.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Game length</ThemedText>
        <View style={styles.chips}>
          {GAME_MINUTES.map((m) => (
            <Chip key={m} label={`${m} min`} selected={m === minutes} onPress={() => setMinutes(m)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">How guessers answer</ThemedText>
        <View style={styles.chips}>
          <Chip label="🗣️ Say it" selected={!typing} onPress={() => setTyping(false)} />
          <Chip label="⌨️ Type it (spelling counts)" selected={typing} onPress={() => setTyping(true)} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {typing
            ? 'Guessers type the word on their phone. The phone checks it, says "Almost!" for a small spelling mistake, and moves on when it is right.'
            : 'Guessers say the word, and the group taps "Got it".'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <Button label={busy ? 'Creating…' : 'Create game'} disabled={busy} onPress={create} />
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <Button
          label="Try the demo first (pretend students)"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/demo',
              // The demo always has two groups of 3 pretend students.
              params: { game: kind, level, minutes: String(DEMO_MINUTES), typing: typing ? '1' : '0' },
            })
          }
        />
        <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
});
