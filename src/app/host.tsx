import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { RoundSettingsForm } from '@/components/round-settings-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createSession } from '@/lib/live-session';
import { DEFAULT_ROUND_SETTINGS, type RoundSettings } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';

/**
 * The teacher chooses the settings and gets a join code for the class.
 * /host is conversation practice; /host?mode=friending is speed friending.
 */
export default function HostRoute() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const friending = params.mode === 'friending';
  const [settings, setSettings] = useState<RoundSettings>({
    ...DEFAULT_ROUND_SETTINGS,
    ...(friending ? { mode: 'friending', week: null, takeTurns: true } : { mode: 'conversation' }),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const session = await createSession(settings);
      router.replace({ pathname: '/session/[code]', params: { code: session.code } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{friending ? 'Speed friending' : 'Host a session'}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {friending
            ? 'Students meet a new partner each round and ask each other fun questions. Everyone has their own question, and there is no grammar point.'
            : "Discussion questions for the week's theme, with its grammar point on every phone. Choose the settings, then share the join code with your students."}
        </ThemedText>
      </View>

      <RoundSettingsForm
        phones
        settings={settings}
        onChange={(changes) => setSettings({ ...settings, ...changes })}
      />

      <View style={styles.section}>
        <Button
          label={busy ? 'Creating…' : 'Create session'}
          disabled={busy}
          onPress={create}
        />
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
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
  centered: {
    textAlign: 'center',
  },
});
