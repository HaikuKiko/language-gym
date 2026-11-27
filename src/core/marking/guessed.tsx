/**
 * Words guessed when reading handwriting (Marking kit): always pink, and the
 * same everywhere (screens, the text box, the PDF report). Change the look here.
 */
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { useTheme } from '@/core/ui/use-theme';
import { guessParts } from '@/core/marking/marks';

/** One guessed word or phrase, in pink. */
export function Guessed({ text, small = false }: { text: string; small?: boolean }) {
  const theme = useTheme();
  return (
    <ThemedText type={small ? 'small' : undefined} style={[styles.guess, { backgroundColor: theme.guessBg }]}>
      {text}
    </ThemedText>
  );
}

/** A text with its guessed words in pink (inside another ThemedText). */
export function GuessedText({ text, guessed, keyPrefix = '' }: { text: string; guessed: string[]; keyPrefix?: string }) {
  return (
    <>
      {guessParts(text, guessed).map((part, i) =>
        part.guess ? <Guessed key={`${keyPrefix}${i}`} text={part.text} /> : part.text,
      )}
    </>
  );
}

/**
 * "We guessed this word: x." / "We guessed these 3 words: x, y, z." with the
 * words in pink, for inside a small ThemedText. `bold` makes the lead-in bold.
 */
export function GuessedWordsList({ words, bold = false, padded = false }: { words: string[]; bold?: boolean; padded?: boolean }) {
  const lead = words.length === 1 ? 'We guessed this word: ' : `We guessed these ${words.length} words: `;
  return (
    <>
      {bold ? <ThemedText type="smallBold">{lead}</ThemedText> : lead}
      {words.map((w, i) => (
        <ThemedText key={i} type="small">
          {i > 0 ? ', ' : ''}
          <Guessed small text={padded ? ` ${w} ` : w} />
        </ThemedText>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  guess: { borderRadius: 3 },
});
