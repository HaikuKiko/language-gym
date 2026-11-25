import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/supabase';
import { currentTeacher, signInTeacher, teacherCount, type Teacher } from '@/lib/teachers';

/** The signed-in teacher (undefined while checking, null when not a teacher). */
export function useTeacher() {
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const refresh = useCallback(() => {
    currentTeacher()
      .then(setTeacher)
      .catch(() => setTeacher(null));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { teacher, refresh };
}

/** Username and password; calls onSignedIn when they are right. */
export function TeacherSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

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
      <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || !username.trim() || !password} onPress={signIn} />
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
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
          This page is for teachers. Sign in with your teacher username and password.
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
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
});
