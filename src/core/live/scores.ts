/**
 * Leaderboards across games (Live classroom kit): at the end of a game the
 * host saves one row per student (table player_scores), and a leaderboard adds
 * them up by name ("Mai T.", the saved names). Rows are kept SCORE_DAYS, then
 * deleted every night.
 */
import { requireSupabase } from '@/core/app/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** How long scores are kept (the nightly delete-old-player-scores job uses the same number). */
export const SCORE_DAYS = 60;

// ===========================================================================

export type ScoreRow = {
  name: string;
  points: number;
  /** Anything else worth adding up (e.g. right answers). */
  details?: Record<string, number>;
};

/** Saves the end-of-game scores (a second save for the same game replaces them). */
export async function saveScores(
  activity: string,
  board: string,
  sessionId: string,
  rows: readonly ScoreRow[],
  /** The class the game was for (its own leaderboard); null for none. */
  classId: string | null = null,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await requireSupabase()
    .from('player_scores')
    .upsert(
      rows.map((r) => ({
        activity,
        board,
        session_id: sessionId,
        name: r.name,
        points: r.points,
        details: r.details ?? {},
        ...(classId ? { class_id: classId } : {}),
      })),
      { onConflict: 'session_id,name' },
    );
  if (error) throw new Error(error.message);
}

export type LeaderboardEntry = {
  name: string;
  points: number;
  /** How many games this person played. */
  games: number;
  /** Each detail added up over their games. */
  totals: Record<string, number>;
};

/**
 * Names that are the same person: "mai t." = "Mai T" = "Mai Tran" (first name
 * + the first letter of the family name, as the join page asks for).
 */
export function nameKey(name: string): string {
  const words = name.trim().toLowerCase().replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  return words.length <= 1 ? (words[0] ?? '') : `${words[0]} ${words[1][0]}`;
}

/** Adds up rows by name, highest first. */
export function leaderboardFrom(
  rows: readonly { name: string; points: number; details?: Record<string, unknown> | null }[],
): LeaderboardEntry[] {
  const byName = new Map<string, LeaderboardEntry>();
  for (const r of rows) {
    const key = nameKey(r.name);
    const entry = byName.get(key) ?? { name: r.name.trim(), points: 0, games: 0, totals: {} };
    entry.points += r.points;
    entry.games += 1;
    for (const [k, v] of Object.entries(r.details ?? {})) {
      if (typeof v === 'number') entry.totals[k] = (entry.totals[k] ?? 0) + v;
    }
    byName.set(key, entry);
  }
  return [...byName.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/**
 * This host's leaderboard for an activity: one board (e.g. one week's quizzes)
 * or, without `board`, everything in the last `days`.
 */
export async function fetchLeaderboard(
  activity: string,
  options: { board?: string; days?: number; classId?: string | null } = {},
): Promise<LeaderboardEntry[]> {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  let query = client
    .from('player_scores')
    .select('name, points, details')
    .eq('activity', activity)
    .eq('host_id', auth.user?.id ?? '');
  if (options.board) query = query.eq('board', options.board);
  if (options.classId) query = query.eq('class_id', options.classId);
  const days = options.days ?? SCORE_DAYS;
  query = query.gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return leaderboardFrom(data ?? []);
}

export type SavedScore = {
  activity: string;
  name: string;
  points: number;
  details: Record<string, unknown> | null;
  created_at: string;
};

/** Every score this host saved in the last `days` (one class, or all), for a page of leaderboards. */
export async function fetchScores(options: { days?: number; classId?: string | null } = {}): Promise<SavedScore[]> {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  const days = options.days ?? SCORE_DAYS;
  let query = client
    .from('player_scores')
    .select('activity, name, points, details, created_at')
    .eq('host_id', auth.user?.id ?? '')
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  if (options.classId) query = query.eq('class_id', options.classId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedScore[];
}
