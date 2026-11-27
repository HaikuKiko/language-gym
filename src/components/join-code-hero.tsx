import { type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { JoinQrCode, getAppAddress, joinUrl } from '@/components/join-qr-code';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCode } from '@/lib/live-session';

/** The big join code and QR code on the teacher's screen before a session starts. */
export function JoinCodeHero({ code, demo = false }: { code: string; demo?: boolean }) {
  const theme = useTheme();
  // The demo has no real join code: pretend students join by themselves.
  const address = demo ? null : getAppAddress();
  const link = address ? joinUrl(address, code) : null;

  return (
    <View style={[styles.hero, { backgroundColor: theme.hero }]}>
      <View style={styles.heroText}>
        <Text style={[styles.heroLabel, { color: theme.onHeroMuted }]}>Join code</Text>
        <Text style={[styles.code, { color: theme.onHero }]} selectable>
          {formatCode(code)}
        </Text>
        {address && link ? (
          <View style={styles.heroLines}>
            <Text style={[styles.heroBody, { color: theme.onHeroMuted }]}>Scan to join, or go to</Text>
            <ExternalLink href={`${address}/join` as Href & string}>
              <Text style={[styles.heroLink, { color: theme.onHero }]}>
                {address.replace(/^https?:\/\//, '')}/join
              </Text>
            </ExternalLink>
            <Text style={[styles.heroBody, { color: theme.onHeroMuted }]}>and type the code</Text>
          </View>
        ) : (
          <Text style={[styles.heroBody, { color: theme.onHeroMuted }]}>
            {demo
              ? 'In the demo, pretend students join by themselves. Press "Start session" when you are ready.'
              : 'Students open the app and enter this code.'}
          </Text>
        )}
      </View>
      {link && <JoinQrCode url={link} code={formatCode(code)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // The code sits beside the QR code on wide screens and above it on phones.
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
    borderRadius: 28,
  },
  heroText: {
    flexGrow: 1,
    flexBasis: 260,
    gap: Spacing.one,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 60,
    lineHeight: 72,
    fontWeight: 800,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  heroLines: {
    alignItems: 'flex-start',
    gap: Spacing.half,
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  heroLink: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 700,
    textDecorationLine: 'underline',
  },
});
