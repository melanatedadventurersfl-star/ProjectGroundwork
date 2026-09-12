import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { getProfileAvatarUrl, subscribeProfileAvatar } from '../member/api';
import {
  experienceLabel,
  experienceModuleEnabled,
  experienceModuleLabel,
  getActiveExperienceContext,
  type ActiveExperienceContext,
} from '../platform/experience';
import { AppIcon, type AppIconName } from '../ui/AppIcon';

type NavItem = {
  label: string;
  moduleCode: string;
  icon: AppIconName;
  href: string;
  requiresAuth?: boolean;
  isActive: (pathname: string) => boolean;
};

const items: NavItem[] = [
  {
    label: 'Trailhead',
    moduleCode: 'home',
    icon: 'trailhead',
    href: '/(tabs)',
    isActive: (pathname) => pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/',
  },
  {
    label: 'Explore',
    moduleCode: 'events',
    icon: 'explore',
    href: '/(tabs)/explore',
    isActive: (pathname) => pathname.includes('/explore') || pathname.startsWith('/adventures') || pathname.startsWith('/checkout') || pathname.startsWith('/readiness'),
  },
  {
    label: 'Outpost',
    moduleCode: 'community',
    icon: 'community',
    href: '/(tabs)/community',
    requiresAuth: true,
    isActive: (pathname) => pathname.includes('/community') || pathname.startsWith('/connections') || pathname.startsWith('/local-events'),
  },
  {
    label: 'Trail Guide',
    moduleCode: 'directory',
    icon: 'guide',
    href: '/trail-guide',
    isActive: (pathname) => pathname.startsWith('/trail-guide'),
  },
  {
    label: 'Profile',
    moduleCode: 'profiles',
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

function configuredLabel(item: NavItem, context: ActiveExperienceContext): string {
  if (item.moduleCode === 'home') return experienceLabel(context.experience, 'home', item.label);
  if (item.moduleCode === 'events') return experienceLabel(context.experience, 'events', item.label);
  if (item.moduleCode === 'community') return experienceLabel(context.experience, 'community', item.label);
  if (item.moduleCode === 'directory') return experienceLabel(context.experience, 'directory', item.label);
  return experienceModuleLabel(context.modules, item.moduleCode, item.label);
}

export function PersistentBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [experienceContext, setExperienceContext] = useState<ActiveExperienceContext | null>(null);

  useEffect(() => {
    if (!userId) {
      setExperienceContext(null);
      return;
    }

    let active = true;
    void getActiveExperienceContext()
      .then((context) => {
        if (active) setExperienceContext(context);
      })
      .catch((error) => {
        console.warn('[experience] Unable to load native member navigation', error);
        if (active) setExperienceContext(null);
      });

    return () => {
      active = false;
    };
  }, [pathname, userId]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeProfileAvatar((nextAvatarUrl) => {
      if (!cancelled) setAvatarUrl(nextAvatarUrl);
    });

    if (!userId) {
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
  }, [userId]);

  if (pathname === '/account-status') return null;

  const visibleItems = session
    ? experienceContext
      ? items
          .filter((item) => experienceModuleEnabled(experienceContext.modules, item.moduleCode, false))
          .map((item) => ({ ...item, label: configuredLabel(item, experienceContext) }))
      : []
    : items;
  const directoryEnabled = !session || Boolean(
    experienceContext && experienceModuleEnabled(experienceContext.modules, 'directory', false),
  );
  const showAskGo = directoryEnabled && pathname.startsWith('/trail-guide') && pathname !== '/trail-guide/ask';

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {showAskGo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Go outdoor guide"
          onPress={() => {
            if (!session) {
              promptForAccount('Ask Go');
              return;
            }
            router.push('/trail-guide/ask' as never);
          }}
          style={({ pressed }) => [styles.askGoButton, pressed && styles.askGoPressed]}
        >
          <Text style={styles.askGoSpark}>✦</Text>
          <Text style={styles.askGoText}>Ask Go</Text>
        </Pressable>
      ) : null}
      <View style={styles.bar}>
        {visibleItems.map((item) => {
          const active = item.isActive(pathname);
          const color = active ? '#D7B45A' : '#E7DFCF';
          const showAvatar = item.moduleCode === 'profiles' && Boolean(session && avatarUrl);
          return (
            <Pressable
              key={item.moduleCode}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
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
                <AppIcon name={item.icon} color={color} size={24} />
              )}
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#121B16',
    borderTopWidth: 1,
    borderTopColor: '#26332B',
  },
  askGoButton: {
    position: 'absolute',
    right: 18,
    top: -50,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#D7B45A',
    borderWidth: 1,
    borderColor: '#F0D27B',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
    zIndex: 20,
  },
  askGoPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  askGoSpark: { color: '#172017', fontSize: 15, fontWeight: '900' },
  askGoText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  bar: {
    minHeight: 60,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
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
    color: '#E7DFCF',
    fontSize: 10,
    fontWeight: '700',
  },
  labelActive: {
    color: '#D7B45A',
  },
});
