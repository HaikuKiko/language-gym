import { createElement } from 'react';
import { Platform } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';

/** Media kit: plays a recording (the browser's own player). */
export function AudioPlayer({ uri, label }: { uri: string; label: string }) {
  if (Platform.OS !== 'web') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Recordings play in the web version.
      </ThemedText>
    );
  }
  return createElement('audio', { src: uri, controls: true, preload: 'metadata', 'aria-label': label, style: { width: '100%' } });
}
