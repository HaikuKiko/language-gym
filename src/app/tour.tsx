import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/core/app/supabase';
import { MAX_FROM_ADULT_M } from '@/core/classes/safety-rules';
import { createSession } from '@/core/live/session';
import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ErrorNote } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { TOURS } from '@/data/tour-routes';
import { TOUR_MINUTES, tourFlags } from '@/lib/tour-live';

/** The teacher sets up a GPS tour and gets a join code. */
export default function TourSetupRoute() {
  const [tourId, setTourId] = useState(TOURS[0].id);
  const [under18, setUnder18] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tour = TOURS.find((t) => t.id === tourId) ?? TOURS[0];

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const session = await createSession({
        level: tour.level,
        week: null,
        roundMinutes: TOUR_MINUTES,
        roundCount: 1,
        autoAdvance: false,
        flags: tourFlags(tour.id, under18),
      });
      router.replace({ pathname: '/session/[code]', params: { code: session.code } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.section}>
        <ThemedText type="subtitle">🗺️ GPS tours</ThemedText>
        <ThemedText themeColor="textSecondary">
          Groups walk to places on a route. The tasks at a place (photo, writing, sound) open only when the group is
          there. Their work becomes a slideshow to present.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Route</ThemedText>
        <View style={styles.chips}>
          {TOURS.map((t) => (
            <Chip key={t.id} label={t.title} selected={t.id === tourId} onPress={() => setTourId(t.id)} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {tour.description} {tour.stops.length} places, level {tour.level}.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Are any students under 18?</ThemedText>
        <View style={styles.chips}>
          <Chip label="Yes, some are" selected={under18} onPress={() => setUnder18(true)} />
          <Chip label="No, all adults" selected={!under18} onPress={() => setUnder18(false)} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {under18
            ? `Under-18 groups share where they are with you during the tour (only their newest place, deleted at the end). They must stay within ${MAX_FROM_ADULT_M} m of you, and places open only when you are near. Recordings of people are voice only.`
            : 'Adult groups go where they like and do not share where they are.'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <Button label={busy ? 'Creating…' : 'Create the tour'} disabled={busy} onPress={create} />
        <ErrorNote message={error} />
        <Button label="Try the demo first (pretend walk)" variant="secondary" onPress={() => router.push('/tour-demo')} />
        <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
