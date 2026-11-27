import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { MAX_FROM_ADULT_M, safetyRules } from '@/core/classes/safety-rules';
import { distanceM, moveBy, nearest, stepTowards, type Fix, type LatLng } from '@/core/place/geo';
import { PlaceMap, type MapPin } from '@/core/place/place-map';
import { usePosition } from '@/core/place/use-position';
import { BRIGHTON_TOUR } from '@/data/tour-routes';
import { useTheme } from '@/core/ui/use-theme';
import { isStopVisited, type TaskWork, type TourStop, type TourWork } from '@/lib/tours';
import { TourGroupScreen } from '@/screens/tour-group-screen';
import { TourTeacherScreen, type SupervisingAdult, type TourGroupStatus } from '@/screens/tour-teacher-screen';

// ===========================================================================
// Settings
// ===========================================================================

/** Your group in the demo. */
const DEMO_GROUP = 'Team Dragons';
/** The pretend groups that walk the route by themselves. */
const PRETEND_GROUPS = ['Tigers', 'Owls', 'Pandas'];
/** The group that sometimes wanders off (to show the "come back" warning). */
const WANDERER = 'Pandas';
/** How often the pretend groups move, and how far each time (sped up for the demo). */
const TICK_MS = 1000;
const STEP_M = 18;
/** A pretend group stays at a place this many ticks to "do the tasks". */
const STAY_TICKS = 6;
/** How often (per arrival) the wanderer heads off instead, and how far. */
const WANDER_CHANCE = 0.35;
const WANDER_M = 170;
/** A helper adult who waits at Pavilion Gardens (so the demo shows more than one adult). */
const HELPER = { id: 'helper', label: 'Helper', stopId: 'pavilion-gardens' };
/** Screens at least this wide show the teacher screen and the phone side by side. */
const SIDE_BY_SIDE_WIDTH = 1000;

// ===========================================================================

type Walker = 'together' | 'group' | 'teacher';
type Pretend = {
  id: string;
  name: string;
  at: LatLng;
  target: LatLng;
  targetStop: string | null;
  visited: string[];
  stay: number;
};

const tour = BRIGHTON_TOUR;
const start: LatLng = { lat: tour.meetingPoint.lat, lng: tour.meetingPoint.lng };

/** A pretend group's next place: an unvisited stop near its teacher, or else near the teacher. */
function nextTarget(g: Pretend, adults: LatLng[]): Pick<Pretend, 'target' | 'targetStop'> {
  if (g.name === WANDERER && Math.random() < WANDER_CHANCE) {
    return { target: moveBy(g.at, WANDER_M, Math.random() * 360), targetStop: null };
  }
  const options = tour.stops.filter(
    (s) => !g.visited.includes(s.id) && (nearest(s.at, adults)?.distance ?? Infinity) <= MAX_FROM_ADULT_M,
  );
  const stop: TourStop | undefined = options[Math.floor(Math.random() * options.length)];
  if (stop) return { target: stop.at, targetStop: stop.id };
  const adult = nearest(g.at, adults);
  return { target: adult ? moveBy(adult.place, 30, Math.random() * 360) : g.at, targetStop: null };
}

function freshPretend(): Pretend[] {
  return PRETEND_GROUPS.map((name, i) => {
    const at = moveBy(start, 15 + i * 10, i * 120);
    return { id: name.toLowerCase(), name, at, target: at, targetStop: null, visited: [], stay: 2 + i * 2 };
  });
}

/** The GPS tours demo: your group's phone and the teacher's screen, with a pretend walk round Brighton. */
export default function TourDemo() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const sideBySide = width >= SIDE_BY_SIDE_WIDTH;
  const [tab, setTab] = useState<'phone' | 'teacher'>('phone');

  const [under18, setUnder18] = useState(true);
  const [realGps, setRealGps] = useState(false);
  const [walker, setWalker] = useState<Walker>('together');
  const [groupAt, setGroupAt] = useState<LatLng>(start);
  const [teacherAt, setTeacherAt] = useState<LatLng>(moveBy(start, 12, 200));
  const [work, setWork] = useState<TourWork>({});
  const [visitOrder, setVisitOrder] = useState<string[]>([]);
  const [pretend, setPretend] = useState<Pretend[]>(freshPretend);
  const [ended, setEnded] = useState(false);

  const rules = useMemo(() => safetyRules(under18 ? 'under-18' : 'adults'), [under18]);
  const position = usePosition(realGps && !ended);
  const fix: Fix | null = realGps ? position.fix : { ...groupAt, accuracy: 0 };
  // With real GPS, the demo pretends a teacher walks with you.
  const teacherPlace = realGps ? (position.fix ?? teacherAt) : teacherAt;

  const helperStop = tour.stops.find((s) => s.id === HELPER.stopId);
  const adults: SupervisingAdult[] = useMemo(
    () => [
      { id: 'teacher', label: 'Teacher', at: teacherPlace },
      ...(helperStop ? [{ id: HELPER.id, label: HELPER.label, at: moveBy(helperStop.at, 20, 90) }] : []),
    ],
    [teacherPlace, helperStop],
  );
  const adultPlaces = useMemo(() => adults.map((a) => a.at), [adults]);

  // The pretend groups walk, staying with the teacher (the helper waits further on).
  useEffect(() => {
    const withTeacher = [teacherPlace];
    if (ended) return;
    const timer = setInterval(() => {
      setPretend((groups) =>
        groups.map((g) => {
          if (g.stay > 0) return { ...g, stay: g.stay - 1 };
          if (distanceM(g.at, g.target) < 1) {
            const visited = g.targetStop && !g.visited.includes(g.targetStop) ? [...g.visited, g.targetStop] : g.visited;
            const arrivedAtStop = g.targetStop !== null;
            const next = { ...g, visited };
            return { ...next, ...nextTarget(next, withTeacher), stay: arrivedAtStop ? STAY_TICKS : 1 };
          }
          return { ...g, at: stepTowards(g.at, g.target, STEP_M) };
        }),
      );
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [ended, teacherPlace]);

  function walkTo(at: LatLng) {
    if (walker !== 'teacher') setGroupAt(at);
    if (walker === 'teacher') setTeacherAt(at);
    if (walker === 'together') setTeacherAt(moveBy(at, 12, 200));
  }

  function saveTask(stopId: string, taskId: string, taskWork: TaskWork) {
    setWork((w) => ({ ...w, [stopId]: { ...w[stopId], [taskId]: taskWork } }));
    setVisitOrder((o) => (o.includes(stopId) ? o : [...o, stopId]));
  }

  function restart() {
    setGroupAt(start);
    setTeacherAt(moveBy(start, 12, 200));
    setWork({});
    setVisitOrder([]);
    setPretend(freshPretend());
    setEnded(false);
  }

  const groups: TourGroupStatus[] = [
    {
      id: 'dragons',
      name: DEMO_GROUP,
      at: rules.shareLiveLocation ? fix : null,
      visited: tour.stops.filter((s) => isStopVisited(s, work)).length,
      lastStop: tour.stops.find((s) => s.id === visitOrder[visitOrder.length - 1])?.name ?? null,
    },
    ...pretend.map((g) => ({
      id: g.id,
      name: g.name,
      at: rules.shareLiveLocation ? g.at : null,
      visited: g.visited.length,
      lastStop: tour.stops.find((s) => s.id === g.visited[g.visited.length - 1])?.name ?? null,
    })),
  ];

  const walkPins: MapPin[] = [
    ...tour.stops.map((s, i) => ({ id: s.id, at: s.at, label: String(i + 1), color: '#1570D1', kind: 'stop' as const })),
    ...adults.map((a) => ({ id: a.id, at: a.at, label: a.label, color: '#1A8F52', kind: 'person' as const })),
    ...(fix ? [{ id: 'you', at: fix as LatLng, label: 'You', color: '#5B3CC4', kind: 'person' as const }] : []),
  ];

  const controls = (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Demo controls</ThemedText>
      <View style={styles.chips}>
        <Chip label="Under 18" selected={under18} onPress={() => setUnder18(true)} />
        <Chip label="Adults" selected={!under18} onPress={() => setUnder18(false)} />
        <Chip label="Pretend walk" selected={!realGps} onPress={() => setRealGps(false)} />
        <Chip label="Real GPS (in Brighton)" selected={realGps} onPress={() => setRealGps(true)} />
      </View>
      {realGps ? (
        <ThemedText type="small" themeColor="textSecondary">
          Using this phone&apos;s location. The demo pretends a teacher walks with you.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Tap the map to walk there:
          </ThemedText>
          <View style={styles.chips}>
            <Chip label="Group + teacher" selected={walker === 'together'} onPress={() => setWalker('together')} />
            <Chip label="Only the group" selected={walker === 'group'} onPress={() => setWalker('group')} />
            <Chip label="Only the teacher" selected={walker === 'teacher'} onPress={() => setWalker('teacher')} />
          </View>
          <PlaceMap centre={tour.meetingPoint} fit={tour.stops.map((s) => s.at)} pins={walkPins} onTap={walkTo} height={sideBySide ? 280 : 240} />
        </>
      )}
    </View>
  );

  const phone = (
    <View style={[styles.phone, { borderColor: theme.text, backgroundColor: theme.background }]}>
      <TourGroupScreen
        tour={tour}
        groupName={DEMO_GROUP}
        rules={rules}
        fix={fix}
        positionProblem={realGps ? position.problem : null}
        adults={adultPlaces}
        work={work}
        visitOrder={visitOrder}
        onSaveTask={saveTask}
        showCodes
      />
    </View>
  );

  const teacher = (
    <TourTeacherScreen tour={tour} rules={rules} groups={groups} adults={adults} onEnd={() => setEnded(true)} />
  );

  return (
    <ThemedView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.banner, { backgroundColor: theme.noticeBg }]}>
          <ThemedText type="smallBold" style={styles.flex}>
            Demo: GPS tour of Brighton. Nothing is saved.
          </ThemedText>
          <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} />
        </View>
        {ended ? (
          <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">The tour has ended. Location is off on every phone.</ThemedText>
            <Button label="Start again" onPress={restart} />
          </View>
        ) : sideBySide ? (
          <View style={styles.sideBySide}>
            <View style={styles.teacherColumn}>{teacher}</View>
            <View style={styles.phoneColumn}>
              {controls}
              {phone}
            </View>
          </View>
        ) : (
          <>
            {controls}
            <View style={styles.chips}>
              <Chip label="📱 Group's phone" selected={tab === 'phone'} onPress={() => setTab('phone')} />
              <Chip label="🧑‍🏫 Teacher" selected={tab === 'teacher'} onPress={() => setTab('teacher')} />
            </View>
            {tab === 'phone' ? phone : teacher}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two, borderRadius: Spacing.two },
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  sideBySide: { flexDirection: 'row', gap: Spacing.four, alignItems: 'flex-start' },
  teacherColumn: { flex: 1.3 },
  phoneColumn: { flex: 1, maxWidth: 440, gap: Spacing.three },
  phone: { borderWidth: 6, borderRadius: 28, padding: Spacing.three },
});
