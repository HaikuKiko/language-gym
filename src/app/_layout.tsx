import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AppLoading } from '@/core/ui/app-loading';
import { PRODUCT_NAME } from '@/constants/product';
import { QuestionsProvider } from '@/hooks/use-questions';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QuestionsProvider loading={<AppLoading />}>
        <Stack screenOptions={{ headerShown: false, title: PRODUCT_NAME }} />
      </QuestionsProvider>
    </ThemeProvider>
  );
}

// Anything that goes wrong while showing a page is caught here instead of a blank white screen.
export { ErrorBoundary } from '@/core/app/error-boundary';
