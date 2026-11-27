import React, { useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { markParts, type MistakeAnchor } from '@/core/marking/marks';

type MarkedTextInputProps = Omit<TextInputProps, 'style' | 'multiline'> & {
  value: string;
  /** Mistakes from the last feedback, underlined while their words remain. */
  anchors: MistakeAnchor[];
  /** Length of the text the feedback was about, to tell how far words moved. */
  originalLength: number;
  /** Words guessed from a photo, highlighted in pink until they are changed. */
  guesses?: { anchors: MistakeAnchor[]; length: number } | null;
};

const MIN_HEIGHT = 220;

/**
 * A multi-line writing box that underlines earlier mistakes with orange
 * squiggles, like a word processor, and highlights words guessed from a
 * photo in pink. On the web a copy of the text sits behind a transparent
 * text box, with only the marks visible, so they move with the text as it is
 * edited. The box grows to fit the text; if it does scroll, the copy scrolls
 * with it, and nothing is drawn outside the box. Other platforms get a plain
 * box.
 */
export function MarkedTextInput({
  value,
  anchors,
  originalLength,
  guesses = null,
  ...inputProps
}: MarkedTextInputProps) {
  const theme = useTheme();
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [scrollY, setScrollY] = useState(0);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const showMarks = Platform.OS === 'web' && (anchors.length > 0 || (guesses?.anchors.length ?? 0) > 0);
  const parts = showMarks
    ? markParts(value, anchors.length > 0 ? { anchors, length: originalLength } : null, guesses)
    : [];

  // On the web, grow the box to fit the text whenever it changes, including
  // text put in by a photo (which some browsers don't report as a size change).
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!el || typeof el.scrollHeight !== 'number') return;
    const previous = el.style.height;
    el.style.height = '0px';
    const needed = el.scrollHeight;
    el.style.height = previous;
    setHeight(Math.max(MIN_HEIGHT, Math.ceil(needed) + 2));
  }, [value]);

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement, minHeight: height }]}>
      {showMarks && (
        <View pointerEvents="none" style={styles.clip}>
          <Text
            aria-hidden
            style={[
              styles.text,
              styles.mirror,
              { color: 'transparent', transform: [{ translateY: -scrollY }] },
            ]}>
            {parts.map((part, i) =>
              part.kind === 'mistake' ? (
                <Text key={i} style={[styles.squiggle, { textDecorationColor: theme.markA }]}>
                  {part.text}
                </Text>
              ) : part.kind === 'guess' ? (
                <Text key={i} style={[styles.guess, { backgroundColor: theme.guessBg }]}>
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )}
            {/* Keeps the last line's height the same as in the text box. */}
            {'\n'}
          </Text>
        </View>
      )}
      <TextInput
        {...inputProps}
        ref={inputRef}
        value={value}
        multiline
        textAlignVertical="top"
        placeholderTextColor={theme.textSecondary}
        onContentSizeChange={(event) => {
          setHeight((h) => Math.max(h, MIN_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height)));
        }}
        onScroll={(event) => {
          // Browsers report the raw scroll event, so read the position from the box.
          const native = event.nativeEvent as { contentOffset?: { y: number } };
          const target = event.currentTarget as unknown as { scrollTop?: number } | null;
          setScrollY(native.contentOffset?.y ?? target?.scrollTop ?? 0);
        }}
        style={[styles.text, styles.input, { color: theme.text, height }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Spacing.three,
    position: 'relative',
    overflow: 'hidden',
  },
  // Keeps the marks inside the box.
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  // Shared by the text box and the copy behind it, so lines wrap the same way.
  text: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.select({ web: 'var(--font-display)', default: undefined }),
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  mirror: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  input: {
    backgroundColor: 'transparent',
    // Above the copy with the marks, so highlights sit behind the words.
    position: 'relative',
    zIndex: 1,
  },
  guess: {
    borderRadius: 3,
  },
  squiggle: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
  },
});
