import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { tenureBadgeDataUris } from './TenureBadgeDataUris';

export type BadgeArtName =
  | 'Trailhead'
  | 'Year 1'
  | 'Year 2'
  | 'Year 3'
  | 'Year 4'
  | 'Year 5'
  | 'First Adventure'
  | 'Trail Regular'
  | 'Wayfinder Five'
  | 'Summit Ten'
  | 'Legacy Twenty'
  | 'Camp Crew'
  | 'Water Wayfinder';

const badgeAssets: Record<BadgeArtName, ImageSourcePropType> = {
  Trailhead: require('../../assets/badges/trailhead.png'),
  'Year 1': require('../../assets/badges/year-1.png'),
  'Year 2': require('../../assets/badges/year-2.png'),
  'Year 3': { uri: tenureBadgeDataUris['Year 3'] },
  'Year 4': { uri: tenureBadgeDataUris['Year 4'] },
  'Year 5': { uri: tenureBadgeDataUris['Year 5'] },
  'First Adventure': require('../../assets/badges/first-adventure.jpg'),
  'Trail Regular': require('../../assets/badges/trail-regular.jpg'),
  'Wayfinder Five': require('../../assets/badges/wayfinder-five.jpg'),
  'Summit Ten': require('../../assets/badges/summit-ten.jpg'),
  'Legacy Twenty': require('../../assets/badges/legacy-twenty.jpg'),
  'Camp Crew': require('../../assets/badges/camp-crew.jpg'),
  'Water Wayfinder': require('../../assets/badges/water-wayfinder.jpg'),
};

const supported = new Set<BadgeArtName>(Object.keys(badgeAssets) as BadgeArtName[]);

export function hasBadgeArt(title: string): title is BadgeArtName {
  return supported.has(title as BadgeArtName);
}

type Props = { title: BadgeArtName; size?: number };

export function BadgeArt({ title, size = 142 }: Props) {
  return (
    <View style={[styles.shell, { width: size, height: size }]}>
      <Image source={badgeAssets[title]} style={styles.image} resizeMode="contain" />
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