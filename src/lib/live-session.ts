/**
 * Phone sessions: the host creates a session and gets a join code, students
 * join with that code, and every phone follows the same session row in
 * Supabase. See supabase/schema.sql for the tables.
 */
import { findFunQuestions, type CustomSet, type FunQuestion } from '@/data/fun-questions';
import { LEVELS, findQuestions, type Level, type Question } from '@/data/questions';
import { groupsForRound, uniqueRoundCount, type Group, type Participant } from '@/lib/round-robin';
import { shuffle, type RoundSettings } from '@/lib/session';
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';

export const CODE_LENGTH = 6;

export type LiveSession = {
  id: string;
  code: string;
  host_id: string;
  status: 'lobby' | 'playing' | 'finished';
  level: Level;
  /** The week the teacher chose; missing or null means any week. */
  week?: number | null;
  round_minutes: number;
  round_count: number;
  auto_advance: boolean;
  /** 0-based. */
  round: number;
  /** "changeover": students are finding their partners; "discussion": talking. */
  stage: 'changeover' | 'discussion';
  /** Set while the timer is running. */
  ends_at: string | null;
  /** Set while the timer is paused or has not been started. */
  remaining_ms: number | null;
  /** Who is taking part in the current round. */
  roster: Participant[];
  seed: number;
  /** Flags; "round-robin" means the rounds are set from the class size at the start. */
  categories?: string[];
  /** Students the host marked as having found their partner this round. */
  found_ids?: string[];
};

const ROUND_ROBIN = 'round-robin';
const FRIENDING = 'speed-friending';
/** Flag for speed friending with turns (one talks, one asks, then swap). */
const TAKE_TURNS = 'take-turns';
/** Flag prefix for a custom question set: `custom:<set id>`. */
const CUSTOM = 'custom:';

/** True when the number of rounds is worked out from the class size at the start. */
export function isRoundRobin(session: LiveSession): boolean {
  return session.categories?.includes(ROUND_ROBIN) ?? false;
}

/** Speed friending: fun get-to-know-you questions, with no grammar point. */
export function isFriending(session: LiveSession): boolean {
  return session.categories?.includes(FRIENDING) ?? false;
}

/** Speed friending with turns: one person talks while their partner asks, then they swap. */
export function isTakingTurns(session: LiveSession): boolean {
  return isFriending(session) && (session.categories?.includes(TAKE_TURNS) ?? false);
}

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

/** Speed friending with a custom question set: its id (null for the usual questions). */
export function customSetId(session: LiveSession): string | null {
  const flag = session.categories?.find((c) => c.startsWith(CUSTOM));
  return flag ? flag.slice(CUSTOM.length) : null;
}

/** Rounds needed for everyone to talk to everyone once (at least 1). */
export function roundRobinRounds(studentCount: number): number {
  return Math.max(1, uniqueRoundCount(studentCount));
}

export type LiveParticipant = {
  id: string;
  session_id: string;
  user_id: string;
  name: string;
  joined_at: string;
  /** The round in which this student tapped "We found each other!". */
  found_round?: number | null;
};

type SessionChanges = Partial<Omit<LiveSession, 'id' | 'code' | 'host_id'>>;

// ---------------------------------------------------------------------------
// Talking to Supabase
// ---------------------------------------------------------------------------

/** The session's flags (kept in the "categories" column) for these settings. */
export function sessionFlags(settings: RoundSettings): string[] {
  return [
    ...(settings.roundRobin ? [ROUND_ROBIN] : []),
    ...(settings.mode === 'friending' ? [FRIENDING] : []),
    ...(settings.mode === 'friending' && settings.customSetId ? [CUSTOM + settings.customSetId] : []),
    ...(settings.mode === 'friending' && settings.takeTurns ? [TAKE_TURNS] : []),
  ];
}

export async function createSession(settings: RoundSettings): Promise<LiveSession> {
  const client = requireSupabase();
  await ensureSignedIn();

  const base = {
    level: settings.level,
    // An older column, now used for flags (see isRoundRobin).
    categories: sessionFlags(settings),
    round_minutes: settings.roundMinutes,
    round_count: settings.roundCount,
    auto_advance: settings.autoAdvance,
    seed: Math.floor(Math.random() * 2 ** 31),
  };
  // A database that has not had the latest schema.sql run has no "week"
  // column yet; in that case the session is created without one.
  let includeWeek = true;

  // Codes are random, so on the rare clash with an existing one, try another.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await client
      .from('sessions')
      .insert({ ...base, code: randomCode(), ...(includeWeek ? { week: settings.week } : {}) })
      .select()
      .single();

    if (!error) return data as LiveSession;
    if (includeWeek && (error.code === 'PGRST204' || error.code === '42703')) {
      includeWeek = false;
      continue;
    }
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('Could not create a session. Please try again.');
}

/**
 * A session by its join code. Sessions (and their names) are readable only by
 * their host and students, so this goes through session_by_code, which also
 * lets a student find a session before joining it.
 */
export async function fetchSessionByCode(code: string): Promise<LiveSession | null> {
  const { data, error } = await requireSupabase().rpc('session_by_code', { p_code: code });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as LiveSession[];
  return rows[0] ?? null;
}

export async function fetchParticipants(sessionId: string): Promise<LiveParticipant[]> {
  const { data, error } = await requireSupabase()
    .from('participants')
    .select()
    .eq('session_id', sessionId)
    .order('joined_at')
    .order('id');
  if (error) throw new Error(error.message);
  return data as LiveParticipant[];
}

/** Adds this device to the session, or renames it if it has already joined. */
/**
 * A session this device is still part of (as a student or the host) that has
 * not finished and started in the last 12 hours, so the start page can offer
 * a way back after a reload or a press of the back button. Null if none.
 * Doesn't sign anyone in: a device with no identity yet has no session.
 */
export async function findMyOpenSession(): Promise<{ code: string; asHost: boolean } | null> {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const [hosted, joined] = await Promise.all([
    client
      .from('sessions')
      .select('code, created_at')
      .eq('host_id', userId)
      .neq('status', 'finished')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1),
    client
      .from('participants')
      .select('joined_at, sessions!inner(code, status, created_at)')
      .eq('user_id', userId)
      .neq('sessions.status', 'finished')
      .gte('sessions.created_at', since)
      .order('joined_at', { ascending: false })
      .limit(1),
  ]);

  const host = hosted.data?.[0];
  const student = joined.data?.[0] as { joined_at: string; sessions: { code: string } | { code: string }[] } | undefined;
  const studentCode = student ? (Array.isArray(student.sessions) ? student.sessions[0]?.code : student.sessions.code) : undefined;
  if (studentCode) return { code: studentCode, asHost: false };
  if (host) return { code: host.code, asHost: true };
  return null;
}

/** Joining with the same login that is running the session as the teacher. */
export class HostDeviceError extends Error {
  constructor() {
    super('This device is logged in as the teacher running this session, so it would show the teacher’s screen.');
  }
}

export async function joinSession(code: string, name: string): Promise<LiveSession> {
  const client = requireSupabase();
  const userId = await ensureSignedIn();

  const session = await fetchSessionByCode(code);
  if (!session) throw new Error('No session found with that code.');
  if (session.status === 'finished') throw new Error('That session has already finished.');
  // The host's own login would get the teacher's screen, not a student's.
  if (session.host_id === userId) throw new HostDeviceError();

  let finalName = name.trim();
  if (!finalName) {
    // Only this student's own entry is readable before joining, so a new guest
    // gets a random number rather than the next one.
    const mine = await fetchParticipants(session.id);
    const existing = mine.find((p) => p.user_id === userId);
    finalName = existing?.name ?? `Guest ${10 + Math.floor(Math.random() * 90)}`;
  }

  const { error } = await client
    .from('participants')
    .upsert(
      { session_id: session.id, user_id: userId, name: finalName },
      { onConflict: 'session_id,user_id' },
    );
  if (error) throw new Error(error.message);

  return session;
}

export async function removeParticipant(participantId: string): Promise<void> {
  const { error } = await requireSupabase().from('participants').delete().eq('id', participantId);
  if (error) throw new Error(error.message);
}

/** A student taps "We found each other!": marks their own row for this round. */
export async function markFound(participantId: string, round: number): Promise<void> {
  const { error } = await requireSupabase().from('participants').update({ found_round: round }).eq('id', participantId);
  if (error) throw new Error(error.message);
}

/**
 * Saves changes to the session (host only). With `onlyIfUnmoved`, the change
 * is skipped when the session has already moved to another round or stage,
 * which stops an automatic step from being applied twice. Returns the saved
 * session, or null when nothing was changed.
 */
export async function updateSession(
  session: LiveSession,
  changes: SessionChanges,
  onlyIfUnmoved = false,
): Promise<LiveSession | null> {
  let query = requireSupabase().from('sessions').update(changes).eq('id', session.id);
  if (onlyIfUnmoved) query = query.eq('round', session.round).eq('stage', session.stage);

  const { data, error } = await query.select().maybeSingle();
  if (error) throw new Error(error.message);
  return data as LiveSession | null;
}

// ---------------------------------------------------------------------------
// Session steps (what to save for each thing the host can do)
// ---------------------------------------------------------------------------

export function rosterFrom(participants: LiveParticipant[]): Participant[] {
  return participants.map((p) => ({ id: p.id, name: p.name }));
}

/** How long the talking lasts. Finding a partner has no time limit. */
export function stageDurationMs(session: LiveSession): number {
  return session.round_minutes * 60 * 1000;
}

function timestampAfter(now: number, ms: number): string {
  return new Date(now + ms).toISOString();
}

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

export function startTimer(session: LiveSession, now: number): SessionChanges {
  return { ends_at: timestampAfter(now, remainingMs(session, now)), remaining_ms: null };
}

export function pauseTimer(session: LiveSession, now: number): SessionChanges {
  return { ends_at: null, remaining_ms: remainingMs(session, now) };
}

export function resetTimer(session: LiveSession): SessionChanges {
  return { ends_at: null, remaining_ms: stageDurationMs(session) };
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

export function endSession(): SessionChanges {
  return { status: 'finished', ends_at: null, remaining_ms: 0 };
}

// ---------------------------------------------------------------------------
// Reading the session
// ---------------------------------------------------------------------------

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

export function remainingMs(session: LiveSession, now: number): number {
  if (session.ends_at) return Math.max(0, Date.parse(session.ends_at) - now);
  return session.remaining_ms ?? 0;
}

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
  if (pool.length === 0) return null;
  const seat = Math.max(0, session.roster.findIndex((p) => p.id === participantId));
  const ordered = shuffle(pool, session.seed + LEVELS.indexOf(session.level));
  return ordered[(seat + session.round) % ordered.length];
}

export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += Math.floor(Math.random() * 10);
  return code;
}
