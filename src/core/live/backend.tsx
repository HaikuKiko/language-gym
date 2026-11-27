/**
 * Where a live session's changes go (Live classroom kit). Normally Supabase
 * (every phone sees them); a demo swaps in a copy kept only on this device,
 * so demo sessions never mix with real ones. Each app adds its own actions
 * (e.g. the word games' "Got it") to the core ones.
 */
import { createContext, use, type ReactNode } from 'react';

import { fetchEvents, logEvent } from '@/core/live/events';
import { markFound } from '@/core/live/ready-check';
import { removeParticipant, updateSession } from '@/core/live/session';

export type CoreSessionBackend = {
  updateSession: typeof updateSession;
  removeParticipant: typeof removeParticipant;
  /** Ready check: a student taps "We found each other!". */
  markFound: typeof markFound;
  /** Saves something that happened (for awards and results afterwards). */
  logEvent: typeof logEvent;
  fetchEvents: typeof fetchEvents;
  /** A demo: nothing is saved and no real students can join. */
  demo: boolean;
};

/** The core actions, saved in Supabase. */
export const SUPABASE_CORE_BACKEND: CoreSessionBackend = {
  updateSession,
  removeParticipant,
  markFound,
  logEvent,
  fetchEvents,
  demo: false,
};

/**
 * Makes the hook and provider for an app's backend: `real` is what screens
 * get normally; a demo wraps them in the provider with its own copy.
 */
export function createSessionBackend<T extends CoreSessionBackend>(real: T) {
  const Context = createContext<T>(real);
  function useBackend(): T {
    return use(Context);
  }
  function Provider({ backend, children }: { backend: T; children: ReactNode }) {
    return <Context value={backend}>{children}</Context>;
  }
  return { useSessionBackend: useBackend, SessionBackendProvider: Provider };
}
