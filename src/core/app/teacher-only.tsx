import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Screen } from '@/core/ui/screen';
import { ErrorNote } from '@/core/ui/notice';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { errorMessage, takeProviderSignInError } from '@/core/app/supabase';
import {
  currentTeacher,
  signedInEmail,
  signInTeacher,
  signInTeacherWithGoogle,
  signOutTeacher,
  teacherCount,
  type Teacher,
} from '@/core/app/teachers';

/** Google sign-in needs the browser (it is set up for the website). */
const GOOGLE_SIGN_IN = Platform.OS === 'web';

/** The signed-in teacher (undefined while checking, null when not a teacher). */
export function useTeacher() {
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const hash = useLocalSearchParams<{ '#'?: string }>()['#'];
  const refresh = useCallback(() => {
    currentTeacher()
      .then(setTeacher)
      .catch(() => setTeacher(null));
  }, []);
  useEffect(() => {
    // Back from Google: the router keeps the address's #access_token=… as a
    // param; once the session is saved (by currentTeacher), take it out.
    if (teacher !== undefined && hash && /access_token=|error=/.test(hash)) {
      router.setParams({ '#': undefined } as never);
    }
  }, [teacher, hash]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { teacher, refresh };
}

/**
 * "Sign in with Google", or username and password; calls onSignedIn when they
 * are right. Also says so when this device is signed in with a Google account
 * that is not a teacher.
 */
export function TeacherSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notTeacherEmail, setNotTeacherEmail] = useState<string | null>(null);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  useEffect(() => {
    // Back from Google: any problem, or a Google account that is not a teacher here.
    setError(takeProviderSignInError());
    signedInEmail()
      .then((email) => setNotTeacherEmail(email && !email.endsWith('.invalid') ? email : null))
      .catch(() => {});
  }, []);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await signInTeacherWithGoogle(); // leaves the page
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function useAnotherAccount() {
    await signOutTeacher();
    setNotTeacherEmail(null);
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await signInTeacher(username, password);
      onSignedIn();
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <View style={styles.form}>
      {notTeacherEmail && (
        <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">
            You are signed in as {notTeacherEmail}, but that is not a teacher account here. Ask a teacher to add
            this Gmail address on the Teachers page, or sign in another way.
          </ThemedText>
          <Button label="Use another account" variant="secondary" onPress={useAnotherAccount} />
        </View>
      )}
      {GOOGLE_SIGN_IN && (
        <>
          <Button label={busy ? 'Opening Google…' : 'Sign in with Google'} disabled={busy} onPress={google} />
          <ThemedText type="small" themeColor="textSecondary">
            Or use your username and password:
          </ThemedText>
        </>
      )}
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Teacher username"
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Teacher password"
        secureTextEntry
        onSubmitEditing={signIn}
        style={inputStyle}
      />
      <Button
        label={busy ? 'Signing in…' : 'Sign in'}
        variant={GOOGLE_SIGN_IN ? 'secondary' : 'primary'}
        disabled={busy || !username.trim() || !password}
        onPress={signIn}
      />
      <ErrorNote message={error} align="left" />
    </View>
  );
}

/**
 * Shows the children only to a signed-in teacher; anyone else gets the
 * teacher sign-in (the database refuses class writing to non-teachers too).
 */
export function TeacherOnly({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { teacher, refresh } = useTeacher();
  const [noTeachers, setNoTeachers] = useState(false);

  useEffect(() => {
    if (teacher === null) teacherCount().then((n) => setNoTeachers(n === 0));
  }, [teacher]);

  if (teacher === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={theme.accent} />
      </Screen>
    );
  }
  if (teacher) return <>{children}</>;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">Teacher sign in</ThemedText>
        <ThemedText themeColor="textSecondary">
          This page is for teachers. Sign in with Google, or with your teacher username and password.
        </ThemedText>
      </View>
      <TeacherSignIn onSignedIn={refresh} />
      {noTeachers && (
        <Button
          label="Create the first teacher account"
          variant="secondary"
          onPress={() => router.push('/teacher')}
        />
      )}
      <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.two,
  },
  note: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
});
