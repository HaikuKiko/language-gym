import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Small "Privacy · Keep me posted" links for the public pages. */
export function FooterLinks({ contact = true }: { contact?: boolean }) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
          Privacy
        </ThemedText>
      </Pressable>
      {contact && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            ·
          </ThemedText>
          <Pressable accessibilityRole="link" onPress={() => router.push('/contact')}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
              Contact / keep me posted
            </ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
