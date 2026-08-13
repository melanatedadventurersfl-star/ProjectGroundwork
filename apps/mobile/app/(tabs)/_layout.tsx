import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';

const tabIcons = {
  index: '⌂',
  explore: '◇',
  community: '◎',
  passport: '▤',
  menu: '≡',
} as const;

function TabGlyph({ glyph, color, size }: { glyph: string; color: ColorValue; size: number }) {
  return (
    <Text
      style={{
        color,
        fontSize: Math.max(21, size - 1),
        fontWeight: '300',
        lineHeight: Math.max(23, size + 1),
      }}
    >
      {glyph}
    </Text>
  );
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
        tabBarInactiveTintColor: '#9DA8A1',
        tabBarStyle: {
          backgroundColor: '#121B16',
          borderTopColor: '#26332B',
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarItemStyle: { paddingVertical: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trailhead', tabBarIcon: ({ color, size }) => <TabGlyph glyph={tabIcons.index} color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color, size }) => <TabGlyph glyph={tabIcons.explore} color={color} size={size} /> }} />
      <Tabs.Screen name="community" options={{ title: 'Groups', tabBarIcon: ({ color, size }) => <TabGlyph glyph={tabIcons.community} color={color} size={size} /> }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport', tabBarIcon: ({ color, size }) => <TabGlyph glyph={tabIcons.passport} color={color} size={size} /> }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu', tabBarIcon: ({ color, size }) => <TabGlyph glyph={tabIcons.menu} color={color} size={size} /> }} />
    </Tabs>
  );
}
