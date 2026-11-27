/** Take turns (Live classroom kit): a round split equally between the members of a group. */
import { remainingMs, type LiveSession } from '@/core/live/session';

/**
 * Taking turns: whose turn it is in a group, from how much of the round has
 * gone. The round is split equally; in turn k, person k talks and the next
 * person in the group asks them their own question.
 */
export function turnFor(
  session: LiveSession,
  groupSize: number,
  now: number,
): { turn: number; turns: number; turnMs: number; leftMs: number; sinceStartMs: number } {
  const total = session.round_minutes * 60_000;
  const turns = Math.max(1, groupSize);
  const turnMs = total / turns;
  const elapsed = Math.min(total, Math.max(0, total - remainingMs(session, now)));
  const turn = Math.min(turns - 1, Math.floor(elapsed / turnMs));
  return { turn, turns, turnMs, leftMs: Math.max(0, (turn + 1) * turnMs - elapsed), sinceStartMs: elapsed - turn * turnMs };
}

