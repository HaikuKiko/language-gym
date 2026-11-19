import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Spacing } from '@/constants/theme';

/**
 * The web address students should open. A configured public address
 * (EXPO_PUBLIC_APP_URL) wins, so the QR code always points at the public site
 * even when the teacher is viewing a private preview copy of it. Otherwise,
 * in a browser, it is wherever the app is being served from.
 */
export function getAppAddress(): string | null {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured && /^https?:\/\/[^/]+$/.test(configured)) return configured;

  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return null;
}

/** The link that opens the app with the join code already filled in. */
export function joinUrl(address: string, code: string): string {
  return `${address}/?code=${code}`;
}

/**
 * A QR code on a white tile, so it scans in dark mode too. Tapping it shows
 * it nearly full screen (like Kahoot), so students at the back can scan it;
 * tapping again closes it.
 */
export function JoinQrCode({ url, code, size = 176 }: { url: string; code?: string; size?: number }) {
  const [big, setBig] = useState(false);
  const { width, height } = useWindowDimensions();
  // Leave room for the code and the hint under the QR code.
  const bigSize = Math.max(200, Math.min(width - 64, height - 200));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show the QR code full screen"
        onPress={() => setBig(true)}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
        <QRCode value={url} size={size} />
        <Text style={styles.hint}>Tap to enlarge</Text>
      </Pressable>

      <Modal visible={big} transparent animationType="fade" onRequestClose={() => setBig(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the big QR code"
          onPress={() => setBig(false)}
          style={styles.backdrop}>
          <View style={styles.bigTile}>
            <QRCode value={url} size={bigSize} />
            {code ? <Text style={styles.bigCode}>{code}</Text> : null}
          </View>
          <Text style={styles.closeHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  hint: {
    fontSize: 13,
    fontWeight: 600,
    color: '#3D4148',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    backgroundColor: 'rgba(5, 12, 24, 0.88)',
  },
  bigTile: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bigCode: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: 800,
    letterSpacing: 6,
    color: '#111316',
  },
  closeHint: {
    fontSize: 16,
    fontWeight: 600,
    color: '#FFFFFF',
  },
});
