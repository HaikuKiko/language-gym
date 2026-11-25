import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LEVELS, type Level } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { sessionFlags, type LiveParticipant, type LiveSession } from '@/lib/live-session';
import { groupsForRound } from '@/lib/round-robin';
import { SessionBackendProvider, type SessionBackend } from '@/lib/session-backend';
import { DEFAULT_ROUND_SETTINGS } from '@/lib/session';
import { LiveHostScreen } from '@/screens/live-host-screen';
import { LiveStudentScreen } from '@/screens/live-student-screen';

// ===========================================================================
// Settings
// ===========================================================================

/** The pretend students, in the order they join. */
const DEMO_NAMES = ['Ana', 'Ben', 'Chen', 'Dara', 'Eli'];
/** Time between pretend students joining. */
const JOIN_EVERY_MS = 400;
/** A pretend pair taps "We found each other!" between these times after a round starts. */
const FIND_MIN_MS = 2500;
const FIND_MAX_MS = 7000;
/** Minutes per round when the demo is opened without settings (e.g. from the landing page). */
const DEMO_ROUND_MINUTES = 1;
/** Screens at least this wide show the teacher screen and the phones side by side. */
const SIDE_BY_SIDE_WIDTH = 1000;

// ===========================================================================

type DemoParams = { level?: string; week?: string; custom?: string; turns?: string; minutes?: string };

/** A session kept only on this device: never saved, so it never mixes with real ones. */
function demoSession(params: DemoParams): LiveSession {
  const level: Level = LEVELS.includes(params.level as Level) ? (params.level as Level) : DEFAULT_ROUND_SETTINGS.level;
  const week = params.week ? Number(params.week) : null;
  const minutes = Number(params.minutes) || DEMO_ROUND_MINUTES;
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
    categories: sessionFlags({
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
  const theme = useTheme();
  const params = useLocalSearchParams<DemoParams>();
  const { width } = useWindowDimensions();
  const [session, setSession] = useState<LiveSession>(() => demoSession(params));
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [tab, setTab] = useState<string>('teacher');
  const sessionRef = useRef(session);
  sessionRef.current = session;

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
    }),
    [],
  );

  // The pretend students join one after another.
  useEffect(() => {
    const timers = DEMO_NAMES.map((name, i) =>
      setTimeout(() => {
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
      }, (i + 1) * JOIN_EVERY_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Each round, every pretend pair finds each other after a few seconds.
  useEffect(() => {
    if (session.status !== 'playing' || session.stage !== 'changeover') return;
    const round = session.round;
    const timers = groupsForRound(session.roster, round).map((group) =>
      setTimeout(
        () => {
          if (sessionRef.current.round === round) backend.markFound(group[0].id, round);
        },
        FIND_MIN_MS + Math.random() * (FIND_MAX_MS - FIND_MIN_MS),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [session.status, session.stage, session.round, session.roster, backend]);

  const host = (
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
      <LiveStudentScreen session={session} participants={participants} me={me} />
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
        <View style={[styles.banner, { backgroundColor: theme.guessBg }]}>
          <Text style={styles.bannerText}>
            Demo with {DEMO_NAMES.length} pretend students. They join, find each other and tap by themselves; you
            can tap for them too. Nothing is saved.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={[styles.bannerText, styles.end]}>End demo</Text>
          </Pressable>
        </View>

        {sideBySide ? (
          <View style={styles.row}>
            <View style={[styles.hostBox, { borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>TEACHER SCREEN</Text>
              <View style={styles.fill}>{host}</View>
            </View>
            <View style={styles.phones}>
              {DEMO_NAMES.map((name) => (
                <View key={name} style={styles.phoneWrap}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>{name.toUpperCase()}&apos;S PHONE</Text>
                  <View style={[styles.phone, { backgroundColor: theme.background }]}>{phone(name)}</View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              <Chip label="Teacher" selected={tab === 'teacher'} onPress={() => setTab('teacher')} />
              {DEMO_NAMES.map((name) => (
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
    flex: 1,
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
