import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

function TabIcon({ name, color, size }: { name: AppIconName; color: ColorValue; size: number }) {
  return <AppIcon name={name} color={color} size={Math.max(22, size)} />;
}

export default function TabLayout() {
  const { session, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: '#D7B45A',
        tabBarInactiveTintColor: '#E7DFCF',
        tabBarStyle: {
          backgroundColor: '#121B16',
          borderTopColor: '#26332B',
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarItemStyle: { paddingVertical: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trailhead', tabBarIcon: ({ color, size }) => <TabIcon name="trailhead" color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color, size }) => <TabIcon name="explore" color={color} size={size} /> }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color, size }) => <TabIcon name="community" color={color} size={size} /> }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport', tabBarIcon: ({ color, size }) => <TabIcon name="passport" color={color} size={size} /> }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu', tabBarIcon: ({ color, size }) => <TabIcon name="menu" color={color} size={size} /> }} />
    </Tabs>
  );
}
