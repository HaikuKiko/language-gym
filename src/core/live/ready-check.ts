/**
 * Ready check (Live classroom kit): each pair or group taps once ("We found
 * each other!"), and the activity moves on when every group has.
 */
import { groupsForRound, type Group } from '@/core/live/groups';
import { requireSupabase } from '@/core/app/supabase';
import type { LiveParticipant, LiveSession, SessionChanges } from '@/core/live/session';

/** A student taps "We found each other!": marks their own row for this round. */
export async function markFound(participantId: string, round: number): Promise<void> {
  const { error } = await requireSupabase().from('participants').update({ found_round: round }).eq('id', participantId);
  if (error) throw new Error(error.message);
}

/** The host marks a pair as found (or not), e.g. when a phone is flat. */
export function setGroupFound(session: LiveSession, group: Group, found: boolean): SessionChanges {
  const ids = new Set(session.found_ids ?? []);
  for (const p of group) {
    if (found) ids.add(p.id);
    else ids.delete(p.id);
  }
  return { found_ids: [...ids] };
}

export type GroupStatus = { group: Group; found: boolean };

/**
 * Which pairs (or groups of three) have found each other this round. A group
 * is found when any member tapped the button this round or the host marked
 * it; someone with no partner counts as found.
 */
export function findingStatus(session: LiveSession, participants: LiveParticipant[]) {
  const tapped = new Set(participants.filter((p) => p.found_round === session.round).map((p) => p.id));
  const marked = new Set(session.found_ids ?? []);
  const groups: GroupStatus[] = groupsForRound(session.roster, session.round).map((group) => ({
    group,
    found: group.length < 2 || group.some((p) => tapped.has(p.id) || marked.has(p.id)),
  }));
  const ready = groups.filter((g) => g.found).length;
  return { groups, ready, total: groups.length, allFound: groups.length > 0 && ready === groups.length };
}

