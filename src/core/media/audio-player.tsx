import { createElement } from 'react';
import { Platform } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';

/** Media kit: plays a recording (the browser's own player). */
export function AudioPlayer({
  uri,
  label,
  autoPlay,
  onPlayingChange,
}: {
  uri: string;
  label: string;
  /** Start playing as soon as it can (a slideshow playing by itself). */
  autoPlay?: boolean;
  /** Told when it starts and stops playing. */
  onPlayingChange?: (playing: boolean) => void;
}) {
  if (Platform.OS !== 'web') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Recordings play in the web version.
      </ThemedText>
    );
  }
  return createElement('audio', {
    src: uri,
    controls: true,
    autoPlay,
    preload: autoPlay ? 'auto' : 'metadata',
    'aria-label': label,
    style: { width: '100%' },
    onPlay: () => onPlayingChange?.(true),
    onPause: () => onPlayingChange?.(false),
    onEnded: () => onPlayingChange?.(false),
    onError: () => onPlayingChange?.(false),
  });
}
