import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { TesterFeedbackButton } from '../feedback/TesterFeedbackButton';
import { getUnreadNotificationCount, subscribeNotificationStateChanges } from '../notifications/api';
import { AppIcon } from '../ui/AppIcon';

function promptForAccount(destination: string) {
  Alert.alert(
    'Sign in to continue',
    `${destination} is available to members. Sign in or create an account to continue.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Create account', onPress: () => router.push('/(auth)/sign-up' as never) },
      { text: 'Sign in', onPress: () => router.push('/(auth)/sign-in' as never) },
    ],
  );
}

export function PersistentTopNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!session) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await getUnreadNotificationCount());
    } catch {
      // Keep navigation usable if the notification count cannot be refreshed.
    }
  }, [session]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [pathname, refreshUnreadCount]);

  useEffect(() => subscribeNotificationStateChanges(() => {
    void refreshUnreadCount();
  }), [refreshUnreadCount]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadCount();
    });
    const interval = setInterval(() => { void refreshUnreadCount(); }, 30_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [refreshUnreadCount]);

  const hasUnreadNotifications = unreadCount > 0;
  const notificationLabel = hasUnreadNotifications
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications';

  if (pathname === '/account-status' || pathname.startsWith('/host') || pathname.startsWith('/vendor')) return null;

  return (
    <View style={[styles.shell, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Melanated home" onPress={() => router.navigate('/(tabs)' as never)} hitSlop={8} style={styles.logoButton}>
          <Image source={require('../../assets/go-melanated-logo-v2.png')} style={styles.logo} resizeMode="contain" />
        </Pressable>

        <View style={styles.actions}>
          <TesterFeedbackButton screenPath={pathname} hidden={!session} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notificationLabel}
            onPress={() => session ? router.navigate('/notifications' as never) : promptForAccount('Notifications')}
            style={({ pressed }) => [
              styles.iconButton,
              hasUnreadNotifications && styles.notificationButtonUnread,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <AppIcon name="notifications" color={hasUnreadNotifications ? '#0F1713' : '#F6F4EE'} size={hasUnreadNotifications ? 23 : 21} />
            {hasUnreadNotifications ? (
              <>
                <View style={styles.unreadAccent} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              </>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Menu"
            onPress={() => session ? router.navigate('/(tabs)/menu' as never) : promptForAccount('Menu')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <AppIcon name="menu" color="#F6F4EE" size={21} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: '#0F1713', borderBottomWidth: 1, borderBottomColor: '#243129', paddingHorizontal: 18 },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoButton: { width: 48, height: 48, alignItems: 'flex-start', justifyContent: 'center' },
  logo: { width: 40, height: 40 },
  actions: { flexDirection: 'row', gap: 9 },
  iconButton: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  iconButtonPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  notificationButtonUnread: {
    backgroundColor: '#D7B45A',
    borderColor: '#F2D685',
    borderWidth: 2,
    shadowColor: '#D7B45A',
    shadowOpacity: 0.38,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  unreadAccent: {
    position: 'absolute',
    left: -4,
    top: 14,
    width: 4,
    height: 11,
    borderRadius: 3,
    backgroundColor: '#F2D685',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -9,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E85D3F',
    borderWidth: 2,
    borderColor: '#0F1713',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '900' },
});