import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { PRODUCT_NAME } from '@/constants/product';
import { QuestionsProvider } from '@/hooks/use-questions';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QuestionsProvider>
        <Stack screenOptions={{ headerShown: false, title: PRODUCT_NAME }} />
      </QuestionsProvider>
    </ThemeProvider>
  );
}
