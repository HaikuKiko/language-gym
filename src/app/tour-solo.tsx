import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { safetyRules } from '@/core/classes/safety-rules';
import { canMakeVideo, downloadFile, makeSlideVideo } from '@/core/media/slide-video';
import { usePosition } from '@/core/place/use-position';
import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ErrorNote, Notice } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { TOURS } from '@/data/tour-routes';
import { tourSlides, type TaskWork, type TourWork } from '@/lib/tours';
import { TourGroupScreen } from '@/screens/tour-group-screen';

// ===========================================================================
// Settings
// ===========================================================================

/** The group name on a solo try-out. */
const SOLO_GROUP = 'My group';

// ===========================================================================

const ADULT_RULES = safetyRules('adults');

/**
 * Solo try-out: anyone opens a tour on one phone with real GPS, no account, no
 * teacher. Nothing is saved (photos and recordings stay on the phone until the
 * page is closed). Away from the route, the code words open the places.
 */
export default function TourSoloRoute() {
  const [tourId, setTourId] = useState(TOURS[0].id);
  const [started, setStarted] = useState(false);
  const [work, setWork] = useState<TourWork>({});
  const [visitOrder, setVisitOrder] = useState<string[]>([]);
  const position = usePosition(started);
  const tour = TOURS.find((t) => t.id === tourId) ?? TOURS[0];
  const [videoShare, setVideoShare] = useState<number | null>(null);
  const [videoProblem, setVideoProblem] = useState<string | null>(null);

  async function saveVideo() {
    setVideoProblem(null);
    setVideoShare(0);
    try {
      const { blob, ext } = await makeSlideVideo({
        title: tour.title,
        subtitle: SOLO_GROUP,
        slides: tourSlides(tour, work, visitOrder),
        onProgress: setVideoShare,
      });
      downloadFile(blob, `${tour.title.replace(/[^\p{L}\p{N}]+/gu, '-')}.${ext}`);
    } catch (e) {
      setVideoProblem(e instanceof Error ? e.message : "Couldn't make the video.");
    } finally {
      setVideoShare(null);
    }
  }

  function saveTask(stopId: string, taskId: string, taskWork: TaskWork) {
    setWork((w) => ({ ...w, [stopId]: { ...w[stopId], [taskId]: taskWork } }));
    setVisitOrder((o) => (o.includes(stopId) ? o : [...o, stopId]));
  }

  if (!started) {
    return (
      <Screen>
        <View style={styles.section}>
          <ThemedText type="subtitle">🗺️ Try a GPS tour</ThemedText>
          <ThemedText themeColor="textSecondary">
            Walk to places on a route. The tasks at a place (photo, writing, sound) open when you get there, and your
            work becomes a slideshow you can save as a video. A try-out on your own phone: no account needed, and your
            work stays on your phone.
          </ThemedText>
        </View>
        {TOURS.length > 1 ? (
          <View style={styles.chips}>
            {TOURS.map((t) => (
              <Chip key={t.id} label={t.title} selected={t.id === tourId} onPress={() => setTourId(t.id)} />
            ))}
          </View>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {tour.title}: {tour.description} Not there? Each place shows a code word that opens it, so you can try the tasks
          from anywhere.
        </ThemedText>
        <Notice text="Your phone will ask to use your location. It stays on this phone and is never sent anywhere." />
        <Button label="Start (uses your location)" onPress={() => setStarted(true)} />
        <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TourGroupScreen
        tour={tour}
        groupName={SOLO_GROUP}
        rules={ADULT_RULES}
        fix={position.fix}
        positionProblem={position.problem}
        adults={[]}
        work={work}
        visitOrder={visitOrder}
        onSaveTask={saveTask}
        showCodes
      />
      {canMakeVideo() && visitOrder.length > 0 ? (
        <Button
          label={
            videoShare === null
              ? '🎬 Save my slideshow as a video'
              : `Making the video… ${Math.round(videoShare * 100)}% (keep this page open)`
          }
          variant="secondary"
          disabled={videoShare !== null}
          onPress={saveVideo}
        />
      ) : null}
      <ErrorNote message={videoProblem} />
      <Notice text="Try-out: your work and slideshow stay on this phone (nothing goes to our server), until you close this page. Keep it open while you walk." />
      <Button
        label="Start again"
        variant="secondary"
        onPress={() => {
          setWork({});
          setVisitOrder([]);
          setStarted(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
