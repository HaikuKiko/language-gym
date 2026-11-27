import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { FooterLinks } from '@/core/ui/footer-links';
import { Screen } from '@/core/ui/screen';
import { ErrorNote } from '@/core/ui/notice';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { PRODUCT_NAME } from '@/constants/product';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { CODE_LENGTH, HostDeviceError, findMyOpenSession, formatCode, joinSession } from '@/core/live/session';
import { NOT_CONFIGURED_MESSAGE, errorMessage, supabase } from '@/core/app/supabase';
import { signOutTeacher } from '@/core/app/teachers';
import { SAVED_NAME_DAYS, hasInitial, savedNamesFor, tidyName } from '@/core/live/saved-names';

/** Wait this long after the last letter typed before looking up saved names. */
const LOOKUP_DELAY_MS = 250;

/**
 * Where the session's QR code leads: the student types their name and joins.
 * Nothing here leads to the teacher page (the main page).
 */
export default function JoinRoute() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code: string }>();
  const code = String(params.code ?? '')
    .replace(/\D/g, '')
    .slice(0, CODE_LENGTH);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** This device is the session's host: 'teacher' when signed in to a teacher account. */
  const [hostDevice, setHostDevice] = useState<'teacher' | 'guest' | null>(null);
  /** Already in this session (after leaving the page or a reload): offer the way back. */
  const [alreadyIn, setAlreadyIn] = useState(false);
  const configured = supabase !== null;
  /** Saved names that start with what is typed. */
  const [matches, setMatches] = useState<string[]>([]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      savedNamesFor(code, name)
        .then((list) => !cancelled && setMatches(list))
        .catch(() => !cancelled && setMatches([]));
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [configured, code, name]);

  useEffect(() => {
    if (!configured) return;
    findMyOpenSession()
      .then((open) => setAlreadyIn(!!open && !open.asHost && open.code === code))
      .catch(() => setAlreadyIn(false));
  }, [configured, code]);

  const goToSession = () => router.replace({ pathname: '/session/[code]', params: { code } });

  async function join(chosen?: string) {
    setBusy(true);
    setError(null);
    setHostDevice(null);
    try {
      await joinSession(code, chosen ?? tidyName(name));
      goToSession();
    } catch (e) {
      if (e instanceof HostDeviceError) {
        const { data } = await supabase!.auth.getSession();
        setHostDevice(data.session?.user.is_anonymous === false ? 'teacher' : 'guest');
      } else {
        setError(errorMessage(e));
      }
    }
    setBusy(false);
  }

  /** A device signed in to the teacher account: sign out, then join as a student. */
  async function joinAsStudent() {
    setBusy(true);
    await signOutTeacher();
    await join();
  }

  // A wrong or cut-off code: type it instead.
  if (code.length !== CODE_LENGTH) return <Redirect href="/join" />;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {PRODUCT_NAME.toUpperCase()}
        </ThemedText>
        <ThemedText type="subtitle">Join the session</ThemedText>
        <ThemedText themeColor="textSecondary">Session {formatCode(code)}</ThemedText>
      </View>

      {alreadyIn && (
        <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold">You&apos;re already in this session</ThemedText>
          <Button label="Back to the session" onPress={goToSession} />
        </View>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name (e.g. Mai T.)"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Your name"
          autoFocus={!alreadyIn}
          maxLength={40}
          onSubmitEditing={() => join()}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        />
        {matches.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => join(m)}
            style={({ pressed }) => [
              styles.match,
              { borderColor: theme.border, backgroundColor: theme.background },
              pressed && { opacity: 0.7 },
            ]}>
            <ThemedText>👤 {m}</ThemedText>
          </Pressable>
        ))}
        {name.trim().length >= 2 && !hasInitial(name) && (
          <ThemedText type="small" themeColor="textSecondary">
            {matches.length > 0 ? 'Is one of these you? Tap it. New here? ' : ''}Add the first letter of your family
            name, e.g. &quot;Mai T.&quot;
          </ThemedText>
        )}
        <Button label={busy ? 'Joining…' : 'Join'} disabled={!configured || busy} onPress={() => join()} />
        <ThemedText type="small" themeColor="textSecondary">
          Your name is saved for your teacher&apos;s classes, so next time you can tap it. Names not used for{' '}
          {SAVED_NAME_DAYS} days are deleted.
        </ThemedText>
        {hostDevice && (
          <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold">This device is the teacher&apos;s</ThemedText>
            <ThemedText type="small">
              {hostDevice === 'teacher'
                ? 'It is signed in to the teacher account that is running this session, so it would show the teacher’s screen. To join as a student, sign out of the teacher account here (only on a phone that is not running the session; signing in again brings the teacher’s screen back).'
                : 'This device is running the session, so it shows the teacher’s screen. Join from another phone.'}
            </ThemedText>
            {hostDevice === 'teacher' && (
              <Button label="Sign out of the teacher account and join" disabled={busy} onPress={joinAsStudent} />
            )}
          </View>
        )}
        <ErrorNote message={error} align="left" />
        {!configured && (
          <ThemedText type="small" themeColor="warning">
            {NOT_CONFIGURED_MESSAGE}
          </ThemedText>
        )}
      </ThemedView>
      <FooterLinks contact={false} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  match: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  input: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    fontSize: 20,
  },
});
