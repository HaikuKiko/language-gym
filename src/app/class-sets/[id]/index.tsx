import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Pill } from '@/components/pill';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  loadClassSet,
  pagePhotoUrls,
  pageTitle,
  processClassSet,
  type ClassSet,
  type ClassSetPage,
} from '@/lib/class-sets';
import { errorMessage } from '@/lib/supabase';

const STATUS_TEXT: Record<ClassSetPage['status'], string> = {
  waiting: 'waiting',
  reading: 'reading…',
  marking: 'marking…',
  done: '',
  error: '',
};

/** One class set: every page (student), marked one after another. */
export default function ClassSetRoute() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [set, setSet] = useState<ClassSet | null | undefined>(undefined);
  const [pages, setPages] = useState<ClassSetPage[]>([]);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const started = useRef(false);

  const onChange = useCallback((page: ClassSetPage) => {
    setPages((current) => current.map((p) => (p.id === page.id ? page : p)));
  }, []);

  const run = useCallback(
    async (loadedSet: ClassSet, loadedPages: ClassSetPage[], retryErrors = false) => {
      setWorking(true);
      await processClassSet(loadedSet, loadedPages, onChange, { retryErrors });
      setWorking(false);
    },
    [onChange],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await loadClassSet(String(id));
      setSet(loaded?.set ?? null);
      if (!loaded) return;
      setPages(loaded.pages);
      pagePhotoUrls(loaded.pages).then(setPhotos);
      // Read and mark whatever is not finished yet (also after a refresh).
      if (!started.current && loaded.pages.some((p) => p.status !== 'done' && p.status !== 'error')) {
        started.current = true;
        run(loaded.set, loaded.pages);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, run]);

  useEffect(() => {
    load();
  }, [load]);

  if (error || set === undefined) {
    return (
      <Screen>
        <ThemedText type="subtitle">Class set</ThemedText>
        {error ? (
          <>
            <ThemedText themeColor="warning">{error}</ThemedText>
            <Button label="Try again" onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </Screen>
    );
  }
  if (set === null) {
    return (
      <Screen>
        <ThemedText type="subtitle">Class set</ThemedText>
        <ThemedText themeColor="textSecondary">This class set isn&apos;t on this device.</ThemedText>
        <Button label="Back to class sets" variant="secondary" onPress={() => router.replace('/class-sets')} />
      </Screen>
    );
  }

  const done = pages.filter((p) => p.status === 'done').length;
  const failed = pages.filter((p) => p.status === 'error');
  const finished = done + failed.length;
  const noName = pages.filter((p) => !p.student_name.trim()).length;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {['CLASS SET', set.class_name, new Date(set.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
        </ThemedText>
        <ThemedText type="subtitle">{set.title || 'Class set'}</ThemedText>
        <View style={styles.pills}>
          <Pill label={`Feedback for ${set.level}`} tone="accent" />
          <Pill label={`${pages.length} pages`} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">
          {finished < pages.length ? `Marking… ${finished} of ${pages.length} done` : `All ${pages.length} pages marked`}
        </ThemedText>
        <ProgressBar fraction={pages.length > 0 ? finished / pages.length : 0} />
        {noName > 0 && (
          <ThemedText type="small" style={{ color: theme.markA }}>
            {noName === 1 ? '1 page has' : `${noName} pages have`} no name: tap it to type the student&apos;s name.
          </ThemedText>
        )}
      </View>

      {pages.map((page) => {
        const named = !!page.student_name.trim();
        return (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            accessibilityLabel={`${pageTitle(page)}${page.cefr_level ? `, level ${page.cefr_level}` : ''}`}
            onPress={() =>
              router.push({ pathname: '/class-sets/[id]/[page]', params: { id: set.id, page: String(page.page_number) } })
            }
            style={({ pressed }) => [
              styles.row,
              named
                ? { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement }
                : { backgroundColor: theme.markABg, borderColor: theme.markA },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.thumb, { borderColor: theme.border }]}>
              {photos[page.page_number] && (
                <Image source={{ uri: photos[page.page_number] }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>
            <View style={styles.rowText}>
              <ThemedText type="smallBold" style={!named ? { color: theme.markA } : undefined}>
                {pageTitle(page)}
                {!named ? ' ✎' : ''}
              </ThemedText>
              {page.status === 'error' && (
                <ThemedText type="small" themeColor="warning">
                  {page.error}
                </ThemedText>
              )}
            </View>
            {page.status === 'done' && page.cefr_level ? (
              <Pill label={page.cefr_level} tone="accent" />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {STATUS_TEXT[page.status]}
              </ThemedText>
            )}
          </Pressable>
        );
      })}

      <View style={styles.section}>
        {failed.length > 0 && !working && (
          <Button label={`Try the ${failed.length} unfinished again`} onPress={() => run(set, pages, true)} />
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Tap a page to see that student&apos;s feedback or change the name. Marked by an AI (Claude) as a guide.
        </ThemedText>
        <Button label="Back to class sets" variant="secondary" onPress={() => router.replace('/class-sets')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  thumb: {
    width: 36,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    textAlign: 'center',
  },
});
