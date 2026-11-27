import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LiveSession } from '@/lib/live-session';
import { useSessionBackend } from '@/lib/session-backend';
import type { SessionEvent } from '@/lib/session-events';
import { errorMessage } from '@/lib/supabase';
import { isTyping, type WordGameKind } from '@/lib/word-game';
import { gameResults, personalLine } from '@/lib/word-game-results';

/**
 * The awards at the end of a word game: points, fastest guessers, best
 * explainers, … With `myId`, a student's own line comes first; with
 * `teacher`, the hardest words and the groups are shown too.
 */
export function GameAwards({
  kind,
  session,
  myId,
  teacher = false,
}: {
  kind: WordGameKind;
  session: LiveSession;
  myId?: string;
  teacher?: boolean;
}) {
  const theme = useTheme();
  const backend = useSessionBackend();
  const [events, setEvents] = useState<SessionEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    backend
      .fetchEvents(session.id)
      .then((list) => !cancelled && setEvents(list))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [backend, session.id, session.status]);

  if (error) {
    return (
      <ThemedText type="small" themeColor="warning">
        Couldn&apos;t load the awards: {error}
      </ThemedText>
    );
  }
  if (!events) return <ThemedText themeColor="textSecondary">Adding up the points…</ThemedText>;

  const results = gameResults(kind, session, events);
  const mine = myId ? personalLine(results, myId) : '';

  return (
    <View style={styles.wrap}>
      {mine !== '' && (
        <View style={[styles.mine, { backgroundColor: theme.successSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.successText }}>
            You: {mine}
          </ThemedText>
        </View>
      )}
      {results.wordsDone === 0 && (
        <ThemedText themeColor="textSecondary">No words were guessed in this game.</ThemedText>
      )}
      <View style={styles.grid}>
        {results.awards.map((award) => (
          <View key={award.title} style={[styles.award, styles.tile, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">
              {award.emoji} {award.title}
            </ThemedText>
            {award.lines.map((line, i) => (
              <ThemedText
                key={i}
                type="small"
                style={line.id && line.id === myId ? { color: theme.accent, fontWeight: 700 } : undefined}>
                {i + 1}. {line.text}
              </ThemedText>
            ))}
          </View>
        ))}
      </View>

      {teacher && results.hardWords.length > 0 && (
        <View style={[styles.award, { backgroundColor: theme.markABg }]}>
          <ThemedText type="smallBold" style={{ color: theme.markA }}>
            Hardest words
          </ThemedText>
          {results.hardWords.map((w) => (
            <ThemedText key={w.word} type="small" style={{ color: theme.markA }}>
              <ThemedText type="smallBold" style={{ color: theme.markA }}>
                {w.word}
              </ThemedText>
              {[
                w.skipped > 0 && `skipped ${w.skipped}× (${w.missedBy.join(', ')})`,
                w.hints > 0 && `meaning opened ${w.hints}×`,
                w.guessed > 0 && w.avgSeconds != null && `guessed in ${Math.round(w.avgSeconds)}s`,
              ]
                .filter(Boolean)
                .map((s) => ` · ${s}`)
                .join('')}
            </ThemedText>
          ))}
        </View>
      )}

      {teacher && results.hardToSpell.length > 0 && (
        <View style={[styles.award, { backgroundColor: theme.markABg }]}>
          <ThemedText type="smallBold" style={{ color: theme.markA }}>
            Hard to spell
          </ThemedText>
          {results.hardToSpell.map((w) => (
            <ThemedText key={w.word} type="small" style={{ color: theme.markA }}>
              <ThemedText type="smallBold" style={{ color: theme.markA }}>
                {w.word}
              </ThemedText>
              {' · typed as '}
              {w.tries.join(', ')}
            </ThemedText>
          ))}
        </View>
      )}

      {teacher && results.groups.length > 1 && (
        <View style={[styles.award, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">👥 Groups</ThemedText>
          {results.groups.map((g) => (
            <ThemedText key={g.index} type="small">
              {g.label} ({g.names.join(', ')}): {g.words} {g.words === 1 ? 'word' : 'words'}
            </ThemedText>
          ))}
        </View>
      )}

      {teacher && results.players.length > 0 && (
        <View style={[styles.award, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Everyone</ThemedText>
          {results.players.map((p) => (
            <ThemedText key={p.id} type="small">
              {p.name}: {p.points} points · guessed {p.guessed} · {kind === 'hot-seat' ? 'described' : 'explained'}{' '}
              {p.explained} · meanings opened {p.hints}
              {isTyping(session) ? ` · spelling mistakes ${p.spellingMistakes}` : ''}
            </ThemedText>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 220,
  },
  mine: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  award: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
});
