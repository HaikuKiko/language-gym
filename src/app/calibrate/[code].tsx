import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CalibrationCard } from '@/components/calibration-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { findMySharedMarks, type Bands } from '@/lib/calibration';
import { loadSharedEssay, type SharedEssay } from '@/lib/shared-essay';
import { errorMessage } from '@/lib/supabase';

/**
 * A colleague's link (/calibrate/<code>): mark a shared IELTS essay without
 * seeing the AI's bands, then compare. The marks join the calibration.
 */
export default function CalibrateRoute() {
  const theme = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [shared, setShared] = useState<SharedEssay | null | undefined>(undefined);
  const [earlier, setEarlier] = useState<{ id: number; teacher: Bands } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const essay = await loadSharedEssay(String(code ?? ''));
      setEarlier(essay ? await findMySharedMarks(essay.code) : null);
      setShared(essay);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  const home = <Button label="Home" variant="secondary" onPress={() => router.replace('/')} />;

  if (error || shared === undefined) {
    return (
      <Screen>
        <ThemedText type="subtitle">Mark this essay</ThemedText>
        {error ? (
          <>
            <ThemedText themeColor="warning">{error}</ThemedText>
            <Button label="Try again" onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
        {home}
      </Screen>
    );
  }

  if (shared === null) {
    return (
      <Screen>
        <ThemedText type="subtitle">Mark this essay</ThemedText>
        <ThemedText themeColor="textSecondary">
          There is no essay with the code {String(code ?? '').toUpperCase()}. Check the link you were sent.
        </ThemedText>
        {home}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          CALIBRATION
        </ThemedText>
        <ThemedText type="subtitle">Mark this essay</ThemedText>
        <ThemedText themeColor="textSecondary">
          A colleague asked you to mark this IELTS Writing Task 2 essay. The AI&apos;s bands stay hidden until you save
          yours.
        </ThemedText>
      </View>

      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">The question</ThemedText>
        <ThemedText>{shared.question || '(Not given: the AI worked it out from the essay.)'}</ThemedText>
      </View>

      {shared.photoUrls.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">The pages (tap to enlarge)</ThemedText>
          <View style={styles.pages}>
            {shared.photoUrls.map((url, i) => (
              <Pressable
                key={url}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Page ${i + 1}, tap to enlarge`}
                onPress={() => setBigPhoto(url)}
                style={[styles.page, { borderColor: theme.border }]}>
                <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">
          The essay{shared.photoUrls.length > 0 ? ' (typed from the photos)' : ''} · {shared.marking.wordCount} words
        </ThemedText>
        <ThemedText selectable>{shared.essay}</ThemedText>
      </View>

      <CalibrationCard
        marking={shared.marking}
        question={shared.question}
        essay={shared.essay}
        blind
        sharedCode={shared.code}
        earlier={earlier}
      />

      {home}

      <Modal visible={bigPhoto !== null} transparent animationType="fade" onRequestClose={() => setBigPhoto(null)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the photo"
          onPress={() => setBigPhoto(null)}
          style={styles.overlay}>
          {bigPhoto && <Image source={{ uri: bigPhoto }} style={styles.big} contentFit="contain" />}
          <ThemedText style={styles.closeHint}>Tap to close</ThemedText>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  box: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  pages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  page: {
    width: 88,
    height: 118,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  big: {
    width: '100%',
    height: '90%',
  },
  closeHint: {
    color: '#ffffff',
    marginTop: Spacing.two,
  },
});
