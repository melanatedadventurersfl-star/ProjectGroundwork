import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgeArt, hasBadgeArt, type BadgeArtName } from '../../src/passport/BadgeArt';
import { getJourney, getMemberBadges, type MemberBadge } from '../../src/passport/api';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { AppIcon } from '../../src/ui/AppIcon';

type BadgeFamily = 'Tenure' | 'Adventure' | 'Activity';
type BadgeFilter = 'All' | BadgeFamily;

type BadgeDefinition = {
  title: BadgeArtName;
  family: BadgeFamily;
  requirement: string;
  adventureTarget?: number;
  tenureYears?: number;
};

type BadgeState = BadgeDefinition & {
  earned: boolean;
  earnedAt: string | null;
  progressLabel: string;
};

const BADGE_CATALOG: BadgeDefinition[] = [
  { title: 'Trailhead', family: 'Tenure', requirement: 'Join the Melanated Adventurers community.' },
  { title: 'Year 1', family: 'Tenure', requirement: 'Reach your first anniversary.', tenureYears: 1 },
  { title: 'Year 2', family: 'Tenure', requirement: 'Stay with the community for 2 years.', tenureYears: 2 },
  { title: 'Year 3', family: 'Tenure', requirement: 'Stay with the community for 3 years.', tenureYears: 3 },
  { title: 'Year 4', family: 'Tenure', requirement: 'Stay with the community for 4 years.', tenureYears: 4 },
  { title: 'Year 5', family: 'Tenure', requirement: 'Reach your fifth anniversary.', tenureYears: 5 },
  { title: 'First Adventure', family: 'Adventure', requirement: 'Complete your first official adventure.', adventureTarget: 1 },
  { title: 'Trail Regular', family: 'Adventure', requirement: 'Complete 3 official adventures.', adventureTarget: 3 },
  { title: 'Wayfinder Five', family: 'Adventure', requirement: 'Complete 5 official adventures.', adventureTarget: 5 },
  { title: 'Summit Ten', family: 'Adventure', requirement: 'Complete 10 official adventures.', adventureTarget: 10 },
  { title: 'Legacy Twenty', family: 'Adventure', requirement: 'Complete 20 official adventures.', adventureTarget: 20 },
  { title: 'Camp Crew', family: 'Activity', requirement: 'Join a qualifying group camping adventure.' },
  { title: 'Water Wayfinder', family: 'Activity', requirement: 'Complete a qualifying water-based adventure.' },
];

const FILTERS: BadgeFilter[] = ['All', 'Tenure', 'Adventure', 'Activity'];
const FAMILIES: BadgeFamily[] = ['Tenure', 'Adventure', 'Activity'];

const FAMILY_COPY: Record<BadgeFamily, { icon: string; subtitle: string }> = {
  Tenure: { icon: '◷', subtitle: 'Time spent growing with the community.' },
  Adventure: { icon: '△', subtitle: 'Badges earned by completing adventures.' },
  Activity: { icon: '≈', subtitle: 'Badges tied to the kind of adventure you joined.' },
};

function addYears(iso: string, years: number) {
  const date = new Date(iso);
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function ProfileBadgesScreen() {
  const [earnedBadges, setEarnedBadges] = useState<MemberBadge[]>([]);
  const [completedAdventures, setCompletedAdventures] = useState(0);
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([getMemberBadges(), getJourney()])
      .then(([nextBadges, journey]) => {
        setEarnedBadges(nextBadges);
        setCompletedAdventures(journey.length);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load badges.'))
      .finally(() => setLoading(false));
  }, []);

  const currentRank = useMemo(() => rankFor(completedAdventures), [completedAdventures]);
  const nextRank = useMemo(() => rankLadder.find(([, minimum]) => minimum > completedAdventures), [completedAdventures]);
  const remaining = nextRank ? Math.max(0, nextRank[1] - completedAdventures) : 0;

  const collection = useMemo<BadgeState[]>(() => {
    const earnedByTitle = new Map(earnedBadges.map((badge) => [badge.title, badge]));
    const trailhead = earnedByTitle.get('Trailhead');
    const now = new Date();

    return BADGE_CATALOG.map((definition) => {
      const directlyEarned = earnedByTitle.get(definition.title);
      if (directlyEarned) {
        return {
          ...definition,
          earned: true,
          earnedAt: directlyEarned.earned_at,
          progressLabel: `Earned ${formatMonthYear(directlyEarned.earned_at)}`,
        };
      }

      if (definition.adventureTarget) {
        const earned = completedAdventures >= definition.adventureTarget;
        return {
          ...definition,
          earned,
          earnedAt: null,
          progressLabel: earned
            ? 'Earned'
            : `${Math.min(completedAdventures, definition.adventureTarget)} / ${definition.adventureTarget} adventures`,
        };
      }

      if (definition.tenureYears && trailhead?.earned_at) {
        const anniversary = addYears(trailhead.earned_at, definition.tenureYears);
        const earned = now >= anniversary;
        return {
          ...definition,
          earned,
          earnedAt: earned ? anniversary.toISOString() : null,
          progressLabel: earned
            ? `Earned ${formatMonthYear(anniversary.toISOString())}`
            : `Stay ${definition.tenureYears} year${definition.tenureYears === 1 ? '' : 's'}`,
        };
      }

      return { ...definition, earned: false, earnedAt: null, progressLabel: definition.requirement };
    });
  }, [earnedBadges, completedAdventures]);

  const earnedCount = collection.filter((badge) => badge.earned).length;
  const completion = collection.length ? Math.round((earnedCount / collection.length) * 100) : 0;
  const visibleFamilies = FAMILIES.filter((family) => activeFilter === 'All' || activeFilter === family);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to profile">
        <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={styles.backText}>Profile</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ACHIEVEMENTS</Text>
          <Text style={styles.title}>Badges</Text>
          <Text style={styles.copy}>Collect milestones across your Melanated Adventurers journey.</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryCount}>{earnedCount} / {collection.length}</Text>
              <Text style={styles.summaryLabel}>Earned</Text>
            </View>
            <View style={styles.percentRing}>
              <Text style={styles.percentText}>{completion}%</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View rank progression"
        onPress={() => router.push('/member/rank-progress' as never)}
        style={({ pressed }) => [styles.rankCard, pressed && styles.rankCardPressed]}
      >
        <View style={styles.rankArt}>
          <RankEmblem rank={currentRank} size={66} />
        </View>
        <View style={styles.rankCopy}>
          <Text style={styles.rankTitle}>{currentRank}</Text>
          <Text style={styles.rankMeta}>
            {nextRank ? `${remaining} adventure${remaining === 1 ? '' : 's'} to ${nextRank[0]}` : 'Highest rank reached'}
          </Text>
          <View style={styles.rankProgressTrack}>
            <View style={styles.rankProgressFill} />
          </View>
        </View>
        <Text style={styles.rankLink}>View Rank Journey →</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((filter) => {
          const active = activeFilter === filter;
          return (
            <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading ? visibleFamilies.map((family) => {
        const familyBadges = collection.filter((badge) => badge.family === family);
        return (
          <View key={family} style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionIcon}>{FAMILY_COPY[family].icon}</Text>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{family}</Text>
                <Text style={styles.sectionSubtitle}>{FAMILY_COPY[family].subtitle}</Text>
              </View>
            </View>

            <View style={styles.grid}>
              {familyBadges.map((badge) => {
                const progressPercent = badge.adventureTarget
                  ? Math.min(100, Math.round((completedAdventures / badge.adventureTarget) * 100))
                  : 0;
                return (
                  <View key={badge.title} style={[styles.card, !badge.earned && styles.cardLocked]}>
                    {!badge.earned ? (
                      <View style={styles.lockPill}>
                        <Text style={styles.lockText}>LOCKED</Text>
                      </View>
                    ) : null}

                    <View style={styles.art}>
                      <View style={!badge.earned ? styles.lockedArt : undefined}>
                        {hasBadgeArt(badge.title) ? (
                          <BadgeArt title={badge.title} size={98} />
                        ) : (
                          <AppIcon name="badge" color={badge.earned ? '#F5C341' : '#7E8983'} size={48} />
                        )}
                      </View>
                    </View>

                    <Text style={[styles.cardTitle, !badge.earned && styles.cardTitleLocked]}>{badge.title}</Text>
                    <Text style={[styles.status, badge.earned ? styles.statusEarned : styles.statusLocked]} numberOfLines={2}>
                      {badge.progressLabel}
                    </Text>

                    {!badge.earned && badge.adventureTarget ? (
                      <View style={styles.cardProgressTrack}>
                        <View style={[styles.cardProgressFill, { width: `${progressPercent}%` }]} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      }) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07100E' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 92, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800', fontSize: 15 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#54D4C5', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F8F3', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 2 },
  copy: { color: '#9AA7A0', fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  summaryCard: { width: 122, backgroundColor: '#101A17', borderRadius: 17, borderWidth: 1, borderColor: '#32423B', padding: 12, justifyContent: 'space-between' },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCount: { color: '#F7F8F3', fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: '#A0ADA6', fontSize: 10.5, marginTop: 1 },
  percentRing: { width: 42, height: 42, borderRadius: 21, borderWidth: 4, borderColor: '#4ED9A1', alignItems: 'center', justifyContent: 'center' },
  percentText: { color: '#F7F8F3', fontSize: 10.5, fontWeight: '900' },
  progressTrack: { height: 5, borderRadius: 99, backgroundColor: '#2A3430', overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#4ED9A1' },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#101A17', borderRadius: 18, borderWidth: 1, borderColor: '#385147', padding: 12 },
  rankCardPressed: { opacity: 0.72 },
  rankArt: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankTitle: { color: '#F7F8F3', fontSize: 20, fontWeight: '900' },
  rankMeta: { color: '#B0BBB5', fontSize: 12, marginTop: 3 },
  rankProgressTrack: { height: 5, borderRadius: 99, backgroundColor: '#2B3531', overflow: 'hidden', marginTop: 9, maxWidth: 170 },
  rankProgressFill: { width: '54%', height: '100%', borderRadius: 99, backgroundColor: '#F5C341' },
  rankLink: { color: '#F5C341', fontSize: 11.5, fontWeight: '900', maxWidth: 96, textAlign: 'right' },
  filters: { gap: 9, paddingRight: 18 },
  filterChip: { minWidth: 78, height: 40, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#33423C', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E1714' },
  filterChipActive: { borderColor: '#4ED9A1', backgroundColor: '#10231D' },
  filterText: { color: '#A9B5AF', fontSize: 12.5, fontWeight: '800' },
  filterTextActive: { color: '#4ED9A1' },
  loader: { marginTop: 18 },
  error: { color: '#FFB4A9' },
  section: { gap: 9, marginTop: 2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  sectionIcon: { color: '#4ED9A1', fontSize: 22, lineHeight: 24, fontWeight: '900' },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: '#F7F8F3', fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: '#8E9C95', fontSize: 12, lineHeight: 16, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.5%', minHeight: 142, backgroundColor: '#111B18', borderRadius: 16, borderWidth: 1, borderColor: '#304039', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 11, alignItems: 'center', justifyContent: 'flex-start', position: 'relative' },
  cardLocked: { backgroundColor: '#0B1210', borderColor: '#222D29' },
  art: { height: 96, alignItems: 'center', justifyContent: 'center' },
  lockedArt: { opacity: 0.42 },
  lockPill: { position: 'absolute', top: 8, right: 8, zIndex: 2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: '#202A26', borderWidth: 1, borderColor: '#52605A' },
  lockText: { color: '#BBC4BF', fontSize: 7.5, letterSpacing: 0.7, fontWeight: '900' },
  cardTitle: { color: '#F7F8F3', fontSize: 13, lineHeight: 16, fontWeight: '900', textAlign: 'center', marginTop: 1 },
  cardTitleLocked: { color: '#B2BBB6' },
  status: { fontSize: 10.5, lineHeight: 14, textAlign: 'center', marginTop: 4, minHeight: 14 },
  statusEarned: { color: '#4ED9A1', fontWeight: '800' },
  statusLocked: { color: '#7F8B85' },
  cardProgressTrack: { width: '82%', height: 4, borderRadius: 99, backgroundColor: '#222D29', overflow: 'hidden', marginTop: 7 },
  cardProgressFill: { height: '100%', borderRadius: 99, backgroundColor: '#4ED9A1' },
});
