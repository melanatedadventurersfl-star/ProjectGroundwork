import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { getMemberBadges, type MemberBadge } from '../../src/passport/api';
import { AppIcon } from '../../src/ui/AppIcon';

export default function ProfileBadgesScreen() {
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void getMemberBadges()
      .then(setBadges)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load badges.'))
      .finally(() => setLoading(false));
  }, []);

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