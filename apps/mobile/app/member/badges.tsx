import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { getJourney, getMemberBadges, type MemberBadge } from '../../src/passport/api';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { AppIcon } from '../../src/ui/AppIcon';

export default function ProfileBadgesScreen() {
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [completedAdventures, setCompletedAdventures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([getMemberBadges(), getJourney()])
      .then(([nextBadges, journey]) => {
        setBadges(nextBadges);
        setCompletedAdventures(journey.length);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load badges.'))
      .finally(() => setLoading(false));
  }, []);

  const currentRank = useMemo(() => rankFor(completedAdventures), [completedAdventures]);
  const nextRank = useMemo(() => rankLadder.find(([, minimum]) => minimum > completedAdventures), [completedAdventures]);
  const remaining = nextRank ? Math.max(0, nextRank[1] - completedAdventures) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to profile">
        <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={styles.backText}>Profile</Text>
      </Pressable>
      <View>
        <Text style={styles.eyebrow}>ACHIEVEMENTS</Text>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.copy}>Milestones you’ve earned across your Melanated Adventurers journey.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View rank progression"
        onPress={() => router.push('/member/rank-progress' as never)}
        style={({ pressed }) => [styles.rankCard, pressed && styles.rankCardPressed]}
      >
        <View style={styles.rankArt}>
          <RankEmblem rank={currentRank} size={76} />
        </View>
        <View style={styles.rankCopy}>
          <Text style={styles.rankEyebrow}>RANK PROGRESSION</Text>
          <Text style={styles.rankTitle}>{currentRank}</Text>
          <Text style={styles.rankMeta}>
            {nextRank ? `${remaining} adventure${remaining === 1 ? '' : 's'} to ${nextRank[0]}` : 'Highest rank reached'}
          </Text>
          <Text style={styles.rankLink}>View your Rank Journey →</Text>
        </View>
      </Pressable>

      {loading ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !badges.length ? (
        <View style={styles.empty}>
          <AppIcon name="badge" color="#F5C341" size={34} />
          <Text style={styles.emptyTitle}>Your first badge is still ahead.</Text>
          <Text style={styles.copy}>Keep completing adventures and milestones. Earned badges will collect here automatically.</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {badges.map((badge) => (
          <View key={badge.badge_id} style={styles.card}>
            <View style={styles.art}>
              {hasBadgeArt(badge.title) ? <BadgeArt title={badge.title} size={104} /> : <AppIcon name="badge" color="#F5C341" size={48} />}
            </View>
            <Text style={styles.cardTitle}>{badge.title}</Text>
            {badge.description ? <Text style={styles.cardCopy} numberOfLines={3}>{badge.description}</Text> : null}
            <Text style={styles.earned}>Earned {new Date(badge.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09110F' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 80, gap: 18 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800' },
  eyebrow: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F8F3', fontSize: 32, lineHeight: 37, fontWeight: '900', marginTop: 3 },
  copy: { color: '#98A59E', fontSize: 14, lineHeight: 20, marginTop: 4 },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#111A17', borderRadius: 20, borderWidth: 1, borderColor: '#3E5148', padding: 15 },
  rankCardPressed: { opacity: 0.68 },
  rankArt: { width: 88, minHeight: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#0D1713' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankEyebrow: { color: '#67CFC8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  rankTitle: { color: '#F7F8F3', fontSize: 21, fontWeight: '900', marginTop: 3 },
  rankMeta: { color: '#A9B5AE', fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  rankLink: { color: '#F5C341', fontSize: 12.5, fontWeight: '900', marginTop: 8 },
  loader: { marginTop: 24 },
  error: { color: '#FFB4A9' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', minHeight: 205, backgroundColor: '#111A17', borderRadius: 18, borderWidth: 1, borderColor: '#29342F', padding: 12, alignItems: 'center' },
  art: { height: 112, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#F7F8F3', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  cardCopy: { color: '#97A39D', fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  earned: { color: '#67CFC8', fontSize: 10.5, fontWeight: '800', marginTop: 7 },
  empty: { backgroundColor: '#111A17', borderRadius: 18, borderWidth: 1, borderColor: '#29342F', padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#F7F8F3', fontSize: 17, fontWeight: '900', textAlign: 'center' },
});