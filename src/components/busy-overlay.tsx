import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A screen-covering "working on it" card while a photo is read or writing is
 * marked, so nobody wonders whether anything is happening. Shows what is
 * happening, a spinner, a moving bar and the seconds so far.
 */
export function BusyOverlay({
  visible,
  title,
  detail,
}: {
  visible: boolean;
  /** e.g. "Reading the handwriting…" */
  title: string;
  /** e.g. "This usually takes 10 to 20 seconds." */
  detail?: string;
}) {
  const theme = useTheme();
  const [seconds, setSeconds] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setSeconds(0);
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    );
    slide.setValue(0);
    loop.start();
    return () => {
      clearInterval(timer);
      loop.stop();
    };
  }, [visible, slide]);

  const left = slide.interpolate({ inputRange: [0, 1], outputRange: ['-40%', '100%'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View
          style={[styles.card, { backgroundColor: theme.background }]}
          accessibilityRole="progressbar"
          accessibilityLabel={`${title} ${seconds} seconds`}
          accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <Animated.View style={[styles.bar, { backgroundColor: theme.accent, left }]} />
          </View>
          <Text style={[styles.seconds, { color: theme.text }]}>{seconds} s</Text>
          {detail ? <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Please keep this page open.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(5, 12, 24, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 800,
    textAlign: 'center',
  },
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    borderRadius: 4,
  },
  seconds: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
