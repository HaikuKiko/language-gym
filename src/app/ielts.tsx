import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { JoinCourse } from '@/components/join-course';
import {
  Bullet,
  CorrectionNotes,
  MarkedWriting,
  NumberedCard,
  ParagraphNote,
  Section,
} from '@/components/feedback-parts';
import { MarkedTextInput } from '@/components/marked-text-input';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatClock, useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { loadAccount, type Account } from '@/lib/account';
import {
  CRITERION_SHORT,
  ESSAY_TYPE_NAMES,
  IELTS_HARD_MIN_WORDS,
  IELTS_MAX_WORDS,
  TASK2_MINUTES,
  formatBand,
  loadAssignedPrompts,
  requestIeltsFeedback,
  type IeltsResponse,
  type WritingPrompt,
} from '@/lib/ielts';
import { pickPhoto } from '@/lib/photo';
import { errorMessage } from '@/lib/supabase';
import {
  UNREADABLE_MARK,
  anchorsFrom,
  countWords,
  markCorrections,
  readPhoto,
  type MistakeAnchor,
} from '@/lib/writing';

const draftKey = (promptId: number) => `ielts-draft-${promptId}`;

/** IELTS Writing Task 2: the teacher's question, a 40-minute timer and band scores. */
export default function IeltsRoute() {
  const theme = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [prompts, setPrompts] = useState<WritingPrompt[] | null>(null);
  const [promptId, setPromptId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IeltsResponse | null>(null);
  const [marks, setMarks] = useState<{ anchors: MistakeAnchor[]; length: number } | null>(null);
  const timer = useCountdown(TASK2_MINUTES * 60);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [nextAccount, nextPrompts] = await Promise.all([loadAccount(), loadAssignedPrompts()]);
      setAccount(nextAccount);
      setPrompts(nextPrompts);
      setPromptId((current) =>
        current !== null && nextPrompts.some((p) => p.id === current) ? current : (nextPrompts[0]?.id ?? null),
      );
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep a draft on this device, so a closed tab doesn't lose 40 minutes' work.
  useEffect(() => {
    if (promptId === null) return;
    let cancelled = false;
    AsyncStorage.getItem(draftKey(promptId))
      .then((saved) => {
        if (!cancelled) setText(saved ?? '');
      })
      .catch(() => {});
    setMarks(null);
    return () => {
      cancelled = true;
    };
  }, [promptId]);

  function changeText(next: string) {
    setText(next);
    if (promptId !== null) AsyncStorage.setItem(draftKey(promptId), next).catch(() => {});
  }

  const prompt = prompts?.find((p) => p.id === promptId) ?? null;
  const enrolment = account?.enrolments.find((e) => e.trackId === 'ielts') ?? null;
  const words = countWords(text);
  const minWords = prompt?.minWords ?? 250;
  const unreadable = text.split(UNREADABLE_MARK).length - 1;

  const back = <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />;

  // ---- Before writing: account, enrolment and a question --------------------
  if (loadError || !account || !prompts) {
    return (
      <Screen>
        <ThemedText type="subtitle">IELTS writing</ThemedText>
        <ThemedText themeColor={loadError ? 'warning' : 'textSecondary'}>{loadError ?? 'Loading…'}</ThemedText>
        {loadError && <Button label="Try again" onPress={load} />}
        {back}
      </Screen>
    );
  }

  if (account.isGuest || !account.student || !enrolment) {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="subtitle">IELTS writing</ThemedText>
          <ThemedText themeColor="textSecondary">
            {account.isGuest
              ? 'IELTS is for saved accounts, so your essays and bands stay with you on every device. It only takes a minute.'
              : !account.student
                ? 'Add your name to your account first.'
                : "Join the IELTS course to start. Choose your target band: you can change it later."}
          </ThemedText>
        </View>
        {account.isGuest || !account.student ? (
          <Button
            label={account.isGuest ? 'Save my account' : 'Add my name'}
            onPress={() => router.push({ pathname: '/account', params: { next: 'ielts' } })}
          />
        ) : (
          <JoinCourse trackId="ielts" trackName="IELTS" onJoined={load} />
        )}
        {back}
      </Screen>
    );
  }

  if (!prompt) {
    return (
      <Screen>
        <ThemedText type="subtitle">IELTS writing</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your teacher hasn&apos;t set a Task 2 question yet. Check again later.
        </ThemedText>
        <Button label="Check again" onPress={load} />
        {back}
      </Screen>
    );
  }

  // ---- Feedback ---------------------------------------------------------------
  if (result) {
    return (
      <IeltsFeedbackView
        response={result}
        text={text}
        prompt={prompt}
        onImprove={() => setResult(null)}
      />
    );
  }

  const problem =
    unreadable > 0
      ? `Replace the ${unreadable === 1 ? '[?] mark' : `${unreadable} [?] marks`} with the words you wrote.`
      : words < IELTS_HARD_MIN_WORDS
        ? `Write at least ${IELTS_HARD_MIN_WORDS} words to get feedback.`
        : words > IELTS_MAX_WORDS
          ? `Please shorten it to ${IELTS_MAX_WORDS} words or fewer (${words} now).`
          : null;

  async function submit() {
    if (!prompt) return;
    setBusy(true);
    setError(null);
    try {
      const response = await requestIeltsFeedback(prompt.id, text);
      timer.pause();
      setResult(response);
      setMarks({
        anchors: anchorsFrom(markCorrections(text, response.feedback.corrections)),
        length: text.length,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  async function scan(source: 'camera' | 'library') {
    setError(null);
    try {
      const image = await pickPhoto(source);
      if (!image) return;
      setReading(true);
      const photo = await readPhoto(image);
      if (!photo.containsWriting || !photo.transcript.trim()) {
        setError('We could not find any writing in that photo. Please try another one.');
      } else {
        changeText(photo.transcript);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    setReading(false);
  }

  const [statement, ...rest] = prompt.prompt.split(/\n\s*\n/);

  return (
    <Screen>
      <View style={styles.titleRow}>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            IELTS WRITING
          </ThemedText>
          <ThemedText type="subtitle">Task 2 essay</ThemedText>
        </View>
        {enrolment.target ? (
          <View style={[styles.target, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold" style={[styles.targetLabel, { color: theme.grammarLabel }]}>
              TARGET
            </ThemedText>
            <ThemedText style={[styles.targetValue, { color: theme.grammarText }]}>{enrolment.target}</ThemedText>
          </View>
        ) : null}
      </View>

      {prompts.length > 1 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Questions from your teacher</ThemedText>
          <View style={styles.chips}>
            {prompts.map((p) => (
              <Chip key={p.id} label={p.topic} selected={p.id === prompt.id} onPress={() => setPromptId(p.id)} />
            ))}
          </View>
        </View>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
          {prompt.essayType ? `${ESSAY_TYPE_NAMES[prompt.essayType]} · ` : ''}
          {prompt.topic}
        </ThemedText>
        <ThemedText style={styles.question}>{statement}</ThemedText>
        {rest.map((line, i) => (
          <ThemedText
            key={i}
            style={i === 0 ? [styles.question, styles.bold] : undefined}
            type={i === 0 ? undefined : 'small'}
            themeColor={i === 0 ? undefined : 'textSecondary'}>
            {line}
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Write at least {minWords} words · about {TASK2_MINUTES} minutes
        </ThemedText>
      </ThemedView>

      <View style={styles.timerRow}>
        <ThemedText
          style={[styles.clock, { color: timer.finished ? theme.warning : theme.text }]}
          accessibilityLabel={timer.finished ? "Time's up" : `${formatClock(timer.remainingSeconds)} left`}>
          {timer.finished ? "Time's up" : formatClock(timer.remainingSeconds)}
        </ThemedText>
        <View style={styles.timerButtons}>
          {timer.finished ? (
            <Button label="Reset" variant="secondary" onPress={timer.reset} />
          ) : (
            <Button
              label={timer.running ? 'Pause' : timer.remainingSeconds === TASK2_MINUTES * 60 ? 'Start timer' : 'Resume'}
              variant="secondary"
              onPress={timer.running ? timer.pause : timer.start}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.photoButtons}>
          <Button
            label={reading ? 'Reading your photo…' : 'Take a photo'}
            variant="secondary"
            disabled={reading || busy}
            onPress={() => scan('camera')}
            style={styles.photoButton}
          />
          <Button
            label="Choose a photo"
            variant="secondary"
            disabled={reading || busy}
            onPress={() => scan('library')}
            style={styles.photoButton}
          />
        </View>
        <MarkedTextInput
          value={text}
          onChangeText={changeText}
          placeholder="Write your essay here, or take a photo of your handwriting…"
          accessibilityLabel="Your essay"
          anchors={marks?.anchors ?? []}
          originalLength={marks?.length ?? text.length}
        />
        <View style={styles.row}>
          <ThemedText type="small">
            <ThemedText type="smallBold">{words}</ThemedText> words
          </ThemedText>
          <ThemedText type="small" style={{ color: words >= minWords ? theme.textSecondary : theme.warning }}>
            {words >= minWords ? `Over ${minWords}: well done` : `${minWords - words} more to reach ${minWords}`}
          </ThemedText>
        </View>
        <ProgressBar fraction={words / minWords} />
        <ThemedText type="small" themeColor="textSecondary">
          Under {minWords} words loses one band on Task Response.
          {marks && marks.anchors.length > 0 ? ' Orange lines show the mistakes from your last feedback.' : ''}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <Button
          label={busy ? 'Marking your essay…' : 'Get my band scores'}
          disabled={busy || problem !== null}
          onPress={submit}
        />
        {problem && !busy && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {problem}
          </ThemedText>
        )}
        {error && (
          <ThemedText type="small" themeColor="warning" style={styles.centered}>
            {error}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Your essay is marked by an AI (Claude) and is not saved on our server. Your draft is kept on
          this device only.
        </ThemedText>
        {back}
      </View>
    </Screen>
  );
}

function IeltsFeedbackView({
  response,
  text,
  prompt,
  onImprove,
}: {
  response: IeltsResponse;
  text: string;
  prompt: WritingPrompt;
  onImprove: () => void;
}) {
  const theme = useTheme();
  const f = response.feedback;
  const marked = markCorrections(text, f.corrections, f.paragraphing.new_paragraph_before);
  const [open, setOpen] = useState(f.criteria[0]?.code ?? null);
  const openCriterion = f.criteria.find((c) => c.code === open) ?? null;
  const onTarget = f.target_band !== null && f.overall_band >= f.target_band;

  return (
    <Screen>
      <View style={[styles.bandCard, { backgroundColor: theme.hero }]}>
        <View style={styles.bandHalf}>
          <ThemedText type="smallBold" style={[styles.bandLabel, { color: theme.onHeroMuted }]}>
            OVERALL BAND
          </ThemedText>
          <ThemedText style={[styles.bandValue, { color: theme.onHero }]}>{formatBand(f.overall_band)}</ThemedText>
        </View>
        {f.target_band !== null && (
          <>
            <View style={[styles.bandDivider, { backgroundColor: theme.onHeroMuted }]} />
            <View style={styles.bandHalf}>
              <ThemedText type="smallBold" style={[styles.bandLabel, { color: theme.onHeroMuted }]}>
                YOUR TARGET
              </ThemedText>
              <ThemedText style={[styles.targetBig, { color: theme.onHero }]}>{formatBand(f.target_band)}</ThemedText>
              <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                {onTarget ? 'On target' : `${formatBand(f.target_band - f.overall_band)} to go`}
              </ThemedText>
            </View>
          </>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {f.word_count} words
        {prompt.essayType ? ` · ${ESSAY_TYPE_NAMES[prompt.essayType]} essay` : ''} · {prompt.topic}
        {f.length_penalty_applied ? ` · under ${f.min_words} words: Task Response lowered by 1` : ''}
      </ThemedText>

      <View style={styles.tiles}>
        {f.criteria.map((c) => {
          const selected = c.code === open;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="button"
              accessibilityState={{ expanded: selected }}
              accessibilityLabel={`${c.criterion}, band ${c.band}`}
              onPress={() => setOpen(c.code)}
              style={[
                styles.tile,
                {
                  backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                  borderColor: selected ? theme.accent : 'transparent',
                },
              ]}>
              <ThemedText type="smallBold">{CRITERION_SHORT[c.code]}</ThemedText>
              <ThemedText style={styles.tileBand}>{c.band}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      {openCriterion && (
        <View style={[styles.detail, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.grammarLabel }}>
            {openCriterion.criterion.toUpperCase()} · BAND {openCriterion.band}
            {openCriterion.band !== openCriterion.band_before_length ? ` (${openCriterion.band_before_length} before the word-count rule)` : ''}
          </ThemedText>
          <ThemedText style={{ color: theme.grammarText }}>{openCriterion.comment}</ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.grammarText }}>
            {openCriterion.band >= 9 ? 'Keeping band 9' : `To reach band ${openCriterion.band + 1}`}
          </ThemedText>
          <ThemedText style={{ color: theme.grammarText }}>{openCriterion.next_band}</ThemedText>
        </View>
      )}

      <ThemedText style={styles.summary}>{f.summary}</ThemedText>

      {f.task_check.parts.length > 0 && (
        <Section title="Did you answer the whole question?">
          <ThemedView type="backgroundElement" style={styles.card}>
            {f.task_check.parts.map((p, i) => (
              <View key={i} style={styles.row}>
                <ThemedText style={styles.flexText}>{p.part}</ThemedText>
                <ThemedText type="smallBold" style={{ color: p.covered === 'fully' ? theme.accent : theme.warning }}>
                  {p.covered === 'fully' ? 'Fully' : p.covered === 'partly' ? 'Partly' : 'Not yet'}
                </ThemedText>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              {f.task_check.position_comment}
            </ThemedText>
          </ThemedView>
        </Section>
      )}

      {f.to_reach_target.length > 0 && (
        <Section title="Your next steps">
          {f.to_reach_target.map((s, i) => (
            <NumberedCard key={i} number={i + 1} color={theme.hero}>
              <ThemedText>{s}</ThemedText>
            </NumberedCard>
          ))}
        </Section>
      )}

      {f.strengths.length > 0 && (
        <Section title="What you did well">
          {f.strengths.map((s, i) => (
            <Bullet key={i} text={s} />
          ))}
        </Section>
      )}

      <MarkedWriting marked={marked} title="Your essay" />
      <CorrectionNotes marked={marked} />
      {f.paragraphing.comment ? <ParagraphNote comment={f.paragraphing.comment} /> : null}

      <View style={styles.section}>
        <Button label="Improve this essay" onPress={onImprove} />
        <Button label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          AI band scores are a guide, not an official IELTS result.{' '}
          {response.remainingToday === 1
            ? '1 feedback check left today.'
            : `${response.remainingToday} feedback checks left today.`}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  target: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  targetLabel: {
    fontSize: 11,
    letterSpacing: 1,
  },
  targetValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  caps: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  question: {
    fontSize: 17,
    lineHeight: 25,
  },
  bold: {
    fontWeight: 700,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  clock: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  timerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoButton: {
    flexGrow: 1,
    flexBasis: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  flexText: {
    flexShrink: 1,
  },
  centered: {
    textAlign: 'center',
  },
  bandCard: {
    flexDirection: 'row',
    padding: Spacing.four,
    borderRadius: 24,
    gap: Spacing.three,
  },
  bandHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  bandDivider: {
    width: 1,
    opacity: 0.4,
  },
  bandLabel: {
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  bandValue: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: 800,
  },
  targetBig: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 88,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    gap: Spacing.one,
  },
  tileBand: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 800,
  },
  detail: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  summary: {
    fontSize: 18,
    lineHeight: 26,
  },
});
