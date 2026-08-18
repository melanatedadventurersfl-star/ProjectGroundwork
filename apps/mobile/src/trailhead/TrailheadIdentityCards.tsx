import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';

type Props = {
  groupCount: number;
  currentRank: string;
  journeyCount: number;
  stateCount: number;
  stampCount: number;
  badgeCount: number;
};

function normalizeRank(rank: string): RankName {
  const legacyRankMap: Record<string, RankName> = {
    Wayfinder: 'Adventurer',
    Summiteer: 'Summit Seeker',
    'Legacy Pathfinder': 'Ascendant',
    'Legacy Adventurer': 'Ascendant',
  };

  if (rank in legacyRankMap) return legacyRankMap[rank];

  const currentRanks: RankName[] = ['Explorer', 'Pathfinder', 'Trailblazer', 'Adventurer', 'Summit Seeker', 'Ascendant'];
  return currentRanks.includes(rank as RankName) ? rank as RankName : 'Explorer';
}

export function TrailheadIdentityCards({
  groupCount,
  currentRank,
  journeyCount,
  stateCount,
  stampCount,
  badgeCount,
}: Props) {
  const displayRank = normalizeRank(currentRank);

  return (
    <View style={styles.stack}>
      <View style={styles.shortcuts}>
        <Pressable
          style={[styles.shortcutCard, styles.communityCard]}
          onPress={() => router.push('/(tabs)/community')}
          accessibilityRole="button"
          accessibilityLabel="Open Community"
        >
          <View style={[styles.iconBadge, styles.communityIconBadge]}>
            <AppIcon name="community" color="#D6E7DE" size={20} />
          </View>
          <View style={styles.shortcutCopy}>
            <Text style={styles.eyebrow}>COMMUNITY</Text>
            <Text style={styles.shortcutTitle}>{groupCount ? `${groupCount} joined` : 'Find your people'}</Text>
            <Text style={styles.shortcutMeta}>See what’s happening</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.shortcutCard, styles.passportCard]}
          onPress={() => router.push('/(tabs)/passport')}
          accessibilityRole="button"
          accessibilityLabel="Open Passport"
        >
          <View style={styles.emblemBackdrop} pointerEvents="none">
            <RankEmblem rank={displayRank} size={72} />
          </View>
          <View style={[styles.iconBadge, styles.passportIconBadge]}>
            <AppIcon name="passport" color="#F4D98B" size={20} />
          </View>
          <View style={styles.shortcutCopy}>
            <Text style={styles.eyebrow}>PASSPORT</Text>
            <Text style={styles.shortcutTitle} numberOfLines={1}>{displayRank}</Text>
            <Text style={styles.shortcutMeta}>{stampCount} stamps · {badgeCount} badges</Text>
          </View>
        </Pressable>
      </View>

      <Pressable
        style={styles.journeyCard}
        onPress={() => router.push('/(tabs)/passport')}
        accessibilityRole="button"
        accessibilityLabel="Open your journey"
      >
        <View style={styles.journeyHeader}>
          <View>
            <Text style={styles.eyebrow}>YOUR JOURNEY</Text>
            <Text style={styles.journeyTitle}>{journeyCount ? 'Your trail is taking shape.' : 'Your trail starts here.'}</Text>
          </View>
          <View style={styles.journeyIcon}>
            <AppIcon name="guide" color="#D7B45A" size={20} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.stat}>{journeyCount}</Text>
            <Text style={styles.statLabel}>Adventures</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.stat}>{stateCount}</Text>
            <Text style={styles.statLabel}>States</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.stat}>{groupCount}</Text>
            <Text style={styles.statLabel}>Communities</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcutCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  communityCard: { backgroundColor: '#193329', borderColor: '#36584A' },
  passportCard: { backgroundColor: '#342B1D', borderColor: '#6B5934' },
  iconBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  communityIconBadge: { backgroundColor: 'rgba(118,164,143,0.12)', borderColor: 'rgba(155,201,180,0.28)' },
  passportIconBadge: { backgroundColor: 'rgba(215,180,90,0.10)', borderColor: 'rgba(215,180,90,0.30)' },
  shortcutCopy: { gap: 3, zIndex: 2, paddingRight: 8 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  shortcutTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 19, fontWeight: '900' },
  shortcutMeta: { color: '#AEBAB3', fontSize: 11, lineHeight: 15 },
  emblemBackdrop: { position: 'absolute', right: -14, top: 19, opacity: 0.24, transform: [{ rotate: '-7deg' }] },
  journeyCard: { backgroundColor: '#18261F', borderRadius: 20, borderWidth: 1, borderColor: '#3A4D42', padding: 15 },
  journeyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  journeyTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 4 },
  journeyIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(215,180,90,0.24)', backgroundColor: 'rgba(215,180,90,0.07)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingVertical: 9, paddingHorizontal: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.025)' },
  statBlock: { flex: 1, alignItems: 'center' },
  stat: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#8F9C94', fontSize: 9, marginTop: 1, fontWeight: '700' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(148,164,154,0.16)' },
});
