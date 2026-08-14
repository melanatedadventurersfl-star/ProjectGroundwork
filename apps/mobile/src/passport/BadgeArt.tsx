import { Image, StyleSheet, View } from 'react-native';

const badgeAssets = {
  'first-adventure': require('../../assets/badges/first-adventure.jpg'),
  'three-adventures': require('../../assets/badges/trail-regular.jpg'),
  'five-adventures': require('../../assets/badges/wayfinder-five.jpg'),
  'ten-adventures': require('../../assets/badges/summit-ten.jpg'),
  'twenty-adventures': require('../../assets/badges/legacy-twenty.jpg'),
  'camp-crew': require('../../assets/badges/camp-crew.jpg'),
  'water-wayfinder': require('../../assets/badges/water-wayfinder.jpg'),
} as const;

export type PremiumBadgeCode = keyof typeof badgeAssets;

export function isPremiumBadgeCode(code: string | null): code is PremiumBadgeCode {
  return !!code && code in badgeAssets;
}

export function BadgeArt({ code, size = 136 }: { code: PremiumBadgeCode; size?: number }) {
  return (
    <View style={[styles.shell, { width: size, height: size }]}>
      <Image source={badgeAssets[code]} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
