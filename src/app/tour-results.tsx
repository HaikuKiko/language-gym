import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/core/app/supabase';
import { TeacherOnly } from '@/core/app/teacher-only';
import { MEDIA_RETENTION_DAYS } from '@/core/classes/safety-rules';
import { SlidePresenter, type SlideDeck } from '@/core/media/slide-presenter';
import { Button } from '@/core/ui/button';
import { ErrorNote } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { fetchMyTours, fetchTourDecks, type PastTour } from '@/lib/tour-live';

/** The classroom screen: the teacher's tours, and each group's slideshow played by itself. */
function TourResultsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ session?: string }>();
  const [tours, setTours] = useState<PastTour[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [showing, setShowing] = useState<{ tour: PastTour; decks: SlideDeck[] } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchMyTours()
      .then(setTours)
      .catch((e) => setProblem(errorMessage(e)));
  }, []);

  async function present(t: PastTour) {
    setLoading(t.session.id);
    setProblem(null);
    try {
      setShowing({ tour: t, decks: await fetchTourDecks(t.session, t.tour) });
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setLoading(null);
    }
  }

  // Opened from a tour's own page: go straight to its slideshows.
  const wanted = tours?.find((t) => t.session.id === params.session);
  useEffect(() => {
    if (wanted) present(wanted);
  }, [wanted]);

  if (showing) {
    const date = new Date(showing.tour.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return (
      <View style={styles.full}>
        <SlidePresenter
          title={`${showing.tour.tour.title} · ${date}`}
          decks={showing.decks}
          onClose={() => setShowing(null)}
        />
      </View>
    );
  }

  return (
    <Screen>
      <ThemedText type="subtitle">📽️ Tour results</ThemedText>
      <ThemedText themeColor="textSecondary">
        Open this on the classroom computer. Each group&apos;s slideshow plays by itself; you can pause, go back or switch
        group. Photos and recordings are kept for {MEDIA_RETENTION_DAYS} days.
      </ThemedText>
      {tours === null && !problem ? <ThemedText themeColor="textSecondary">Loading…</ThemedText> : null}
      {tours?.length === 0 ? <ThemedText themeColor="textSecondary">No tours yet.</ThemedText> : null}
      {(tours ?? []).map((t) => (
        <View key={t.session.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{t.tour.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {new Date(t.createdAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {t.session.status === 'playing' ? ' · still running' : ''}
          </ThemedText>
          <Button
            label={loading === t.session.id ? 'Loading…' : '▶ Present the slideshows'}
            disabled={loading !== null}
            onPress={() => present(t)}
          />
        </View>
      ))}
      <ErrorNote message={problem} />
      <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
    </Screen>
  );
}

export default function TourResultsRoute() {
  return (
    <TeacherOnly>
      <TourResultsScreen />
    </TeacherOnly>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, minHeight: '100%' },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
});
