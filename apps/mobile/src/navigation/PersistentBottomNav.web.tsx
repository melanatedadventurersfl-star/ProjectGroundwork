import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppIcon, type AppIconName } from '../ui/AppIcon';

type NavItem = {
  label: string;
  icon: AppIconName;
  href: string;
  isActive: (pathname: string) => boolean;
};

const primaryItems: NavItem[] = [
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
    isActive: (pathname) => pathname.includes('/explore') || pathname.startsWith('/adventures'),
  },
  {
    label: 'Outpost',
    icon: 'community',
    href: '/(tabs)/community',
    isActive: (pathname) => pathname.includes('/community') || pathname.startsWith('/connections') || pathname.startsWith('/local-events'),
  },
  {
    label: 'Trail Guide',
    icon: 'guide',
    href: '/trail-guide',
    isActive: (pathname) => pathname.startsWith('/trail-guide'),
  },
  {
    label: 'Profile',
    icon: 'profile',
    href: '/member/profile',
    isActive: (pathname) => pathname.startsWith('/member') || pathname.startsWith('/passport'),
  },
];

const operationsItems: NavItem[] = [
  {
    label: 'Host Center',
    icon: 'community',
    href: '/host',
    isActive: (pathname) => pathname.startsWith('/host'),
  },
  {
    label: 'Admin',
    icon: 'profile',
    href: '/admin',
    isActive: (pathname) => pathname.startsWith('/admin'),
  },
];

function NavButton({ item, pathname, compact = false }: { item: NavItem; pathname: string; compact?: boolean }) {
  const active = item.isActive(pathname);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => router.navigate(item.href as never)}
      style={({ pressed }) => [
        compact ? styles.compactItem : styles.sideItem,
        active && styles.sideItemActive,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name={item.icon} color={active ? '#D7B45A' : '#E7DFCF'} size={compact ? 22 : 21} />
      <Text style={[compact ? styles.compactLabel : styles.sideLabel, active && styles.activeLabel]}>{item.label}</Text>
    </Pressable>
  );
}

export function PersistentBottomNav() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;

  if (pathname === '/account-status') return null;

  if (!desktop) {
    return (
      <View style={styles.bottomBar}>
        {primaryItems.map((item) => (
          <NavButton key={item.label} item={item} pathname={pathname} compact />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <Text style={styles.brandGo}>GO</Text>
        <Text style={styles.brandMelanated}>MELANATED</Text>
        <Text style={styles.brandTag}>Your outdoor life, in one place.</Text>
      </View>

      <View style={styles.navGroup}>
        {primaryItems.map((item) => (
          <NavButton key={item.label} item={item} pathname={pathname} />
        ))}
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>OPERATIONS</Text>
      <View style={styles.navGroup}>
        {operationsItems.map((item) => (
          <NavButton key={item.label} item={item} pathname={pathname} />
        ))}
      </View>

      <View style={styles.desktopFooter}>
        <Text style={styles.desktopFooterText}>Go Melanated Web</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 248,
    zIndex: 50,
    backgroundColor: '#111A15',
    borderRightWidth: 1,
    borderRightColor: '#26332B',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 18,
  },
  brandBlock: {
    paddingHorizontal: 10,
    paddingBottom: 22,
  },
  brandGo: {
    color: '#D7B45A',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandMelanated: {
    color: '#F1E8D7',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.1,
  },
  brandTag: {
    marginTop: 7,
    color: '#9DA99F',
    fontSize: 11,
    lineHeight: 16,
  },
  navGroup: {
    gap: 5,
  },
  sideItem: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  sideItemActive: {
    backgroundColor: '#1D2A22',
  },
  sideLabel: {
    color: '#E7DFCF',
    fontSize: 14,
    fontWeight: '700',
  },
  activeLabel: {
    color: '#D7B45A',
  },
  pressed: {
    opacity: 0.82,
  },
  divider: {
    height: 1,
    backgroundColor: '#26332B',
    marginVertical: 18,
  },
  sectionLabel: {
    color: '#78857C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    paddingHorizontal: 12,
    marginBottom: 7,
  },
  desktopFooter: {
    marginTop: 'auto',
    paddingHorizontal: 10,
  },
  desktopFooterText: {
    color: '#66736B',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#121B16',
    borderTopWidth: 1,
    borderTopColor: '#26332B',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  compactItem: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  compactLabel: {
    color: '#E7DFCF',
    fontSize: 10,
    fontWeight: '700',
  },
});
