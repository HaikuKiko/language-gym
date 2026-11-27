/**
 * Where a live session's changes go. Normally Supabase (every phone sees
 * them); the solo demo swaps in a copy kept only on this device, so demo
 * sessions never mix with real ones.
 */
import { createContext, use, type ReactNode } from 'react';

import { fetchEvents, logEvent } from '@/lib/session-events';
import { markFound, removeParticipant, toggleFollowUp, updateSession } from '@/lib/live-session';
import { recordCard } from '@/lib/word-game';

export type SessionBackend = {
  updateSession: typeof updateSession;
  removeParticipant: typeof removeParticipant;
  markFound: typeof markFound;
  /** Word games: a student taps "Got it" or "Skip". */
  recordCard: typeof recordCard;
  /** Saves something that happened (for awards and results afterwards). */
  logEvent: typeof logEvent;
  fetchEvents: typeof fetchEvents;
  /** Take turns: a student taps a follow-up question they asked. */
  toggleFollowUp: typeof toggleFollowUp;
  /** The solo demo: nothing is saved and no real students can join. */
  demo: boolean;
};

const SUPABASE_BACKEND: SessionBackend = {
  updateSession,
  removeParticipant,
  markFound,
  recordCard,
  logEvent,
  fetchEvents,
  toggleFollowUp,
  demo: false,
};

const SessionBackendContext = createContext<SessionBackend>(SUPABASE_BACKEND);

export function useSessionBackend(): SessionBackend {
  return use(SessionBackendContext);
}

export function SessionBackendProvider({ backend, children }: { backend: SessionBackend; children: ReactNode }) {
  return <SessionBackendContext value={backend}>{children}</SessionBackendContext>;
}
