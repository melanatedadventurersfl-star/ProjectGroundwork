import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { adventureBadgeDataUris } from './AdventureBadgeDataUris';
import { communityBadgeDataUris } from './CommunityBadgeDataUris';
import { groupExplorerBadgeDataUri } from './GroupExplorerBadgeDataUri';
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
  | 'Water Wayfinder'
  | 'Group Explorer'
  | 'First Post';

const badgeAssets: Record<BadgeArtName, ImageSourcePropType> = {
  Trailhead: require('../../assets/badges/trailhead.png'),
  'Year 1': require('../../assets/badges/year-1.png'),
  'Year 2': require('../../assets/badges/year-2.png'),
  'Year 3': { uri: tenureBadgeDataUris['Year 3'] },
  'Year 4': { uri: tenureBadgeDataUris['Year 4'] },
  'Year 5': { uri: tenureBadgeDataUris['Year 5'] },
  'First Adventure': { uri: adventureBadgeDataUris['First Adventure'] },
  'Trail Regular': { uri: adventureBadgeDataUris['Trail Regular'] },
  'Wayfinder Five': { uri: adventureBadgeDataUris['Wayfinder Five'] },
  'Summit Ten': { uri: adventureBadgeDataUris['Summit Ten'] },
  'Legacy Twenty': { uri: adventureBadgeDataUris['Legacy Twenty'] },
  'Camp Crew': { uri: adventureBadgeDataUris['Camp Crew'] },
  'Water Wayfinder': { uri: adventureBadgeDataUris['Water Wayfinder'] },
  'Group Explorer': { uri: groupExplorerBadgeDataUri },
  'First Post': { uri: communityBadgeDataUris['First Post'] },
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
