import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { createElement } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FooterLinks } from '@/components/footer-links';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { LANDING_VIDEO_URL, PRODUCT_NAME, PRODUCT_SENTENCE } from '@/constants/product';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CODE_LENGTH } from '@/lib/live-session';

const STEPS = [
  ['Start a session', 'in one tap. No account, no app to install.'],
  ['Students scan the QR code', 'on your screen and type their name.'],
  ['Rounds run by themselves:', 'students find their partner, take turns to talk, then move on.'],
] as const;

/**
 * The landing page for teachers (the main address). It shows only the
 * speaking product: no other part of the app is linked from here. The
 * teachers' dashboard is at /dashboard.
 */
export default function LandingRoute() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  // Old links (/?code=123456) go to the join page.
  const code = (params.code ?? '').replace(/\D/g, '').slice(0, CODE_LENGTH);
  if (code.length === CODE_LENGTH) return <Redirect href={{ pathname: '/join/[code]', params: { code } }} />;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          FOR LANGUAGE TEACHERS
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          {PRODUCT_NAME}
        </ThemedText>
        <ThemedText style={styles.sentence}>{PRODUCT_SENTENCE}</ThemedText>
      </View>

      {LANDING_VIDEO_URL ? <Video url={LANDING_VIDEO_URL} /> : null}

      <View style={styles.steps}>
        {STEPS.map(([bold, rest], i) => (
          <View key={bold} style={styles.step}>
            <View style={[styles.number, { backgroundColor: theme.accent }]}>
              <Text style={styles.numberText}>{i + 1}</Text>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={{ fontWeight: 700 }}>{bold}</ThemedText> {rest}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.buttons}>
        <Button
          label="Try it now with your class"
          onPress={() => router.push({ pathname: '/host', params: { mode: 'friending' } })}
        />
        <Button label="Try the demo on your own" variant="secondary" onPress={() => router.push('/demo')} />
      </View>
      <FooterLinks />
    </Screen>
  );
}

/** The landing video: an .mp4 file, or a YouTube/Vimeo embed link (web only). */
function Video({ url }: { url: string }) {
  if (Platform.OS !== 'web') return null;
  const frame = { width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 16, background: '#000' };
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
    ? createElement('video', { src: url, controls: true, playsInline: true, style: frame })
    : createElement('iframe', {
        src: url,
        style: frame,
        allow: 'autoplay; fullscreen; picture-in-picture',
        allowFullScreen: true,
        title: `${PRODUCT_NAME} in 60 seconds`,
      });
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 40,
    lineHeight: 48,
  },
  sentence: {
    fontSize: 20,
    lineHeight: 28,
  },
  steps: {
    gap: Spacing.three,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    color: '#fff',
    fontWeight: 800,
    fontSize: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 25,
  },
  buttons: {
    gap: Spacing.two,
  },
});
