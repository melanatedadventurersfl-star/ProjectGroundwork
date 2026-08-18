import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { adventureBadgeDataUris } from './AdventureBadgeDataUris';
import { communityBadgeDataUris } from './CommunityBadgeDataUris';
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

type ImageBadgeArtName = Exclude<BadgeArtName, 'Group Explorer'>;

const badgeAssets: Record<ImageBadgeArtName, ImageSourcePropType> = {
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
  'First Post': { uri: communityBadgeDataUris['First Post'] },
};

const supported = new Set<BadgeArtName>([...Object.keys(badgeAssets), 'Group Explorer'] as BadgeArtName[]);

export function hasBadgeArt(title: string): title is BadgeArtName {
  return supported.has(title as BadgeArtName);
}

type Props = { title: BadgeArtName; size?: number };

function GroupExplorerArt({ size }: { size: number }) {
  return (
    <View style={[styles.groupExplorerShell, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.groupExplorerInner, { width: size * 0.76, height: size * 0.76, borderRadius: size * 0.38 }]}>
        <Text style={[styles.groupExplorerCompass, { fontSize: size * 0.35 }]}>⌖</Text>
        <Text style={[styles.groupExplorerMountain, { fontSize: size * 0.21 }]}>△</Text>
      </View>
    </View>
  );
}

export function BadgeArt({ title, size = 142 }: Props) {
  if (title === 'Group Explorer') {
    return <GroupExplorerArt size={size} />;
  }

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
  groupExplorerShell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171237',
    borderWidth: 3,
    borderColor: '#C8A85B',
  },
  groupExplorerInner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#241B4A',
    borderWidth: 2,
    borderColor: '#7E6EB0',
  },
  groupExplorerCompass: {
    color: '#F0D27B',
    fontWeight: '900',
    lineHeight: undefined,
  },
  groupExplorerMountain: {
    color: '#6CCDBA',
    fontWeight: '900',
    marginTop: -10,
  },
});
