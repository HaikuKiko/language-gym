import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { getAppAddress } from '@/core/live/join-qr-code';
import { Screen } from '@/core/ui/screen';
import { TeacherOnly } from '@/core/app/teacher-only';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { loadContactMessages, type ContactMessage } from '@/core/app/contact';
import { findMyOpenSession } from '@/core/live/session';
import { WORD_GAMES, fetchMyPastGames, type PastGame } from '@/lib/word-game';
import { NOT_CONFIGURED_MESSAGE, supabase } from '@/core/app/supabase';

/** The pages teachers send to students as links (students never see this page). */
const STUDENT_LINKS = [
  { label: 'Writing practice', path: '/write' },
  { label: 'IELTS writing', path: '/ielts' },
  { label: 'Student account', path: '/account' },
] as const;

/** The teacher dashboard, for signed-in teachers only (visitors start at the landing page). */
export default function DashboardRoute() {
  return (
    <TeacherOnly>
      <Dashboard />
    </TeacherOnly>
  );
}

/**
 * The teacher dashboard: sessions, class writing, marking, and the links to
 * send students. Nothing public links here: visitors see the landing page (/),
 * and students join sessions from the QR code's own page (/join/…).
 */
function Dashboard() {
  const theme = useTheme();
  const [hosting, setHosting] = useState<string | null>(null);
  const configured = supabase !== null;

  // A session this device is running (after a reload or the back button).
  useEffect(() => {
    if (!configured) return;
    findMyOpenSession()
      .then((open) => setHosting(open?.asHost ? open.code : null))
      .catch(() => setHosting(null));
  }, [configured]);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">Language Gym</ThemedText>
        <ThemedText themeColor="textSecondary">For teachers: run sessions and mark writing.</ThemedText>
      </View>

      {hosting && (
        <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold">Your session is still running</ThemedText>
          <Button
            label="Back to my session"
            onPress={() => router.push({ pathname: '/session/[code]', params: { code: hosting } })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Code {hosting}
          </ThemedText>
        </View>
      )}

      <View style={styles.section}>
        <ThemedText type="smallBold">Speaking</ThemedText>
        <Button
          label="🎉 Speed friending"
          disabled={!configured}
          onPress={() => router.push({ pathname: '/host', params: { mode: 'friending' } })}
        />
        <Button
          label="🔥 Word games (Hot Seat, Explain It)"
          disabled={!configured}
          onPress={() => router.push('/word-game')}
        />
        <Button label="❓ Grammar quizzes" disabled={!configured} onPress={() => router.push('/quiz')} />
        <Button label="🏆 Leaderboards" disabled={!configured} onPress={() => router.push('/leaderboards')} />
        <Button label="🗺️ GPS tours" disabled={!configured} onPress={() => router.push('/tour')} />
        <Button label="Host a session" variant="secondary" disabled={!configured} onPress={() => router.push('/host')} />
        <Button label="Use one shared screen instead" variant="secondary" onPress={() => router.push('/single')} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Writing</ThemedText>
        <Button label="Class writing" variant="secondary" disabled={!configured} onPress={() => router.push('/class-sets')} />
        <Button
          label="Mark an IELTS essay"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/teacher-ielts')}
        />
        <Button label="Teacher account" variant="secondary" disabled={!configured} onPress={() => router.push('/teacher')} />
        {!configured && (
          <ThemedText type="small" themeColor="warning">
            {NOT_CONFIGURED_MESSAGE}
          </ThemedText>
        )}
      </View>

      <PastWordGames />
      <StudentLinks />
      <Messages />
    </Screen>
  );
}

/** Word games played in the last 30 days: tap one to see its awards again. */
function PastWordGames() {
  const [games, setGames] = useState<PastGame[] | null>(null);
  useEffect(() => {
    fetchMyPastGames()
      .then(setGames)
      .catch(() => setGames([]));
  }, []);
  if (!games || games.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Word game results</ThemedText>
      {games.map((g) => (
        <Button
          key={g.code}
          variant="secondary"
          label={`${WORD_GAMES[g.kind].emoji} ${WORD_GAMES[g.kind].name} · ${g.level} · ${new Date(g.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${g.students} students`}
          onPress={() => router.push({ pathname: '/session/[code]', params: { code: g.code } })}
        />
      ))}
    </View>
  );
}

/** Messages left on the contact page ("Keep me posted"), newest first. */
function Messages() {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  useEffect(() => {
    loadContactMessages()
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);
  if (!messages) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Messages from the contact page</ThemedText>
      {messages.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No messages yet.
        </ThemedText>
      ) : (
        messages.map((m) => (
          <ThemedView key={m.id} type="backgroundElement" style={styles.link}>
            <ThemedText type="smallBold" selectable>
              {m.email}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {new Date(m.created_at).toLocaleString()}
            </ThemedText>
            {m.message ? <ThemedText selectable>{m.message}</ThemedText> : null}
          </ThemedView>
        ))
      )}
    </View>
  );
}

/** The links to send students, each with "Copy" (and "Open" to try it). */
function StudentLinks() {
  const address = getAppAddress() ?? '';
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      setCopied(null);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Links to send students</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Students use these on their own (they don&apos;t see this page). For speed friending they scan the QR code.
      </ThemedText>
      {STUDENT_LINKS.map(({ label, path }) => {
        const url = `${address}${path}`;
        return (
          <ThemedView key={path} type="backgroundElement" style={styles.link}>
            <ThemedText type="smallBold">{label}</ThemedText>
            <ThemedText type="small" selectable themeColor="textSecondary">
              {url}
            </ThemedText>
            <View style={styles.linkButtons}>
              {canCopy && (
                <Button label={copied === url ? 'Copied ✓' : 'Copy link'} onPress={() => copy(url)} style={styles.linkButton} />
              )}
              <Button label="Open" variant="secondary" onPress={() => router.push(path)} style={styles.linkButton} />
            </View>
          </ThemedView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  link: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  linkButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  linkButton: {
    flex: 1,
  },
});
