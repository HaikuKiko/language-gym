import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CODE_LENGTH, findMyOpenSession, formatCode, joinSession } from '@/lib/live-session';
import { NOT_CONFIGURED_MESSAGE, errorMessage, supabase } from '@/lib/supabase';

/** Start page: students join with a code, teachers host a session. */
export default function HomeRoute() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  // The session code comes from the QR code or link (?code=123456).
  const code = (params.code ?? '').replace(/\D/g, '').slice(0, CODE_LENGTH);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ code: string; asHost: boolean } | null>(null);

  const configured = supabase !== null;

  // Still in a session (after a reload or the back button)? Offer the way back.
  useEffect(() => {
    if (!configured) return;
    findMyOpenSession()
      .then(setOpen)
      .catch(() => setOpen(null));
  }, [configured]);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.background }];

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const session = await joinSession(code, name);
      router.push({ pathname: '/session/[code]', params: { code: session.code } });
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Language Gym</ThemedText>
        <ThemedText themeColor="textSecondary">
          Talk with a new partner every round, with a question to get you started.
        </ThemedText>
      </View>

      {open && (
        <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold">
            {open.asHost ? 'Your session is still running' : "You're still in a session"}
          </ThemedText>
          <Button
            label="Back to my session"
            onPress={() => router.push({ pathname: '/session/[code]', params: { code: open.code } })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Code {open.code}
          </ThemedText>
        </View>
      )}

      {/* Students arrive here from the QR code or link, which brings the session code. */}
      {code.length === CODE_LENGTH && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Join the session</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Session {formatCode(code)}
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Your name"
            autoFocus
            maxLength={40}
            onSubmitEditing={join}
            style={[inputStyle, styles.nameInput]}
          />
          <Button label={busy ? 'Joining…' : 'Join'} disabled={!configured || busy} onPress={join} />
          {error && (
            <ThemedText type="small" themeColor="warning">
              {error}
            </ThemedText>
          )}
        </ThemedView>
      )}

      <View style={styles.section}>
        <ThemedText type="smallBold">Practise on your own</ThemedText>
        <Button
          label="Writing practice"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/write')}
        />
        <Button
          label="IELTS writing"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/ielts')}
        />
        <Button
          label="My account"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/account')}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Teachers</ThemedText>
        <Button
          label="Mark an IELTS essay"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/teacher-ielts')}
        />
        <Button
          label="Teacher account"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/teacher')}
        />
        <Button
          label="Class writing"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/class-sets')}
        />
        <Button
          label="Host a session"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/host')}
        />
        <Button
          label="Use one shared screen instead"
          variant="secondary"
          onPress={() => router.push('/single')}
        />
        {!configured && (
          <ThemedText type="small" themeColor="warning">
            {NOT_CONFIGURED_MESSAGE}
          </ThemedText>
        )}
      </View>
    </Screen>
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
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  nameInput: {
    fontSize: 20,
    minHeight: 56,
  },
});
