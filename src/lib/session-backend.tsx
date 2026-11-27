/**
 * The live-session backend for Talk Rounds and the word games: the core
 * actions (src/core/live/backend.tsx) plus their own.
 */
import { SUPABASE_CORE_BACKEND, createSessionBackend, type CoreSessionBackend } from '@/core/live/backend';
import { toggleFollowUp } from '@/lib/talk-rounds';
import { recordCard } from '@/lib/word-game';

export type SessionBackend = CoreSessionBackend & {
  /** Word games: a student taps "Got it" or "Skip". */
  recordCard: typeof recordCard;
  /** Take turns: a student taps a follow-up question they asked. */
  toggleFollowUp: typeof toggleFollowUp;
};

export const { useSessionBackend, SessionBackendProvider } = createSessionBackend<SessionBackend>({
  ...SUPABASE_CORE_BACKEND,
  recordCard,
  toggleFollowUp,
});
