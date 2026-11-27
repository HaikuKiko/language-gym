import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';

/** Shown while the app gets ready, so a phone never shows a blank page. */
export function AppLoading({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.fill}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText themeColor="textSecondary">{label}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
});
