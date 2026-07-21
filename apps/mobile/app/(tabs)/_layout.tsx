import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';

export default function TabLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trailhead' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
    </Tabs>
  );
}
