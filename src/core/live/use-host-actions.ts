import { useState } from 'react';

import { errorMessage } from '@/core/app/supabase';
import type { CoreSessionBackend } from '@/core/live/backend';
import type { LiveParticipant, LiveSession, SessionChanges } from '@/core/live/session';

type HostActionsOptions = {
  backend: CoreSessionBackend;
  session: LiveSession;
  participants: LiveParticipant[];
  onSession: (session: LiveSession) => void;
  onParticipants: (participants: LiveParticipant[]) => void;
};

/**
 * What every teacher screen does (Live classroom kit): save a change to the
 * session, remove a student, and keep the last error to show (ErrorNote).
 */
export function useHostActions({ backend, session, participants, onSession, onParticipants }: HostActionsOptions) {
  const [error, setError] = useState<string | null>(null);

  /** Saves a change. With `onlyIfUnmoved`, it is skipped if the session has already moved on. */
  async function save(changes: SessionChanges, onlyIfUnmoved = false) {
    try {
      const saved = await backend.updateSession(session, changes, onlyIfUnmoved);
      if (saved) onSession(saved);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(participant: LiveParticipant) {
    try {
      await backend.removeParticipant(participant.id);
      onParticipants(participants.filter((p) => p.id !== participant.id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return { save, remove, error, setError };
}
