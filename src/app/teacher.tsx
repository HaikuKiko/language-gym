import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Screen } from '@/core/ui/screen';
import { TeacherSignIn, useTeacher } from '@/core/app/teacher-only';
import { ErrorNote } from '@/core/ui/notice';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { errorMessage } from '@/core/app/supabase';
import {
  MIN_PASSWORD_LENGTH,
  addTeacher,
  createFirstTeacher,
  listTeachers,
  setMyGmail,
  signOutTeacher,
  teacherCount,
  type Teacher,
} from '@/core/app/teachers';

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
            ? `Signed in as ${teacher.username}. Sign in the same way (Google, or username and password) on your other devices to see the same classes.`
            : 'Sign in with Google, or with your teacher username and password.'}
        </ThemedText>
      </View>

      {teacher ? (
        <>
          <Button label="Class writing" onPress={() => router.push('/class-sets')} />
          <GmailForm
            gmail={teacher.gmail}
            onSaved={async () => {
              refresh();
              setTeachers(await listTeachers());
            }}
          />
          <View style={styles.section}>
            <ThemedText type="smallBold">Teachers</ThemedText>
            {teachers.map((t) => (
              <ThemedText key={t.userId}>
                {t.displayName}{' '}
                <ThemedText themeColor="textSecondary">
                  ({t.username}
                  {t.gmail ? ` · Google: ${t.gmail}` : ''})
                </ThemedText>
              </ThemedText>
            ))}
          </View>
          <AccountForm
            title="Add a teacher"
            note="Type their Gmail address so they can use “Sign in with Google”, and/or give them a password to use with the username. Each teacher sees only their own classes."
            buttonLabel="Add the teacher"
            withGmail
            onSave={async (username, name, password, gmail) => {
              await addTeacher(username, name, password, gmail);
              setTeachers(await listTeachers());
              const ways = [
                gmail.trim() ? `with Google (${gmail.trim().toLowerCase()})` : '',
                password ? `as ${username.trim().toLowerCase()} with the password` : '',
              ].filter(Boolean);
              return `${name} can now sign in ${ways.join(' or ')}.`;
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

/** The Gmail address this teacher uses for "Sign in with Google". */
function GmailForm({ gmail, onSaved }: { gmail: string | null; onSaved: () => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(gmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setMyGmail(value);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <View style={[styles.box, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold">Sign in with Google</ThemedText>
      {!editing ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {gmail
              ? `You can sign in with Google as ${gmail}.`
              : 'Add your Gmail address to sign in with Google instead of a password.'}
          </ThemedText>
          <Button
            label={gmail ? 'Change Gmail address' : 'Add my Gmail address'}
            variant="secondary"
            onPress={() => setEditing(true)}
          />
        </>
      ) : (
        <>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="name@gmail.com"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Your Gmail address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
          />
          <Button label={busy ? 'Saving…' : 'Save'} disabled={busy || !value.includes('@')} onPress={save} />
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          <ErrorNote message={error} align="left" />
        </>
      )}
    </View>
  );
}

/** Username, name and password (twice), and maybe a Gmail address, for a new teacher account. */
function AccountForm({
  title,
  note,
  buttonLabel,
  withGmail = false,
  onSave,
}: {
  title: string;
  note: string;
  buttonLabel: string;
  /** Ask for a Gmail address too; then the password may be left empty. */
  withGmail?: boolean;
  /** Returns a message to show after saving, or null. */
  onSave: (username: string, name: string, password: string, gmail: string) => Promise<string | null>;
}) {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [gmail, setGmail] = useState('');
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
      setMessage(await onSave(username, name, password, gmail));
      setUsername('');
      setName('');
      setGmail('');
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
      {withGmail && (
        <TextInput
          value={gmail}
          onChangeText={setGmail}
          placeholder="Gmail address (for Sign in with Google)"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Their Gmail address"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={inputStyle}
        />
      )}
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={
          withGmail
            ? `Password (${MIN_PASSWORD_LENGTH}+ letters, or none)`
            : `Password (at least ${MIN_PASSWORD_LENGTH} characters)`
        }
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
      <ErrorNote message={problem} align="left" />
      <Button
        label={busy ? 'Saving…' : buttonLabel}
        disabled={
          busy ||
          !name.trim() ||
          !username.trim() ||
          (!password && !(withGmail && gmail.includes('@'))) ||
          password !== again ||
          !!problem
        }
        onPress={save}
      />
      {message && <ThemedText type="small">{message}</ThemedText>}
      <ErrorNote message={error} align="left" />
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
