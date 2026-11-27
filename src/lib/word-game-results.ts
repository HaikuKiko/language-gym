/**
 * Word games: points and awards for each student, worked out at the end of
 * a game from the record of every word (session_events). Every phone and the
 * teacher's screen work them out the same way.
 */
import type { LiveSession } from '@/core/live/session';
import type { Participant } from '@/core/live/groups';
import type { SessionEvent } from '@/core/live/events';
import {
  CARD_DONE,
  GAME_STARTED,
  GUESS_WRONG,
  HINT,
  groupLabel,
  isTyping,
  teamNames,
  type CardDoneData,
  type GuessWrongData,
  type HintData,
  type WordGameKind,
} from '@/lib/word-game';

// ===========================================================================
// Settings: points
// ===========================================================================

/** Guessing a word. */
export const GUESS_POINTS = 10;
/** Extra for guessing a word this quickly. */
export const FAST_BONUS_POINTS = 5;
export const FAST_SECONDS = 20;
/** Explain It: explaining a word that gets guessed. */
export const EXPLAIN_POINTS = 10;
/** Hot Seat: each person describing a word that gets guessed. */
export const DESCRIBE_POINTS = 5;
/** Extra for each person who could see a guessed word, when nobody opened its meaning. */
export const NO_HINT_BONUS_POINTS = 3;
/** Typing: extra for typing a word right the first time. */
export const SPELLED_FIRST_TIME_POINTS = 2;
/** How many people each award lists. */
export const AWARD_PLACES = 3;
/** How many words "Hardest words" lists. */
export const HARD_WORDS_SHOWN = 5;

// ===========================================================================

export type PlayerResult = {
  id: string;
  name: string;
  points: number;
  /** Words this person guessed, and their average time (seconds). */
  guessed: number;
  guessSeconds: number | null;
  /** Words this person explained or described that were guessed. */
  explained: number;
  explainSeconds: number | null;
  /** Meanings this person opened. */
  hints: number;
  /** Typing: words typed right the first time, and guesses that were spelling mistakes. */
  firstTry: number;
  spellingMistakes: number;
};

export type Award = { title: string; emoji: string; lines: { id?: string; text: string }[] };

export type WordResult = {
  word: string;
  skipped: number;
  guessed: number;
  hints: number;
  avgSeconds: number | null;
  missedBy: string[];
};

export type GameResults = {
  players: PlayerResult[];
  awards: Award[];
  hardWords: WordResult[];
  groups: { index: number; label: string; names: string[]; words: number }[];
  /** Typing: words with spelling mistakes, and how they were spelled. */
  hardToSpell: { word: string; tries: string[] }[];
  wordsDone: number;
};

type Card = CardDoneData & { at: number; seconds: number; hinted: boolean };

const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const secs = (s: number | null) => (s == null ? '' : `${Math.round(s)}s each`);

/** Points and awards for a finished (or running) game. */
export function gameResults(kind: WordGameKind, session: LiveSession, events: readonly SessionEvent[]): GameResults {
  const names = new Map<string, string>(session.roster.map((p: Participant) => [p.id, p.name]));
  const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? 'Someone') : 'Someone');
  const start = events.find((e) => e.kind === GAME_STARTED);
  const startAt = start ? Date.parse(start.created_at) : null;

  // Meanings opened, per word on screen and per person.
  const hintedCards = new Set<string>();
  const hintsBy = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== HINT) continue;
    const d = e.data as HintData;
    hintedCards.add(`${d.round}:${d.group}:${d.card}`);
    if (e.participant_id) hintsBy.set(e.participant_id, (hintsBy.get(e.participant_id) ?? 0) + 1);
  }

  // Typing: wrong guesses, per word on screen and person.
  const typing = isTyping(session);
  const wrongOn = new Map<string, number>();
  const mistakesBy = new Map<string, number>();
  const misspelt = new Map<string, string[]>();
  for (const e of events) {
    if (e.kind !== GUESS_WRONG || !e.participant_id) continue;
    const d = e.data as GuessWrongData;
    const key = `${d.round}:${d.group}:${d.card}:${e.participant_id}`;
    wrongOn.set(key, (wrongOn.get(key) ?? 0) + 1);
    if (d.almost) {
      mistakesBy.set(e.participant_id, (mistakesBy.get(e.participant_id) ?? 0) + 1);
      misspelt.set(d.word, [...(misspelt.get(d.word) ?? []), d.guess]);
    }
  }
  const firstTries = new Map<string, number>();

  // Each word once (two people can tap at the same moment), with its time.
  const seen = new Set<string>();
  const lastAt = new Map<string, number>();
  const cards: Card[] = [];
  for (const e of events) {
    if (e.kind !== CARD_DONE) continue;
    const d = e.data as CardDoneData;
    const key = `${d.round}:${d.group}:${d.card}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const at = Date.parse(e.created_at);
    const groupKey = `${d.round}:${d.group}`;
    const from = lastAt.get(groupKey) ?? startAt ?? at;
    lastAt.set(groupKey, at);
    cards.push({ ...d, at, seconds: Math.max(0, (at - from) / 1000), hinted: hintedCards.has(key) });
  }

  // Per person.
  const ids = new Set<string>(session.roster.map((p) => p.id));
  const guessTimes = new Map<string, number[]>();
  const explainTimes = new Map<string, number[]>();
  const points = new Map<string, number>();
  const add = (map: Map<string, number[]>, id: string, s: number) => map.set(id, [...(map.get(id) ?? []), s]);
  const score = (id: string, n: number) => points.set(id, (points.get(id) ?? 0) + n);

  for (const c of cards) {
    if (c.result !== 'got') continue;
    if (c.guesser_id) {
      add(guessTimes, c.guesser_id, c.seconds);
      score(c.guesser_id, GUESS_POINTS + (c.seconds <= FAST_SECONDS ? FAST_BONUS_POINTS : 0));
      if (typing && !wrongOn.has(`${c.round}:${c.group}:${c.card}:${c.guesser_id}`)) {
        score(c.guesser_id, SPELLED_FIRST_TIME_POINTS);
        firstTries.set(c.guesser_id, (firstTries.get(c.guesser_id) ?? 0) + 1);
      }
    }
    // Who could see the word: Hot Seat, everyone but the guesser; Explain It, the explainer.
    const seers = kind === 'hot-seat' ? c.members.filter((m) => m !== c.player_id) : [c.player_id];
    for (const id of seers) {
      add(explainTimes, id, c.seconds);
      score(id, (kind === 'hot-seat' ? DESCRIBE_POINTS : EXPLAIN_POINTS) + (c.hinted ? 0 : NO_HINT_BONUS_POINTS));
    }
  }

  const players: PlayerResult[] = [...ids].map((id) => ({
    id,
    name: nameOf(id),
    points: points.get(id) ?? 0,
    guessed: guessTimes.get(id)?.length ?? 0,
    guessSeconds: avg(guessTimes.get(id) ?? []),
    explained: explainTimes.get(id)?.length ?? 0,
    explainSeconds: avg(explainTimes.get(id) ?? []),
    hints: hintsBy.get(id) ?? 0,
    firstTry: firstTries.get(id) ?? 0,
    spellingMistakes: mistakesBy.get(id) ?? 0,
  }));

  const top = <T>(list: T[], keep: (t: T) => boolean, order: (a: T, b: T) => number) =>
    list.filter(keep).sort(order).slice(0, AWARD_PLACES);
  const awards: Award[] = [];

  awards.push({
    title: 'Points',
    emoji: '🏆',
    lines: top(
      players,
      (p) => p.points > 0,
      (a, b) => b.points - a.points,
    ).map((p) => ({
      id: p.id,
      text: `${p.name}: ${p.points} points`,
    })),
  });
  awards.push({
    title: 'Fastest guessers',
    emoji: '⚡',
    lines: top(
      players,
      (p) => p.guessed > 0,
      (a, b) => b.guessed - a.guessed || (a.guessSeconds ?? 0) - (b.guessSeconds ?? 0),
    ).map((p) => ({
      id: p.id,
      text: `${p.name}: ${p.guessed} ${p.guessed === 1 ? 'word' : 'words'}, ${secs(p.guessSeconds)}`,
    })),
  });
  awards.push({
    title: kind === 'hot-seat' ? 'Best describers' : 'Best explainers',
    emoji: '🗣️',
    lines: top(
      players,
      (p) => p.explained > 0,
      (a, b) => b.explained - a.explained || (a.explainSeconds ?? 0) - (b.explainSeconds ?? 0),
    ).map((p) => ({
      id: p.id,
      text: `${p.name}: ${p.explained} ${p.explained === 1 ? 'word' : 'words'}, ${secs(p.explainSeconds)}`,
    })),
  });

  // Explain It: an explainer and a guesser who get through words quickly together.
  if (kind === 'explain-it') {
    const pairs = new Map<string, number[]>();
    for (const c of cards)
      if (c.result === 'got' && c.guesser_id) add(pairs, `${c.player_id}>${c.guesser_id}`, c.seconds);
    awards.push({
      title: 'Strong pairs',
      emoji: '🤝',
      lines: [...pairs.entries()]
        .sort((a, b) => b[1].length - a[1].length || (avg(a[1]) ?? 0) - (avg(b[1]) ?? 0))
        .slice(0, AWARD_PLACES)
        .map(([key, times]) => {
          const [from, to] = key.split('>');
          return {
            text: `${nameOf(from)} explains, ${nameOf(to)} guesses: ${times.length} ${times.length === 1 ? 'word' : 'words'}, ${secs(avg(times))}`,
          };
        }),
    });
  }

  if (typing) {
    awards.push({
      title: 'Best spellers',
      emoji: '✍️',
      lines: top(
        players,
        (p) => p.firstTry > 0,
        (a, b) => b.firstTry - a.firstTry || a.spellingMistakes - b.spellingMistakes,
      ).map((p) => ({ id: p.id, text: `${p.name}: ${p.firstTry} of ${p.guessed} right first time` })),
    });
  }

  awards.push({
    title: 'No hints needed',
    emoji: '💪',
    lines: top(
      players,
      (p) => p.hints === 0 && p.guessed + p.explained > 0,
      (a, b) => b.guessed + b.explained - (a.guessed + a.explained),
    ).map((p) => ({
      id: p.id,
      text: `${p.name}: ${p.guessed + p.explained} ${p.guessed + p.explained === 1 ? 'word' : 'words'}, no hints`,
    })),
  });

  // Hardest words: skipped most, then hints, then slowest.
  const byWord = new Map<string, Card[]>();
  for (const c of cards) byWord.set(c.word, [...(byWord.get(c.word) ?? []), c]);
  const hardWords: WordResult[] = [...byWord.entries()]
    .map(([word, list]) => ({
      word,
      skipped: list.filter((c) => c.result === 'skipped').length,
      guessed: list.filter((c) => c.result === 'got').length,
      hints: list.filter((c) => c.hinted).length,
      avgSeconds: avg(list.filter((c) => c.result === 'got').map((c) => c.seconds)),
      missedBy: list.filter((c) => c.result === 'skipped').map((c) => nameOf(c.player_id)),
    }))
    .filter((w) => w.skipped > 0 || w.hints > 0)
    .sort((a, b) => b.skipped - a.skipped || b.hints - a.hints || (b.avgSeconds ?? 0) - (a.avgSeconds ?? 0))
    .slice(0, HARD_WORDS_SHOWN);

  // Groups (a small extra).
  const groupWords = new Map<number, number>();
  const groupNames = new Map<number, string[]>();
  for (const c of cards) {
    if (!groupNames.has(c.group)) groupNames.set(c.group, c.members.map(nameOf));
    if (c.result === 'got') groupWords.set(c.group, (groupWords.get(c.group) ?? 0) + 1);
  }
  const teams = teamNames(events);
  const groups = [...groupNames.entries()]
    .map(([index, members]) => ({
      index,
      label: groupLabel(teams, 0, index),
      names: members,
      words: groupWords.get(index) ?? 0,
    }))
    .sort((a, b) => b.words - a.words);

  return {
    players: players.sort((a, b) => b.points - a.points),
    awards: awards.filter((a) => a.lines.length > 0),
    hardWords,
    groups,
    hardToSpell: [...misspelt.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, HARD_WORDS_SHOWN)
      .map(([word, tries]) => ({ word, tries: [...new Set(tries)] })),
    wordsDone: cards.filter((c) => c.result === 'got').length,
  };
}

/** One line for a student's own phone, e.g. "45 points · 2nd in Fastest guessers". */
export function personalLine(results: GameResults, id: string): string {
  const me = results.players.find((p) => p.id === id);
  if (!me) return '';
  const places = ['1st', '2nd', '3rd', '4th', '5th'];
  const wins = results.awards
    .map((a) => ({ a, i: a.lines.findIndex((l) => l.id === id) }))
    .filter(({ i }) => i >= 0)
    .map(({ a, i }) => `${a.emoji} ${places[i]} in ${a.title}`);
  return [`${me.points} points`, ...wins].join(' · ');
}
