import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';

/** A boxed message: "info" (blue) or "danger" (orange, for warnings). */
export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'danger' }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.notice,
        tone === 'danger'
          ? { backgroundColor: theme.markABg, borderColor: theme.warning }
          : { backgroundColor: theme.accentSoft, borderColor: theme.border },
      ]}>
      <ThemedText type="small" themeColor={tone === 'danger' ? 'markA' : 'text'}>
        {text}
      </ThemedText>
    </View>
  );
}

/** A short red line under a button when something went wrong; nothing when there is no message. */
export function ErrorNote({ message, align = 'center' }: { message: string | null | undefined; align?: 'center' | 'left' }) {
  if (!message) return null;
  return (
    <ThemedText type="small" themeColor="warning" style={align === 'center' ? styles.centered : undefined}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.two },
  centered: { textAlign: 'center' },
});
