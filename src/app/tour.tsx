import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/core/app/supabase';
import { ClassPicker } from '@/core/classes/class-picker';
import { classFlags, useChosenClass, useClasses } from '@/core/classes/classes';
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
  const classes = useClasses();
  const [classId, setClassId] = useChosenClass(classes);
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
        flags: [...tourFlags(tour.id), ...classFlags(classId)],
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

      <ClassPicker classes={classes} value={classId} onChange={setClassId} />

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

      <ThemedText type="small" themeColor="textSecondary">
        Everyone counts as an adult. In the waiting room you can mark any group under 18: their phone then shares where
        it is with you, they must stay within {MAX_FROM_ADULT_M} m of you, places open only when you are near, and
        recordings of people are voice only.
      </ThemedText>

      <View style={styles.section}>
        <Button label={busy ? 'Creating…' : 'Create the tour'} disabled={busy} onPress={create} />
        <ErrorNote message={error} />
        <Button label="Try the demo first (pretend walk)" variant="secondary" onPress={() => router.push('/tour-demo')} />
        <Button
          label="📱 Solo on one phone (anyone can try it, no account)"
          variant="secondary"
          onPress={() => router.push('/tour-solo')}
        />
        <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
