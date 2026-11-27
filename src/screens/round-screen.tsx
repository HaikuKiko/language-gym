import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { GrammarCard } from '@/components/grammar-card';
import { WeekFocus } from '@/components/week-focus';
import { findWeek } from '@/data/weeks';
import { useWeeks } from '@/hooks/use-questions';
import { useTheme } from '@/core/ui/use-theme';
import { Spacing } from '@/core/ui/theme';
import type { Question } from '@/data/questions';
import { formatClock, useCountdown } from '@/core/app/use-countdown';
import { groupsForRound } from '@/lib/round-robin';
import { CHANGEOVER_SECONDS, type Session } from '@/lib/session';

type RoundScreenProps = {
  session: Session;
  /** 0-based. */
  round: number;
  question: Question;
  onChangeQuestion: () => void;
  onNext: () => void;
  onEnd: () => void;
};

export function RoundScreen({
  session,
  round,
  question,
  onChangeQuestion,
  onNext,
  onEnd,
}: RoundScreenProps) {
  const theme = useTheme();
  const auto = session.autoAdvance;
  const [stage, setStage] = useState<'changeover' | 'discussion'>(
    auto ? 'changeover' : 'discussion',
  );
  const groups = groupsForRound(session.participants, round);
  const plan = findWeek(useWeeks(), session.level, session.week);
  const lastRound = round + 1 >= session.roundCount;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">
          Round {round + 1} of {session.roundCount}
        </ThemedText>
        <WeekFocus level={session.level} week={session.week} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
        <ThemedText type="smallBold" style={[styles.bigLabel, { color: theme.grammarLabel }]}>
          EVERYONE&apos;S QUESTION
        </ThemedText>
        <ThemedText style={[styles.question, { color: theme.grammarText }]}>{question.text}</ThemedText>
        {session.questions.length > 1 && (
          <Button
            label="Different question"
            variant="secondary"
            onPress={onChangeQuestion}
            style={styles.changeQuestion}
          />
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" style={styles.bigLabel}>
          PARTNERS
        </ThemedText>
        <View style={styles.groups}>
          {groups.map((group) => (
            <View
              key={group.map((p) => p.id).join('+')}
              style={[styles.group, { backgroundColor: theme.hero }]}>
              <ThemedText style={[styles.groupNames, { color: theme.onHero }]}>
                {group.map((p) => p.name).join('  &  ')}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {stage === 'changeover' ? (
        <TimerPanel
          key="changeover"
          seconds={CHANGEOVER_SECONDS}
          label="Find your partner"
          autoStart
          onFinish={() => setStage('discussion')}
        />
      ) : (
        <TimerPanel
          key="discussion"
          seconds={session.roundMinutes * 60}
          label={auto ? 'Talk' : undefined}
          autoStart={auto}
          onFinish={auto ? onNext : undefined}
        />
      )}

      {plan && <GrammarCard week={plan} />}

      <View style={styles.section}>
        <Button label={lastRound ? 'Finish session' : 'Next round'} onPress={onNext} />
        {!lastRound && <Button label="End session" variant="secondary" onPress={onEnd} />}
      </View>
    </Screen>
  );
}

type TimerPanelProps = {
  seconds: number;
  label?: string;
  autoStart?: boolean;
  onFinish?: () => void;
};

function TimerPanel({ seconds, label, autoStart, onFinish }: TimerPanelProps) {
  const timer = useCountdown(seconds, { autoStart, onFinish });

  return (
    <View style={styles.timer}>
      {label && (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <ThemedText
        accessibilityRole="timer"
        themeColor={timer.finished ? 'warning' : 'text'}
        style={styles.clock}>
        {timer.finished ? "Time's up" : formatClock(timer.remainingSeconds)}
      </ThemedText>
      <View style={styles.row}>
        {!timer.finished && (
          <Button
            label={timer.running ? 'Pause' : autoStart ? 'Resume' : 'Start timer'}
            onPress={timer.running ? timer.pause : timer.start}
          />
        )}
        <Button label="Reset" variant="secondary" onPress={timer.reset} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  bigLabel: {
    letterSpacing: 1.5,
  },
  question: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: 700,
  },
  groupNames: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 700,
    textAlign: 'center',
  },
  changeQuestion: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
  },
  timer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  clock: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  groups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  group: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexGrow: 1,
    flexBasis: 260,
    justifyContent: 'center',
  },
});
