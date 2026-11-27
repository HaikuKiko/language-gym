/**
 * Pretend students for testing a real session with your own phone: the
 * teacher's page adds 1–3 made-up students who join like real phones (each is
 * its own anonymous guest) and tap by themselves while the page is open.
 * Speed friending: they tap "We found each other!" (only when their whole
 * group is pretend, so a real tester taps for themselves). Word games: they
 * tap "Got it" or "Skip" when it is their turn to. Quizzes: they answer each
 * question (mostly right).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';

import type { LiveParticipant, LiveSession } from '@/core/live/session';
import { questionSeconds, type QuizQuestion } from '@/core/live/quiz';
import { groupsForRound } from '@/core/live/groups';
import { quizOf } from '@/lib/grammar-quiz';
import { finishCard, groupProgress, wordGameKind } from '@/lib/word-game';

// ===========================================================================
// Settings
// ===========================================================================

/** The choices on the teacher's screen. */
export const PRETEND_STUDENT_CHOICES = [1, 2, 3] as const;
/** Made-up names, used in this order. */
const PRETEND_NAMES = ['Alex', 'Bea', 'Carlos', 'Dee', 'Emre', 'Fatima', 'Gio', 'Hana', 'Ivo', 'Jun'];
/** Added to each name so everyone can see who is pretend. */
const PRETEND_SUFFIX = ' (pretend)';
/** A pretend group taps "We found each other!" between these times after a round starts. */
const FIND_MIN_MS = 2500;
const FIND_MAX_MS = 7000;
/** Word games: a pretend student taps for their group's word between these times. */
const GUESS_MIN_MS = 5000;
const GUESS_MAX_MS = 10000;
/** Word games: how often a pretend student skips a word instead of guessing it. */
const SKIP_CHANCE = 0.2;
/** Quizzes: how often a pretend student picks the right answer. */
const QUIZ_RIGHT_CHANCE = 0.7;
/** Quizzes: a pretend student answers between these fractions of the question time. */
const QUIZ_ANSWER_FROM = 0.1;
const QUIZ_ANSWER_TO = 0.6;
/** How often the pretend students look at the session. */
const CHECK_EVERY_MS = 500;

// ===========================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

type Pretend = { id: string; client: SupabaseClient };

export function isPretendName(name: string): boolean {
  return name.endsWith(PRETEND_SUFFIX);
}

/** Word games: a pretend student's taps, saved with their own guest login (like their own phone). */
function cardBackend(p: Pretend) {
  return {
    recordCard: async (me: LiveParticipant, card: number, guessed: boolean) => {
      const column = guessed ? 'got_cards' : 'skipped_cards';
      const current = (guessed ? me.got_cards : me.skipped_cards) ?? [];
      if (current.includes(card)) return;
      const { error } = await p.client
        .from('participants')
        .update({ [column]: [...current, card] })
        .eq('id', me.id);
      if (error) throw new Error(error.message);
    },
    logEvent: async (sessionId: string, participantId: string | null, kind: string, data: Record<string, unknown>) => {
      const { error } = await p.client
        .from('session_events')
        .insert({ session_id: sessionId, participant_id: participantId, kind, data });
      if (error) throw new Error(error.message);
    },
  };
}

/** Joins one pretend student to the session as their own anonymous guest. */
async function joinPretend(session: LiveSession, name: string): Promise<Pretend> {
  if (!url || !key) throw new Error('Phone sessions are not set up.');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, storageKey: `pretend-${name}` },
  });
  const { data: auth, error: authError } = await client.auth.signInAnonymously();
  if (authError || !auth.user) throw new Error(`${name} could not sign in: ${authError?.message ?? 'no user'}`);
  const { data: me, error } = await client
    .from('participants')
    .upsert({ session_id: session.id, user_id: auth.user.id, name }, { onConflict: 'session_id,user_id' })
    .select('id')
    .single();
  if (error || !me) throw new Error(`${name} could not join: ${error?.message ?? 'no row'}`);
  return { id: me.id as string, client };
}

/**
 * Keeps the pretend students of this teacher page running. Call it at the top
 * of the host screen so they keep going from the lobby to the end.
 */
export function usePretendStudents(
  session: LiveSession,
  participants: readonly LiveParticipant[],
  /** Quizzes: the questions, so the pretend students can answer them. */
  quizQuestions?: readonly QuizQuestion[],
) {
  const quizRef = useRef(quizQuestions);
  quizRef.current = quizQuestions;
  const pretends = useRef<Pretend[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  async function add(count: number) {
    setBusy(true);
    setError(null);
    try {
      const taken = new Set(participantsRef.current.map((p) => p.name));
      const names = PRETEND_NAMES.map((n) => n + PRETEND_SUFFIX)
        .filter((n) => !taken.has(n))
        .slice(0, count);
      const joined = await Promise.all(names.map((n) => joinPretend(sessionRef.current, n)));
      pretends.current = [...pretends.current, ...joined];
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Taps that are waiting: what they are for, and when they are due.
  const pending = useRef(new Map<string, number>());

  useEffect(() => {
    const tick = setInterval(() => {
      const mine = pretends.current;
      const s = sessionRef.current;
      if (mine.length === 0 || s.status !== 'playing') return;
      const byId = new Map(mine.map((p) => [p.id, p]));
      const now = Date.now();

      // Schedules a tap once per key; runs it when due.
      const tapWhenDue = (key: string, min: number, max: number, tap: () => Promise<unknown>) => {
        const due = pending.current.get(key);
        if (due === undefined) {
          pending.current.set(key, now + min + Math.random() * (max - min));
        } else if (due !== Infinity && now >= due) {
          pending.current.set(key, Infinity);
          tap().catch(() => {});
        }
      };

      // Quizzes: each pretend student answers each question once, a few seconds in.
      if (quizOf(s)) {
        const question = quizRef.current?.[s.round];
        if (!question || s.stage !== 'discussion') return;
        const seconds = questionSeconds(s);
        for (const p of mine) {
          const from = seconds * 1000 * QUIZ_ANSWER_FROM;
          const to = seconds * 1000 * QUIZ_ANSWER_TO;
          const start = now;
          tapWhenDue(`quiz:${s.round}:${p.id}`, from, to, async () => {
            const wrong = question.options.map((_, i) => i).filter((i) => i !== question.answer);
            const choice =
              Math.random() < QUIZ_RIGHT_CHANCE ? question.answer : wrong[Math.floor(Math.random() * wrong.length)];
            await p.client.rpc('answer_quiz', {
              p_participant_id: p.id,
              p_question: s.round,
              p_choice: choice,
              p_ms: Math.round(Date.now() - start + from),
            });
          });
        }
        return;
      }

      const game = wordGameKind(s);
      if (!game) {
        if (s.stage !== 'changeover') return;
        for (const group of groupsForRound(s.roster, s.round)) {
          if (!group.every((p) => byId.has(p.id))) continue;
          const first = byId.get(group[0].id)!;
          tapWhenDue(`found:${s.round}:${first.id}`, FIND_MIN_MS, FIND_MAX_MS, async () =>
            first.client.from('participants').update({ found_round: s.round }).eq('id', first.id),
          );
        }
        return;
      }

      // Mixed groups: each pretend student taps "We found each other!" in their new group.
      if (s.stage === 'changeover') {
        for (const p of mine) {
          if (!s.roster.some((r) => r.id === p.id)) continue;
          tapWhenDue(`regroup:${s.round}:${p.id}`, FIND_MIN_MS, FIND_MAX_MS, async () =>
            p.client.from('participants').update({ found_round: s.round }).eq('id', p.id),
          );
        }
        return;
      }
      if (s.ends_at === null) return;
      for (const group of groupProgress(s, participantsRef.current)) {
        if (!group.player) continue;
        // Hot Seat: someone describing taps. Explain It: the explainer taps.
        const tapperId =
          game === 'hot-seat'
            ? group.members.find((m) => m.id !== group.player?.id && byId.has(m.id))?.id
            : byId.has(group.player.id)
              ? group.player.id
              : undefined;
        const tapper = tapperId ? byId.get(tapperId) : undefined;
        if (!tapper) continue;
        const card = group.card;
        tapWhenDue(`card:${group.index}:${card}`, GUESS_MIN_MS, GUESS_MAX_MS, async () => {
          const row = participantsRef.current.find((p) => p.id === tapper.id);
          if (!row) return;
          // Explain It: someone else in the group guessed it.
          const others = group.members.filter((m) => m.id !== group.player?.id);
          const guesser = others[Math.floor(Math.random() * others.length)]?.id ?? null;
          await finishCard(cardBackend(tapper), s, game, group, row, Math.random() >= SKIP_CHANCE, guesser);
        });
      }
    }, CHECK_EVERY_MS);
    return () => clearInterval(tick);
  }, []);

  // Sign the pretend guests out when the teacher leaves the page.
  useEffect(
    () => () => {
      for (const p of pretends.current) p.client.auth.signOut().catch(() => {});
    },
    [],
  );

  return { add, busy, error };
}
