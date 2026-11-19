import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { joinCourse } from '@/lib/account';
import { errorMessage } from '@/lib/supabase';

const IELTS_TARGETS = ['5.5', '6.0', '6.5', '7.0', '7.5'];

/**
 * Lets a saved student join a course themselves (prototype: no teacher
 * needed). For IELTS they also choose a target band, or "Not sure yet".
 */
export function JoinCourse({
  trackId,
  trackName,
  onJoined,
}: {
  trackId: string;
  trackName: string;
  onJoined: () => void;
}) {
  const isIelts = trackId === 'ielts';
  const [target, setTarget] = useState<string | null>(isIelts ? '6.5' : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await joinCourse(trackId, target);
      onJoined();
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <View style={styles.box}>
      {isIelts && (
        <>
          <ThemedText type="smallBold">Your target band</ThemedText>
          <View style={styles.chips}>
            {IELTS_TARGETS.map((t) => (
              <Chip key={t} label={t} selected={target === t} onPress={() => setTarget(t)} />
            ))}
            <Chip label="Not sure yet" selected={target === null} onPress={() => setTarget(null)} />
          </View>
        </>
      )}
      <Button label={busy ? 'Joining…' : `Join ${trackName}`} disabled={busy} onPress={join} />
      {error && (
        <ThemedText type="small" themeColor="warning">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
