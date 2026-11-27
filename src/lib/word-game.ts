/**
 * Word games on phones (the same join code and QR as the speaking sessions).
 *
 * The teacher picks a game, a level, a group size and how long the game
 * lasts. Students are split into groups. Each group works through its own
 * words at its own pace: when the word is guessed (or skipped), the group gets
 * a new word and the next person in the group takes the turn. When the game
 * timer runs out, the group with the most words guessed wins.
 *
 * - Hot Seat: one person guesses; everyone else sees the word and describes it.
 * - Explain It: one person sees the word and explains it; everyone else guesses.
 *
 * Where things are kept: the game settings are flags on the session row
 * (`categories`); each student's taps are on their own participant row
 * (`got_cards`, `skipped_cards`: card numbers within their group). Every phone
 * works out each group's progress from those, so two people tapping at the
 * same moment for the same card count once.
 */
import { LEVELS } from '@/data/questions';
import { cardsForLevel, WORD_CARDS, type WordCard } from '@/data/word-cards';
import type { LiveParticipant, LiveSession } from '@/lib/live-session';
import type { Participant } from '@/lib/round-robin';
import { shuffle } from '@/lib/session';
import { requireSupabase } from '@/lib/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** Group sizes the teacher can choose from. */
export const GROUP_SIZES = [2, 3, 4, 5, 6] as const;
/** Game lengths (minutes) the teacher can choose from. */
export const GAME_MINUTES = [5, 10, 15, 20] as const;
export const DEFAULT_GAME_MINUTES = 10;
/** "+1 minute" on the teacher's screen. */
export const EXTRA_TIME_MS = 60_000;

/** The games: names shown to everyone, and their default group size. */
export const WORD_GAMES = {
  'hot-seat': {
    name: 'Hot Seat',
    emoji: '🔥',
    defaultGroupSize: 4,
    summary:
      'One student in each group guesses. Everyone else sees the word and describes it without saying the words on the "Don\'t say" list. Each word gets a new guesser.',
  },
  'explain-it': {
    name: 'Explain It',
    emoji: '💬',
    defaultGroupSize: 5,
    summary:
      'One student in each group sees the word and explains it without saying the words on the "Don\'t say" list. The rest of the group guesses. Each word gets a new explainer.',
  },
} as const;

// ===========================================================================

export type WordGameKind = keyof typeof WORD_GAMES;

const GAME_FLAG = 'word-game:';
const GROUP_SIZE_FLAG = 'group-size:';
const GROUPS_FLAG = 'groups:';

export function isWordGameKind(value: unknown): value is WordGameKind {
  return typeof value === 'string' && value in WORD_GAMES;
}

/** The flags that make a session a word game. */
export function wordGameFlags(kind: WordGameKind, groupSize: number): string[] {
  return [GAME_FLAG + kind, GROUP_SIZE_FLAG + groupSize];
}

function flagValue(session: LiveSession, prefix: string): string | null {
  const flag = session.categories?.find((c) => c.startsWith(prefix));
  return flag ? flag.slice(prefix.length) : null;
}

/** Which word game this session is (null for a speaking session). */
export function wordGameKind(session: LiveSession): WordGameKind | null {
  const kind = flagValue(session, GAME_FLAG);
  return isWordGameKind(kind) ? kind : null;
}

export function groupSizeOf(session: LiveSession): number {
  const kind = wordGameKind(session);
  const size = Number(flagValue(session, GROUP_SIZE_FLAG));
  return size >= 2 ? size : kind ? WORD_GAMES[kind].defaultGroupSize : 4;
}

/** How many groups for this many students (every group has at least 2). */
export function groupCountFor(studentCount: number, groupSize: number): number {
  if (studentCount < 4) return 1;
  let count = Math.max(1, Math.round(studentCount / groupSize));
  // No group more than one bigger than the size chosen.
  while (Math.ceil(studentCount / count) > groupSize + 1) count++;
  return Math.min(count, Math.floor(studentCount / 2));
}

/** The number of groups, fixed when the game starts. */
function groupCount(session: LiveSession): number {
  const fixed = Number(flagValue(session, GROUPS_FLAG));
  return fixed >= 1 ? fixed : groupCountFor(session.roster.length, groupSizeOf(session));
}

/**
 * The groups. Students are dealt round the groups in roster order, so a
 * student who joins late is added to a group without moving anyone else.
 */
export function gameGroups(session: LiveSession): Participant[][] {
  const count = groupCount(session);
  const groups: Participant[][] = Array.from({ length: count }, () => []);
  session.roster.forEach((p, i) => groups[i % count].push(p));
  return groups;
}

export type GroupProgress = {
  index: number;
  members: Participant[];
  /** The card the group is on now (0 = its first word). */
  card: number;
  /** Words guessed. */
  score: number;
  /** Hot Seat: the guesser. Explain It: the explainer. */
  player: Participant | null;
  /** Who takes the turn after this word. */
  nextPlayer: Participant | null;
  word: WordCard | null;
};

/** Where every group is up to, from the taps saved on the students' rows. */
export function groupProgress(
  session: LiveSession,
  participants: readonly LiveParticipant[],
  cards: readonly WordCard[] = WORD_CARDS,
): GroupProgress[] {
  const groups = gameGroups(session);
  const pool = shuffle(cardsForLevel(cards, session.level), session.seed + LEVELS.indexOf(session.level));
  const byId = new Map(participants.map((p) => [p.id, p]));

  return groups.map((members, index) => {
    const got = new Set<number>();
    const done = new Set<number>();
    for (const m of members) {
      const row = byId.get(m.id);
      for (const n of row?.got_cards ?? []) {
        got.add(n);
        done.add(n);
      }
      for (const n of row?.skipped_cards ?? []) done.add(n);
    }
    const card = done.size === 0 ? 0 : Math.max(...done) + 1;
    const n = members.length;
    return {
      index,
      members,
      card,
      score: got.size,
      player: n > 0 ? members[card % n] : null,
      nextPlayer: n > 0 ? members[(card + 1) % n] : null,
      // Groups never share a word: group g takes every G-th card of the shuffled list.
      word: pool.length > 0 ? pool[(index + card * groups.length) % pool.length] : null,
    };
  });
}

/** The group a student is in, or null when they joined after the start. */
export function groupOf(progress: readonly GroupProgress[], participantId: string): GroupProgress | null {
  return progress.find((g) => g.members.some((m) => m.id === participantId)) ?? null;
}

/** Groups ranked by words guessed (ties share a place). */
export function ranking(progress: readonly GroupProgress[]): { group: GroupProgress; place: number }[] {
  const sorted = [...progress].sort((a, b) => b.score - a.score || a.index - b.index);
  return sorted.map((group) => ({ group, place: 1 + sorted.filter((g) => g.score > group.score).length }));
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

type Changes = Partial<Omit<LiveSession, 'id' | 'code' | 'host_id'>>;

/** Starts the game: mixes the class into groups and starts the game timer. */
export function startWordGame(session: LiveSession, participants: readonly LiveParticipant[], now: number): Changes {
  const roster = shuffle(
    participants.map((p) => ({ id: p.id, name: p.name })),
    session.seed,
  );
  const count = groupCountFor(roster.length, groupSizeOf(session));
  return {
    status: 'playing',
    round: 0,
    round_count: 1,
    stage: 'discussion',
    roster,
    categories: [...(session.categories ?? []).filter((c) => !c.startsWith(GROUPS_FLAG)), GROUPS_FLAG + count],
    ends_at: new Date(now + session.round_minutes * 60_000).toISOString(),
    remaining_ms: null,
  };
}

/** Students who joined after the start are added to the end of the roster. */
export function addLateJoiners(session: LiveSession, participants: readonly LiveParticipant[]): Changes | null {
  const inRoster = new Set(session.roster.map((p) => p.id));
  const late = participants.filter((p) => !inRoster.has(p.id));
  if (late.length === 0) return null;
  return { roster: [...session.roster, ...late.map((p) => ({ id: p.id, name: p.name }))] };
}

/** Adds time to the game clock (running or paused). */
export function addTime(session: LiveSession, now: number, ms: number): Changes {
  if (session.ends_at) {
    const base = Math.max(now, Date.parse(session.ends_at));
    return { ends_at: new Date(base + ms).toISOString() };
  }
  return { remaining_ms: (session.remaining_ms ?? 0) + ms };
}

/**
 * A student taps "Got it" or "Skip" for the card their group is on. Saved on
 * their own row; the card number makes a second tap for the same card harmless.
 */
export async function recordCard(me: LiveParticipant, card: number, guessed: boolean): Promise<void> {
  const column = guessed ? 'got_cards' : 'skipped_cards';
  const current = (guessed ? me.got_cards : me.skipped_cards) ?? [];
  if (current.includes(card)) return;
  const { error } = await requireSupabase()
    .from('participants')
    .update({ [column]: [...current, card] })
    .eq('id', me.id);
  if (error) throw new Error(error.message);
}
