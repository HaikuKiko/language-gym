import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AiMarking } from '@/lib/calibration';
import type { PreparedPhoto } from '@/lib/photo';
import { shareReport } from '@/lib/share-report';
import { calibrateUrl, shareEssay } from '@/lib/shared-essay';
import { errorMessage } from '@/lib/supabase';

/**
 * "Ask another teacher": under a teacher's marking, makes a link to the
 * essay (with the photos of the pages) so other teachers can give their own
 * bands without seeing the AI's first. One link can go to several teachers.
 */
export function ShareCalibrationCard({
  marking,
  question,
  essay,
  photos,
}: {
  marking: AiMarking;
  question: string;
  essay: string;
  /** Photos of the pages; empty if the essay was typed or the page was refreshed. */
  photos: PreparedPhoto[];
}) {
  const theme = useTheme();
  const [sharing, setSharing] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const url = code ? calibrateUrl(code) : null;
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

  async function share() {
    setSharing(true);
    setError(null);
    try {
      setCode(await shareEssay({ question, essay, marking, photos }));
    } catch (e) {
      setError(errorMessage(e));
    }
    setSharing(false);
  }

  async function sendLink() {
    if (!url) return;
    const outcome = await shareReport(
      'IELTS essay to mark',
      `Could you mark this IELTS Writing Task 2 essay? You'll see the AI's bands after you give yours.\n${url}`,
    );
    setStatus(outcome === 'copied' ? 'Link copied.' : outcome === 'failed' ? 'Could not share. Copy the link instead.' : null);
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      setStatus('Could not copy. Press and hold the link to copy it.');
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold" style={styles.title}>
        Ask another teacher
      </ThemedText>
      {!code ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Send a link. They see the question, {photos.length > 0 ? 'the photos ' : ''}and the essay, give their own
            bands, and only then see the AI&apos;s.
            {photos.length === 0 ? ' (No photos: the essay was typed, or the page was refreshed.)' : ''}
          </ThemedText>
          <Button label={sharing ? 'Making the link…' : 'Share for calibration'} disabled={sharing} onPress={share} />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Link ready. You can send it to several teachers; each marks it once.
          </ThemedText>
          <View style={[styles.link, { borderColor: theme.accent, backgroundColor: theme.background }]}>
            <ThemedText type="small" selectable>
              {url ?? `Code: ${code}`}
            </ThemedText>
          </View>
          {url && <Button label="Share link…" onPress={sendLink} />}
          {url && canCopy && <Button label="Copy link" variant="secondary" onPress={copyLink} />}
          {status && (
            <ThemedText type="small" themeColor="textSecondary">
              {status}
            </ThemedText>
          )}
        </>
      )}
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  link: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
});
