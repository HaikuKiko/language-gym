import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AudioPlayer } from '@/core/media/audio-player';
import type { Slide } from '@/core/media/slideshow';
import { VIDEO_SLIDE_SECONDS, canMakeVideo, downloadFile, makeSlideVideo } from '@/core/media/slide-video';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';

/**
 * Media kit: slideshows on the classroom screen. Plays by itself (each slide
 * `SLIDE_SECONDS`, and a slide with a recording waits until it has played),
 * with Back / Pause / Next, full screen, and one chip per deck (e.g. per group)
 * plus "All" to play every deck one after another.
 */

// ===========================================================================
// Settings
// ===========================================================================

/** How long each slide shows when it plays by itself. */
export const SLIDE_SECONDS = 15;
/** After a recording ends, the slide stays this long before the next one. */
export const AFTER_SOUND_SECONDS = 3;

// ===========================================================================

export type SlideDeck = { id: string; label: string; slides: Slide[] };

const ALL = 'all';
const WIDE = 800;
const DARK = {
  page: '#0B1220',
  panel: '#111A2E',
  line: '#22304D',
  text: '#F3F6FB',
  soft: '#A9B6CF',
  accent: '#3D8BEF',
  chip: '#1C2741',
};
const TICK_MS = 250;

export function SlidePresenter({
  title,
  decks,
  allLabel = 'All groups',
  onClose,
}: {
  title: string;
  decks: SlideDeck[];
  allLabel?: string;
  onClose?: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [chosen, setChosen] = useState<string>(decks.length > 1 ? ALL : (decks[0]?.id ?? ALL));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(SLIDE_SECONDS * 1000);
  const [videoStep, setVideoStep] = useState<'off' | 'check' | 'making'>('off');
  const [videoShare, setVideoShare] = useState(0);
  const [withSound, setWithSound] = useState(true);
  const [videoProblem, setVideoProblem] = useState<string | null>(null);

  const playlist = useMemo(
    () => decks.filter((d) => chosen === ALL || d.id === chosen).flatMap((d) => d.slides.map((slide) => ({ deck: d, slide }))),
    [decks, chosen],
  );
  const item = playlist[Math.min(index, playlist.length - 1)];

  function go(next: number) {
    setIndex(Math.max(0, Math.min(next, playlist.length - 1)));
    setElapsed(0);
    setLimit(SLIDE_SECONDS * 1000);
    setSoundPlaying(false);
  }

  // The clock: runs unless paused or a recording is playing; at the end, the next slide.
  useEffect(() => {
    if (paused || soundPlaying || !item) return;
    const timer = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(timer);
  }, [paused, soundPlaying, item]);
  useEffect(() => {
    if (elapsed < limit) return;
    if (index < playlist.length - 1) go(index + 1);
    else setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, limit]);

  function onSound(playing: boolean) {
    setSoundPlaying(playing);
    // After a recording, give the class a moment before moving on.
    if (!playing) {
      setElapsed(0);
      setLimit(AFTER_SOUND_SECONDS * 1000);
    }
  }

  function fullScreen() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const chosenLabel = chosen === ALL ? allLabel : (decks.find((d) => d.id === chosen)?.label ?? '');
  // Slides with a recording last as long as the recording instead.
  const videoSeconds = playlist.length * VIDEO_SLIDE_SECONDS;

  async function makeVideo() {
    setVideoStep('making');
    setVideoProblem(null);
    setVideoShare(0);
    try {
      const { blob, ext } = await makeSlideVideo({
        title,
        subtitle: chosenLabel,
        slides: playlist.map((p) => ({ ...p.slide, kicker: `${p.deck.label}${p.slide.kicker ? ` · ${p.slide.kicker}` : ''}` })),
        includeSound: withSound,
        onProgress: setVideoShare,
      });
      const name = `${title} ${chosenLabel}`.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
      downloadFile(blob, `${name}.${ext}`);
      setVideoStep('off');
    } catch (e) {
      setVideoProblem(e instanceof Error ? e.message : "Couldn't make the video.");
      setVideoStep('check');
    }
  }

  const progress = playlist.length ? (index + Math.min(elapsed / limit, 1)) / playlist.length : 0;

  return (
    <View style={[styles.page, { minHeight: '100%' }]}>
      <View style={[styles.top, !wide && styles.wrap]}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <View style={styles.chips}>
          {decks.map((d) => (
            <DarkChip
              key={d.id}
              label={`${d.label} (${d.slides.length})`}
              selected={chosen === d.id}
              onPress={() => {
                setChosen(d.id);
                go(0);
              }}
            />
          ))}
          {decks.length > 1 ? (
            <DarkChip
              label={allLabel}
              selected={chosen === ALL}
              onPress={() => {
                setChosen(ALL);
                go(0);
              }}
            />
          ) : null}
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 1000) / 10}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.middle}>
        {videoStep !== 'off' ? (
          <View style={styles.panel}>
            <ThemedText style={styles.heading2}>🎬 Save as a video: {chosenLabel}</ThemedText>
            {videoStep === 'check' ? (
              <>
                <ThemedText style={styles.text}>
                  Before it goes on a website, check that every student in it agreed, and anyone in a recording too.
                  For students under 18, their parents must agree. Check the photos for faces and the text for full
                  names.
                </ThemedText>
                <View style={styles.chips}>
                  <DarkChip label="With the recordings" selected={withSound} onPress={() => setWithSound(true)} />
                  <DarkChip label="Without the recordings" selected={!withSound} onPress={() => setWithSound(false)} />
                </View>
                <ThemedText style={styles.soft}>
                  It takes as long to make as to watch (about {Math.ceil(videoSeconds / 60)} min
                  {withSound ? ', plus the recordings' : ''}). Keep this page open. The file saves to this computer.
                </ThemedText>
                {videoProblem ? <ThemedText style={styles.problem}>{videoProblem}</ThemedText> : null}
                <View style={styles.chips}>
                  <DarkChip label="They agreed: make the video" selected onPress={makeVideo} />
                  <DarkChip label="Cancel" onPress={() => setVideoStep('off')} />
                </View>
              </>
            ) : (
              <>
                <ThemedText style={styles.text}>Making the video… {Math.round(videoShare * 100)}%</ThemedText>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(videoShare * 100)}%` }]} />
                </View>
                <ThemedText style={styles.soft}>Keep this page open and this tab in front until the file is saved.</ThemedText>
              </>
            )}
          </View>
        ) : !item ? (
          <ThemedText style={styles.text}>Nothing to show yet: this group hasn&apos;t saved any work.</ThemedText>
        ) : (
          <View style={[styles.body, wide && styles.bodyWide]}>
            {item.slide.imageUri ? (
              <Image
                source={{ uri: item.slide.imageUri }}
                style={[styles.photo, wide && styles.photoWide]}
                resizeMode="contain"
                accessibilityLabel={`Photo: ${item.slide.title}`}
              />
            ) : null}
            <View style={[styles.words, wide && styles.flex]}>
              <ThemedText style={styles.kicker}>
                {item.deck.label}
                {item.slide.kicker ? ` · ${item.slide.kicker}` : ''}
              </ThemedText>
              <ThemedText style={[styles.heading, !wide && styles.headingSmall]}>{item.slide.title}</ThemedText>
              {item.slide.texts.map((t, i) => (
                <ThemedText key={i} style={styles.text}>
                  {t}
                </ThemedText>
              ))}
              {(item.slide.sounds ?? []).map((s, i) => (
                <View key={`${item.slide.id}-${s.uri}`} style={styles.sound}>
                  <ThemedText style={styles.soundLabel}>🎙 {s.label}</ThemedText>
                  <AudioPlayer uri={s.uri} label={s.label} autoPlay={!paused && i === 0} onPlayingChange={onSound} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottom, !wide && styles.wrap]}>
        <DarkChip label="← Back" onPress={() => go(index - 1)} />
        <DarkChip label={paused ? '▶ Play' : '❚❚ Pause'} selected onPress={() => setPaused(!paused)} />
        <DarkChip label="Next →" onPress={() => go(index + 1)} />
        <ThemedText style={[styles.soft, styles.flex]}>
          {playlist.length ? `Slide ${index + 1} of ${playlist.length}` : ''}
          {paused
            ? ' · paused'
            : soundPlaying
              ? ' · playing the recording'
              : ` · each slide ${SLIDE_SECONDS} s (longer while a recording plays)`}
        </ThemedText>
        {canMakeVideo() && playlist.length && videoStep === 'off' ? (
          <DarkChip
            label="🎬 Save as a video"
            onPress={() => {
              setPaused(true);
              setVideoStep('check');
            }}
          />
        ) : null}
        {Platform.OS === 'web' ? <DarkChip label="⛶ Full screen" onPress={fullScreen} /> : null}
        {onClose ? <DarkChip label="Close" onPress={onClose} /> : null}
      </View>
    </View>
  );
}

function DarkChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? DARK.accent : DARK.chip },
        pressed && { opacity: 0.7 },
      ]}>
      <ThemedText style={styles.chipText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: DARK.page, padding: Spacing.three, gap: Spacing.three },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  wrap: { flexWrap: 'wrap' },
  title: { color: DARK.text, fontSize: 22, lineHeight: 28, fontWeight: 800, flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { color: DARK.text, fontSize: 15, lineHeight: 20, fontWeight: 600 },
  track: { height: 5, borderRadius: 3, backgroundColor: DARK.line, overflow: 'hidden' },
  fill: { height: 5, backgroundColor: DARK.accent },
  middle: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.three },
  body: { gap: Spacing.four },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Spacing.three, backgroundColor: DARK.panel },
  photoWide: { width: '55%' },
  words: { gap: Spacing.three },
  flex: { flex: 1 },
  kicker: { color: '#7FB4F5', fontSize: 18, lineHeight: 24 },
  heading: { color: DARK.text, fontSize: 48, lineHeight: 56, fontWeight: 800 },
  headingSmall: { fontSize: 32, lineHeight: 38 },
  text: { color: DARK.text, fontSize: 26, lineHeight: 38 },
  sound: { gap: Spacing.one, backgroundColor: DARK.chip, borderRadius: Spacing.three, padding: Spacing.three },
  soundLabel: { color: DARK.text, fontSize: 18, lineHeight: 24 },
  soft: { color: DARK.soft, fontSize: 15, lineHeight: 20 },
  panel: { gap: Spacing.three, maxWidth: 820, alignSelf: 'center' },
  heading2: { color: DARK.text, fontSize: 32, lineHeight: 40, fontWeight: 800 },
  problem: { color: '#FF8A80', fontSize: 18, lineHeight: 24 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: DARK.panel, borderRadius: Spacing.three, padding: Spacing.two },
});
