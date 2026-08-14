import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '../ui/AppIcon';

export function PersistentTopNav() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.shell, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trailhead"
          onPress={() => router.navigate('/(tabs)' as never)}
          hitSlop={8}
          style={styles.logoButton}
        >
          <Image
            source={require('../../assets/ma-pathfinder-mark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.navigate('/notifications' as never)}
            style={styles.iconButton}
          >
            <AppIcon name="notifications" color="#F6F4EE" size={21} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.navigate('/member/profile' as never)}
            style={styles.iconButton}
          >
            <AppIcon name="profile" color="#F6F4EE" size={21} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#0F1713',
    borderBottomWidth: 1,
    borderBottomColor: '#243129',
    paddingHorizontal: 18,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoButton: {
    width: 48,
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: 46,
    height: 46,
  },
  actions: {
    flexDirection: 'row',
    gap: 9,
  },
  iconButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#405047',
    backgroundColor: '#17211C',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
