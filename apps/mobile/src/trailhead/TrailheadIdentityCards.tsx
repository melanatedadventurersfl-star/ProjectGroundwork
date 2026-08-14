import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommunityPost } from '../community/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';

type Props = {
  communityPost?: CommunityPost;
  groupCount: number;
  currentRank: string;
  journeyCount: number;
  stateCount: number;
  stampCount: number;
  badgeCount: number;
};

function normalizeRank(rank: string): RankName {
  return rank === 'Legacy Adventurer' ? 'Legacy Pathfinder' : rank as RankName;
}

function nextRank(journeyCount: number) {
  if (journeyCount >= 20) return null;
  if (journeyCount >= 10) return { label: 'Legacy Pathfinder', remaining: 20 - journeyCount };
  if (journeyCount >= 5) return { label: 'Summiteer', remaining: 10 - journeyCount };
  if (journeyCount >= 3) return { label: 'Wayfinder', remaining: 5 - journeyCount };
  if (journeyCount >= 1) return { label: 'Trailblazer', remaining: 3 - journeyCount };
  return { label: 'Pathfinder', remaining: 1 };
}

export function TrailheadIdentityCards({
  communityPost,
  groupCount,
  currentRank,
  journeyCount,
  stateCount,
  stampCount,
  badgeCount,
}: Props) {
  const milestone = nextRank(journeyCount);
  const displayRank = normalizeRank(currentRank);
  const communityHeadline = communityPost?.body || (groupCount ? `${groupCount} group${groupCount === 1 ? '' : 's'} joined` : 'Find your people');
  const communityMeta = communityPost
    ? `${communityPost.author_name} · ${communityPost.reaction_count + communityPost.comment_count} interactions`
    : groupCount
      ? 'Your groups are ready when the conversation starts.'
      : 'Join a group and your community activity will live here.';

  return (
    <>
      <View style={styles.duo}>
        <Pressable style={[styles.card, styles.communityCard]} onPress={() => router.push('/(tabs)/community')}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, styles.communityIconBadge]}>
              <AppIcon name="community" color="#D6E7DE" size={20} />
            </View>
            <Text style={styles.eyebrow}>COMMUNITY</Text>
          </View>

          <View style={styles.communityMotif} pointerEvents="none">
            <View style={[styles.node, styles.nodeOne]} />
            <View style={[styles.node, styles.nodeTwo]} />
            <View style={[styles.node, styles.nodeThree]} />
            <View style={[styles.connection, styles.connectionOne]} />
            <View style={[styles.connection, styles.connectionTwo]} />
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={communityPost ? 3 : 2}>{communityHeadline}</Text>
            <Text style={styles.muted} numberOfLines={2}>{communityMeta}</Text>
          </View>

          <View style={styles.ctaRow}>
            <Text style={styles.cta}>Open Community</Text>
            <AppIcon name="chevron-forward" color="#D7B45A" size={16} />
          </View>
        </Pressable>

        <Pressable style={[styles.card, styles.passportCard]} onPress={() => router.push('/(tabs)/passport')}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, styles.passportIconBadge]}>
              <AppIcon name="passport" color="#F4D98B" size={20} />
            </View>
            <Text style={styles.eyebrow}>PASSPORT</Text>
          </View>

          <View style={styles.emblemBackdrop} pointerEvents="none">
            <RankEmblem rank={displayRank} size={108} />
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.rank}>{displayRank}</Text>
            {milestone ? (
              <Text style={styles.muted}>{milestone.remaining} adventure{milestone.remaining === 1 ? '' : 's'} to {milestone.label}</Text>
            ) : (
              <Text style={styles.muted}>Top trail rank reached.</Text>
            )}
            <View style={styles.passportCounts}>
              <Text style={styles.countText}>{stampCount} stamp{stampCount === 1 ? '' : 's'}</Text>
              <View style={styles.countDot} />
              <Text style={styles.countText}>{badgeCount} badge{badgeCount === 1 ? '' : 's'}</Text>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <Text style={styles.cta}>Open Passport</Text>
            <AppIcon name="chevron-forward" color="#D7B45A" size={16} />
          </View>
        </Pressable>
      </View>

      <Pressable style={styles.journeyCard} onPress={() => router.push('/(tabs)/passport')}>
        <View style={styles.journeyTrail} pointerEvents="none">
          <View style={[styles.trailDot, styles.trailDotOne]} />
          <View style={[styles.trailDot, styles.trailDotTwo]} />
          <View style={[styles.trailDot, styles.trailDotThree]} />
          <View style={[styles.trailSegment, styles.trailSegmentOne]} />
          <View style={[styles.trailSegment, styles.trailSegmentTwo]} />
        </View>

        <View style={styles.journeyHeader}>
          <View>
            <Text style={styles.eyebrow}>MY JOURNEY</Text>
            <Text style={styles.journeyTitle}>{journeyCount ? 'Your trail is taking shape.' : 'Your trail starts here.'}</Text>
          </View>
          <View style={styles.journeyIcon}>
            <AppIcon name="guide" color="#D7B45A" size={22} />
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

        {!journeyCount ? <Text style={styles.journeyMuted}>Book your first adventure and watch this card become your personal trail record.</Text> : null}

        <View style={styles.ctaRow}>
          <Text style={styles.cta}>Open Journey</Text>
          <AppIcon name="chevron-forward" color="#D7B45A" size={16} />
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  duo: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, minHeight: 214, borderRadius: 22, borderWidth: 1, padding: 15, overflow: 'hidden' },
  communityCard: { backgroundColor: '#193329', borderColor: '#36584A' },
  passportCard: { backgroundColor: '#342B1D', borderColor: '#6B5934' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 3 },
  iconBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  communityIconBadge: { backgroundColor: 'rgba(118,164,143,0.12)', borderColor: 'rgba(155,201,180,0.28)' },
  passportIconBadge: { backgroundColor: 'rgba(215,180,90,0.10)', borderColor: 'rgba(215,180,90,0.30)' },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardBody: { flex: 1, justifyContent: 'center', paddingTop: 8, zIndex: 2 },
  cardTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  rank: { color: '#FFF8E8', fontSize: 21, lineHeight: 25, fontWeight: '900', maxWidth: '76%' },
  muted: { color: '#AEBAB3', lineHeight: 18, marginTop: 5, fontSize: 12 },
  passportCounts: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  countText: { color: '#D8CCAD', fontSize: 11, fontWeight: '700' },
  countDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#8C7950' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 10, zIndex: 3 },
  cta: { color: '#D7B45A', fontWeight: '900', fontSize: 13 },
  communityMotif: { position: 'absolute', right: -8, bottom: 18, width: 96, height: 92, opacity: 0.45 },
  node: { position: 'absolute', width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(166,211,191,0.30)', backgroundColor: 'rgba(166,211,191,0.08)' },
  nodeOne: { right: 8, top: 4 },
  nodeTwo: { left: 12, top: 34 },
  nodeThree: { right: 26, bottom: 6 },
  connection: { position: 'absolute', height: 1, backgroundColor: 'rgba(166,211,191,0.22)' },
  connectionOne: { width: 58, right: 19, top: 31, transform: [{ rotate: '-24deg' }] },
  connectionTwo: { width: 45, right: 26, bottom: 32, transform: [{ rotate: '36deg' }] },
  emblemBackdrop: { position: 'absolute', right: -20, bottom: 22, opacity: 0.34, transform: [{ rotate: '-7deg' }] },
  journeyCard: { minHeight: 190, backgroundColor: '#18261F', borderRadius: 22, borderWidth: 1, borderColor: '#3A4D42', padding: 17, overflow: 'hidden' },
  journeyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  journeyTitle: { color: '#FFF8E8', fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 7 },
  journeyIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(215,180,90,0.24)', backgroundColor: 'rgba(215,180,90,0.07)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.025)' },
  statBlock: { flex: 1, alignItems: 'center' },
  stat: { color: '#FFF8E8', fontSize: 25, fontWeight: '900' },
  statLabel: { color: '#8F9C94', fontSize: 10, marginTop: 2, fontWeight: '700' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(148,164,154,0.16)' },
  journeyMuted: { color: '#99A79F', marginTop: 11, lineHeight: 18, maxWidth: '84%', fontSize: 12 },
  journeyTrail: { position: 'absolute', right: -5, bottom: -3, width: 150, height: 105, opacity: 0.7 },
  trailDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(215,180,90,0.19)' },
  trailDotOne: { left: 8, bottom: 16 },
  trailDotTwo: { left: 70, bottom: 55 },
  trailDotThree: { right: 8, top: 8 },
  trailSegment: { position: 'absolute', height: 2, backgroundColor: 'rgba(215,180,90,0.10)', borderRadius: 2 },
  trailSegmentOne: { width: 76, left: 5, bottom: 39, transform: [{ rotate: '-28deg' }] },
  trailSegmentTwo: { width: 80, right: 3, top: 35, transform: [{ rotate: '-34deg' }] },
});
