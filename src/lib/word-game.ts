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
import { LEVELS } from '@/core/content/levels';
import { cardsForLevel, WORD_CARDS, type WordCard } from '@/data/word-cards';
import { flagValue, remainingMs, type LiveParticipant, type LiveSession } from '@/core/live/session';
import { dealOrder, mixGroups, type Participant } from '@/core/live/groups';
import { shuffle } from '@/core/content/shuffle';
import { requireSupabase } from '@/core/app/supabase';

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
/** Typing: a guess this many letters away from the word is "Almost! Check your spelling". */
export const NEAR_MISS_LETTERS = 2;
/** Typing: words shorter than this only count as "almost" when one letter is wrong. */
export const NEAR_MISS_MIN_LENGTH = 6;
/** Team names: the longest name, and how often phones check for a new one. */
export const TEAM_NAME_MAX_LENGTH = 24;
export const TEAM_NAME_REFRESH_MS = 5000;
/** "Mix the groups": how often (minutes) everyone moves to a new group. */
export const MIX_MINUTES = [3, 5] as const;
/** Card numbers in round r start at r × this (so each round's groups start from their first word). */
export const ROUND_CARD_BASE = 1000;

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
const TYPING_FLAG = 'typing';
const MIX_FLAG = 'mix:';

export function isWordGameKind(value: unknown): value is WordGameKind {
  return typeof value === 'string' && value in WORD_GAMES;
}

/** The flags that make a session a word game. */
export function wordGameFlags(kind: WordGameKind, groupSize: number, typing = false, mixMinutes = 0): string[] {
  return [
    GAME_FLAG + kind,
    GROUP_SIZE_FLAG + groupSize,
    ...(typing ? [TYPING_FLAG] : []),
    ...(mixMinutes > 0 ? [MIX_FLAG + mixMinutes] : []),
  ];
}

/** "Mix the groups": minutes per round (0 = the groups stay the same). */
export function mixMinutesOf(session: LiveSession): number {
  const n = Number(flagValue(session, MIX_FLAG));
  return n > 0 ? n : 0;
}

/** How many rounds (sets of groups) a game of this length has; the last round takes what is left. */
export function roundCountFor(gameMinutes: number, mixMinutes: number): number {
  return mixMinutes > 0 ? Math.max(1, Math.floor(gameMinutes / mixMinutes)) : 1;
}

/** Guessers type the word on their phone (spelling counts) instead of saying it. */
export function isTyping(session: LiveSession): boolean {
  return session.categories?.includes(TYPING_FLAG) ?? false;
}

/** A guess or word for comparing: small letters, no accents, only letters and numbers. */
export function normalizeGuess(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** How many letters must change to turn one word into the other. */
function lettersApart(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const here = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = here;
    }
  }
  return row[b.length];
}

/** Checks a typed guess: right, almost (a spelling mistake), or wrong. */
export function checkGuess(guess: string, word: string): 'right' | 'almost' | 'wrong' {
  const g = normalizeGuess(guess);
  const w = normalizeGuess(word);
  if (!g) return 'wrong';
  if (g === w) return 'right';
  const allowed = w.length >= NEAR_MISS_MIN_LENGTH ? NEAR_MISS_LETTERS : 1;
  return lettersApart(g, w) <= allowed ? 'almost' : 'wrong';
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
  /** The round (set of groups), 0-based. */
  round: number;
  index: number;
  members: Participant[];
  /** The card the group is on now (round × ROUND_CARD_BASE + words done this round). */
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
  const round = session.round ?? 0;
  const first = round * ROUND_CARD_BASE;
  const inRound = (n: number) => n >= first && n < first + ROUND_CARD_BASE;
  // Each round deals the words again in a new order.
  const pool = shuffle(
    cardsForLevel(cards, session.level),
    session.seed + LEVELS.indexOf(session.level) + round * 7919,
  );
  const byId = new Map(participants.map((p) => [p.id, p]));

  return groups.map((members, index) => {
    const got = new Set<number>();
    const done = new Set<number>();
    for (const m of members) {
      const row = byId.get(m.id);
      for (const n of row?.got_cards ?? []) {
        if (!inRound(n)) continue;
        got.add(n);
        done.add(n);
      }
      for (const n of row?.skipped_cards ?? []) if (inRound(n)) done.add(n);
    }
    const turn = done.size === 0 ? 0 : Math.max(...done) + 1 - first;
    const n = members.length;
    return {
      round,
      index,
      members,
      card: first + turn,
      score: got.size,
      player: n > 0 ? members[turn % n] : null,
      nextPlayer: n > 0 ? members[(turn + 1) % n] : null,
      // Groups never share a word: group g takes every G-th card of the shuffled list.
      word: pool.length > 0 ? pool[(index + turn * groups.length) % pool.length] : null,
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
    round_count: roundCountFor(session.round_minutes, mixMinutesOf(session)),
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

/** True when the clock says it's time for new groups ("Mix the groups"). */
export function newRoundDue(session: LiveSession, now: number): boolean {
  const mix = mixMinutesOf(session);
  if (!mix || session.status !== 'playing' || session.stage !== 'discussion') return false;
  if (session.round >= session.round_count - 1) return false;
  const endsAt = session.round_minutes * 60_000 - (session.round + 1) * mix * 60_000;
  return remainingMs(session, now) <= endsAt;
}

/**
 * New groups for the next round: the clock stops while everyone finds their
 * new group. `pastGroups`: every earlier round's groups (ids), so people who
 * were together before are kept apart.
 */
export function startNewRound(
  session: LiveSession,
  participants: readonly LiveParticipant[],
  pastGroups: readonly (readonly string[])[],
  now: number,
): Changes {
  const here = new Set(participants.map((p) => p.id));
  const roster = [
    ...session.roster.filter((p) => here.has(p.id)),
    ...participants.filter((p) => !session.roster.some((r) => r.id === p.id)).map((p) => ({ id: p.id, name: p.name })),
  ];
  const count = groupCount(session);
  const round = session.round + 1;
  return {
    round,
    stage: 'changeover',
    roster: dealOrder(mixGroups(roster, count, pastGroups, session.seed + round)),
    found_ids: [],
    ends_at: null,
    remaining_ms: remainingMs(session, now),
  };
}

/** Everyone has found their new group (or the teacher said start): the clock runs again. */
export function resumeRound(session: LiveSession, now: number): Changes {
  return {
    stage: 'discussion',
    ends_at: new Date(now + (session.remaining_ms ?? 0)).toISOString(),
    remaining_ms: null,
  };
}

/** Which groups have found each other this round (any member tapped, or the teacher marked them). */
export function groupsFound(session: LiveSession, participants: readonly LiveParticipant[]): boolean[] {
  const tapped = new Set(participants.filter((p) => p.found_round === session.round).map((p) => p.id));
  const marked = new Set(session.found_ids ?? []);
  // A group is found when every member has tapped (or the teacher marked them).
  return gameGroups(session).map((g) => g.every((p) => tapped.has(p.id) || marked.has(p.id)));
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

// ---------------------------------------------------------------------------
// The record of every word (session_events), for points and awards
// ---------------------------------------------------------------------------

export const GAME_STARTED = 'game_started';
export const CARD_DONE = 'card_done';
export const HINT = 'hint';
/** Typing: a wrong guess (kept for "hard to spell" and Best spellers). */
export const GUESS_WRONG = 'guess_wrong';
/** A group names its team (the newest name wins). */
export const TEAM_NAME = 'team_name';
/** A round's groups start playing ({round, groups: ids per group}); round 0 is the start of the game. */
export const ROUND_STARTED = 'round_started';

export type RoundStartedData = { round: number; groups: string[][] };

/** Every round's groups so far (for keeping people apart), from the events. */
export function pastGroupsFrom(events: readonly { kind: string; data: Record<string, unknown> }[]): string[][] {
  return events.filter((e) => e.kind === ROUND_STARTED).flatMap((e) => (e.data as RoundStartedData).groups ?? []);
}

/** The event data for the groups now playing. */
export function roundStartedData(session: LiveSession): RoundStartedData {
  return { round: session.round, groups: gameGroups(session).map((g) => g.map((p) => p.id)) };
}

/** What is saved when a word is guessed or skipped (kind CARD_DONE). */
export type CardDoneData = {
  round: number;
  group: number;
  card: number;
  word: string;
  result: 'got' | 'skipped';
  /** Hot Seat: the guesser. Explain It: the explainer. */
  player_id: string;
  /** Who guessed the word (null when skipped or not known). */
  guesser_id: string | null;
  /** Everyone in the group at the time. */
  members: string[];
};

/** What is saved when someone opens a word's meaning (kind HINT). */
export type HintData = { round: number; group: number; card: number; word: string };

/** Typing: a wrong guess (kind GUESS_WRONG). */
export type GuessWrongData = HintData & { guess: string; almost: boolean };

/** A team name (kind TEAM_NAME); an empty name clears it. */
export type TeamNameData = { round: number; group: number; name: string };

/** The newest name for each group ("round:group" → name), from the events. */
export function teamNames(events: readonly { kind: string; data: Record<string, unknown> }[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const e of events) {
    if (e.kind !== TEAM_NAME) continue;
    const d = e.data as TeamNameData;
    const key = `${d.round}:${d.group}`;
    if (d.name.trim()) names.set(key, d.name.trim());
    else names.delete(key);
  }
  return names;
}

/** A group's name: its team name, or "Group N". */
export function groupLabel(names: ReadonlyMap<string, string>, round: number, group: number): string {
  return names.get(`${round}:${group}`) ?? `Group ${group + 1}`;
}

type CardBackend = {
  recordCard: typeof recordCard;
  logEvent: (
    sessionId: string,
    participantId: string | null,
    kind: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
};

/**
 * A word is guessed or skipped: moves the group on (recordCard), then saves
 * the record for the awards. `guesserId`: who guessed it, when known.
 */
export async function finishCard(
  backend: CardBackend,
  session: LiveSession,
  kind: WordGameKind,
  group: GroupProgress,
  tapper: LiveParticipant,
  guessed: boolean,
  guesserId: string | null,
): Promise<void> {
  if (!group.player || !group.word) return;
  await backend.recordCard(tapper, group.card, guessed);
  const data: CardDoneData = {
    round: group.round,
    group: group.index,
    card: group.card,
    word: group.word.word,
    result: guessed ? 'got' : 'skipped',
    player_id: group.player.id,
    guesser_id: guessed ? (kind === 'hot-seat' ? group.player.id : guesserId) : null,
    members: group.members.map((m) => m.id),
  };
  await backend.logEvent(session.id, tapper.id, CARD_DONE, data);
}

/** How far back "Past word games" on the dashboard looks (sessions are deleted after 30 days anyway). */
export const PAST_GAMES_DAYS = 30;

export type PastGame = { code: string; kind: WordGameKind; level: string; created_at: string; students: number };

/** Word games this teacher hosted, newest first, so their awards can be opened again. */
export async function fetchMyPastGames(): Promise<PastGame[]> {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return [];
  const since = new Date(Date.now() - PAST_GAMES_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('sessions')
    .select('code, level, categories, roster, created_at, status')
    .eq('host_id', userId)
    .eq('status', 'finished')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as (LiveSession & { created_at: string })[]).flatMap((s) => {
    const kind = wordGameKind(s);
    return kind && s.roster.length > 0
      ? [{ code: s.code, kind, level: s.level, created_at: s.created_at, students: s.roster.length }]
      : [];
  });
}
