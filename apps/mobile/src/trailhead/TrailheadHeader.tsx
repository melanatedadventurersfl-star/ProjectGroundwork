import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '../ui/AppIcon';

export function TrailheadHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/go-melanated-logo.png')}
          style={styles.brandMark}
          resizeMode="contain"
          accessibilityLabel="Go Melanated"
        />
        <Text style={styles.pageTitle}>TRAILHEAD</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Notifications"
          onPress={() => router.push('/notifications')}
          style={styles.iconButton}
        >
          <AppIcon name="notifications" color="#F6F4EE" size={22} />
        </Pressable>
        <Pressable
          accessibilityLabel="Menu"
          onPress={() => router.push('/menu')}
          style={styles.iconButton}
        >
          <AppIcon name="menu" color="#F6F4EE" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    zIndex: 12,
    minHeight: 58,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandMark: { width: 50, height: 50 },
  pageTitle: {
    color: '#F6F4EE',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2.2,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 1 },
  },
  actions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(246,244,238,0.38)',
    backgroundColor: 'rgba(9,16,13,0.54)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
