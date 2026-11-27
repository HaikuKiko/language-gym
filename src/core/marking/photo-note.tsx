import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { GuessedWordsList } from '@/core/marking/guessed';
import type { PhotoReading } from '@/core/marking/photo-reading';

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
        {photo.pages > 1 ? `This is what we read in the ${photo.pages} pages.` : 'This is what we read in the photo.'} Fix anything that is different from the paper, but
        don&apos;t correct the writer&apos;s own mistakes: the feedback is about them.
      </ThemedText>
      {guessed.length > 0 ? (
        <ThemedText type="small">
          <GuessedWordsList words={guessed} bold padded />
          {'. They are highlighted in pink below.'}
        </ThemedText>
      ) : null}
      {photo.fromCache ? (
        <ThemedText type="small" themeColor="textSecondary">
          {photo.pages > 1 ? 'We read these photos before' : 'We read this photo before'}, so this is the same
          reading (no wait, and it did not use a photo reading).
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
