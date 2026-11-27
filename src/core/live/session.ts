/**
 * Live classroom sessions (Live classroom kit): the teacher creates a session
 * and gets a join code, students join with that code, and every phone follows
 * the same session row in Supabase. Any activity (Talk Rounds, word games, …)
 * is a session with its own flags; see supabase/schema.sql for the tables.
 */
import type { Level } from '@/core/content/levels';
import type { Participant } from '@/core/live/groups';
import type { SharedPlace } from '@/core/place/shared-place';
import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';

/** How many digits a join code has. */
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
  /** Outdoor activities: the teacher's newest place (Place kit, shared-place.ts). */
  host_place?: SharedPlace | null;
};

export type LiveParticipant = {
  id: string;
  session_id: string;
  user_id: string;
  name: string;
  joined_at: string;
  /** The round in which this student tapped "We found each other!". */
  found_round?: number | null;
  /** Word games: the cards (numbered per group) this student marked as guessed. */
  got_cards?: number[] | null;
  /** Word games: the cards this student skipped. */
  skipped_cards?: number[] | null;
  /**
   * Take turns: the follow-up questions this student tapped as asked, as
   * "round.turn.number" keys (one per follow-up, so the count is how many
   * they asked). For a leaderboard later.
   */
  asked_follow_ups?: string[] | null;
  /** Outdoor activities: this student's newest place, when they share it (no history is kept). */
  live_place?: SharedPlace | null;
};

/** What the host may change on a session. */
export type SessionChanges = Partial<Omit<LiveSession, 'id' | 'code' | 'host_id'>>;

/** True when the session has this flag. */
export function hasFlag(session: LiveSession, flag: string): boolean {
  return session.categories?.includes(flag) ?? false;
}

/** The value of a `prefix<value>` flag, e.g. `custom:<set id>`; null when there is none. */
export function flagValue(session: LiveSession, prefix: string): string | null {
  const flag = session.categories?.find((c) => c.startsWith(prefix));
  return flag ? flag.slice(prefix.length) : null;
}

// ---------------------------------------------------------------------------
// Talking to Supabase
// ---------------------------------------------------------------------------

export type NewSession = {
  level: Level;
  /** Talk Rounds: the week's theme; null for any. */
  week: number | null;
  /** How long a round (or a whole game) lasts. */
  roundMinutes: number;
  roundCount: number;
  /** Automatic: the teacher's screen moves on when the clock runs out. */
  autoAdvance: boolean;
  /** What kind of activity this is and its options (kept in the "categories" column). */
  flags: string[];
};

/** Creates a session with a new join code. */
export async function createSession(settings: NewSession): Promise<LiveSession> {
  const client = requireSupabase();
  await ensureSignedIn();

  const base = {
    level: settings.level,
    // An older column, now used for flags (see hasFlag).
    categories: settings.flags,
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

/** Adds this device to the session, or renames it if it has already joined. */
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
// Steps every activity uses
// ---------------------------------------------------------------------------

export function rosterFrom(participants: LiveParticipant[]): Participant[] {
  return participants.map((p) => ({ id: p.id, name: p.name }));
}

/** How long a round lasts (or a whole game, for the word games). */
export function stageDurationMs(session: LiveSession): number {
  return session.round_minutes * 60 * 1000;
}

/** A time `ms` from `now`, as saved in the session. */
export function timestampAfter(now: number, ms: number): string {
  return new Date(now + ms).toISOString();
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

export function endSession(): SessionChanges {
  return { status: 'finished', ends_at: null, remaining_ms: 0 };
}

export function remainingMs(session: LiveSession, now: number): number {
  if (session.ends_at) return Math.max(0, Date.parse(session.ends_at) - now);
  return session.remaining_ms ?? 0;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += Math.floor(Math.random() * 10);
  return code;
}
