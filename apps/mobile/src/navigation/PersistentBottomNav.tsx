import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '../ui/AppIcon';

type NavItem = {
  label: string;
  icon: AppIconName;
  href: string;
  isActive: (pathname: string) => boolean;
};

const items: NavItem[] = [
  {
    label: 'Trailhead',
    icon: 'trailhead',
    href: '/(tabs)',
    isActive: (pathname) => pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/',
  },
  {
    label: 'Explore',
    icon: 'explore',
    href: '/(tabs)/explore',
    isActive: (pathname) => pathname.includes('/explore') || pathname.startsWith('/adventures') || pathname.startsWith('/checkout') || pathname.startsWith('/readiness'),
  },
  {
    label: 'Outpost',
    icon: 'community',
    href: '/(tabs)/community',
    isActive: (pathname) => pathname.includes('/community') || pathname.startsWith('/connections') || pathname.startsWith('/local-events'),
  },
  {
    label: 'Passport',
    icon: 'passport',
    href: '/(tabs)/passport',
    isActive: (pathname) => pathname.includes('/passport'),
  },
  {
    label: 'Menu',
    icon: 'menu',
    href: '/(tabs)/menu',
    isActive: (pathname) => pathname.includes('/menu') || pathname.startsWith('/member') || pathname.startsWith('/notifications') || pathname.startsWith('/guide') || pathname.startsWith('/about') || pathname.startsWith('/host'),
  },
];

export function PersistentBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {items.map((item) => {
        const active = item.isActive(pathname);
        const color = active ? '#D7B45A' : '#E7DFCF';
        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => router.navigate(item.href as never)}
            style={styles.item}
          >
            <AppIcon name={item.icon} color={color} size={24} />
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 60,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#121B16',
    borderTopWidth: 1,
    borderTopColor: '#26332B',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    gap: 2,
  },
  label: {
    color: '#E7DFCF',
    fontSize: 10,
    fontWeight: '700',
  },
  labelActive: {
    color: '#D7B45A',
  },
});
