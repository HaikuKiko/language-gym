import { useEffect, useState } from 'react';

import { fetchParticipants, fetchSessionByCode, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { ensureSignedIn, errorMessage, requireSupabase } from '@/core/app/supabase';

/** How often to re-read the session, as a safety net behind live updates. */
const REFRESH_INTERVAL_MS = 5000;
/**
 * Big groups (assemblies): every change to a student's row goes live to every
 * phone, so 50 phones tapping at once means thousands of messages, more than
 * Supabase allows per second, and live updates stop for everyone. Above this
 * many students, students' phones stop listening for other students' changes
 * and re-read the list every BIG_GROUP_REFRESH_MS instead. The teacher's screen
 * and the teacher's own changes (next round, start, stop) stay live.
 */
const LIVE_STUDENT_UPDATES_UP_TO = 20;
const BIG_GROUP_REFRESH_MS = 3000;
const STUDENT_LIVE_DELAY_MS = 5000;
/**
 * When the server is slow or a re-read fails, a phone waits longer before
 * the next one (doubling each time, up to this), so a hall of phones doesn't
 * keep a struggling server down. Back to normal after the next success.
 */
const SLOW_SERVER_MAX_WAIT_MS = 30_000;
/** Stop waiting for the first connection after this long and offer "Try again". */
const CONNECT_TIMEOUT_MS = 15_000;

export type LiveSessionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      session: LiveSession;
      participants: LiveParticipant[];
      /** This device's guest ID. */
      userId: string;
    };

/**
 * Loads a session by its join code and keeps it up to date: changes arrive
 * live from Supabase, and the session is also re-read every few seconds in
 * case a live update is missed (for example while a phone was asleep).
 */
export function useLiveSession(code: string) {
  const [state, setState] = useState<LiveSessionState>({ status: 'loading' });
  /** Goes up each time "Try again" is tapped, which connects again. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cleanUp = () => {};

    async function connect() {
      const client = requireSupabase();
      const userId = await ensureSignedIn();
      const session = await fetchSessionByCode(code);
      if (!session) throw new Error('No session found with that code.');
      const participants = await fetchParticipants(session.id);
      if (cancelled) return;

      setState({ status: 'ready', session, participants, userId });

      const isHost = session.host_id === userId;
      const channel = client
        .channel(`session-${session.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
          (payload) => {
            const latest = payload.new as LiveSession;
            setState((prev) => (prev.status === 'ready' ? { ...prev, session: latest } : prev));
          },
        )
        .subscribe();

      // Students' changes (joining, taps): live while the group is small (see
      // LIVE_STUDENT_UPDATES_UP_TO); always live on the teacher's screen.
      // A student's phone waits STUDENT_LIVE_DELAY_MS before listening, so
      // when a whole hall scans the QR code at once, the phones see the big
      // group first and never start listening.
      let studentChannel: ReturnType<typeof client.channel> | null = null;
      const listenToStudents = () =>
        client
          .channel(`session-students-${session.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'participants',
              filter: `session_id=eq.${session.id}`,
            },
            () => reloadStudents(),
          )
          .subscribe();
      if (isHost) studentChannel = listenToStudents();
      const listenLater = isHost
        ? undefined
        : setTimeout(async () => {
            await reloadStudents();
            if (!cancelled && !bigGroup) studentChannel = listenToStudents();
          }, STUDENT_LIVE_DELAY_MS);
      let bigGroup = false;
      // One re-read at a time; after a failure, wait longer before the next.
      let studentsBusy = false;
      let studentsBackoffMs = 0;
      const reloadStudents = async () => {
        if (studentsBusy) return;
        studentsBusy = true;
        const latest = await fetchParticipants(session.id).catch(() => null);
        studentsBusy = false;
        studentsBackoffMs = latest ? 0 : Math.min(SLOW_SERVER_MAX_WAIT_MS, Math.max(REFRESH_INTERVAL_MS, studentsBackoffMs * 2));
        if (cancelled || !latest) return;
        setState((prev) => (prev.status === 'ready' ? { ...prev, participants: latest } : prev));
        if (!isHost && !bigGroup && latest.length > LIVE_STUDENT_UPDATES_UP_TO) {
          bigGroup = true;
          if (studentChannel) client.removeChannel(studentChannel);
          studentChannel = null;
        }
      };
      if (participants.length > LIVE_STUDENT_UPDATES_UP_TO) reloadStudents();

      // Only the host changes the session, so the host's own copy is always
      // the newest and does not need re-reading.
      let lastSessionRead = Date.now();
      let lastStudentsRead = Date.now();
      let sessionBusy = false;
      let sessionBackoffMs = 0;
      const interval = setInterval(async () => {
        const now = Date.now();
        const studentsEvery = studentsBackoffMs || (bigGroup ? BIG_GROUP_REFRESH_MS : REFRESH_INTERVAL_MS);
        if (now - lastStudentsRead >= studentsEvery) {
          lastStudentsRead = now;
          reloadStudents();
        }
        if (isHost || sessionBusy || now - lastSessionRead < (sessionBackoffMs || REFRESH_INTERVAL_MS)) return;
        lastSessionRead = now;
        sessionBusy = true;
        const latest = await fetchSessionByCode(code).catch(() => null);
        sessionBusy = false;
        sessionBackoffMs = latest ? 0 : Math.min(SLOW_SERVER_MAX_WAIT_MS, Math.max(REFRESH_INTERVAL_MS, sessionBackoffMs * 2));
        if (cancelled || !latest) return;
        setState((prev) => (prev.status === 'ready' ? { ...prev, session: latest } : prev));
      }, 500);

      cleanUp = () => {
        clearInterval(interval);
        clearTimeout(listenLater);
        client.removeChannel(channel);
        if (studentChannel) client.removeChannel(studentChannel);
      };
      if (cancelled) cleanUp();
    }

    let connected = false;
    const slow = setTimeout(() => {
      if (!cancelled && !connected) setState({ status: 'error', message: 'Connecting timed out.' });
    }, CONNECT_TIMEOUT_MS);

    connect()
      .then(() => {
        connected = true;
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(error) });
      })
      .finally(() => clearTimeout(slow));

    return () => {
      cancelled = true;
      clearTimeout(slow);
      cleanUp();
    };
  }, [code, attempt]);

  /** Connects again after an error. */
  function retry() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  /** Shows a change the host just saved without waiting for it to come back. */
  function applySession(session: LiveSession) {
    setState((prev) => (prev.status === 'ready' ? { ...prev, session } : prev));
  }

  function applyParticipants(participants: LiveParticipant[]) {
    setState((prev) => (prev.status === 'ready' ? { ...prev, participants } : prev));
  }

  return { state, applySession, applyParticipants, retry };
}
