import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';

const tabIcons = {
  index: '⛺',
  explore: '🧭',
  community: '🔥',
  passport: '🛂',
  menu: '☰',
} as const;

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
      <Tabs.Screen name="index" options={{ title: 'Trailhead', tabBarIcon: ({ size }) => <Text style={{ fontSize: Math.max(18, size - 2) }}>{tabIcons.index}</Text> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ size }) => <Text style={{ fontSize: Math.max(18, size - 2) }}>{tabIcons.explore}</Text> }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ size }) => <Text style={{ fontSize: Math.max(18, size - 2) }}>{tabIcons.community}</Text> }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport', tabBarIcon: ({ size }) => <Text style={{ fontSize: Math.max(18, size - 2) }}>{tabIcons.passport}</Text> }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu', tabBarIcon: ({ size }) => <Text style={{ fontSize: Math.max(18, size - 2) }}>{tabIcons.menu}</Text> }} />
    </Tabs>
  );
}
