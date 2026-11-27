import { type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';

/** After an update to the site, a page left open may ask for old files: reload once, at most this often. */
const AUTO_RELOAD_GAP_MS = 30_000;

/** Reloads the page (web), which also picks up the newest version of the site. */
function reloadPage(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  window.location.reload();
  return true;
}

/** A newer version of the site was published while this page was open. */
function isOldVersionError(error: Error): boolean {
  return /loading (css )?chunk|failed to fetch dynamically imported|importing a module script failed|unexpected token '<'|load async|requiring unknown module/i.test(
    `${error.name} ${error.message}`,
  );
}

/**
 * Anything that goes wrong while showing a page lands here instead of a blank
 * white screen: the student can try again (a session picks up where it was).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !isOldVersionError(error)) return;
    try {
      const last = Number(window.sessionStorage.getItem('auto-reload-at') ?? 0);
      if (Date.now() - last < AUTO_RELOAD_GAP_MS) return;
      window.sessionStorage.setItem('auto-reload-at', String(Date.now()));
    } catch {
      // No storage (private mode): still reload once.
    }
    reloadPage();
  }, [error]);

  return (
    <ThemedView style={styles.fill}>
      <View style={styles.center}>
        <ThemedText type="subtitle" style={styles.text}>
          Something went wrong
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          Tap the button to try again. If you were in a session, you go straight back in.
        </ThemedText>
        <Button
          label="Try again"
          onPress={() => {
            if (!reloadPage()) retry();
          }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  text: { textAlign: 'center' },
});
