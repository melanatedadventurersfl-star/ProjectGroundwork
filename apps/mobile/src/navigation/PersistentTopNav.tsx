import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { getUnreadNotificationCount } from '../notifications/api';
import { AppIcon } from '../ui/AppIcon';
import { horizontalGutter, layout } from '../ui/layout';

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
  const { width } = useWindowDimensions();
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

  const notificationLabel = unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications';
  const gutter = horizontalGutter(width);

  return (
    <View style={[styles.shell, { paddingTop: Math.max(insets.top, 8), paddingHorizontal: gutter }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Melanated home" onPress={() => router.navigate('/(tabs)' as never)} hitSlop={8} style={styles.logoButton}>
          <Image source={require('../../assets/ma-app-icon.png')} style={styles.logo} resizeMode="cover" />
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notificationLabel}
            onPress={() => session ? router.navigate('/notifications' as never) : promptForAccount('Notifications')}
            style={styles.iconButton}
          >
            <AppIcon name="notifications" color="#F6F4EE" size={21} />
            {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Menu"
            onPress={() => session ? router.navigate('/(tabs)/menu' as never) : promptForAccount('Menu')}
            style={styles.iconButton}
          >
            <AppIcon name="menu" color="#F6F4EE" size={21} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: '#0F1713', borderBottomWidth: 1, borderBottomColor: '#243129' },
  bar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoButton: { width: layout.navTouchTarget, height: layout.navTouchTarget, alignItems: 'flex-start', justifyContent: 'center' },
  logo: { width: 40, height: 40, borderRadius: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: layout.navTouchTarget, height: layout.navTouchTarget, borderRadius: layout.navTouchTarget / 2, borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D3A94F', borderWidth: 2, borderColor: '#0F1713' },
  badgeText: { color: '#0F1713', fontSize: 9, lineHeight: 11, fontWeight: '900' },
});
