import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { adventureBadgeDataUris } from './AdventureBadgeDataUris';
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
  | 'Conversation Starter'
  | 'First Post'
  | 'Community Connector'
  | 'Helping Hand'
  | 'Local Explorer'
  | 'Adventure Companion'
  | 'Community Builder'
  | 'Trusted Host'
  | 'Trail Guide'
  | 'Founding Member';

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

  // Community badge artwork lives in apps/mobile/assets/badges/community.
  'Group Explorer': require('../../assets/badges/community/group_explorer.png'),
  'Conversation Starter': require('../../assets/badges/community/conversation_starter.png'),
  // Keep the legacy title working for members who already earned First Post.
  'First Post': require('../../assets/badges/community/conversation_starter.png'),
  'Community Connector': require('../../assets/badges/community/community_connector.png'),
  'Helping Hand': require('../../assets/badges/community/helping_hand.png'),
  'Local Explorer': require('../../assets/badges/community/local_explorer.png'),
  'Adventure Companion': require('../../assets/badges/community/adventure_companion.png'),
  'Community Builder': require('../../assets/badges/community/community_builder.png'),
  'Trusted Host': require('../../assets/badges/community/trusted_host.png'),
  'Trail Guide': require('../../assets/badges/community/trail_guide.jpg'),
  'Founding Member': require('../../assets/badges/community/founding_member.png'),
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
