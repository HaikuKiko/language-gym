import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Chip } from '@/core/ui/chip';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { LEVELS, type Level } from '@/core/content/levels';
import { useTheme } from '@/core/ui/use-theme';
import { type LiveParticipant, type LiveSession } from '@/core/live/session';
import { sessionFlags } from '@/lib/talk-rounds';
import { groupsForRound } from '@/core/live/groups';
import { SessionBackendProvider, type SessionBackend } from '@/lib/session-backend';
import type { SessionEvent } from '@/core/live/events';
import { DEFAULT_ROUND_SETTINGS } from '@/lib/session';
import {
  GUESS_WRONG,
  TEAM_NAME,
  WORD_GAMES,
  finishCard,
  groupProgress,
  isTyping,
  isWordGameKind,
  wordGameFlags,
  wordGameKind,
  type GuessWrongData,
  type TeamNameData,
} from '@/lib/word-game';
import { WordGameHostScreen } from '@/screens/word-game-host-screen';
import { WordGameStudentScreen } from '@/screens/word-game-student-screen';
import { LiveHostScreen } from '@/screens/live-host-screen';
import { QuizHostScreen } from '@/screens/quiz-host-screen';
import { QuizStudentScreen } from '@/screens/quiz-student-screen';
import { answerOf, isQuestionOpen, questionSeconds, DEFAULT_QUESTION_SECONDS } from '@/core/live/quiz';
import { fetchQuestions, quizFlags, quizOf } from '@/lib/grammar-quiz';
import { LiveStudentScreen } from '@/screens/live-student-screen';

// ===========================================================================
// Settings
// ===========================================================================

/** The pretend students, in the order they join. */
const DEMO_NAMES = ['Ana', 'Ben', 'Chen', 'Dara'];
/** How many pretend students the viewer can choose (fewer phones are easier to follow). */
const DEMO_STUDENT_CHOICES = [2, 3] as const;
const DEFAULT_DEMO_STUDENTS = 2;
/** Time between pretend students joining. */
const JOIN_EVERY_MS = 250;
/** A pretend pair taps "We found each other!" between these times after a round starts. */
const FIND_MIN_MS = 2500;
const FIND_MAX_MS = 7000;
/** Minutes per round when the demo is opened without settings (e.g. from the landing page). */
const DEMO_ROUND_MINUTES = 1;
/** Word games: the pretend students (6, so there are two groups of 3). */
const GAME_DEMO_NAMES = ['Ana', 'Ben', 'Chen', 'Dara', 'Eli', 'Fay'];
/** Word games: group size and game length when the demo is opened without settings. */
const GAME_DEMO_GROUP_SIZE = 3;
const GAME_DEMO_MINUTES = 2;
/** Word games: a pretend group gets its word between these times after it appears. */
const GUESS_MIN_MS = 4000;
const GUESS_MAX_MS = 9000;
/** Word games: how often a pretend group skips a word instead of guessing it. */
const SKIP_CHANCE = 0.2;
/** Word games: names the pretend teams give themselves, a few seconds into the game. */
const DEMO_TEAM_NAMES = ['The Owls', 'Rocket Squad', 'Word Wizards', 'Quick Foxes'];
const TEAM_NAME_AFTER_MS = 6000;
/** Word games with typing: how often a pretend guesser makes a spelling mistake first. */
const MISSPELL_CHANCE = 0.3;
/** Word games with "Mix the groups": new groups every minute, so the 2-minute demo has 2 rounds. */
const DEMO_MIX_MINUTES = 1;
/** Quizzes: how often a pretend student picks the right answer, and when they answer (fractions of the time). */
const QUIZ_RIGHT_CHANCE = 0.7;
const QUIZ_ANSWER_FROM = 0.15;
const QUIZ_ANSWER_TO = 0.6;
/** Screens at least this wide show the teacher screen and the phones side by side. */
const SIDE_BY_SIDE_WIDTH = 1000;

// ===========================================================================

type DemoParams = {
  level?: string;
  week?: string;
  custom?: string;
  turns?: string;
  minutes?: string;
  /** A word game (hot-seat or explain-it) instead of speed friending. */
  game?: string;
  /** Word games: the group size. */
  size?: string;
  /** Word games: "1" when guessers type the word. */
  typing?: string;
  /** How many pretend students (2 or 3). */
  students?: string;
  /** Word games: "1" to mix the groups. */
  mix?: string;
  /** Quizzes: the quiz set's id, the quiz number and the seconds per question. */
  quiz?: string;
  number?: string;
  seconds?: string;
};

/** A session kept only on this device: never saved, so it never mixes with real ones. */
function demoSession(params: DemoParams): LiveSession {
  const level: Level = LEVELS.includes(params.level as Level) ? (params.level as Level) : DEFAULT_ROUND_SETTINGS.level;
  const week = params.week ? Number(params.week) : null;
  const game = isWordGameKind(params.game) ? params.game : null;
  const minutes = Number(params.minutes) || (game ? GAME_DEMO_MINUTES : DEMO_ROUND_MINUTES);
  return {
    id: 'demo',
    code: '000000',
    host_id: 'demo-host',
    status: 'lobby',
    level,
    week,
    round_minutes: minutes,
    round_count: 3,
    auto_advance: true,
    round: 0,
    stage: 'changeover',
    ends_at: null,
    remaining_ms: null,
    roster: [],
    seed: Math.floor(Math.random() * 2 ** 31),
    categories: params.quiz
      ? quizFlags(params.quiz, Number(params.number) || 1, Number(params.seconds) || DEFAULT_QUESTION_SECONDS)
      : game
      ? wordGameFlags(
          game,
          Number(params.size) || GAME_DEMO_GROUP_SIZE,
          params.typing === '1',
          params.mix === '1' ? DEMO_MIX_MINUTES : 0,
        )
      : sessionFlags({
          ...DEFAULT_ROUND_SETTINGS,
          level,
          week,
          roundMinutes: minutes,
          roundRobin: true,
          autoAdvance: true,
          mode: 'friending',
          customSetId: params.custom || null,
          takeTurns: params.turns !== '0',
        }),
    created_at: new Date().toISOString(),
    found_ids: [],
  } as LiveSession;
}

/**
 * The solo demo: a whole speed-friending session with pretend students who
 * join, find each other and tap by themselves. Shows the teacher screen and
 * the students' phones together (or as tabs on a narrow screen).
 */
export default function DemoRoute() {
  const params = useLocalSearchParams<DemoParams>();
  const fromLink = Number(params.students);
  const [count, setCount] = useState<number>(
    (DEMO_STUDENT_CHOICES as readonly number[]).includes(fromLink) ? fromLink : DEFAULT_DEMO_STUDENTS,
  );
  // A new count starts the demo again from the beginning.
  return <Demo key={count} params={params} count={count} onCount={setCount} />;
}

function Demo({ params, count, onCount }: { params: DemoParams; count: number; onCount: (n: number) => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [session, setSession] = useState<LiveSession>(() => demoSession(params));
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const game = wordGameKind(session);
  const quiz = quizOf(session);
  const names = useMemo(() => (game || quiz ? GAME_DEMO_NAMES : DEMO_NAMES).slice(0, count), [game, quiz, count]);
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const [tab, setTab] = useState<string>('teacher');
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // Word games: the record of every word, kept only in memory.
  const eventsRef = useRef<SessionEvent[]>([]);

  const backend = useMemo<SessionBackend>(
    () => ({
      demo: true,
      updateSession: async (from, changes, onlyIfUnmoved = false) => {
        const current = sessionRef.current;
        if (onlyIfUnmoved && (current.round !== from.round || current.stage !== from.stage)) return null;
        const next = { ...current, ...changes } as LiveSession;
        sessionRef.current = next;
        setSession(next);
        return next;
      },
      removeParticipant: async (id) => setParticipants((list) => list.filter((p) => p.id !== id)),
      markFound: async (id, round) =>
        setParticipants((list) => list.map((p) => (p.id === id ? { ...p, found_round: round } : p))),
      recordCard: async (me, card, guessed) => {
        const column = guessed ? 'got_cards' : 'skipped_cards';
        const next = participantsRef.current.map((p) =>
          p.id === me.id && !(p[column] ?? []).includes(card) ? { ...p, [column]: [...(p[column] ?? []), card] } : p,
        );
        participantsRef.current = next;
        setParticipants(next);
      },
      logEvent: async (sessionId, participantId, kind, data = {}) => {
        eventsRef.current.push({
          session_id: sessionId,
          participant_id: participantId,
          kind,
          data,
          created_at: new Date().toISOString(),
        });
      },
      fetchEvents: async () => [...eventsRef.current],
      // Quizzes: the real questions (the teacher's own), answers kept here.
      loadQuizQuestions: (setId, number) => fetchQuestions(setId, number),
      answerQuiz: async (participantId, question, choice, ms) => {
        const current = sessionRef.current;
        if (!isQuestionOpen(current, Date.now()) || current.round !== question) return false;
        const me = participantsRef.current.find((p) => p.id === participantId);
        if (!me || answerOf(me, question)) return false;
        const next = participantsRef.current.map((p) =>
          p.id === participantId
            ? { ...p, quiz_answers: { ...(p.quiz_answers ?? {}), [String(question)]: { c: choice, ms } } }
            : p,
        );
        participantsRef.current = next;
        setParticipants(next);
        return true;
      },
      saveScores: async () => {},
      toggleFollowUp: async (me, key) => {
        const next = participantsRef.current.map((p) => {
          if (p.id !== me.id) return p;
          const asked = p.asked_follow_ups ?? [];
          return { ...p, asked_follow_ups: asked.includes(key) ? asked.filter((k) => k !== key) : [...asked, key] };
        });
        participantsRef.current = next;
        setParticipants(next);
      },
    }),
    [],
  );

  // The pretend students join one after another.
  useEffect(() => {
    const timers = names.map((name, i) =>
      setTimeout(
        () => {
          setParticipants((list) =>
            list.some((p) => p.name === name)
              ? list
              : [
                  ...list,
                  {
                    id: `demo-${i}`,
                    session_id: 'demo',
                    user_id: `demo-user-${i}`,
                    name,
                    joined_at: new Date().toISOString(),
                    found_round: null,
                  },
                ],
          );
        },
        (i + 1) * JOIN_EVERY_MS,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [names]);

  // Each round, every pretend pair finds each other after a few seconds.
  useEffect(() => {
    if (session.status !== 'playing' || session.stage !== 'changeover') return;
    const round = session.round;
    // Talk Rounds: one tap per pair. Word games: everyone taps when they find their new group.
    const tappers = game ? session.roster.map((p) => p.id) : groupsForRound(session.roster, round).map((g) => g[0].id);
    const timers = tappers.map((id) =>
      setTimeout(
        () => {
          if (sessionRef.current.round === round) backend.markFound(id, round);
        },
        FIND_MIN_MS + Math.random() * (FIND_MAX_MS - FIND_MIN_MS),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [game, session.status, session.stage, session.round, session.roster, backend]);

  // Word games: each pretend group guesses (or skips) its word a few seconds after it appears.
  // A clock checks every half second, so one group's tap never delays another's.
  const clockRunning = session.ends_at !== null;
  const pendingTaps = useRef(new Map<number, { card: number; due: number }>());
  useEffect(() => {
    if (!game || session.status !== 'playing' || !clockRunning) return;
    const pending = pendingTaps.current;
    const tick = setInterval(() => {
      const now = Date.now();
      for (const group of groupProgress(sessionRef.current, participantsRef.current)) {
        const due = pending.get(group.index);
        if (!due || due.card !== group.card) {
          pending.set(group.index, {
            card: group.card,
            due: now + GUESS_MIN_MS + Math.random() * (GUESS_MAX_MS - GUESS_MIN_MS),
          });
          continue;
        }
        if (now < due.due || !group.player) continue;
        pending.set(group.index, { card: group.card, due: Infinity });
        // Hot Seat: someone describing taps. Explain It: the explainer taps.
        const tapperId =
          game === 'hot-seat' ? group.members.find((m) => m.id !== group.player?.id)?.id : group.player.id;
        const tapper = participantsRef.current.find((p) => p.id === tapperId);
        // Explain It: someone else in the group guessed it.
        const others = group.members.filter((m) => m.id !== group.player?.id);
        const guesser = others[Math.floor(Math.random() * others.length)]?.id ?? null;
        const guessed = Math.random() >= SKIP_CHANCE;
        const current = sessionRef.current;
        const guesserId = game === 'hot-seat' ? group.player.id : guesser;
        // Typing: now and then a pretend guesser misspells the word first.
        if (guessed && guesserId && group.word && isTyping(current) && Math.random() < MISSPELL_CHANCE) {
          const word = group.word.word;
          const typo = word.length > 3 ? word.slice(0, -2) + word.slice(-1) : word + 'e';
          const data: GuessWrongData = {
            round: group.round,
            group: group.index,
            card: group.card,
            word,
            guess: typo,
            almost: true,
          };
          backend.logEvent(current.id, guesserId, GUESS_WRONG, data);
        }
        if (tapper) finishCard(backend, current, game, group, tapper, guessed, guesser);
      }
    }, 500);
    return () => {
      clearInterval(tick);
      pending.clear();
    };
  }, [game, session.status, clockRunning, backend]);

  // Quizzes: each pretend student answers a few seconds into every question (mostly right).
  const quizOpen = !!quiz && session.status === 'playing' && session.stage === 'discussion';
  useEffect(() => {
    if (!quizOpen) return;
    const round = sessionRef.current.round;
    const seconds = questionSeconds(sessionRef.current);
    const shown = Date.now();
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    fetchQuestions(quiz.setId, quiz.number)
      .then((questions) => {
        const question = questions[round];
        if (cancelled || !question) return;
        for (const p of participantsRef.current) {
          const wait = seconds * 1000 * (QUIZ_ANSWER_FROM + Math.random() * (QUIZ_ANSWER_TO - QUIZ_ANSWER_FROM));
          timers.push(
            setTimeout(() => {
              const wrong = question.options.map((_, i) => i).filter((i) => i !== question.answer);
              const choice =
                Math.random() < QUIZ_RIGHT_CHANCE ? question.answer : wrong[Math.floor(Math.random() * wrong.length)];
              backend.answerQuiz(p.id, round, choice, Date.now() - shown);
            }, wait),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [quizOpen, session.round, quiz?.setId, quiz?.number, backend]);

  // Word games: each pretend team names itself a few seconds in.
  useEffect(() => {
    if (!game || session.status !== 'playing' || session.stage !== 'discussion') return;
    const timer = setTimeout(() => {
      groupProgress(sessionRef.current, participantsRef.current).forEach((group) => {
        const data: TeamNameData = {
          round: group.round,
          group: group.index,
          name: DEMO_TEAM_NAMES[(group.index + group.round * 2) % DEMO_TEAM_NAMES.length],
        };
        backend.logEvent(sessionRef.current.id, group.members[0]?.id ?? null, TEAM_NAME, data);
      });
    }, TEAM_NAME_AFTER_MS);
    return () => clearTimeout(timer);
  }, [game, session.status, session.stage, session.round, backend]);

  const host = quiz ? (
    <QuizHostScreen
      session={session}
      participants={participants}
      onSession={setSession}
      onParticipants={setParticipants}
    />
  ) : game ? (
    <WordGameHostScreen
      kind={game}
      session={session}
      participants={participants}
      onSession={setSession}
      onParticipants={setParticipants}
    />
  ) : (
    <LiveHostScreen
      session={session}
      participants={participants}
      onSession={setSession}
      onParticipants={setParticipants}
    />
  );
  const phone = (name: string) => {
    const me = participants.find((p) => p.name === name);
    return me ? (
      quiz ? (
        <QuizStudentScreen session={session} participants={participants} me={me} />
      ) : game ? (
        <WordGameStudentScreen kind={game} session={session} participants={participants} me={me} />
      ) : (
        <LiveStudentScreen session={session} participants={participants} me={me} />
      )
    ) : (
      <View style={styles.joining}>
        <ThemedText themeColor="textSecondary">{name} is joining…</ThemedText>
      </View>
    );
  };
  const sideBySide = width >= SIDE_BY_SIDE_WIDTH;

  return (
    <SessionBackendProvider backend={backend}>
      <ThemedView style={styles.page}>
        <View style={[styles.banner, { backgroundColor: theme.noticeBg }]}>
          <Text style={styles.bannerText}>
            {quiz
              ? `Quiz demo with ${names.length} pretend students. They join and answer by themselves (mostly right); you can answer for them too. Nothing is saved.`
              : game
              ? `${WORD_GAMES[game].name} demo with ${names.length} pretend students. They join, and their groups guess words by themselves; you can tap for them too. Nothing is saved.`
              : `Demo with ${names.length} pretend students. They join, find each other and tap by themselves; you can tap for them too. Nothing is saved.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={[styles.bannerText, styles.end]}>End demo</Text>
          </Pressable>
          <View style={styles.countRow}>
            <Text style={styles.bannerText}>Pretend students:</Text>
            {DEMO_STUDENT_CHOICES.map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: n === count }}
                accessibilityLabel={`Start again with ${n} pretend students`}
                onPress={() => onCount(n)}
                style={[styles.countChip, n === count && styles.countChipOn]}>
                <Text style={[styles.countText, n === count && styles.countTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {sideBySide ? (
          <View style={styles.row}>
            <View style={[styles.hostBox, { borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>TEACHER SCREEN</Text>
              <View style={styles.fill}>{host}</View>
            </View>
            {/* The phones scroll (on an iPad in landscape only two fit). */}
            <ScrollView style={styles.fill} contentContainerStyle={styles.phones}>
              {names.map((name) => (
                <View key={name} style={styles.phoneWrap}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>{name.toUpperCase()}&apos;S PHONE</Text>
                  <View style={[styles.phone, { backgroundColor: theme.background }]}>{phone(name)}</View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              <Chip label="Teacher" selected={tab === 'teacher'} onPress={() => setTab('teacher')} />
              {names.map((name) => (
                <Chip key={name} label={name} selected={tab === name} onPress={() => setTab(name)} />
              ))}
            </View>
            <View style={styles.fill}>{tab === 'teacher' ? host : phone(tab)}</View>
          </>
        )}
      </ThemedView>
    </SessionBackendProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111',
    flexShrink: 1,
  },
  end: {
    textDecorationLine: 'underline',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  countChip: {
    minWidth: 40,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111',
    backgroundColor: '#fff',
  },
  countChipOn: {
    backgroundColor: '#111',
  },
  countText: {
    fontSize: 15,
    fontWeight: 800,
    color: '#111',
  },
  countTextOn: {
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  hostBox: {
    width: 440,
    borderWidth: 1,
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  label: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: Spacing.one,
  },
  phones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignContent: 'flex-start',
  },
  phoneWrap: {
    width: 270,
  },
  phone: {
    height: 560,
    borderWidth: 6,
    borderColor: '#222',
    borderRadius: 28,
    overflow: 'hidden',
  },
  joining: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
