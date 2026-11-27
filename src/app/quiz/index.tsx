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
import { Leaderboard } from '@/core/live/leaderboard';
import { SCORE_DAYS, fetchLeaderboard, type LeaderboardEntry } from '@/core/live/scores';
import { QUIZ_ACTIVITY, fetchQuizSets, sortLevels, type QuizSet } from '@/lib/grammar-quiz';

/** Grammar quizzes: the teacher's weeks of quizzes, and the leaderboard over SCORE_DAYS. */
function QuizzesScreen() {
  const [sets, setSets] = useState<QuizSet[] | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizSets()
      .then(setSets)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!showBoard || board) return;
    fetchLeaderboard(QUIZ_ACTIVITY)
      .then(setBoard)
      .catch((e) => setError(errorMessage(e)));
  }, [showBoard, board]);

  return (
    <Screen>
      <View style={styles.section}>
        <ThemedText type="subtitle">❓ Grammar quizzes</ThemedText>
        <ThemedText themeColor="textSecondary">
          Type (or photograph) the week&apos;s grammar for each level, and Claude writes the quizzes. The class plays
          them on their phones; points add up over the week.
        </ThemedText>
        <Button label="✨ Make this week's quizzes" onPress={() => router.push('/quiz/new')} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Your weeks</ThemedText>
        {sets === null && !error && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}
        {sets?.length === 0 && (
          <ThemedText themeColor="textSecondary">None yet. Make the first one above.</ThemedText>
        )}
        {sets?.map((s) => (
          <Button
            key={s.id}
            variant="secondary"
            label={`${s.name} · ${sortLevels(s.levels).join(' + ')} · ${s.quiz_count} ${s.quiz_count === 1 ? 'quiz' : 'quizzes'}`}
            onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: s.id } })}
          />
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.chips}>
          <Chip
            label={`🏆 Leaderboard (last ${SCORE_DAYS} days)`}
            selected={showBoard}
            onPress={() => setShowBoard((v) => !v)}
          />
        </View>
        {showBoard &&
          (board ? (
            <Leaderboard
              rows={board.map((e) => ({
                key: e.name,
                name: e.name,
                points: e.points,
                note: `${e.games} ${e.games === 1 ? 'quiz' : 'quizzes'}`,
              }))}
            />
          ) : (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          ))}
      </View>

      <ErrorNote message={error} />
      <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
    </Screen>
  );
}

export default function QuizzesRoute() {
  return (
    <TeacherOnly>
      <QuizzesScreen />
    </TeacherOnly>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
