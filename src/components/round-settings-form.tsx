import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { ThemedView } from '@/core/ui/themed-view';
import { LEVELS, countForWeek, findQuestions } from '@/data/questions';
import { WEEKS_PER_LEVEL, findWeek } from '@/data/weeks';
import { useCustomSets, useFunQuestions, useQuestions, useWeeks } from '@/hooks/use-questions';
import { FRIENDING_WEEKS, findFunQuestions } from '@/data/fun-questions';
import { uniqueRoundCount } from '@/lib/round-robin';
import { CHANGEOVER_SECONDS, type RoundSettings } from '@/lib/session';

const ROUND_MINUTES = [1, 2, 3, 5, 10];
const MAX_ROUNDS = 20;

type RoundSettingsFormProps = {
  settings: RoundSettings;
  onChange: (changes: Partial<RoundSettings>) => void;
  /** When known, used to say how many rounds fit before partners repeat. */
  studentCount?: number;
  /** Shown under the level picker. */
  levelHint?: string;
  /** Phone sessions: each round starts when every pair has found each other. */
  phones?: boolean;
};

/** Level, week, round length, timer mode and number of rounds. */
export function RoundSettingsForm({
  settings,
  onChange,
  studentCount = 0,
  levelHint,
  phones = false,
}: RoundSettingsFormProps) {
  const { level, week, roundMinutes, roundCount, roundRobin, autoAdvance } = settings;
  const questions = useQuestions();
  const funQuestions = useFunQuestions();
  const customSets = useCustomSets();
  const weeks = useWeeks();
  const plan = findWeek(weeks, level, week);
  const friending = settings.mode === 'friending';
  const custom = friending ? (customSets.find((c) => c.id === settings.customSetId) ?? null) : null;
  const available = friending
    ? findFunQuestions(funQuestions, level, week).length
    : findQuestions(questions, level, week).length;
  const ownQuestions = week === null ? 0 : countForWeek(questions, level, week);
  const uniqueRounds = uniqueRoundCount(studentCount);

  return (
    <>
      <View style={styles.section}>
        <ThemedText type="smallBold">Level</ThemedText>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip
              key={l}
              label={l}
              selected={l === level}
              onPress={() => onChange({ level: l })}
            />
          ))}
        </View>
        {levelHint && (
          <ThemedText type="small" themeColor="textSecondary">
            {levelHint}
          </ThemedText>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Theme</ThemedText>
        <View style={styles.chips}>
          {(friending ? [...FRIENDING_WEEKS] : Array.from({ length: WEEKS_PER_LEVEL }, (_, i) => i + 1)).map((n) => (
            <Chip
              key={n}
              label={findWeek(weeks, level, n)?.topic ?? `Week ${n}`}
              accessibilityLabel={`Week ${n}: ${findWeek(weeks, level, n)?.topic ?? ''}`}
              selected={!custom && n === week}
              onPress={() => onChange({ week: n, customSetId: null })}
            />
          ))}
          <Chip
            label="Any theme"
            selected={!custom && week === null}
            onPress={() => onChange({ week: null, customSetId: null })}
          />
        </View>
        {friending && customSets.length > 0 && (
          <>
            <ThemedText type="smallBold">Custom</ThemedText>
            <View style={styles.chips}>
              {customSets.map((c) => (
                <Chip
                  key={c.id}
                  label={`★ ${c.name}`}
                  accessibilityLabel={`Custom: ${c.name}`}
                  selected={custom?.id === c.id}
                  onPress={() => onChange({ customSetId: c.id, week: null })}
                />
              ))}
            </View>
          </>
        )}
        {custom ? (
          <ThemedView type="backgroundElement" style={styles.plan}>
            <ThemedText type="smallBold">★ {custom.name}</ThemedText>
            {custom.description ? <ThemedText type="small">{custom.description}</ThemedText> : null}
            <ThemedText type="small" themeColor="textSecondary">
              {custom.questions.length} custom {custom.questions.length === 1 ? 'question' : 'questions'}, the same at
              every level. Everyone gets their own question to ask their partner, and a new one each round.
            </ThemedText>
          </ThemedView>
        ) : friending ? (
          <ThemedView type="backgroundElement" style={styles.plan}>
            <ThemedText type="smallBold">
              {level} · {week === null ? 'Any theme' : (plan?.topic ?? `Theme ${week}`)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {available} fun {available === 1 ? 'question' : 'questions'} for getting to know each other, written for{' '}
              {level}. Everyone gets their own question to ask their partner, and a new one each round. No grammar
              point.
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView type="backgroundElement" style={styles.plan}>
            {week === null ? (
              <ThemedText type="smallBold">Any week: all {level} questions</ThemedText>
            ) : (
              <>
                <ThemedText type="smallBold">
                  {level} · Week {week}
                  {plan ? `: ${plan.topic}` : ''}
                </ThemedText>
                {plan?.grammar ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Grammar: {plan.grammar}
                  </ThemedText>
                ) : null}
              </>
            )}
            <ThemedText type="small" themeColor={available === 0 ? 'warning' : 'textSecondary'}>
              {available === 0
                ? `There are no ${level} questions yet.`
                : week !== null && ownQuestions === 0
                  ? `No questions written for this week yet, so all ${available} ${level} questions will be used.`
                  : `${available} ${available === 1 ? 'question' : 'questions'} available.`}
            </ThemedText>
          </ThemedView>
        )}
      </View>

      {friending && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Talking</ThemedText>
          <View style={styles.chips}>
            <Chip label="Take turns" selected={!!settings.takeTurns} onPress={() => onChange({ takeTurns: true })} />
            <Chip
              label="Free conversation"
              selected={!settings.takeTurns}
              onPress={() => onChange({ takeTurns: false })}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {settings.takeTurns
              ? `Each round is split in half: one person asks and the other talks, then they swap. With ${roundMinutes} ${roundMinutes === 1 ? 'minute' : 'minutes'}, each person talks for ${formatHalf(roundMinutes)}.`
              : 'Both partners have a question and take turns as they like.'}
          </ThemedText>
        </View>
      )}

      <View style={styles.section}>
        <ThemedText type="smallBold">Minutes per round</ThemedText>
        <View style={styles.chips}>
          {ROUND_MINUTES.map((m) => (
            <Chip
              key={m}
              label={`${m} min`}
              selected={m === roundMinutes}
              onPress={() => onChange({ roundMinutes: m })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Timer</ThemedText>
        <View style={styles.chips}>
          <Chip
            label="Manual"
            selected={!autoAdvance}
            onPress={() => onChange({ autoAdvance: false })}
          />
          <Chip
            label="Automatic"
            selected={autoAdvance}
            onPress={() => onChange({ autoAdvance: true })}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {phones
            ? autoAdvance
              ? 'The session runs by itself: each round starts as soon as every pair has found each other, and the next round begins when time is up.'
              : 'Students find their partner first; you start each round and move to the next one yourself.'
            : autoAdvance
              ? `The session runs by itself: ${CHANGEOVER_SECONDS} seconds to find a partner, then the round, then straight on to the next one.`
              : 'You start the timer and move to the next round yourself.'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Number of rounds</ThemedText>
        <View style={styles.chips}>
          <Chip
            label="Round robin"
            selected={roundRobin}
            onPress={() => onChange({ roundRobin: true })}
          />
          <Chip
            label="Choose a number"
            selected={!roundRobin}
            onPress={() => onChange({ roundRobin: false })}
          />
        </View>
        {roundRobin ? (
          <ThemedText type="small" themeColor="textSecondary">
            Everyone talks to everyone once.{' '}
            {uniqueRounds > 0
              ? `With ${studentCount} students that is ${uniqueRounds} ${uniqueRounds === 1 ? 'round' : 'rounds'}.`
              : 'The number of rounds is set when you start: one less than the number of students (with an odd number, one group of three each round).'}
          </ThemedText>
        ) : (
        <>
        <View style={styles.row}>
          <Button
            label="−"
            variant="secondary"
            disabled={roundCount <= 1}
            onPress={() => onChange({ roundCount: roundCount - 1 })}
          />
          <ThemedText type="subtitle" style={styles.roundCount}>
            {roundCount}
          </ThemedText>
          <Button
            label="+"
            variant="secondary"
            disabled={roundCount >= MAX_ROUNDS}
            onPress={() => onChange({ roundCount: roundCount + 1 })}
          />
        </View>
        {uniqueRounds > 0 && (
          <ThemedText
            type="small"
            themeColor={roundCount > uniqueRounds ? 'warning' : 'textSecondary'}>
            {roundCount > uniqueRounds
              ? `With ${studentCount} students, partners start repeating after round ${uniqueRounds}.`
              : `With ${studentCount} students, everyone gets a new partner for up to ${uniqueRounds} ${uniqueRounds === 1 ? 'round' : 'rounds'}.`}
          </ThemedText>
        )}
        </>
        )}
      </View>
    </>
  );
}

/** Half a round, in words: "1 minute", "30 seconds", "1½ minutes". */
function formatHalf(minutes: number): string {
  const seconds = (minutes * 60) / 2;
  if (seconds < 60) return `${seconds} seconds`;
  const whole = Math.floor(seconds / 60);
  const half = seconds % 60 >= 30 ? '½' : '';
  return `${whole}${half} ${whole === 1 && !half ? 'minute' : 'minutes'}`;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  plan: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  roundCount: {
    minWidth: 56,
    textAlign: 'center',
  },
});
