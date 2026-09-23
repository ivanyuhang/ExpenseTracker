import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PreferencesProvider, usePreferences } from '@/features/expense-tracker/preferences';

export default function RootLayout() {
  return <PreferencesProvider><ThemedLayout /></PreferencesProvider>;
}

function ThemedLayout() {
  const { isDark } = usePreferences();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
