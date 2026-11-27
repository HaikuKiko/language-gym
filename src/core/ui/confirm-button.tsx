import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';

/**
 * A button with an "Are you sure?" step: the first tap shows the question and
 * Yes / No. "danger" (e.g. deleting) has an orange border; "careful" (e.g.
 * something that uses up checks) a soft orange box.
 */
export function ConfirmButton({
  label,
  busyLabel,
  busy = false,
  disabled = false,
  title,
  detail,
  yesLabel,
  noLabel = 'Cancel',
  tone = 'careful',
  onConfirm,
}: {
  label: string;
  /** Shown on the button while the action runs. */
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  /** The question, in bold (optional). */
  title?: string;
  /** What will happen. */
  detail: ReactNode;
  yesLabel: string;
  noLabel?: string;
  tone?: 'danger' | 'careful';
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        label={busy && busyLabel ? busyLabel : label}
        variant="secondary"
        disabled={disabled || busy}
        onPress={() => setAsking(true)}
      />
    );
  }
  return (
    <View
      style={[
        styles.box,
        tone === 'danger' ? [styles.danger, { borderColor: theme.warning }] : { backgroundColor: theme.markABg },
      ]}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      <ThemedText type="small" themeColor={tone === 'danger' ? 'textSecondary' : undefined}>
        {detail}
      </ThemedText>
      <Button
        label={yesLabel}
        onPress={() => {
          setAsking(false);
          onConfirm();
        }}
      />
      <Button label={noLabel} variant="secondary" onPress={() => setAsking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  danger: { borderWidth: 2 },
});
