import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { WritingFeedbackView } from '@/components/writing-feedback';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AREAS,
  knownStudentNames,
  loadClassSet,
  pagePhotoUrls,
  pageTitle,
  renamePage,
  studentKey,
  type ClassSet,
  type ClassSetPage,
} from '@/lib/class-sets';
import { errorMessage } from '@/lib/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** How often to look again while the page is still being read or marked. */
const REFRESH_MS = 3000;
/** Most name suggestions shown at once. */
const MAX_SUGGESTIONS = 6;

// ===========================================================================

/** One student in a class set: the name, the levels per area, and the feedback. */
export default function ClassSetPageRoute() {
  const theme = useTheme();
  const { id, page: pageParam } = useLocalSearchParams<{ id: string; page: string }>();
  const pageNumber = Number(pageParam);
  const [set, setSet] = useState<ClassSet | null>(null);
  const [page, setPage] = useState<ClassSetPage | null | undefined>(undefined);
  const [photo, setPhoto] = useState<string | null>(null);
  const [bigPhoto, setBigPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await loadClassSet(String(id));
      const found = loaded?.pages.find((p) => p.page_number === pageNumber) ?? null;
      setSet(loaded?.set ?? null);
      setPage(found);
      if (found) pagePhotoUrls([found]).then((urls) => setPhoto(urls[found.page_number] ?? null));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, pageNumber]);

  useEffect(() => {
    load();
  }, [load]);

  // Still being read or marked (on the class set screen): look again shortly.
  const pending = !!page && page.status !== 'done' && page.status !== 'error';
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [pending, load]);

  const back = (
    <Button
      label="Back to the class set"
      variant="secondary"
      onPress={() => router.replace({ pathname: '/class-sets/[id]', params: { id: String(id) } })}
    />
  );

  if (error || page === undefined) {
    return (
      <Screen>
        {error ? <ThemedText themeColor="warning">{error}</ThemedText> : <ActivityIndicator color={theme.accent} />}
        {back}
      </Screen>
    );
  }
  if (page === null || set === null) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">This page isn&apos;t in the class set.</ThemedText>
        {back}
      </Screen>
    );
  }

  const header = (
    <>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {['CLASS SET', set.title, set.class_name].filter(Boolean).join(' · ')}
      </ThemedText>
      <NameEditor page={page} onRenamed={setPage} />
      <View style={styles.photoRow}>
        {photo && (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="The page, tap to enlarge"
            onPress={() => setBigPhoto(true)}
            style={[styles.thumb, { borderColor: theme.border }]}>
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Pressable>
        )}
        {page.area_levels && (
          <View style={[styles.areas, { backgroundColor: theme.backgroundElement }]}>
            {AREAS.map((area) => (
              <View key={area} style={styles.areaRow}>
                <ThemedText type="small">{area}</ThemedText>
                <ThemedText type="smallBold">{page.area_levels?.[area] ?? '–'}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
      <Modal visible={bigPhoto} transparent animationType="fade" onRequestClose={() => setBigPhoto(false)}>
        <Pressable accessibilityRole="button" onPress={() => setBigPhoto(false)} style={styles.overlay}>
          {photo && <Image source={{ uri: photo }} style={styles.big} contentFit="contain" />}
          <ThemedText style={styles.closeHint}>Tap to close</ThemedText>
        </Pressable>
      </Modal>
    </>
  );

  if (page.status !== 'done' || !page.feedback) {
    return (
      <Screen>
        {header}
        <ThemedText themeColor={page.status === 'error' ? 'warning' : 'textSecondary'}>
          {page.status === 'error'
            ? page.error
            : page.status === 'waiting'
              ? 'Waiting to be read and marked…'
              : page.status === 'reading'
                ? 'Reading the page…'
                : 'Marking…'}
        </ThemedText>
        {page.transcript ? (
          <View style={[styles.areas, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">The writing</ThemedText>
            <ThemedText selectable>{page.transcript}</ThemedText>
          </View>
        ) : null}
        {back}
      </Screen>
    );
  }

  return (
    <WritingFeedbackView
      response={{ feedback: page.feedback, remainingToday: 0 }}
      text={page.transcript ?? ''}
      header={header}
      footer={back}
      showUsage={false}
      reportTitle={`Writing feedback: ${pageTitle(page)}`}
    />
  );
}

/** The student's name: edit it, with names from earlier class sets suggested. */
function NameEditor({ page, onRenamed }: { page: ClassSetPage; onRenamed: (page: ClassSetPage) => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(!page.student_name.trim());
  const [name, setName] = useState(page.student_name);
  const [known, setKnown] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) knownStudentNames().then(setKnown);
  }, [editing]);

  async function save(value: string) {
    if (!value.trim()) return;
    setSaving(true);
    onRenamed(await renamePage(page, value));
    setName(value.trim());
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <View style={styles.nameRow}>
        <ThemedText type="subtitle" style={styles.flex}>
          {pageTitle(page)}
        </ThemedText>
        <Button label="Change name" variant="secondary" onPress={() => setEditing(true)} />
      </View>
    );
  }

  const typed = studentKey(name);
  const suggestions = known
    .filter((n) => studentKey(n) !== typed && (!typed || studentKey(n).includes(typed)))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <View style={[styles.nameBox, { backgroundColor: theme.markABg }]}>
      <ThemedText type="smallBold">
        {page.student_name.trim() ? "Change the student's name" : `Page ${page.page_number}: whose writing is this?`}
      </ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="The student's name"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="The student's name"
        autoFocus
        onSubmitEditing={() => save(name)}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
      />
      {suggestions.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Already in your class sets (use the same name so their work stays together):
          </ThemedText>
          <View style={styles.chips}>
            {suggestions.map((n) => (
              <Chip key={n} label={n} selected={false} onPress={() => save(n)} />
            ))}
          </View>
        </>
      )}
      <View style={styles.chips}>
        <Button label={saving ? 'Saving…' : 'Save the name'} disabled={!name.trim() || saving} onPress={() => save(name)} />
        {page.student_name.trim() ? (
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        ) : null}
      </View>
      {page.status === 'done' && page.cefr_level ? <Pill label={`Level ${page.cefr_level}`} tone="accent" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  nameBox: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  thumb: {
    width: 90,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  areas: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  areaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  big: {
    width: '100%',
    height: '90%',
  },
  closeHint: {
    color: '#ffffff',
    marginTop: Spacing.two,
  },
});
