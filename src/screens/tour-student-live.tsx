import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SUPABASE_CORE_BACKEND } from '@/core/live/backend';
import { leaveSession } from '@/core/live/leave';
import { StudentLobby } from '@/core/live/lobby';
import type { LiveParticipant, LiveSession } from '@/core/live/session';
import { Slideshow } from '@/core/media/slideshow';
import { freshPlace, shareStudentPlace, useSharePlace } from '@/core/place/shared-place';
import { usePosition } from '@/core/place/use-position';
import { useNow } from '@/core/app/use-now';
import { Button } from '@/core/ui/button';
import { Notice } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { fetchTourWork, saveTourWork, tourRules } from '@/lib/tour-live';
import { tourSlides, type TaskFiles, type TaskWork, type Tour, type TourWork } from '@/lib/tours';
import { TourGroupScreen } from '@/screens/tour-group-screen';

/** A student's phone in a live GPS tour (each phone is one group). */
export function TourStudentLive({ tour, session, me }: { tour: Tour; session: LiveSession; me: LiveParticipant }) {
  const rules = useMemo(() => tourRules(session), [session]);
  const playing = session.status === 'playing';
  const position = usePosition(playing);
  const now = useNow(10_000);
  const [work, setWork] = useState<TourWork>({});
  const [visitOrder, setVisitOrder] = useState<string[]>([]);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);

  // Share this phone's newest place with the teacher (under 18 only).
  useSharePlace(position.fix, playing && rules.shareLiveLocation, (fix) => shareStudentPlace(me.id, fix));
  // When the tour ends, this phone clears its own place too.
  const cleared = useRef(false);
  useEffect(() => {
    if (session.status === 'finished' && !cleared.current) {
      cleared.current = true;
      shareStudentPlace(me.id, null).catch(() => {});
    }
  }, [session.status, me.id]);

  // After a reload, get back what this group already saved.
  useEffect(() => {
    if (session.status === 'lobby') return;
    let cancelled = false;
    fetchTourWork(session.id, me.id)
      .then((all) => {
        if (cancelled) return;
        const mine = all[me.id];
        if (!mine) return;
        setWork((local) => ({ ...mine.work, ...local }));
        setVisitOrder((local) => [...mine.visitOrder, ...local.filter((s) => !mine.visitOrder.includes(s))]);
      })
      .catch(() => !cancelled && setLoadProblem("Couldn't load your earlier work. It is still saved."));
    return () => {
      cancelled = true;
    };
  }, [session.id, session.status, me.id]);

  async function saveTask(stopId: string, taskId: string, taskWork: TaskWork, files?: TaskFiles) {
    await saveTourWork({ session, participantId: me.id, stopId, taskId, work: taskWork, files });
    setWork((w) => ({ ...w, [stopId]: { ...w[stopId], [taskId]: taskWork } }));
    setVisitOrder((o) => (o.includes(stopId) ? o : [...o, stopId]));
  }

  const teacher = freshPlace(session.host_place, now);
  const adults = teacher ? [teacher] : [];
  const notices = [
    ...(loadProblem ? [loadProblem] : []),
    ...(rules.needsAdultNearby && !teacher
      ? ["Waiting for your teacher's location. The stops open when your teacher is near (the teacher keeps the tour page open)."]
      : []),
  ];

  if (session.status === 'lobby') {
    return (
      <StudentLobby
        name={me.name}
        studentCount={1}
        intro={`We're going on a GPS tour: ${tour.title}. ${
          rules.shareLiveLocation ? 'During the tour, your teacher can see where your phone is.' : ''
        }`}
        leaveLabel="Leave"
        onLeave={() => leaveSession(SUPABASE_CORE_BACKEND, me, session)}
      />
    );
  }

  if (session.status === 'finished') {
    return (
      <Screen>
        <View style={styles.column}>
          <ThemedText type="subtitle">The tour has ended</ThemedText>
          <ThemedText themeColor="textSecondary">Location is off. Here is your slideshow to present.</ThemedText>
        </View>
        <Slideshow title={`${me.name} · ${tour.title}`} slides={tourSlides(tour, work, visitOrder)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TourGroupScreen
        tour={tour}
        groupName={me.name}
        rules={rules}
        fix={position.fix}
        positionProblem={position.problem}
        adults={adults}
        work={work}
        visitOrder={visitOrder}
        onSaveTask={saveTask}
        notices={notices}
      />
      <Notice text="Keep this page open while you walk. If your phone goes to sleep, open it again: your work is saved." />
      <Button label="Leave the tour" variant="secondary" onPress={() => leaveSession(SUPABASE_CORE_BACKEND, me, session)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: Spacing.two },
});
