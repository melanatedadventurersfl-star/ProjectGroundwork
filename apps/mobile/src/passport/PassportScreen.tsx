import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp } from '../member/api';
import {
  getMemberBadges,
  getPassportStamps,
  type MemberBadge,
  type PassportStamp,
} from './api';
import { BadgeArt, hasBadgeArt } from './BadgeArt';
import { isLegacyStampCode, StampArt } from './StampArt';
import { getPassportTimeline, type PassportTimelineItem } from './timeline';

type JourneyFilter = 'all' | 'stamps' | 'badges' | 'milestones';

const GOLD = '#D7B45A';
const TEAL = '#35D4C8';

function formatDate(value: string, withYear = true) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
}

function yearOf(value: string) {
  return new Date(value).getFullYear();
}

function TimelineArtwork({ item }: { item: PassportTimelineItem }) {
  if (item.item_type === 'stamp') {
    return (
      <View style={styles.artShell}>
        {item.code && isLegacyStampCode(item.code) ? (
          <StampArt code={item.code} width={86} />
        ) : (
          <View style={styles.genericStamp}><Text style={styles.genericStampText}>MA</Text></View>
        )}
      </View>
    );
  }

  if (item.item_type === 'badge') {
    return (
      <View style={styles.artShell}>
        {hasBadgeArt(item.title) ? (
          <BadgeArt title={item.title} size={82} />
        ) : (
          <View style={styles.genericBadge}><Text style={styles.genericBadgeText}>★</Text></View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.joinMark}>
      <Text style={styles.joinMarkTop}>MA</Text>
      <Text style={styles.joinMarkBottom}>JOINED</Text>
    </View>
  );
}

export default function PassportScreen() {
  const [timeline, setTimeline] = useState<PassportTimelineItem[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [year, setYear] = useState<number | null>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextTimeline, nextStamps, nextBadges, basecamp] = await Promise.all([
        getPassportTimeline(),
        getPassportStamps(),
        getMemberBadges(),
        getMemberBasecamp(),
      ]);
      setTimeline(nextTimeline);
      setStamps(nextStamps);
      setBadges(nextBadges);
      setProfile(basecamp.profile);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your Passport.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(
    () => Array.from(new Set(timeline.map((item) => yearOf(item.occurred_at)))).sort((a, b) => b - a),
    [timeline],
  );

  const filteredTimeline = useMemo(() => timeline.filter((item) => {
    if (year !== null && yearOf(item.occurred_at) !== year) return false;
    if (filter === 'stamps') return item.item_type === 'stamp';
    if (filter === 'badges') return item.item_type === 'badge';
    if (filter === 'milestones') {
      return item.item_type === 'join' || (item.item_type === 'badge' && item.category === 'milestone');
    }
    return true;
  }), [timeline, filter, year]);

  const joinedItem = timeline.find((item) => item.item_type === 'join');
  const latestItem = timeline[timeline.length - 1];
  const displayName = profile?.display_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || profile?.username
    || 'Member';

  const openTimelineItem = (item: PassportTimelineItem) => {
    if (item.item_type === 'stamp' && item.adventure_id) {
      router.push(`/passport/reflection/${item.adventure_id}`);
      return;
    }
    if (item.item_type === 'badge') {
      router.push({ pathname: '/passport/badges/[id]', params: { id: item.item_id.replace('badge:', '') } });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={GOLD} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={GOLD}
          />
        )}
      >
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>YOUR ADVENTURE RECORD</Text>
          <Text style={styles.title}>Passport</Text>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.identityCopy}>
            <Text style={styles.identityName}>{displayName}</Text>
            {profile?.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
            <Text style={styles.memberSince}>
              {joinedItem ? `Member since ${formatDate(joinedItem.occurred_at)}` : 'Your journey starts here'}
            </Text>
          </View>
          <View style={styles.identityStats}>
            <Text style={styles.statNumber}>{stamps.length}</Text>
            <Text style={styles.statLabel}>STAMPS</Text>
            <View style={styles.statDivider} />
            <Text style={styles.statNumber}>{badges.length}</Text>
            <Text style={styles.statLabel}>BADGES</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Achievement Badges</Text>
            <Text style={styles.sectionSub}>Milestones earned along the way.</Text>
          </View>
          <Pressable onPress={() => setFilter('badges')}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        {badges.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgePreviewRow}>
            {badges.slice(0, 6).map((badge) => (
              <View key={badge.badge_id} style={styles.badgePreviewCard}>
                <View style={styles.badgePreviewArt}>
                  {hasBadgeArt(badge.title) ? (
                    <BadgeArt title={badge.title} size={92} />
                  ) : (
                    <View style={styles.genericBadge}><Text style={styles.genericBadgeText}>★</Text></View>
                  )}
                </View>
                <Text style={styles.badgePreviewTitle} numberOfLines={2}>{badge.title}</Text>
                <Text style={styles.badgePreviewMeta}>{formatDate(badge.earned_at, false)}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyPanel}><Text style={styles.emptyText}>Your first badge is still ahead.</Text></View>
        )}

        <View style={styles.journeyHeader}>
          <Text style={styles.sectionTitle}>Adventure Journey</Text>
          <Text style={styles.journeyTagline}>Your journey. Your stamps. Your story.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {([
            ['all', 'All'],
            ['stamps', 'Stamps'],
            ['badges', 'Badges'],
            ['milestones', 'Milestones'],
          ] as [JourneyFilter, string][]).map(([value, label]) => {
            const active = filter === value;
            return (
              <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setYearPickerOpen(true)} style={[styles.filterChip, year !== null && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, year !== null && styles.filterChipTextActive]}>{year ?? 'Year'} ▾</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.timelinePanel}>
          <View style={styles.timelineTopRow}>
            <Text style={styles.timelineCount}>{filteredTimeline.length} milestone{filteredTimeline.length === 1 ? '' : 's'}</Text>
            {year !== null ? (
              <Pressable onPress={() => setYear(null)}><Text style={styles.clearFilter}>Clear year</Text></Pressable>
            ) : null}
          </View>

          {filteredTimeline.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timelineScroll}
              snapToInterval={164}
              decelerationRate="fast"
            >
              {filteredTimeline.map((item, index) => {
                const interactive = item.item_type !== 'join';
                return (
                  <View key={item.item_id} style={styles.timelineStepWrap}>
                    <View style={styles.connectorRow}>
                      <View style={[styles.connectorLine, index === 0 && styles.connectorLineHidden]} />
                      <View style={[styles.timelineNode, item.item_type === 'stamp' && styles.timelineNodeStamp, item.item_type === 'badge' && styles.timelineNodeBadge]}>
                        <View style={styles.timelineNodeInner} />
                      </View>
                      <View style={[styles.connectorLine, index === filteredTimeline.length - 1 && styles.connectorLineHidden]} />
                    </View>

                    <Pressable
                      disabled={!interactive}
                      onPress={() => openTimelineItem(item)}
                      style={({ pressed }) => [styles.timelineCard, pressed && interactive && styles.timelineCardPressed]}
                    >
                      <TimelineArtwork item={item} />
                      <View style={styles.typePill}>
                        <Text style={styles.typePillText}>{item.item_type === 'join' ? 'START' : item.item_type.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.timelineTitle} numberOfLines={3}>{item.title}</Text>
                      <Text style={styles.timelineDate}>{formatDate(item.occurred_at)}</Text>
                      {item.city ? <Text style={styles.timelineLocation} numberOfLines={1}>{item.city}{item.state ? `, ${item.state}` : ''}</Text> : null}
                    </Pressable>
                  </View>
                );
              })}

              {filter === 'all' && year === null ? (
                <View style={styles.timelineStepWrap}>
                  <View style={styles.connectorRow}>
                    <View style={styles.connectorLine} />
                    <View style={styles.todayNode}><View style={styles.todayNodeInner} /></View>
                    <View style={styles.connectorLineHidden} />
                  </View>
                  <View style={[styles.timelineCard, styles.todayCard]}>
                    <View style={styles.todayCompass}><Text style={styles.todayCompassText}>✦</Text></View>
                    <Text style={styles.todayLabel}>TODAY</Text>
                    <Text style={styles.todayTitle}>The trail keeps going.</Text>
                    {latestItem ? <Text style={styles.timelineDate}>Latest mark {formatDate(latestItem.occurred_at)}</Text> : null}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <View style={styles.emptyJourney}>
              <Text style={styles.emptyJourneyTitle}>No marks match these filters.</Text>
              <Text style={styles.emptyJourneyText}>Try another type or switch back to All years.</Text>
            </View>
          )}
        </View>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => setFilter('stamps')}>
            <Text style={styles.quickActionNumber}>{stamps.length}</Text>
            <Text style={styles.quickActionLabel}>Stamp Book</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/passport/memories')}>
            <Text style={styles.quickActionGlyph}>▣</Text>
            <Text style={styles.quickActionLabel}>Memories</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Modal transparent visible={yearPickerOpen} animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setYearPickerOpen(false)}>
          <Pressable style={styles.yearSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.yearHandle} />
            <Text style={styles.yearTitle}>Filter Journey by Year</Text>
            <Pressable
              style={[styles.yearOption, year === null && styles.yearOptionActive]}
              onPress={() => { setYear(null); setYearPickerOpen(false); }}
            >
              <Text style={[styles.yearOptionText, year === null && styles.yearOptionTextActive]}>All years</Text>
            </Pressable>
            {years.map((value) => (
              <Pressable
                key={value}
                style={[styles.yearOption, year === value && styles.yearOptionActive]}
                onPress={() => { setYear(value); setYearPickerOpen(false); }}
              >
                <Text style={[styles.yearOptionText, year === value && styles.yearOptionTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1612' },
  center: { flex: 1, backgroundColor: '#0D1612', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 44, gap: 16 },
  pageIntro: { gap: 4 },
  eyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 36, fontWeight: '900' },
  identityCard: { borderRadius: 22, backgroundColor: '#18251F', borderWidth: 1, borderColor: '#35483D', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityCopy: { flex: 1 },
  identityName: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  username: { color: '#829189', fontSize: 12, marginTop: 2 },
  memberSince: { color: '#C4B77D', fontSize: 11, fontWeight: '800', marginTop: 8 },
  identityStats: { minWidth: 94, borderLeftWidth: 1, borderLeftColor: '#35443C', paddingLeft: 16, alignItems: 'center' },
  statNumber: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#78877F', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statDivider: { width: 34, height: 1, backgroundColor: '#39473F', marginVertical: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  sectionSub: { color: '#85948B', marginTop: 3, fontSize: 12 },
  viewAll: { color: TEAL, fontWeight: '900', fontSize: 12, paddingBottom: 2 },
  badgePreviewRow: { gap: 10, paddingRight: 18 },
  badgePreviewCard: { width: 142, minHeight: 176, borderRadius: 18, backgroundColor: '#15211B', borderWidth: 1, borderColor: '#34453B', padding: 10, alignItems: 'center' },
  badgePreviewArt: { height: 100, alignItems: 'center', justifyContent: 'center' },
  badgePreviewTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', textAlign: 'center', lineHeight: 17 },
  badgePreviewMeta: { color: TEAL, fontSize: 10, fontWeight: '800', marginTop: 6 },
  journeyHeader: { gap: 2, marginTop: 4 },
  journeyTagline: { color: '#A0ADA5', fontSize: 13 },
  filterRow: { gap: 8, paddingRight: 18 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#35473D', backgroundColor: '#141F1A', paddingHorizontal: 14, paddingVertical: 9 },
  filterChipActive: { borderColor: GOLD, backgroundColor: 'rgba(215,180,90,0.12)' },
  filterChipText: { color: '#89968E', fontSize: 11, fontWeight: '900' },
  filterChipTextActive: { color: '#F3D981' },
  timelinePanel: { borderRadius: 22, backgroundColor: '#121D18', borderWidth: 1, borderColor: '#2F4036', paddingVertical: 14 },
  timelineTopRow: { paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineCount: { color: '#8D9B92', fontSize: 10, fontWeight: '800' },
  clearFilter: { color: TEAL, fontSize: 10, fontWeight: '900' },
  timelineScroll: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  timelineStepWrap: { width: 164, alignItems: 'center' },
  connectorRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  connectorLine: { flex: 1, height: 2, backgroundColor: GOLD },
  connectorLineHidden: { opacity: 0 },
  timelineNode: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFF0B3', backgroundColor: '#5B4B22', alignItems: 'center', justifyContent: 'center' },
  timelineNodeStamp: { borderColor: TEAL, backgroundColor: '#173D38' },
  timelineNodeBadge: { borderColor: GOLD, backgroundColor: '#4B3C18' },
  timelineNodeInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF8E8' },
  timelineCard: { width: 148, minHeight: 220, marginTop: 8, borderRadius: 18, backgroundColor: '#19261F', borderWidth: 1, borderColor: '#35473D', padding: 11, alignItems: 'center' },
  timelineCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
  artShell: { height: 88, width: '100%', alignItems: 'center', justifyContent: 'center' },
  joinMark: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: TEAL, backgroundColor: '#14332F', alignItems: 'center', justifyContent: 'center', marginVertical: 5 },
  joinMarkTop: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  joinMarkBottom: { color: TEAL, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 1 },
  genericStamp: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: TEAL, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14302C' },
  genericStampText: { color: TEAL, fontWeight: '900', fontSize: 17 },
  genericBadge: { width: 72, height: 72, borderRadius: 18, borderWidth: 2, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B2618' },
  genericBadgeText: { color: GOLD, fontSize: 26, fontWeight: '900' },
  typePill: { backgroundColor: 'rgba(53,212,200,0.09)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, marginTop: 2 },
  typePillText: { color: TEAL, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  timelineTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', lineHeight: 16, textAlign: 'center', marginTop: 7 },
  timelineDate: { color: '#C6B477', fontSize: 10, fontWeight: '800', marginTop: 7, textAlign: 'center' },
  timelineLocation: { color: '#78877F', fontSize: 9, marginTop: 3, textAlign: 'center' },
  todayNode: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFF8E8', backgroundColor: '#233129', alignItems: 'center', justifyContent: 'center' },
  todayNodeInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL },
  todayCard: { justifyContent: 'center' },
  todayCompass: { width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: '#526158', alignItems: 'center', justifyContent: 'center' },
  todayCompassText: { color: TEAL, fontSize: 31 },
  todayLabel: { color: TEAL, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  todayTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  emptyPanel: { borderRadius: 17, borderWidth: 1, borderColor: '#304039', backgroundColor: '#152019', padding: 16 },
  emptyText: { color: '#93A098' },
  emptyJourney: { margin: 14, padding: 18, borderRadius: 16, backgroundColor: '#17231D', borderWidth: 1, borderColor: '#2D3C34' },
  emptyJourneyTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  emptyJourneyText: { color: '#8F9D95', marginTop: 5, lineHeight: 18 },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, minHeight: 82, borderRadius: 18, backgroundColor: '#17231D', borderWidth: 1, borderColor: '#304139', alignItems: 'center', justifyContent: 'center' },
  quickActionNumber: { color: GOLD, fontSize: 22, fontWeight: '900' },
  quickActionGlyph: { color: TEAL, fontSize: 22, fontWeight: '900' },
  quickActionLabel: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', marginTop: 4 },
  error: { color: '#FFB4A9', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' },
  yearSheet: { backgroundColor: '#17231D', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#394A41', padding: 18, paddingBottom: 34, gap: 8 },
  yearHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#56645D', alignSelf: 'center', marginBottom: 4 },
  yearTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  yearOption: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#2C3B33' },
  yearOptionActive: { borderColor: GOLD, backgroundColor: 'rgba(215,180,90,0.1)' },
  yearOptionText: { color: '#A2AEA7', fontWeight: '800' },
  yearOptionTextActive: { color: '#F4D67B' },
});
