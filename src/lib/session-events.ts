/**
 * Things that happen in a live session, one row each (table session_events),
 * kept for awards and results afterwards. Shared by every live game: word
 * games log words guessed and hints; Talk Rounds can log follow-up questions.
 */
import { requireSupabase } from '@/lib/supabase';

export type SessionEvent = {
  id?: number;
  session_id: string;
  /** Who did it (null: the host, or nobody in particular). */
  participant_id: string | null;
  kind: string;
  data: Record<string, unknown>;
  created_at: string;
};

export async function logEvent(
  sessionId: string,
  participantId: string | null,
  kind: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await requireSupabase()
    .from('session_events')
    .insert({ session_id: sessionId, participant_id: participantId, kind, data });
  if (error) throw new Error(error.message);
}

/** All of a session's events, oldest first. */
export async function fetchEvents(sessionId: string): Promise<SessionEvent[]> {
  const { data, error } = await requireSupabase()
    .from('session_events')
    .select()
    .eq('session_id', sessionId)
    .order('created_at')
    .order('id');
  if (error) throw new Error(error.message);
  return data as SessionEvent[];
}
