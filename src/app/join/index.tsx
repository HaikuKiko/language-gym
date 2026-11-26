import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { FooterLinks } from '@/components/footer-links';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRODUCT_NAME } from '@/constants/product';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CODE_LENGTH, findMyOpenSession, formatCode } from '@/lib/live-session';
import { supabase } from '@/lib/supabase';

/**
 * Join without the QR code: type the code from the teacher's screen. A phone
 * that is already in a session (after a reload or closing the browser) gets a
 * button straight back into it.
 */
export default function JoinWithCodeRoute() {
  const theme = useTheme();
  const [typed, setTyped] = useState('');
  const [mine, setMine] = useState<string | null>(null);
  const code = typed.replace(/\D/g, '').slice(0, CODE_LENGTH);
  const complete = code.length === CODE_LENGTH;

  useEffect(() => {
    if (!supabase) return;
    findMyOpenSession()
      .then((open) => setMine(open && !open.asHost ? open.code : null))
      .catch(() => setMine(null));
  }, []);

  const go = (to: string) => router.push({ pathname: '/join/[code]', params: { code: to } });

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {PRODUCT_NAME.toUpperCase()}
        </ThemedText>
        <ThemedText type="subtitle">Join a session</ThemedText>
        <ThemedText themeColor="textSecondary">
          Type the {CODE_LENGTH}-number code on your teacher&apos;s screen.
        </ThemedText>
      </View>

      {mine && (
        <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold">You&apos;re in session {formatCode(mine)}</ThemedText>
          <Button label="Back to my session" onPress={() => router.replace({ pathname: '/session/[code]', params: { code: mine } })} />
        </View>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder="123 456"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Session code"
          inputMode="numeric"
          keyboardType="number-pad"
          autoComplete="off"
          autoFocus={!mine}
          maxLength={CODE_LENGTH + 2}
          onSubmitEditing={() => complete && go(code)}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        />
        <Button label="Next" disabled={!complete} onPress={() => go(code)} />
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
  input: {
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    fontSize: 32,
    letterSpacing: 6,
    textAlign: 'center',
  },
});
