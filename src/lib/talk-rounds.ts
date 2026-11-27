/**
 * Talk Rounds' own rules (speed friending and conversation practice), on top
 * of the Live classroom kit (src/core/live): its flags, rounds of finding a
 * partner then talking, and which question each phone shows.
 */
import { LEVELS, type Level } from '@/core/content/levels';
import { uniqueRoundCount } from '@/core/live/groups';
import { requireSupabase } from '@/core/app/supabase';
import {
  createSession,
  endSession,
  flagValue,
  hasFlag,
  rosterFrom,
  stageDurationMs,
  timestampAfter,
  type LiveParticipant,
  type LiveSession,
  type SessionChanges,
} from '@/core/live/session';
import { type CustomSet } from '@/core/content/custom-sets';
import { findFunQuestions, type FunQuestion } from '@/data/fun-questions';
import { findQuestions, type Question } from '@/data/questions';
import { pickForSeat, shuffle } from '@/core/content/shuffle';
import { type RoundSettings } from '@/lib/session';

const ROUND_ROBIN = 'round-robin';
const FRIENDING = 'speed-friending';
/** Flag for speed friending with turns (one talks, one asks, then swap). */
const TAKE_TURNS = 'take-turns';
/** Flag prefix for a custom question set: `custom:<set id>`. */
const CUSTOM = 'custom:';

/** True when the number of rounds is worked out from the class size at the start. */
export function isRoundRobin(session: LiveSession): boolean {
  return hasFlag(session, ROUND_ROBIN);
}

/** Speed friending: fun get-to-know-you questions, with no grammar point. */
export function isFriending(session: LiveSession): boolean {
  return hasFlag(session, FRIENDING);
}

/** Speed friending with turns: one person talks while their partner asks, then they swap. */
export function isTakingTurns(session: LiveSession): boolean {
  return isFriending(session) && hasFlag(session, TAKE_TURNS);
}

/** Speed friending with a custom question set: its id (null for the usual questions). */
export function customSetId(session: LiveSession): string | null {
  return flagValue(session, CUSTOM);
}

/** Rounds needed for everyone to talk to everyone once (at least 1). */
export function roundRobinRounds(studentCount: number): number {
  return Math.max(1, uniqueRoundCount(studentCount));
}

/** The session's flags (kept in the "categories" column) for these settings. */
export function sessionFlags(settings: RoundSettings): string[] {
  return [
    ...(settings.roundRobin ? [ROUND_ROBIN] : []),
    ...(settings.mode === 'friending' ? [FRIENDING] : []),
    ...(settings.mode === 'friending' && settings.customSetId ? [CUSTOM + settings.customSetId] : []),
    ...(settings.mode === 'friending' && settings.takeTurns ? [TAKE_TURNS] : []),
  ];
}

/** Creates a Talk Rounds session; `extraFlags` are added to its flags. */
export async function createTalkSession(settings: RoundSettings, extraFlags: string[] = []): Promise<LiveSession> {
  return createSession({
    level: settings.level,
    week: settings.week,
    roundMinutes: settings.roundMinutes,
    roundCount: settings.roundCount,
    autoAdvance: settings.autoAdvance,
    flags: [...sessionFlags(settings), ...extraFlags],
  });
}

/** Take turns: a student taps a follow-up they asked (again to undo). Saved on their own row. */
export async function toggleFollowUp(me: LiveParticipant, key: string): Promise<void> {
  const current = me.asked_follow_ups ?? [];
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  const { error } = await requireSupabase().from('participants').update({ asked_follow_ups: next }).eq('id', me.id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Session steps (what to save for each thing the host can do)
// ---------------------------------------------------------------------------

/**
 * Every round starts with finding partners, with no clock: the question
 * appears once every pair has found each other (see beginDiscussion).
 */
function roundStart(): SessionChanges {
  return { stage: 'changeover', ends_at: null, remaining_ms: null, found_ids: [] };
}

export function startSession(
  session: LiveSession,
  participants: LiveParticipant[],
  now: number,
): SessionChanges {
  return {
    status: 'playing',
    round: 0,
    roster: rosterFrom(participants),
    ...(isRoundRobin(session) ? { round_count: roundRobinRounds(participants.length) } : {}),
    ...roundStart(),
  };
}

/** Moves to the next round, or finishes the session after the last one. */
export function nextRound(
  session: LiveSession,
  participants: LiveParticipant[],
  now: number,
): SessionChanges {
  if (session.round + 1 >= session.round_count) return endSession();
  return {
    round: session.round + 1,
    // Picks up anyone who joined or was removed during the last round.
    roster: rosterFrom(participants),
    ...roundStart(),
  };
}

/** Everyone has found their partner (or the host starts anyway): show the question and start the clock. */
export function beginDiscussion(session: LiveSession, now: number): SessionChanges {
  return {
    stage: 'discussion',
    ends_at: timestampAfter(now, stageDurationMs(session)),
    remaining_ms: null,
  };
}

// ---------------------------------------------------------------------------
// Reading the session
// ---------------------------------------------------------------------------

/**
 * Conversation practice: the question everyone discusses this round. Every
 * phone works this out the same way, so the whole class is on the same
 * question, with a new one each round.
 */
export function questionForRound(
  session: LiveSession,
  questions: readonly Question[],
  level: Level,
): { text: string } | null {
  const pool = findQuestions(questions, level, session.week);
  if (pool.length === 0) return null;
  const ordered = shuffle(pool, session.seed + LEVELS.indexOf(level));
  return ordered[session.round % ordered.length];
}

/**
 * Speed friending: each student has their own question to ask their partner.
 * The questions are shuffled once per session; a student's question moves one
 * step along the list each round, starting from their place in the roster, so
 * partners have different questions and nobody gets the same one twice until
 * the list runs out.
 */
export function questionForStudent(
  session: LiveSession,
  funQuestions: readonly FunQuestion[],
  participantId: string,
  customSets: readonly CustomSet[] = [],
): { text: string; followUps?: string[] } | null {
  // A custom set: its questions, the same at every level.
  const custom = customSets.find((s) => s.id === customSetId(session));
  const pool: { text: string; followUps?: string[] }[] = custom
    ? custom.questions.map((text, i) => ({ text, followUps: custom.followUps?.[i] }))
    : findFunQuestions(funQuestions, session.level, session.week);
  const seat = session.roster.findIndex((p) => p.id === participantId);
  return pickForSeat(pool, session.seed + LEVELS.indexOf(session.level), seat, session.round);
}

