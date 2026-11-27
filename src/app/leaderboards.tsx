import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ErrorNote } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { TeacherOnly } from '@/core/app/teacher-only';
import { errorMessage } from '@/core/app/supabase';
import { ClassPicker } from '@/core/classes/class-picker';
import { className, useChosenClass, useClasses } from '@/core/classes/classes';
import { Leaderboard } from '@/core/live/leaderboard';
import { SCORE_DAYS, fetchScores, nameKey, type SavedScore } from '@/core/live/scores';
import {
  ACTIVITIES,
  FOLLOW_UP_POINTS,
  SPEAKING_ROUND_POINTS,
  WORD_GAME_POINT_SCALE,
  WRITING_HANDED_IN_POINTS,
  fetchWritingScores,
  type Activity,
} from '@/lib/leaderboards';

// ===========================================================================
// Settings
// ===========================================================================

/** "This week" = the last this many days. */
const WEEK_DAYS = 7;

// ===========================================================================

type Period = 'week' | 'all';
const ACTIVITY_KEYS = Object.keys(ACTIVITIES) as Activity[];

/** Every leaderboard in one place: per class, per activity, this week or the last SCORE_DAYS. */
function LeaderboardsScreen() {
  const classes = useClasses();
  const [classId, setClassId] = useChosenClass(classes);
  const [activity, setActivity] = useState<Activity | 'all'>('all');
  const [period, setPeriod] = useState<Period>('week');
  const [scores, setScores] = useState<SavedScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setScores(null);
    setError(null);
    const days = period === 'week' ? WEEK_DAYS : SCORE_DAYS;
    Promise.all([fetchScores({ days, classId }), fetchWritingScores({ days, classId })])
      .then(([games, writing]) => !cancelled && setScores([...games, ...writing]))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [classId, period]);

  const rows = boardRows((scores ?? []).filter((s) => activity === 'all' || s.activity === activity));
  const title = [
    className(classes, classId) ?? 'All classes',
    activity === 'all' ? null : ACTIVITIES[activity].name,
    period === 'week' ? 'this week' : `last ${SCORE_DAYS} days`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen>
      <View style={styles.section}>
        <ThemedText type="subtitle">🏆 Leaderboards</ThemedText>
        <ThemedText themeColor="textSecondary">
          Points from quizzes, word games, speaking and writing, added up for each student.
        </ThemedText>
      </View>

      <ClassPicker classes={classes} value={classId} onChange={setClassId} noneLabel="All classes" />

      <View style={styles.section}>
        <ThemedText type="smallBold">Activity</ThemedText>
        <View style={styles.chips}>
          <Chip label="All" selected={activity === 'all'} onPress={() => setActivity('all')} />
          {ACTIVITY_KEYS.map((a) => (
            <Chip
              key={a}
              label={`${ACTIVITIES[a].emoji} ${ACTIVITIES[a].name}`}
              selected={activity === a}
              onPress={() => setActivity(a)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">When</ThemedText>
        <View style={styles.chips}>
          <Chip label="This week" selected={period === 'week'} onPress={() => setPeriod('week')} />
          <Chip label={`Last ${SCORE_DAYS} days`} selected={period === 'all'} onPress={() => setPeriod('all')} />
        </View>
      </View>

      <ErrorNote message={error} />
      {scores === null && !error ? (
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      ) : (
        <Leaderboard title={title} rows={rows} />
      )}

      <ThemedText type="small" themeColor="textSecondary">
        How points work: a quiz gives up to 1,000 a question (right and fast). A word game gives{' '}
        {WORD_GAME_POINT_SCALE} for each game point. Speaking gives {SPEAKING_ROUND_POINTS.toLocaleString()} a round
        plus {FOLLOW_UP_POINTS} for each follow-up question. Each piece of writing handed in gives{' '}
        {WRITING_HANDED_IN_POINTS.toLocaleString()}. Only activities started for a class count for that class.
      </ThemedText>

      <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
    </Screen>
  );
}

/** Adds up the scores by student, with a line showing each activity's share. */
function boardRows(scores: readonly SavedScore[]) {
  const byName = new Map<string, { name: string; points: number; parts: Map<string, number> }>();
  for (const s of scores) {
    const key = nameKey(s.name);
    const entry = byName.get(key) ?? { name: s.name.trim(), points: 0, parts: new Map<string, number>() };
    entry.points += s.points;
    entry.parts.set(s.activity, (entry.parts.get(s.activity) ?? 0) + s.points);
    // Prefer the short form the join page uses ("Mai T.") when both appear.
    if (s.name.trim().length < entry.name.length) entry.name = s.name.trim();
    byName.set(key, entry);
  }
  return [...byName.entries()]
    .map(([key, e]) => ({
      key,
      name: e.name,
      points: e.points,
      detail: ACTIVITY_KEYS.filter((a) => e.parts.has(a))
        .map((a) => `${ACTIVITIES[a].emoji} ${e.parts.get(a)!.toLocaleString()}`)
        .join(' · '),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export default function LeaderboardsRoute() {
  return (
    <TeacherOnly>
      <LeaderboardsScreen />
    </TeacherOnly>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
