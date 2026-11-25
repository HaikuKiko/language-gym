import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TeacherSignIn, useTeacher } from '@/components/teacher-only';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/supabase';
import {
  MIN_PASSWORD_LENGTH,
  addTeacher,
  createFirstTeacher,
  listTeachers,
  signOutTeacher,
  teacherCount,
  type Teacher,
} from '@/lib/teachers';

/** Teacher accounts: sign in, the first teacher account, adding teachers, signing out. */
export default function TeacherRoute() {
  const theme = useTheme();
  const { teacher, refresh } = useTeacher();
  const [noTeachers, setNoTeachers] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    if (teacher === null) teacherCount().then((n) => setNoTeachers(n === 0));
    if (teacher) listTeachers().then(setTeachers);
  }, [teacher]);

  async function signOut() {
    await signOutTeacher();
    router.replace('/');
  }

  if (teacher === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={theme.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          TEACHERS
        </ThemedText>
        <ThemedText type="subtitle">{teacher ? `Hello, ${teacher.displayName}` : 'Teacher sign in'}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {teacher
            ? `Signed in as ${teacher.username}. Sign in with the same username and password on your other devices to see the same classes.`
            : 'Sign in with your teacher username and password.'}
        </ThemedText>
      </View>

      {teacher ? (
        <>
          <Button label="Class writing" onPress={() => router.push('/class-sets')} />
          <View style={styles.section}>
            <ThemedText type="smallBold">Teachers</ThemedText>
            {teachers.map((t) => (
              <ThemedText key={t.userId}>
                {t.displayName} <ThemedText themeColor="textSecondary">({t.username})</ThemedText>
              </ThemedText>
            ))}
          </View>
          <AccountForm
            title="Add a teacher"
            note="Give them the username and password; they can sign in straight away. Each teacher sees only their own classes."
            buttonLabel="Add the teacher"
            onSave={async (username, name, password) => {
              await addTeacher(username, name, password);
              setTeachers(await listTeachers());
              return `${name} can now sign in as ${username.trim().toLowerCase()}.`;
            }}
          />
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </>
      ) : (
        <>
          <TeacherSignIn onSignedIn={refresh} />
          {noTeachers && (
            <AccountForm
              title="Create the first teacher account"
              note="Do this on the device you have used for class writing so far: everything made on it is kept. After this, teachers add other teachers."
              buttonLabel="Create my teacher account"
              onSave={async (username, name, password) => {
                await createFirstTeacher(username, name, password);
                refresh();
                return null;
              }}
            />
          )}
        </>
      )}
      <Button label="Back" variant="secondary" onPress={() => router.replace('/dashboard')} />
    </Screen>
  );
}

/** Username, name and password (twice), for a new teacher account. */
function AccountForm({
  title,
  note,
  buttonLabel,
  onSave,
}: {
  title: string;
  note: string;
  buttonLabel: string;
  /** Returns a message to show after saving, or null. */
  onSave: (username: string, name: string, password: string) => Promise<string | null>;
}) {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.background }];
  const problem =
    password && password.length < MIN_PASSWORD_LENGTH
      ? `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      : again && again !== password
        ? 'The two passwords are not the same.'
        : null;

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await onSave(username, name, password));
      setUsername('');
      setName('');
      setPassword('');
      setAgain('');
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <View style={[styles.box, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {note}
      </ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name, e.g. Graham"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Teacher's name"
        style={inputStyle}
      />
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username, e.g. graham"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="New username"
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="New password"
        secureTextEntry
        style={inputStyle}
      />
      <TextInput
        value={again}
        onChangeText={setAgain}
        placeholder="The password again"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="New password again"
        secureTextEntry
        style={inputStyle}
      />
      {problem && (
        <ThemedText type="small" themeColor="warning">
          {problem}
        </ThemedText>
      )}
      <Button
        label={busy ? 'Saving…' : buttonLabel}
        disabled={busy || !name.trim() || !username.trim() || !password || password !== again || !!problem}
        onPress={save}
      />
      {message && <ThemedText type="small">{message}</ThemedText>}
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.one,
  },
  box: {
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
