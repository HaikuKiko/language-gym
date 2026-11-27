import { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AudioPlayer } from '@/core/media/audio-player';
import { Button } from '@/core/ui/button';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';

/**
 * Media kit: a click-through slideshow (a group presenting its project). Each
 * slide has a heading, an optional photo and some text. Side by side on a wide
 * screen, photo on top on a phone.
 */

export type Slide = {
  id: string;
  /** Small line above the heading, e.g. "Stop 3". */
  kicker?: string;
  title: string;
  /** A photo (any image address, including data: addresses). */
  imageUri?: string;
  /** Paragraphs of text. */
  texts: string[];
  /** Recordings to play. */
  sounds?: { label: string; uri: string }[];
};

const WIDE = 700;

export function Slideshow({ title, slides, onClose }: { title: string; slides: Slide[]; onClose?: () => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)];
  const wide = width >= WIDE;

  if (!slide) {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText>Nothing to show yet: visit a place and save your work first.</ThemedText>
        {onClose ? <Button label="Back" variant="secondary" onPress={onClose} /> : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.top}>
        <ThemedText type="smallBold" style={styles.flex}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Slide {index + 1} of {slides.length}
        </ThemedText>
      </View>
      <View style={[styles.body, wide && styles.bodyWide]}>
        {slide.imageUri ? (
          <Image
            source={{ uri: slide.imageUri }}
            style={[styles.photo, wide ? styles.photoWide : null, { backgroundColor: theme.backgroundElement }]}
            resizeMode="cover"
            accessibilityLabel={`Photo: ${slide.title}`}
          />
        ) : null}
        <View style={[styles.words, wide && styles.flex]}>
          {slide.kicker ? (
            <ThemedText type="small" themeColor="textSecondary">
              {slide.kicker}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.heading}>{slide.title}</ThemedText>
          {slide.texts.map((t, i) => (
            <ThemedText key={i} style={styles.text}>
              {t}
            </ThemedText>
          ))}
          {(slide.sounds ?? []).map((s) => (
            <View key={s.uri} style={styles.sound}>
              <ThemedText type="smallBold">{s.label}</ThemedText>
              <AudioPlayer uri={s.uri} label={s.label} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.dots}>
        {slides.map((s, i) => (
          <View key={s.id} style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.border }]} />
        ))}
      </View>
      <View style={styles.buttons}>
        <Button label="← Back" variant="secondary" disabled={index === 0} onPress={() => setIndex(index - 1)} style={styles.flex} />
        <Button
          label="Next →"
          disabled={index >= slides.length - 1}
          onPress={() => setIndex(index + 1)}
          style={styles.flex}
        />
      </View>
      {onClose ? <Button label="Close the slideshow" variant="secondary" onPress={onClose} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  body: { gap: Spacing.three },
  bodyWide: { flexDirection: 'row' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Spacing.three },
  photoWide: { width: '50%' },
  words: { gap: Spacing.two },
  heading: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  text: { fontSize: 18, lineHeight: 27 },
  sound: { gap: Spacing.one },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { width: 9, height: 9, borderRadius: 5 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});
