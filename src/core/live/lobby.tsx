/**
 * The waiting room before an activity starts (Live classroom kit): the
 * teacher's list of students and Start/Cancel buttons, and the student's
 * "You're in" screen.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/core/ui/avatar';
import { Button } from '@/core/ui/button';
import { ErrorNote } from '@/core/ui/notice';
import { Pill } from '@/core/ui/pill';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import type { LiveParticipant } from '@/core/live/session';

/** Fewer students than this and the activity can't start. */
export const MIN_STUDENTS = 2;

/** The teacher's list of students who have joined; tap a name to remove it. */
export function StudentRoster({
  participants,
  onRemove,
}: {
  participants: LiveParticipant[];
  onRemove: (participant: LiveParticipant) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold">Students</ThemedText>
        <Pill label={String(participants.length)} tone="accent" />
      </View>
      {participants.length === 0 ? (
        <View style={[styles.empty, { borderColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            Waiting for students to join…
          </ThemedText>
        </View>
      ) : (
        <View style={styles.chips}>
          {participants.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${p.name}`}
              onPress={() => onRemove(p)}
              style={({ pressed }) => [styles.student, { backgroundColor: theme.background }, pressed && styles.pressed]}>
              <Avatar id={p.id} name={p.name} size={28} />
              <ThemedText type="small">{p.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ✕
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </ThemedView>
  );
}

/** Start and Cancel, under the waiting room. Start needs at least MIN_STUDENTS. */
export function LobbyButtons({
  studentCount,
  startLabel,
  cancelLabel,
  onStart,
  onCancel,
  error,
}: {
  studentCount: number;
  startLabel: string;
  cancelLabel: string;
  onStart: () => void;
  onCancel: () => void;
  error?: string | null;
}) {
  const tooFew = studentCount < MIN_STUDENTS;
  return (
    <View style={styles.section}>
      <Button label={startLabel} disabled={tooFew} onPress={onStart} />
      {tooFew && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          At least two students need to join before you can start.
        </ThemedText>
      )}
      <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
      <ErrorNote message={error} />
    </View>
  );
}

/** A student's phone before the start: "You're in", how many have joined, and Leave. */
export function StudentLobby({
  name,
  studentCount,
  intro,
  leaveLabel,
  onLeave,
}: {
  name: string;
  studentCount: number;
  /** A line about the activity, e.g. "We're playing Hot Seat." */
  intro?: ReactNode;
  leaveLabel: string;
  onLeave: () => void;
}) {
  return (
    <Screen>
      <View style={styles.message}>
        <ThemedText type="subtitle">You&apos;re in, {name}</ThemedText>
        {intro ? <ThemedText themeColor="textSecondary">{intro}</ThemedText> : null}
        <ThemedText themeColor="textSecondary">
          Waiting for your teacher to start. {studentCount} {studentCount === 1 ? 'student has' : 'students have'}{' '}
          joined so far.
        </ThemedText>
      </View>
      <Button label={leaveLabel} variant="secondary" onPress={onLeave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { padding: Spacing.four, borderRadius: Spacing.four, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  empty: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  student: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
    borderRadius: Spacing.four,
    minHeight: 36,
  },
  pressed: { opacity: 0.7 },
  message: { gap: Spacing.two, paddingVertical: Spacing.four },
  centered: { textAlign: 'center' },
});
