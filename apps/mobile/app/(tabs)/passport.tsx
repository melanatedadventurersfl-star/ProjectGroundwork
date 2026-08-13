import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp } from '../../src/member/api';
import {
  getAllMemoryPhotos,
  getJourney,
  getMemberBadges,
  getPassportStamps,
  type JourneyItem,
  type MemberBadge,
  type MemoryPhoto,
  type PassportStamp,
} from '../../src/passport/api';

type PassportView = 'journey' | 'stamps' | 'badges' | 'memories';

const ladder = [
  { name: 'Explorer', min: 0 },
  { name: 'Pathfinder', min: 1 },
  { name: 'Trailblazer', min: 3 },
  { name: 'Wayfinder', min: 6 },
  { name: 'Summiteer', min: 10 },
  { name: 'Legacy Adventurer', min: 20 },
] as const;

function levelFor(completed: number) {
  return [...ladder].reverse().find((level) => completed >= level.min) ?? ladder[0];
}

export default function PassportScreen() {
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [view, setView] = useState<PassportView>('journey');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextJourney, nextStamps, nextBadges, nextPhotos, basecamp] = await Promise.all([
        getJourney(),
        getPassportStamps(),
        getMemberBadges(),
        getAllMemoryPhotos(),
        getMemberBasecamp(),
      ]);
      setJourney(nextJourney);
      setStamps(nextStamps);
      setBadges(nextBadges);
      setPhotos(nextPhotos);
      setProfile(basecamp.profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your Passport.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const level = useMemo(() => levelFor(journey.length), [journey.length]);
  const nextLevel = useMemo(() => ladder.find((item) => item.min > journey.length), [journey.length]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  const displayName = profile?.display_name ?? 'Adventurer';
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Recently';

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={view === 'journey' ? journey : []}
        keyExtractor={(item) => item.adventure_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR MA STORY</Text>
            <Text style={styles.title}>Passport</Text>

            <View style={styles.identityCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{String(displayName).slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.identityText}>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.status}>{level.name}</Text>
                <Text style={styles.joined}>Joined {joined}</Text>
              </View>
              {profile?.platform_role && profile.platform_role !== 'member' ? <Text style={styles.roleBadge}>{String(profile.platform_role).replace('_', ' ').toUpperCase()}</Text> : null}
            </View>

            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>{nextLevel ? `Path to ${nextLevel.name}` : 'Legacy status reached'}</Text>
              <Text style={styles.progressBody}>{nextLevel ? `${nextLevel.min - journey.length} more completed official adventure${nextLevel.min - journey.length === 1 ? '' : 's'} to advance.` : 'Keep building the story. The trail does not end at the title.'}</Text>
            </View>

            <View style={styles.statsGrid}>
              <Pressable style={[styles.stat, view === 'journey' && styles.statActive]} onPress={() => setView('journey')}><Text style={styles.statNumber}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></Pressable>
              <Pressable style={[styles.stat, view === 'stamps' && styles.statActive]} onPress={() => setView('stamps')}><Text style={styles.statNumber}>{stamps.length}</Text><Text style={styles.statLabel}>Stamps</Text></Pressable>
              <Pressable style={[styles.stat, view === 'badges' && styles.statActive]} onPress={() => setView('badges')}><Text style={styles.statNumber}>{badges.length}</Text><Text style={styles.statLabel}>Badges</Text></Pressable>
              <Pressable style={[styles.stat, view === 'memories' && styles.statActive]} onPress={() => setView('memories')}><Text style={styles.statNumber}>{photos.length}</Text><Text style={styles.statLabel}>Memories</Text></Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {view === 'journey' ? (
              <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Journey Timeline</Text><Text style={styles.sectionMeta}>Completed official adventures</Text></View>
            ) : null}

            {view === 'stamps' ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Official Stamp Book</Text>
                <Text style={styles.panelIntro}>One official stamp is tied to each completed MA adventure.</Text>
                {stamps.length ? <View style={styles.tileGrid}>{stamps.map((stamp) => <View key={`${stamp.stamp_id}-${stamp.adventure_id ?? ''}`} style={styles.stampTile}><Text style={styles.stampMark}>✦</Text><Text style={styles.tileTitle}>{stamp.title}</Text><Text style={styles.tileDate}>{new Date(stamp.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text></View>)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Your stamp book is waiting.</Text><Text style={styles.empty}>Complete an official MA adventure to earn the first stamp.</Text></View>}
              </View>
            ) : null}

            {view === 'badges' ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Badges</Text>
                <Text style={styles.panelIntro}>Badges recognize milestones and achievements. They are separate from your member status and event stamps.</Text>
                {badges.length ? <View style={styles.tileGrid}>{badges.map((badge) => <View key={badge.badge_id} style={styles.badgeTile}><Text style={styles.badgeMark}>◆</Text><Text style={styles.tileTitle}>{badge.title}</Text><Text style={styles.tileDate}>{badge.category}</Text></View>)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No badges yet.</Text><Text style={styles.empty}>Milestone and achievement badges will appear here as you earn them.</Text></View>}
              </View>
            ) : null}

            {view === 'memories' ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Adventure Memories</Text>
                <Text style={styles.panelIntro}>Photos shared from completed adventures collect here. Attendee upload controls live on the individual adventure memory page.</Text>
                {photos.length ? <View style={styles.photoGrid}>{photos.map((photo) => <View key={photo.id} style={styles.photoTile}><Image source={{ uri: photo.image_url }} style={styles.photo} /><Text style={styles.photoCaption} numberOfLines={2}>{photo.caption || (photo.visibility === 'group' ? 'Shared adventure memory' : 'Private memory')}</Text></View>)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No memories added yet.</Text><Text style={styles.empty}>After an adventure, open it from your Journey Timeline to add reflections and photos.</Text></View>}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={view === 'journey' ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your first chapter is still ahead.</Text>
            <Text style={styles.empty}>Completed registered adventures will appear here automatically.</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.emptyAction}>Explore adventures →</Text></Pressable>
          </View>
        ) : null}
        renderItem={({ item, index }) => (
          <View style={styles.timelineRow}>
            <View style={styles.timelineRail}><View style={styles.timelineDot} />{index < journey.length - 1 ? <View style={styles.timelineLine} /> : null}</View>
            <Pressable style={styles.card} onPress={() => router.push(`/passport/reflection/${item.adventure_id}`)}>
              <Text style={styles.date}>{new Date(item.experienced_at ?? item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.category} · {item.city}, {item.state}</Text>
              <View style={styles.memoryStats}><Text style={styles.memoryStat}>{item.stamp_count} official stamp{Number(item.stamp_count) === 1 ? '' : 's'}</Text><Text style={styles.memoryStat}>{item.photo_count} memor{item.photo_count === 1 ? 'y' : 'ies'}</Text></View>
              {item.highlight ? <Text style={styles.highlight}>“{item.highlight}”</Text> : <Text style={styles.prompt}>Open memories & reflection →</Text>}
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingBottom: 42 }, header: { gap: 12, marginBottom: 15 }, eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 }, title: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#1D2B24', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#32453A' }, avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#17211C', fontSize: 24, fontWeight: '900' }, identityText: { flex: 1 }, name: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' }, status: { color: '#F0D083', fontWeight: '900', marginTop: 2 }, joined: { color: '#89968E', fontSize: 12, marginTop: 3 }, roleBadge: { color: '#BFE2C9', fontSize: 9, fontWeight: '900', backgroundColor: '#26382E', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  progressCard: { backgroundColor: '#17211C', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#28362E' }, progressTitle: { color: '#FFF8E8', fontWeight: '900' }, progressBody: { color: '#AEB8B2', marginTop: 4, lineHeight: 19 },
  statsGrid: { flexDirection: 'row', gap: 7 }, stat: { flex: 1, backgroundColor: '#17211C', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 8, borderWidth: 1, borderColor: '#28362E', alignItems: 'center' }, statActive: { borderColor: '#D7B45A', backgroundColor: '#223027' }, statNumber: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' }, statLabel: { color: '#8F9A93', fontSize: 10, marginTop: 3 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 4 }, sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' }, sectionMeta: { color: '#7F8B83', fontSize: 11 }, panel: { gap: 10, marginTop: 4 }, panelIntro: { color: '#9CA8A0', lineHeight: 20 }, tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, stampTile: { width: '48%', borderWidth: 1, borderColor: '#5C5134', backgroundColor: '#161F1A', borderRadius: 14, padding: 12 }, badgeTile: { width: '48%', borderWidth: 1, borderColor: '#3D5145', backgroundColor: '#17231C', borderRadius: 14, padding: 12 }, stampMark: { color: '#D7B45A', fontSize: 20 }, badgeMark: { color: '#BFE2C9', fontSize: 19 }, tileTitle: { color: '#FFF8E8', fontWeight: '900', marginTop: 5 }, tileDate: { color: '#89958D', fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, photoTile: { width: '48%', backgroundColor: '#17211C', borderRadius: 14, overflow: 'hidden' }, photo: { width: '100%', aspectRatio: 1 }, photoCaption: { color: '#C7D0CA', fontSize: 12, lineHeight: 17, padding: 9 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' }, timelineRail: { width: 28, alignItems: 'center' }, timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7B45A', marginTop: 20 }, timelineLine: { width: 1, flex: 1, backgroundColor: '#405047', marginTop: 5 }, card: { flex: 1, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 17, gap: 6, marginBottom: 12 }, date: { color: '#D7B45A', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 }, cardTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, meta: { color: '#99A49D' }, memoryStats: { flexDirection: 'row', gap: 13, marginTop: 3 }, memoryStat: { color: '#D6DFD9', fontSize: 12, fontWeight: '700' }, highlight: { color: '#E4E9E5', fontSize: 15, lineHeight: 22, marginTop: 7 }, prompt: { color: '#D7B45A', fontWeight: '800', marginTop: 7 },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 20, marginTop: 8, gap: 7 }, emptyTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', textAlign: 'center' }, empty: { color: '#AAB4AE', textAlign: 'center', lineHeight: 20 }, emptyAction: { color: '#D7B45A', fontWeight: '900', textAlign: 'center', marginTop: 5 }, error: { color: '#FFB4A9' },
});
