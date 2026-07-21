import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
