import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BusyOverlay } from '@/components/busy-overlay';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IeltsFeedbackView } from '@/components/ielts-feedback';
import { JoinCourse } from '@/components/join-course';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WritingBox } from '@/components/writing-box';
import { Spacing } from '@/constants/theme';
import { formatClock, useCountdown } from '@/hooks/use-countdown';
import { useSavedState } from '@/hooks/use-saved-state';
import { useTheme } from '@/hooks/use-theme';
import { useWritingDraft } from '@/hooks/use-writing-draft';
import { loadAccount, type Account } from '@/lib/account';
import {
  ESSAY_TYPE_NAMES,
  IELTS_HARD_MIN_WORDS,
  IELTS_MAX_WORDS,
  TASK2_MINUTES,
  loadAssignedPrompts,
  requestIeltsFeedback,
  type IeltsResponse,
  type WritingPrompt,
} from '@/lib/ielts';
import { errorMessage } from '@/lib/supabase';
import { countWords, writingProblem } from '@/lib/writing';

const draftKey = (promptId: number) => `ielts-draft-${promptId}`;

/** IELTS Writing Task 2: the teacher's question, a 40-minute timer and band scores. */
export default function IeltsRoute() {
  const theme = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [prompts, setPrompts] = useState<WritingPrompt[] | null>(null);
  const [promptId, setPromptId] = useSavedState<number | null>('ielts:promptId', null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useSavedState<IeltsResponse | null>('ielts:result', null);
  // Each change is also kept as a draft for this question, so a closed tab
  // doesn't lose 40 minutes' work.
  const draft = useWritingDraft('ielts', {
    onError: setError,
    onTextChange: (next) => {
      if (promptId !== null) AsyncStorage.setItem(draftKey(promptId), next).catch(() => {});
    },
  });
  const text = draft.text;
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

  const lastPromptId = useRef(promptId);

  // Keep a draft on this device, so a closed tab doesn't lose 40 minutes' work.
  useEffect(() => {
    if (promptId === null) return;
    let cancelled = false;
    AsyncStorage.getItem(draftKey(promptId))
      .then((saved) => {
        if (!cancelled) draft.setText(saved ?? '');
      })
      .catch(() => {});
    // A different question: the old underlines no longer apply. (Not after a
    // refresh, when the same question and its feedback are restored.)
    if (lastPromptId.current !== promptId) draft.setMarks(null);
    lastPromptId.current = promptId;
    return () => {
      cancelled = true;
    };
    // Only when the question changes; draft is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptId]);

  const prompt = prompts?.find((p) => p.id === promptId) ?? null;
  const enrolment = account?.enrolments.find((e) => e.trackId === 'ielts') ?? null;
  const words = countWords(text);
  const minWords = prompt?.minWords ?? 250;

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
        subtitle={`${prompt.essayType ? `${ESSAY_TYPE_NAMES[prompt.essayType]} essay · ` : ''}${prompt.topic}`}
        onImprove={() => setResult(null)}
      />
    );
  }

  const problem = writingProblem(text, { minWords: IELTS_HARD_MIN_WORDS, maxWords: IELTS_MAX_WORDS });

  async function submit() {
    if (!prompt) return;
    setBusy(true);
    setError(null);
    try {
      const response = await requestIeltsFeedback(prompt.id, text);
      timer.pause();
      setResult(response);
      draft.showMistakes(response.feedback.corrections);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
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
        <WritingBox
          draft={draft}
          disabled={busy}
          placeholder="Write your essay here, or take a photo of your handwriting…"
          label="Your essay">
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
          </ThemedText>
        </WritingBox>
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
      <BusyOverlay visible={draft.reading} title="Reading your handwriting…" detail="This usually takes 10 to 20 seconds." />
      <BusyOverlay visible={busy} title="Marking your essay…" detail="This usually takes 20 to 40 seconds." />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
});
