import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WorkoutRootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0D0B' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
