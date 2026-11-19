import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { emailLink, shareReport } from '@/lib/share-report';

/**
 * Shares the whole report through the phone's share menu (Teams, Outlook,
 * WhatsApp, Mail …). On a computer without one, the report is copied and can
 * be pasted, or opened in an email.
 */
export function ShareReportButton({ title, report }: { title: string; report: () => string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function share() {
    const text = report();
    const outcome = await shareReport(title, text);
    setStatus(outcome === 'copied' ? 'copied' : outcome === 'failed' ? 'failed' : 'idle');
  }

  return (
    <View style={styles.box}>
      <Button label="Share report" variant="secondary" onPress={share} />
      {status === 'copied' && (
        <View style={styles.box}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Report copied. Paste it into Teams, Outlook or anywhere else.
          </ThemedText>
          <Button
            label="Open it in an email"
            variant="secondary"
            onPress={() => Linking.openURL(emailLink(title, report()))}
          />
        </View>
      )}
      {status === 'failed' && (
        <ThemedText type="small" themeColor="warning" style={styles.centered}>
          Sharing isn&apos;t available here. Try again on a phone.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
});
