/**
 * Points for the class leaderboards, from every activity: quizzes (saved by
 * the quiz screen), word games and speaking (saved here when a game for a
 * class ends), and writing (points for each piece handed in, worked out from
 * the class sets). The Leaderboards page adds them up per student.
 */
import { useEffect, useRef } from 'react';

import { sessionClassId } from '@/core/classes/classes';
import { saveScores, SCORE_DAYS, type SavedScore, type ScoreRow } from '@/core/live/scores';
import type { LiveParticipant, LiveSession } from '@/core/live/session';
import { requireSupabase } from '@/core/app/supabase';
import { isPretendName } from '@/lib/pretend-students';
import { gameResults } from '@/lib/word-game-results';
import type { WordGameKind } from '@/lib/word-game';
import type { SessionEvent } from '@/core/live/events';

// ===========================================================================
// Settings (chosen so one activity of each kind is worth roughly the same:
// a good 10-question quiz is about 7,000 points)
// ===========================================================================

/** Word games: each word-game point is worth this many leaderboard points. */
export const WORD_GAME_POINT_SCALE = 50;
/** Speaking: points for each round a student took part in. */
export const SPEAKING_ROUND_POINTS = 500;
/** Speaking (take turns): points for each follow-up question a student asked. */
export const FOLLOW_UP_POINTS = 200;
/** Writing: points for each piece of writing handed in (marked in a class set). */
export const WRITING_HANDED_IN_POINTS = 3000;

// ===========================================================================

export const ACTIVITIES = {
  quiz: { name: 'Quizzes', emoji: '❓', unit: ['quiz', 'quizzes'] },
  'word-game': { name: 'Word games', emoji: '🔥', unit: ['game', 'games'] },
  speaking: { name: 'Speaking', emoji: '🗣️', unit: ['session', 'sessions'] },
  writing: { name: 'Writing', emoji: '✍️', unit: ['piece', 'pieces'] },
} as const;
export type Activity = keyof typeof ACTIVITIES;

/** Speaking points: rounds taken part in, plus follow-up questions asked. */
export function speakingScores(session: LiveSession, participants: readonly LiveParticipant[]): ScoreRow[] {
  const rounds = session.roster.length > 0 ? session.round + 1 : 0;
  return session.roster
    .filter((p) => !isPretendName(p.name))
    .map((p) => {
      const followUps = participants.find((q) => q.id === p.id)?.asked_follow_ups?.length ?? 0;
      return {
        name: p.name,
        points: rounds * SPEAKING_ROUND_POINTS + followUps * FOLLOW_UP_POINTS,
        details: { rounds, follow_ups: followUps },
      };
    });
}

/** Word game points (the game's own points, scaled). */
export function wordGameScores(kind: WordGameKind, session: LiveSession, events: readonly SessionEvent[]): ScoreRow[] {
  return gameResults(kind, session, events)
    .players.filter((p) => !isPretendName(p.name))
    .map((p) => ({
      name: p.name,
      points: p.points * WORD_GAME_POINT_SCALE,
      details: { game_points: p.points, guessed: p.guessed, explained: p.explained },
    }));
}

/**
 * Saves a finished game's points once, only when it was for a class (games
 * without a class, demos and public sessions are not saved).
 */
export function useSaveClassScores(
  activity: Activity,
  session: LiveSession,
  demo: boolean,
  rows: () => Promise<ScoreRow[]>,
  onError: (message: string) => void,
) {
  const saved = useRef(false);
  const classId = sessionClassId(session);
  const finished = session.status === 'finished';
  const rowsNow = useRef(rows);
  rowsNow.current = rows;
  const onErrorNow = useRef(onError);
  onErrorNow.current = onError;

  useEffect(() => {
    if (!finished || !classId || demo || saved.current) return;
    saved.current = true;
    rowsNow
      .current()
      .then((list) => saveScores(activity, session.id, session.id, list, classId))
      .catch((e) => onErrorNow.current(`The points could not be saved: ${e instanceof Error ? e.message : e}`));
  }, [finished, classId, demo, activity, session.id]);
}

/** Writing points: one row per piece handed in (a marked student in a class set) in the last `days`. */
export async function fetchWritingScores(options: { days?: number; classId?: string | null } = {}): Promise<SavedScore[]> {
  const client = requireSupabase();
  const since = new Date(Date.now() - (options.days ?? SCORE_DAYS) * 24 * 60 * 60 * 1000).toISOString();
  let sets = client.from('class_sets').select('id, created_at').not('class_id', 'is', null).gte('created_at', since);
  if (options.classId) sets = sets.eq('class_id', options.classId);
  const { data: setRows, error } = await sets;
  if (error) throw new Error(error.message);
  if (!setRows?.length) return [];
  const created = new Map(setRows.map((s) => [s.id as string, s.created_at as string]));
  const [{ data: pages, error: pageError }, { data: students }] = await Promise.all([
    client
      .from('class_set_pages')
      .select('set_id, student_name, student_id')
      .in('set_id', [...created.keys()])
      .is('continues_page', null)
      .eq('status', 'done'),
    client.from('class_students').select('id, name'),
  ]);
  if (pageError) throw new Error(pageError.message);
  const nameOf = new Map((students ?? []).map((s) => [s.id as string, s.name as string]));
  return (pages ?? [])
    .map((p) => ({
      activity: 'writing',
      name: (p.student_id && nameOf.get(p.student_id)) || p.student_name || '',
      points: WRITING_HANDED_IN_POINTS,
      details: { pieces: 1 },
      created_at: created.get(p.set_id) ?? since,
    }))
    .filter((r) => r.name.trim() !== '');
}
