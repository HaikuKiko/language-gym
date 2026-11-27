import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { BusyOverlay } from '@/core/ui/busy-overlay';
import { Chip } from '@/core/ui/chip';
import { ErrorNote } from '@/core/ui/notice';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { TeacherOnly } from '@/core/app/teacher-only';
import { ClassPicker } from '@/core/classes/class-picker';
import { useChosenClass, useClasses } from '@/core/classes/classes';
import { errorMessage } from '@/core/app/supabase';
import { LEVELS } from '@/core/content/levels';
import { pickPhotos, type PreparedPhoto } from '@/core/media/photo';
import {
  DEFAULT_LEVELS,
  DEFAULT_QUESTIONS_PER_QUIZ,
  DEFAULT_QUIZ_COUNT,
  MAX_GRAMMAR_LENGTH,
  MAX_GRAMMAR_PHOTOS,
  MAX_QUIZ_LEVELS,
  QUESTIONS_PER_QUIZ,
  QUIZ_COUNTS,
  defaultWeekName,
  makeQuizSet,
  setQuizSetClass,
  sortLevels,
} from '@/lib/grammar-quiz';

/** Make a week of grammar quizzes: the grammar per level, how many quizzes, and the mix. */
function NewQuizSetScreen() {
  const theme = useTheme();
  const classes = useClasses();
  const [classId, setClassId] = useChosenClass(classes);
  const [name, setName] = useState(defaultWeekName());
  const [levels, setLevels] = useState<string[]>([...DEFAULT_LEVELS]);
  const [grammar, setGrammar] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [quizzes, setQuizzes] = useState<number>(DEFAULT_QUIZ_COUNT);
  const [perQuiz, setPerQuiz] = useState<number>(DEFAULT_QUESTIONS_PER_QUIZ);
  const [mix, setMix] = useState('even');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = sortLevels(levels);
  const mixNow = mix === 'even' || chosen.includes(mix) ? mix : 'even';
  const missing = photos.length === 0 && chosen.some((l) => (grammar[l] ?? '').trim().length < 3);

  function toggleLevel(level: string) {
    setLevels((list) =>
      list.includes(level)
        ? list.filter((l) => l !== level)
        : list.length >= MAX_QUIZ_LEVELS
          ? list
          : [...list, level],
    );
  }

  async function addPhotos(source: 'camera' | 'library') {
    setError(null);
    try {
      const picked = await pickPhotos(source, MAX_GRAMMAR_PHOTOS - photos.length);
      setPhotos((list) => [...list, ...picked].slice(0, MAX_GRAMMAR_PHOTOS));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const id = await makeQuizSet({
        name: name.trim() || defaultWeekName(),
        levels: chosen.map((level) => ({ level, grammar: grammar[level] ?? '' })),
        quizzes,
        perQuiz,
        mix: mixNow,
        photos,
      });
      if (classId) await setQuizSetClass(id, classId).catch(() => {});
      router.replace({ pathname: '/quiz/[id]', params: { id } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }];

  return (
    <Screen>
      <BusyOverlay
        visible={busy}
        title={`Writing ${quizzes} quizzes…`}
        detail="This takes about half a minute. Please keep this page open."
      />
      <ThemedText type="subtitle">Make this week&apos;s quizzes</ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold">Name</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={80}
          accessibilityLabel="Name of the week"
          style={inputStyle}
        />
      </View>

      <ClassPicker
        classes={classes}
        value={classId}
        onChange={setClassId}
        note="Each class has its own leaderboard."
      />

      <View style={styles.section}>
        <ThemedText type="smallBold">Levels in the class</ThemedText>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} selected={levels.includes(l)} onPress={() => toggleLevel(l)} />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Up to {MAX_QUIZ_LEVELS}. Every quiz mixes questions from each level.
        </ThemedText>
      </View>

      {chosen.map((level) => (
        <ThemedView key={level} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{level} grammar this week</ThemedText>
          <TextInput
            value={grammar[level] ?? ''}
            onChangeText={(text) => setGrammar((g) => ({ ...g, [level]: text }))}
            placeholder={
              level === 'A1'
                ? 'e.g. present simple: I/you/we/they work, he/she works; do / does questions'
                : 'e.g. past simple vs past continuous: I was walking when it started to rain'
            }
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={MAX_GRAMMAR_LENGTH}
            accessibilityLabel={`${level} grammar`}
            style={[inputStyle, styles.multiline]}
          />
        </ThemedView>
      ))}

      <View style={styles.section}>
        <ThemedText type="smallBold">Or add photos of the grammar page</ThemedText>
        <View style={styles.chips}>
          {Platform.OS !== 'web' && (
            <Chip label="📷 Take a photo" onPress={photos.length < MAX_GRAMMAR_PHOTOS ? () => addPhotos('camera') : undefined} />
          )}
          <Chip
            label="🖼️ Choose photos"
            onPress={photos.length < MAX_GRAMMAR_PHOTOS ? () => addPhotos('library') : undefined}
          />
          {photos.length > 0 && <Chip label="✕ Remove photos" onPress={() => setPhotos([])} />}
        </View>
        {photos.length > 0 && (
          <View style={styles.chips}>
            {photos.map((p, i) => (
              <Image
                key={i}
                source={{ uri: `data:${p.mediaType};base64,${p.base64}` }}
                style={styles.thumb}
                accessibilityLabel={`Photo ${i + 1}`}
              />
            ))}
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Up to {MAX_GRAMMAR_PHOTOS}. With photos, a few words per level (e.g. &quot;page 34&quot;) help Claude
          match them up.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">How many quizzes?</ThemedText>
        <View style={styles.chips}>
          {QUIZ_COUNTS.map((n) => (
            <Chip key={n} label={String(n)} selected={n === quizzes} onPress={() => setQuizzes(n)} />
          ))}
        </View>
        <ThemedText type="smallBold">Questions in each</ThemedText>
        <View style={styles.chips}>
          {QUESTIONS_PER_QUIZ.map((n) => (
            <Chip key={n} label={String(n)} selected={n === perQuiz} onPress={() => setPerQuiz(n)} />
          ))}
        </View>
        {chosen.length > 1 && (
          <>
            <ThemedText type="smallBold">Mix of levels</ThemedText>
            <View style={styles.chips}>
              <Chip label="Even" selected={mixNow === 'even'} onPress={() => setMix('even')} />
              {chosen.map((l) => (
                <Chip key={l} label={`Mostly ${l}`} selected={mixNow === l} onPress={() => setMix(l)} />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Button
          label={`✨ Make ${quizzes} quizzes`}
          disabled={busy || chosen.length === 0 || missing}
          onPress={make}
        />
        {chosen.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Choose at least one level.
          </ThemedText>
        )}
        {chosen.length > 0 && missing && (
          <ThemedText type="small" themeColor="textSecondary">
            Type the grammar for each level, or add a photo.
          </ThemedText>
        )}
        <ErrorNote message={error} />
        <Button label="Back" variant="secondary" onPress={() => router.replace('/quiz')} />
      </View>
    </Screen>
  );
}

export default function NewQuizSetRoute() {
  return (
    <TeacherOnly>
      <NewQuizSetScreen />
    </TeacherOnly>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.four, gap: Spacing.two },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  thumb: { width: 72, height: 96, borderRadius: Spacing.two },
});
