import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { underlineMistakes, type MistakeAnchor } from '@/lib/writing';

type MarkedTextInputProps = Omit<TextInputProps, 'style' | 'multiline'> & {
  value: string;
  /** Mistakes from the last feedback, underlined while their words remain. */
  anchors: MistakeAnchor[];
  /** Length of the text the feedback was about, to tell how far words moved. */
  originalLength: number;
};

const MIN_HEIGHT = 220;

/**
 * A multi-line writing box that underlines earlier mistakes with orange
 * squiggles, like a word processor. On the web a copy of the text sits
 * behind a transparent text box, with only the underlines visible, so the
 * lines move with the text as it is edited. Other platforms get a plain box.
 */
export function MarkedTextInput({
  value,
  anchors,
  originalLength,
  ...inputProps
}: MarkedTextInputProps) {
  const theme = useTheme();
  const [height, setHeight] = useState(MIN_HEIGHT);
  const showMarks = Platform.OS === 'web' && anchors.length > 0;
  const parts = showMarks ? underlineMistakes(value, anchors, originalLength) : [];

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement, minHeight: height }]}>
      {showMarks && (
        <Text
          aria-hidden
          pointerEvents="none"
          style={[styles.text, styles.mirror, { color: 'transparent' }]}>
          {parts.map((part, i) =>
            part.marked ? (
              <Text key={i} style={[styles.squiggle, { textDecorationColor: theme.markA }]}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
          {/* Keeps the last line's height the same as in the text box. */}
          {'\n'}
        </Text>
      )}
      <TextInput
        {...inputProps}
        value={value}
        multiline
        textAlignVertical="top"
        placeholderTextColor={theme.textSecondary}
        onContentSizeChange={(event) => {
          setHeight(Math.max(MIN_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height)));
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
  },
  squiggle: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
  },
});
