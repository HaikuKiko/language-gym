import { useEffect, useState } from 'react';

import {
  fetchParticipants,
  fetchSessionByCode,
  type LiveParticipant,
  type LiveSession,
} from '@/lib/live-session';
import { ensureSignedIn, errorMessage, requireSupabase } from '@/lib/supabase';

/** How often to re-read the session, as a safety net behind live updates. */
const REFRESH_INTERVAL_MS = 5000;
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

      const reloadParticipants = async () => {
        const latest = await fetchParticipants(session.id).catch(() => null);
        if (cancelled || !latest) return;
        setState((prev) => (prev.status === 'ready' ? { ...prev, participants: latest } : prev));
      };

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
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'participants',
            filter: `session_id=eq.${session.id}`,
          },
          reloadParticipants,
        )
        .subscribe();

      // Only the host changes the session, so the host's own copy is always
      // the newest and does not need re-reading.
      const isHost = session.host_id === userId;
      const interval = setInterval(async () => {
        reloadParticipants();
        if (isHost) return;
        const latest = await fetchSessionByCode(code).catch(() => null);
        if (cancelled || !latest) return;
        setState((prev) => (prev.status === 'ready' ? { ...prev, session: latest } : prev));
      }, REFRESH_INTERVAL_MS);

      cleanUp = () => {
        clearInterval(interval);
        client.removeChannel(channel);
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
