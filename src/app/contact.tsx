import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { FooterLinks } from '@/components/footer-links';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { PRODUCT_NAME } from '@/constants/product';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendContactMessage } from '@/lib/contact';
import { errorMessage } from '@/lib/supabase';

/** "Keep me posted": a teacher leaves their email and, if they like, a message. */
export default function ContactRoute() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await sendContactMessage(email, message);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  const back = (
    <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
  );

  if (sent) {
    return (
      <Screen>
        <ThemedText type="subtitle">Thank you!</ThemedText>
        <ThemedText>We&apos;ll be in touch.</ThemedText>
        {back}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Keep me posted</ThemedText>
        <ThemedText themeColor="textSecondary">
          Leave your email to hear about new features in {PRODUCT_NAME}. You can also ask a question, tell us what you
          think, or ask us to delete data.
        </ThemedText>
      </View>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Your email"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Your email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={200}
        style={inputStyle}
      />
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Your message (optional)"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Your message"
        multiline
        maxLength={2000}
        style={[inputStyle, styles.message]}
      />
      <Button label={busy ? 'Sending…' : 'Send'} disabled={busy || !emailOk} onPress={send} />
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        We only use your email to reply and to keep you posted. Ask us any time and we&apos;ll delete it.
      </ThemedText>
      {back}
      <FooterLinks contact={false} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  message: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
