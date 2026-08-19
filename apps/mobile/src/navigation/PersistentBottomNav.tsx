import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { getProfileAvatarUrl, subscribeProfileAvatar } from '../member/api';
import { AppIcon, type AppIconName } from '../ui/AppIcon';
import { layout } from '../ui/layout';

type NavItem = {
  label: string;
  icon: AppIconName;
  href: string;
  requiresAuth?: boolean;
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
    isActive: (pathname) => pathname.includes('/explore') || pathname.startsWith('/adventures') || pathname.startsWith('/checkout') || pathname.startsWith('/readiness') || pathname.startsWith('/trail-guide'),
  },
  {
    label: 'Outpost',
    icon: 'community',
    href: '/(tabs)/community',
    requiresAuth: true,
    isActive: (pathname) => pathname.includes('/community') || pathname.startsWith('/connections') || pathname.startsWith('/local-events'),
  },
  {
    label: 'Reservations',
    icon: 'trips',
    href: '/member/trips',
    requiresAuth: true,
    isActive: (pathname) => pathname.startsWith('/member/trips') || pathname.startsWith('/readiness'),
  },
  {
    label: 'Profile',
    icon: 'profile',
    href: '/member/profile',
    requiresAuth: true,
    isActive: (pathname) => pathname.startsWith('/member/profile') || pathname.startsWith('/member/stamps') || pathname.startsWith('/member/badges') || pathname.startsWith('/past-adventures') || pathname.startsWith('/passport'),
  },
];

function promptForAccount(destination: string) {
  Alert.alert(
    'Sign in to continue',
    `${destination} is part of your member experience. Sign in or create an account to continue.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Create account', onPress: () => router.push('/(auth)/sign-up' as never) },
      { text: 'Sign in', onPress: () => router.push('/(auth)/sign-in' as never) },
    ],
  );
}

export function PersistentBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const compact = width < layout.compactBreakpoint;

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeProfileAvatar((nextAvatarUrl) => {
      if (!cancelled) setAvatarUrl(nextAvatarUrl);
    });

    if (!session) {
      setAvatarUrl(null);
    } else {
      getProfileAvatarUrl()
        .then((nextAvatarUrl) => {
          if (!cancelled) setAvatarUrl(nextAvatarUrl);
        })
        .catch(() => {
          if (!cancelled) setAvatarUrl(null);
        });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session?.user.id]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {items.map((item) => {
        const active = item.isActive(pathname);
        const color = active ? '#D7B45A' : '#E7DFCF';
        const showAvatar = item.label === 'Profile' && Boolean(session && avatarUrl);
        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            hitSlop={2}
            onPress={() => {
              if (item.requiresAuth && !session) {
                promptForAccount(item.label);
                return;
              }
              router.navigate(item.href as never);
            }}
            style={styles.item}
          >
            {showAvatar ? (
              <View style={[styles.avatarFrame, active && styles.avatarFrameActive]}>
                <Image source={{ uri: avatarUrl! }} style={styles.avatar} resizeMode="cover" />
              </View>
            ) : (
              <AppIcon name={item.icon} color={color} size={compact ? 22 : 24} />
            )}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 64,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#121B16',
    borderTopWidth: 1,
    borderTopColor: '#26332B',
  },
  item: {
    minWidth: 0,
    minHeight: layout.navTouchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
  },
  avatarFrame: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#E7DFCF',
    overflow: 'hidden',
  },
  avatarFrameActive: {
    borderColor: '#D7B45A',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  label: {
    maxWidth: '100%',
    color: '#E7DFCF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 9.5,
  },
  labelActive: {
    color: '#D7B45A',
  },
});
