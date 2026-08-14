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
import { RankEmblem, rankFor, rankLadder, type RankName } from '../../src/passport/RankEmblem';

type ViewMode = 'journey' | 'stamps' | 'badges' | 'memories';

function nextRankProgress(completed: number) {
  const next = rankLadder.find(([, minimum]) => minimum > completed);
  if (!next) return null;
  return { rank: next[0], remaining: next[1] - completed };
}

export default function PassportScreen() {
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<ViewMode>('journey');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextJourney, nextStamps, nextBadges, nextPhotos, base] = await Promise.all([
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
      setProfile(base.profile);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Passport.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const currentRank = useMemo(() => rankFor(journey.length), [journey.length]);
  const nextRank = useMemo(() => nextRankProgress(journey.length), [journey.length]);
  const states = new Set(journey.map((item) => item.state).filter(Boolean));
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || 'Member';
  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Recently';

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  }

  const data = mode === 'journey' ? journey : [];

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.adventure_id}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor="#D7B45A"
          />
        )}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.eyebrow}>EVERY ADVENTURE LEAVES A MARK</Text>
            <Text style={styles.title}>Passport</Text>

            <View style={styles.identity}>
              <View style={styles.identityGlow} />
              <View style={styles.identityText}>
                <Text style={styles.name}>{name}</Text>
                {profile?.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
                <Text style={styles.rank}>{currentRank}</Text>
                <Text style={styles.joined}>Member since {joined}{profile?.home_city ? ` · ${profile.home_city}, ${profile.home_state}` : ''}</Text>
                {nextRank ? (
                  <Text style={styles.rankProgress}>{nextRank.remaining} adventure{nextRank.remaining === 1 ? '' : 's'} to {nextRank.rank}</Text>
                ) : (
                  <Text style={styles.rankProgress}>Highest Passport rank achieved.</Text>
                )}
              </View>
              <View style={styles.heroEmblem}>
                <RankEmblem rank={currentRank} size={118} />
              </View>
            </View>

            <Pressable style={styles.journeyBar} onPress={() => setMode('journey')}>
              <Text style={styles.eyebrow}>MY JOURNEY</Text>
              {journey.length ? (
                <View style={styles.journeyCounts}>
                  <Text style={styles.journeyCount}>{journey.length} Adventure{journey.length === 1 ? '' : 's'}</Text>
                  <Text style={styles.journeyCount}>{states.size} State{states.size === 1 ? '' : 's'}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.journeyEmpty}>Your map starts with your first adventure.</Text>
                  <Text style={styles.muted}>Complete an official MA experience and your trail will grow here.</Text>
                </>
              )}
            </Pressable>

            <View style={styles.ladder}>
              <View style={styles.sectionRow}>
                <View>
                  <Text style={styles.sectionTitle}>Rank Trail</Text>
                  <Text style={styles.muted}>Each rank unlocks a new expedition emblem.</Text>
                </View>
                <Text style={styles.rankTrailCount}>{journey.length} completed</Text>
              </View>
              <View style={styles.ladderRow}>
                {rankLadder.map(([rankName, minimum]) => {
                  const reached = journey.length >= minimum;
                  const selected = currentRank === rankName;
                  return (
                    <View key={rankName} style={styles.rankStep}>
                      <View style={[styles.rankEmblemShell, selected && styles.rankEmblemCurrent]}>
                        <RankEmblem rank={rankName as RankName} size={46} muted={!reached} />
                      </View>
                      <Text style={[styles.rankLabel, reached && styles.rankDone, selected && styles.rankCurrent]} numberOfLines={2}>{rankName}</Text>
                      <Text style={styles.rankMin}>{minimum === 0 ? 'Start' : `${minimum}`}</Text>
                    </View>
                  );
                })}
              </View>
              <Pressable onPress={() => router.push('/guide')}><Text style={styles.link}>About Ranks & Passport</Text></Pressable>
            </View>

            <View style={styles.stats}>
              {([
                ['journey', 'Adventures', journey.length],
                ['stamps', 'Stamps', stamps.length],
                ['badges', 'Badges', badges.length],
                ['memories', 'Memories', photos.length],
              ] as [ViewMode, string, number][]).map(([value, label, count]) => (
                <Pressable key={value} style={[styles.stat, mode === value && styles.statActive]} onPress={() => setMode(value)}>
                  <Text style={styles.statNum}>{count || '•'}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {mode === 'journey' ? <Text style={styles.sectionTitle}>{journey.length ? 'Journey Timeline' : 'Your first chapter is waiting'}</Text> : null}

            {mode === 'stamps' ? (
              <View>
                <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Stamp Book</Text><Text style={styles.muted}>Newest first</Text></View>
                {stamps.length ? (
                  <View style={styles.grid}>
                    {stamps.map((stamp) => (
                      <Pressable key={`${stamp.stamp_id}-${stamp.adventure_id}`} style={styles.stamp} onPress={() => stamp.adventure_id && router.push(`/passport/reflection/${stamp.adventure_id}`)}>
                        <View style={styles.stampSeal}><Text style={styles.stampGlyph}>MA</Text></View>
                        <Text style={styles.tileTitle}>{stamp.title}</Text>
                        <Text style={styles.muted}>{new Date(stamp.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.empty}><Text style={styles.tileTitle}>Your stamp book is waiting.</Text><Text style={styles.muted}>Complete an official MA Adventure to earn your first passport-style seal.</Text></View>
                )}
              </View>
            ) : null}

            {mode === 'badges' ? (
              <View>
                <Text style={styles.sectionTitle}>Achievement Badges</Text>
                <Text style={styles.muted}>Milestone medallions stay distinct from your six Passport rank emblems.</Text>
                {badges.length ? (
                  <View style={styles.grid}>
                    {badges.map((badge) => (
                      <View key={badge.badge_id} style={styles.badgeTile}>
                        <View style={styles.medal}><Text style={styles.medalGlyph}>MA</Text></View>
                        <Text style={styles.tileTitle}>{badge.title}</Text><Text style={styles.muted}>{badge.category}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.empty}><Text style={styles.tileTitle}>Your first badge is still ahead.</Text><Text style={styles.muted}>Milestones appear here as you explore, connect, and complete Adventures.</Text></View>
                )}
              </View>
            ) : null}

            {mode === 'memories' ? (
              <View>
                <Text style={styles.sectionTitle}>My Scrapbook</Text><Text style={styles.muted}>Your photos and reflections live here.</Text>
                {photos.length ? (
                  <View style={styles.grid}>
                    {photos.map((photo) => (
                      <View key={photo.id} style={styles.photoTile}><Image source={{ uri: photo.image_url }} style={styles.photo} /><Text style={styles.photoText} numberOfLines={2}>{photo.caption || 'Adventure memory'}</Text></View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.empty}><Text style={styles.tileTitle}>Your scrapbook has open pages.</Text><Text style={styles.muted}>Completed Adventures can become memory albums.</Text></View>
                )}
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={styles.timeline}>
            <View style={styles.rail}><View style={styles.timelineDot} />{index < journey.length - 1 ? <View style={styles.line} /> : null}</View>
            <Pressable style={styles.timelineCard} onPress={() => router.push(`/passport/reflection/${item.adventure_id}`)}>
              <Text style={styles.date}>{new Date(item.experienced_at || item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={styles.tileTitle}>{item.title}</Text><Text style={styles.muted}>{item.category} · {item.city}, {item.state}</Text><Text style={styles.link}>Open Stamp & Memories</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={mode === 'journey' ? <View style={styles.empty}><Text style={styles.tileTitle}>Nothing to count yet. Plenty to start.</Text><Text style={styles.muted}>Your completed Adventures will build this timeline automatically.</Text></View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48 },
  header: { gap: 13, marginBottom: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 36, fontWeight: '900' },
  identity: { minHeight: 178, backgroundColor: '#1B2922', borderRadius: 22, borderWidth: 1, borderColor: '#35483C', padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  identityGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -38, top: -24, backgroundColor: 'rgba(215,180,90,0.055)' },
  identityText: { flex: 1, zIndex: 2, paddingRight: 8 },
  heroEmblem: { width: 122, height: 122, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  name: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  username: { color: '#A4B0A8', marginTop: 3 },
  rank: { color: '#F0D083', fontWeight: '900', marginTop: 8, fontSize: 16 },
  joined: { color: '#87948B', fontSize: 11, marginTop: 4, lineHeight: 16 },
  rankProgress: { color: '#C7B77F', fontSize: 11, fontWeight: '800', marginTop: 8 },
  journeyBar: { minHeight: 128, backgroundColor: '#1A2821', borderWidth: 1, borderColor: '#33483B', borderRadius: 17, padding: 15 },
  journeyCounts: { flexDirection: 'row', gap: 18, marginTop: 8 },
  journeyCount: { color: '#FFF8E8', fontWeight: '900' },
  journeyEmpty: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', lineHeight: 24, marginTop: 10, maxWidth: '82%' },
  ladder: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 15 },
  ladderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  rankStep: { width: '16%', alignItems: 'center' },
  rankEmblemShell: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  rankEmblemCurrent: { backgroundColor: 'rgba(215,180,90,0.10)', borderWidth: 1, borderColor: 'rgba(215,180,90,0.40)' },
  rankLabel: { color: '#657169', fontSize: 8, lineHeight: 10, textAlign: 'center', marginTop: 7 },
  rankDone: { color: '#D4DAD6', fontWeight: '800' },
  rankCurrent: { color: '#F0D083' },
  rankMin: { color: '#5E6A62', fontSize: 8, marginTop: 3 },
  rankTrailCount: { color: '#8D998F', fontSize: 10, fontWeight: '700' },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 9 },
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28362E', borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  statActive: { borderColor: '#D7B45A' },
  statNum: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#849188', fontSize: 9, marginTop: 2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  muted: { color: '#8F9B93', lineHeight: 19, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  stamp: { width: '48%', backgroundColor: '#161F1A', borderRadius: 16, borderWidth: 1, borderColor: '#655837', padding: 12 },
  stampSeal: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  stampGlyph: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  tileTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 7 },
  badgeTile: { width: '48%', backgroundColor: '#17231C', borderRadius: 16, borderWidth: 1, borderColor: '#3D5145', padding: 12 },
  medal: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#26372D', borderWidth: 3, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  medalGlyph: { color: '#F0D083', fontSize: 15, fontWeight: '900' },
  photoTile: { width: '48%', backgroundColor: '#17211C', borderRadius: 14, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1 },
  photoText: { color: '#C7D0CA', fontSize: 12, padding: 9 },
  empty: { backgroundColor: '#17211C', borderRadius: 16, padding: 17, marginTop: 10 },
  timeline: { flexDirection: 'row' },
  rail: { width: 26, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7B45A', marginTop: 20 },
  line: { width: 1, flex: 1, backgroundColor: '#405047', marginTop: 5 },
  timelineCard: { flex: 1, backgroundColor: '#17211C', borderRadius: 17, borderWidth: 1, borderColor: '#28362E', padding: 16, marginBottom: 12 },
  date: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  error: { color: '#FFB4A9' },
});
