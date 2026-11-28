import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/core/app/supabase';
import { useNow } from '@/core/app/use-now';
import { SUPABASE_CORE_BACKEND } from '@/core/live/backend';
import { JoinCodeHero } from '@/core/live/join-code-hero';
import { LateJoinQr } from '@/core/live/late-join-qr';
import { StudentRoster } from '@/core/live/lobby';
import { updateSession, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { useHostActions } from '@/core/live/use-host-actions';
import { Slideshow } from '@/core/media/slideshow';
import { clearSessionPlaces, freshPlace, shareHostPlace, useSharePlace } from '@/core/place/shared-place';
import { usePosition } from '@/core/place/use-position';
import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ConfirmButton } from '@/core/ui/confirm-button';
import { ErrorNote, Notice } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { safetyRules } from '@/core/classes/safety-rules';
import { TOUR_WORK_REFRESH_MS, anyUnder18, fetchTourWork, isUnder18, withUnder18, type GroupWork } from '@/lib/tour-live';
import { isStopVisited, tourSlides, type Tour } from '@/lib/tours';
import { TourTeacherScreen, type SupervisingAdult, type TourGroupStatus } from '@/screens/tour-teacher-screen';

/** The teacher's phone or laptop in a live GPS tour: waiting room, live map, slideshows. */
export function TourHostLive({
  tour,
  session,
  participants,
  onSession,
  onParticipants,
}: {
  tour: Tour;
  session: LiveSession;
  participants: LiveParticipant[];
  onSession: (session: LiveSession) => void;
  onParticipants: (participants: LiveParticipant[]) => void;
}) {
  // The teacher's view uses the under-18 rules (sight distance) for groups marked under 18.
  const someUnder18 = anyUnder18(session);
  const rules = useMemo(() => safetyRules(someUnder18 ? 'under-18' : 'adults'), [someUnder18]);
  const { error, remove } = useHostActions({
    backend: SUPABASE_CORE_BACKEND,
    session,
    participants,
    onSession,
    onParticipants,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(10_000);

  // The teacher's phone counts as the supervising adult: it shares its place while the tour runs.
  const [shareMine, setShareMine] = useState(true);
  const playing = session.status === 'playing';
  const position = usePosition(playing && shareMine);
  useSharePlace(position.fix, playing && shareMine, (fix) => shareHostPlace(session.id, fix));

  // The groups' work, re-read every so often.
  const [work, setWork] = useState<Record<string, GroupWork>>({});
  const reload = useCallback(() => {
    fetchTourWork(session.id)
      .then(setWork)
      .catch(() => {});
  }, [session.id]);
  useEffect(() => {
    if (session.status === 'lobby') return;
    reload();
    if (session.status !== 'playing') return;
    const timer = setInterval(reload, TOUR_WORK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [session.status, reload]);

  const [showing, setShowing] = useState<string | null>(null);

  async function setStatus(status: LiveSession['status']) {
    setBusy(true);
    setProblem(null);
    try {
      const saved = await updateSession(session, { status });
      if (saved) onSession(saved);
      if (status === 'finished') await clearSessionPlaces(session.id);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleUnder18(participantId: string) {
    setProblem(null);
    try {
      const categories = withUnder18(session, participantId, !isUnder18(session, participantId));
      const saved = await updateSession(session, { categories });
      if (saved) onSession(saved);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }

  const under18Switches =
    participants.length === 0 ? null : (
      <View style={styles.column}>
        <ThemedText type="smallBold">Under 18?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Everyone counts as an adult. Tap a group if anyone in it is under 18: their phone shares where it is with you,
          they must stay within {rules.maxFromAdultM} m of you, and places open only when you are near.
        </ThemedText>
        <View style={styles.chips}>
          {participants.map((p) => (
            <Chip
              key={p.id}
              label={`${isUnder18(session, p.id) ? '✓ ' : ''}${p.name}: under 18`}
              selected={isUnder18(session, p.id)}
              onPress={() => toggleUnder18(p.id)}
            />
          ))}
        </View>
      </View>
    );

  const shown = participants.find((p) => p.id === showing);
  if (shown) {
    const w = work[shown.id] ?? { work: {}, visitOrder: [] };
    return (
      <Screen>
        <Slideshow title={`${shown.name} · ${tour.title}`} slides={tourSlides(tour, w.work, w.visitOrder)} onClose={() => setShowing(null)} />
      </Screen>
    );
  }

  const slideshowButtons = (
    <View style={styles.column}>
      <ThemedText type="smallBold">Slideshows</ThemedText>
      {participants.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No groups yet.
        </ThemedText>
      ) : (
        <View style={styles.chips}>
          {participants.map((p) => {
            const n = tour.stops.filter((s) => isStopVisited(s, work[p.id]?.work ?? {})).length;
            return <Chip key={p.id} label={`▶ ${p.name} (${n})`} onPress={() => setShowing(p.id)} />;
          })}
        </View>
      )}
      <Button label="Refresh the groups' work" variant="secondary" onPress={reload} />
    </View>
  );

  if (session.status === 'lobby') {
    return (
      <Screen>
        <ThemedText type="subtitle">🗺️ {tour.title}</ThemedText>
        <JoinCodeHero code={session.code} />
        <StudentRoster participants={participants} onRemove={remove} />
        <ThemedText type="small" themeColor="textSecondary">
          Each phone that joins is one group: one phone per group, with the group&apos;s name (e.g. &quot;Team Dragons&quot;).
          Adult groups go where they like; you see the places they have reached.
          {someUnder18 ? ' Keep this page open on your phone while you walk, so under-18 groups can open places.' : ''}
        </ThemedText>
        {under18Switches}
        <Button label={busy ? 'Starting…' : 'Start the tour'} disabled={busy || participants.length === 0} onPress={() => setStatus('playing')} />
        <Button label="Cancel" variant="secondary" onPress={() => router.replace('/dashboard')} />
        <ErrorNote message={problem ?? error} />
      </Screen>
    );
  }

  if (session.status === 'finished') {
    return (
      <Screen>
        <ThemedText type="subtitle">The tour has ended</ThemedText>
        <ThemedText themeColor="textSecondary">
          Location is off on every phone. To show the slideshows in class, open the dashboard on the classroom computer
          and choose &quot;📽️ Tour results&quot;.
        </ThemedText>
        <Button
          label="📽️ Present on this screen (plays by itself)"
          onPress={() => router.push({ pathname: '/tour-results', params: { session: session.id } })}
        />
        {slideshowButtons}
        <Button label="Back to the dashboard" variant="secondary" onPress={() => router.replace('/dashboard')} />
      </Screen>
    );
  }

  const teacherAt = position.fix ?? freshPlace(session.host_place, now);
  const adults: SupervisingAdult[] = teacherAt ? [{ id: 'teacher', label: 'You', at: teacherAt }] : [];
  const groups: TourGroupStatus[] = participants.map((p) => {
    const w = work[p.id];
    const last = w?.visitOrder[w.visitOrder.length - 1];
    return {
      id: p.id,
      name: p.name,
      at: isUnder18(session, p.id) ? freshPlace(p.live_place, now) : null,
      under18: isUnder18(session, p.id),
      visited: w ? tour.stops.filter((s) => isStopVisited(s, w.work)).length : 0,
      lastStop: tour.stops.find((s) => s.id === last)?.name ?? null,
    };
  });

  return (
    <Screen>
      <TourTeacherScreen tour={tour} rules={rules} groups={groups} adults={adults} onToggleUnder18={toggleUnder18}>
        <View style={styles.chips}>
          <Chip label="📍 Share my location" selected={shareMine} onPress={() => setShareMine(true)} />
          <Chip label="Off" selected={!shareMine} onPress={() => setShareMine(false)} />
        </View>
        {position.problem ? <Notice text={position.problem} /> : null}
        {rules.needsAdultNearby && !shareMine ? (
          <Notice tone="danger" text="Your location is off, so under-18 groups can't open any stops." />
        ) : null}
        {slideshowButtons}
        <View style={styles.column}>
          <ThemedText type="smallBold">Code words (if a phone has no GPS signal at a stop)</ThemedText>
          {tour.stops.map((s, i) => (
            <ThemedText key={s.id} type="small" themeColor="textSecondary">
              {i + 1}. {s.name}: “{s.backupCode}”
            </ThemedText>
          ))}
        </View>
        <LateJoinQr code={session.code} demo={false} />
        <ConfirmButton
          label="End the tour"
          busy={busy}
          busyLabel="Ending…"
          title="End the tour now?"
          detail="Location switches off on every phone and everyone's place is deleted. The work and slideshows are kept."
          yesLabel="Yes, end it"
          onConfirm={() => setStatus('finished')}
        />
        <ErrorNote message={problem ?? error} />
      </TourTeacherScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
