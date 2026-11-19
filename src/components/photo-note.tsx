import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PhotoReading } from '@/lib/writing';

/**
 * Shown after reading a photo of handwriting: check the text, and which hard
 * to read words were guessed, so they can be compared with the paper.
 */
export function PhotoNote({ photo }: { photo: PhotoReading }) {
  const theme = useTheme();
  const guessed = photo.guessedWords;
  const clear = photo.legibility === 'good' && guessed.length === 0;

  return (
    <View style={[styles.note, { backgroundColor: clear ? theme.accentSoft : theme.markABg }]}>
      <ThemedText type="smallBold">Check the text before you get feedback</ThemedText>
      <ThemedText type="small">
        This is what we read in the photo. Fix anything that is different from the paper, but
        don&apos;t correct the writer&apos;s own mistakes: the feedback is about them.
      </ThemedText>
      {guessed.length > 0 ? (
        <ThemedText type="small">
          <ThemedText type="smallBold">
            {guessed.length === 1 ? 'We guessed this word: ' : `We guessed these ${guessed.length} words: `}
          </ThemedText>
          {guessed.map((w) => `“${w}”`).join(', ')}
        </ThemedText>
      ) : null}
      {photo.note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {photo.note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
