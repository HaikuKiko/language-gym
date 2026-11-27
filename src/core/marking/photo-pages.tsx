import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { MAX_PAGES, pickPhotos, type PreparedPhoto } from '@/core/media/photo';
import { errorMessage } from '@/core/app/supabase';

/**
 * Photos of handwriting, one per page: take them one at a time or choose
 * several, see them in order (remove any), then read them all together into
 * one text. All the pages count as one photo reading.
 */
export function PhotoPages({
  disabled,
  reading,
  onRead,
  onError,
}: {
  disabled?: boolean;
  /** True while the pages are being read. */
  reading: boolean;
  /** Reads the pages; return true when it worked, so the pages are cleared. */
  onRead: (pages: PreparedPhoto[]) => Promise<boolean>;
  onError: (message: string | null) => void;
}) {
  const theme = useTheme();
  const [pages, setPages] = useState<PreparedPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const room = MAX_PAGES - pages.length;
  const off = disabled || reading || picking;

  async function add(source: 'camera' | 'library') {
    onError(null);
    setPicking(true);
    try {
      const added = await pickPhotos(source, room);
      if (added.length > 0) setPages((current) => [...current, ...added].slice(0, MAX_PAGES));
    } catch (e) {
      onError(errorMessage(e));
    }
    setPicking(false);
  }

  async function read() {
    if (await onRead(pages)) setPages([]);
  }

  const count = pages.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.buttons}>
        <Button
          label="Take a photo"
          variant="secondary"
          disabled={off || room === 0}
          onPress={() => add('camera')}
          style={styles.button}
        />
        <Button
          label="Choose photos"
          variant="secondary"
          disabled={off || room === 0}
          onPress={() => add('library')}
          style={styles.button}
        />
      </View>

      {count > 0 && (
        <>
          <View style={styles.pages}>
            {pages.map((page, i) => (
              <View key={i} style={[styles.page, { borderColor: theme.border }]}>
                <Image
                  source={{ uri: `data:${page.mediaType};base64,${page.base64}` }}
                  style={[StyleSheet.absoluteFill, styles.thumb]}
                  contentFit="cover"
                  accessibilityLabel={`Page ${i + 1}`}
                />
                <View style={[styles.label, { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold">Page {i + 1}</ThemedText>
                </View>
                {!off && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove page ${i + 1}`}
                    hitSlop={8}
                    onPress={() => setPages((current) => current.filter((_, j) => j !== i))}
                    style={[styles.remove, { backgroundColor: theme.textSecondary }]}>
                    <ThemedText type="smallBold" style={{ color: theme.background }}>
                      ×
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
            {room > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another page"
                disabled={off}
                onPress={() => add('library')}
                style={[styles.page, styles.add, { borderColor: theme.border }]}>
                <ThemedText type="subtitle" themeColor="textSecondary">
                  +
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {count === 1 ? '1 page.' : `${count} pages.`}{' '}
            {room > 0
              ? `Add up to ${MAX_PAGES}, in order, then read them all together.`
              : 'That is the most pages. Read them now.'}
          </ThemedText>
          <Button
            label={reading ? 'Reading…' : count === 1 ? 'Read 1 page' : `Read ${count} pages`}
            disabled={off}
            onPress={read}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    flexBasis: 140,
  },
  pages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  page: {
    width: 72,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'visible',
  },
  label: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 5,
    borderRadius: 6,
  },
  thumb: {
    borderRadius: 9,
  },
  remove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
