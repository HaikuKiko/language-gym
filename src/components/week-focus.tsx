import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PRODUCT_NAME } from '@/constants/product';
import { Spacing } from '@/constants/theme';
import type { Level } from '@/data/questions';
import { findWeek } from '@/data/weeks';
import { useWeeks } from '@/hooks/use-questions';

type WeekFocusProps = {
  level: Level;
  week: number | null | undefined;
  /** Speed friending: the theme only, with no grammar. */
  friending?: boolean;
  /** Speed friending with a custom question set: its name. */
  customName?: string | null;
};

/** The level, week, topic and grammar focus of a session, in two short lines. */
export function WeekFocus({ level, week, friending = false, customName = null }: WeekFocusProps) {
  const plan = findWeek(useWeeks(), level, week);

  return (
    <View style={styles.focus}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {friending ? `${PRODUCT_NAME} · ${level}` : level}
        {friending
          ? customName
            ? ` · ${customName}`
            : plan
              ? ` · ${plan.topic}`
              : ' · Any theme'
          : week != null
            ? ` · Week ${week}`
            : ''}
        {!friending && plan ? `: ${plan.topic}` : ''}
      </ThemedText>
      {!friending && plan?.grammar ? (
        <ThemedText type="small" themeColor="textSecondary">
          Grammar: {plan.grammar}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  focus: {
    gap: Spacing.half,
  },
});
