import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { JoinQrCode, getAppAddress, joinUrl } from '@/core/live/join-qr-code';
import { formatCode } from '@/core/live/session';

/** Size of the small QR code for late joiners on a teacher's screen during an activity. */
export const LATE_JOIN_QR_SIZE = 88;

/**
 * "Late? Scan to join": a small QR code for every teacher screen while an
 * activity is running (tap it to make it big). Nothing in a demo.
 */
export function LateJoinQr({ code, demo }: { code: string; demo: boolean }) {
  const address = demo ? null : getAppAddress();
  if (!address) return null;
  return (
    <View style={styles.lateJoin}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Late? Scan to join
      </ThemedText>
      <JoinQrCode url={joinUrl(address, code)} code={formatCode(code)} size={LATE_JOIN_QR_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  lateJoin: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
