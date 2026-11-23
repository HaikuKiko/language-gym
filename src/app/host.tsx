import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { RoundSettingsForm } from '@/components/round-settings-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createSession } from '@/lib/live-session';
import { DEFAULT_ROUND_SETTINGS, type RoundSettings } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';

/** The teacher chooses the settings and gets a join code for the class. */
export default function HostRoute() {
  const [settings, setSettings] = useState<RoundSettings>({
    ...DEFAULT_ROUND_SETTINGS,
    // Speed friending starts with every theme: each theme alone has only a few questions.
    mode: 'friending',
    week: null,
  });
  const friending = settings.mode === 'friending';
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
        <ThemedText type="subtitle">Host a session</ThemedText>
        <ThemedText themeColor="textSecondary">
          Choose the settings, then share the join code with your students.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Type of session</ThemedText>
        <View style={styles.chips}>
          <Chip
            label="Speed friending"
            selected={friending}
            onPress={() => setSettings({ ...settings, mode: 'friending', week: null })}
          />
          <Chip
            label="Conversation practice"
            selected={!friending}
            onPress={() => setSettings({ ...settings, mode: 'conversation' })}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {friending
            ? 'Fun questions for getting to know each other, often using their phones (photos, music, maps). No grammar point.'
            : "Discussion questions for the week's theme, with its grammar point on every phone."}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
});
