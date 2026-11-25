/**
 * Where a live session's changes go. Normally Supabase (every phone sees
 * them); the solo demo swaps in a copy kept only on this device, so demo
 * sessions never mix with real ones.
 */
import { createContext, use, type ReactNode } from 'react';

import { markFound, removeParticipant, updateSession } from '@/lib/live-session';

export type SessionBackend = {
  updateSession: typeof updateSession;
  removeParticipant: typeof removeParticipant;
  markFound: typeof markFound;
  /** The solo demo: nothing is saved and no real students can join. */
  demo: boolean;
};

const SUPABASE_BACKEND: SessionBackend = { updateSession, removeParticipant, markFound, demo: false };

const SessionBackendContext = createContext<SessionBackend>(SUPABASE_BACKEND);

export function useSessionBackend(): SessionBackend {
  return use(SessionBackendContext);
}

export function SessionBackendProvider({ backend, children }: { backend: SessionBackend; children: ReactNode }) {
  return <SessionBackendContext value={backend}>{children}</SessionBackendContext>;
}
