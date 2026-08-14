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
import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { RankEmblem, rankFor, rankLadder, type RankName } from '../../src/passport/RankEmblem';
import { isLegacyStampCode, StampArt } from '../../src/passport/StampArt';

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
            <View style={styles.pageIntro}>
              <Text style={styles.eyebrow}>EVERY ADVENTURE LEAVES A MARK</Text>
              <Text style={styles.title}>Passport</Text>
            </View>

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
              <View style={styles.heroEmblem}><RankEmblem rank={currentRank} size={128} /></View>
            </View>

            <Pressable style={styles.journeyBar} onPress={() => setMode('journey')}>
              <View style={styles.journeyHeaderRow}>
                <Text style={styles.eyebrow}>MY JOURNEY</Text>
                {journey.length ? <Text style={styles.journeyMini}>{states.size} state{states.size === 1 ? '' : 's'}</Text> : null}
              </View>
              <Text style={styles.journeyHero}>{journey.length ? `${journey.length} adventure${journey.length === 1 ? '' : 's'} on your trail.` : 'Your map starts with your first adventure.'}</Text>
              <Text style={styles.muted}>{journey.length ? 'Every completed MA experience adds another chapter to your Passport.' : 'Complete an official MA experience and your trail will grow here.'}</Text>
            </Pressable>

            <View style={styles.ladder}>
              <View style={styles.rankTrailHeader}>
                <View style={styles.rankTrailCopy}>
                  <Text style={styles.sectionTitle}>Rank Trail</Text>
                  <Text style={styles.muted}>Complete adventures to rise through the Pathfinder ranks.</Text>
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
                        <RankEmblem rank={rankName as RankName} size={58} muted={!reached} />
                      </View>
                      <Text style={[styles.rankLabel, reached && styles.rankDone, selected && styles.rankCurrent]} numberOfLines={2}>{rankName}</Text>
                      <Text style={[styles.rankMin, selected && styles.rankMinCurrent]}>{minimum === 0 ? 'Start' : `${minimum}`}</Text>
                    </View>
                  );
                })}
              </View>
              <Pressable onPress={() => router.push('/guide')}><Text style={styles.link}>About Ranks & Passport</Text></Pressable>
            </View>

            <View style={styles.modeTabs}>
              {([
                ['journey', 'Adventures', journey.length],
                ['stamps', 'Stamps', stamps.length],
                ['badges', 'Badges', badges.length],
                ['memories', 'Memories', photos.length],
              ] as [ViewMode, string, number][]).map(([value, label, count]) => {
                const active = mode === value;
                return (
                  <Pressable key={value} style={[styles.modeTab, active && styles.modeTabActive]} onPress={() => setMode(value)}>
                    <Text style={[styles.modeCount, active && styles.modeCountActive]}>{count}</Text>
                    <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {mode === 'journey' && !journey.length ? (
              <View style={styles.sectionPanel}>
                <Text style={styles.panelEyebrow}>JOURNEY TIMELINE</Text>
                <Text style={styles.panelTitle}>Your first chapter is waiting.</Text>
                <Text style={styles.panelBody}>Completed adventures will build your timeline automatically, along with the stamps, memories, and milestones you collect.</Text>
              </View>
            ) : null}

            {mode === 'journey' && journey.length ? (
              <View style={styles.sectionHeadingRow}>
                <View><Text style={styles.panelEyebrow}>JOURNEY TIMELINE</Text><Text style={styles.sectionTitle}>Your adventure history</Text></View>
                <Text style={styles.muted}>{journey.length} total</Text>
              </View>
            ) : null}

            {mode === 'stamps' ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeadingRow}>
                  <View><Text style={styles.panelEyebrow}>COLLECTED SEALS</Text><Text style={styles.sectionTitle}>Stamp Book</Text></View>
                  {stamps.length ? <Text style={styles.muted}>Newest first</Text> : null}
                </View>
                {stamps.length ? (
                  <View style={styles.grid}>
                    {stamps.map((stamp) => (
                      <Pressable key={`${stamp.stamp_id}-${stamp.adventure_id}`} style={styles.stamp} onPress={() => stamp.adventure_id && router.push(`/passport/reflection/${stamp.adventure_id}`)}>
                        {isLegacyStampCode(stamp.code) ? (
                          <View style={styles.stampArtwork}><StampArt code={stamp.code} width={138} /></View>
                        ) : (
                          <View style={styles.stampSeal}><Text style={styles.stampGlyph}>MA</Text></View>
                        )}
                        <Text style={styles.tileTitle}>{stamp.title}</Text>
                        <Text style={styles.muted}>{new Date(stamp.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.sectionPanel}>
                    <Text style={styles.panelTitle}>Your stamp book is waiting.</Text>
                    <Text style={styles.panelBody}>Complete an official MA Adventure to earn your first passport-style seal.</Text>
                  </View>
                )}
              </View>
            ) : null}

            {mode === 'badges' ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeadingRow}>
                  <View><Text style={styles.panelEyebrow}>SPECIAL MILESTONES</Text><Text style={styles.sectionTitle}>Achievement Badges</Text></View>
                  {badges.length ? <Text style={styles.muted}>Premium embroidered series</Text> : null}
                </View>
                {badges.length ? (
                  <View style={styles.grid}>
                    {badges.map((badge) => (
                      <View key={badge.badge_id} style={styles.badgeTile}>
                        <View style={styles.badgeArtwork}>
                          {hasBadgeArt(badge.title) ? (
                            <BadgeArt title={badge.title} size={142} />
                          ) : (
                            <View style={styles.medal}><Text style={styles.medalGlyph}>MA</Text></View>
                          )}
                        </View>
                        <Text style={styles.tileTitle}>{badge.title}</Text>
                        <Text style={styles.badgeCategory}>{badge.category}</Text>
                        <Text style={styles.badgeEarned}>Earned {new Date(badge.earned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.sectionPanel}>
                    <Text style={styles.panelTitle}>Your first badge is still ahead.</Text>
                    <Text style={styles.panelBody}>Milestones appear here as you explore, connect, and complete Adventures.</Text>
                  </View>
                )}
              </View>
            ) : null}

            {mode === 'memories' ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeadingRow}>
                  <View><Text style={styles.panelEyebrow}>YOUR PERSONAL ARCHIVE</Text><Text style={styles.sectionTitle}>Memories</Text></View>
                  <Text style={styles.muted}>{photos.length} saved</Text>
                </View>
                <Text style={styles.panelBody}>Moments from the adventures you’ve lived. Keep them private, share them with MA members, or make selected memories public.</Text>
                <View style={styles.memoryActions}>
                  <Pressable style={styles.memoryPrimary} onPress={() => router.push('/passport/memories')}>
                    <Text style={styles.memoryPrimaryText}>Open Memories</Text>
                  </Pressable>
                  <Pressable style={styles.memorySecondary} onPress={() => router.push('/passport/memories/add')}>
                    <Text style={styles.memorySecondaryText}>+ Add</Text>
                  </Pressable>
                </View>
                {photos.length ? (
                  <View style={styles.grid}>
                    {photos.slice(0, 4).map((photo) => (
                      <Pressable key={photo.id} style={styles.photoTile} onPress={() => router.push(`/passport/memories/photo/${photo.id}`)}>
                        <Image source={{ uri: photo.image_url }} style={styles.photo} />
                        <Text style={styles.photoText} numberOfLines={2}>{photo.caption || 'Adventure memory'}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.sectionPanel}>
                    <Text style={styles.panelTitle}>{journey.length ? 'Your adventures already have stories.' : 'Your scrapbook has open pages.'}</Text>
                    <Text style={styles.panelBody}>{journey.length ? 'Add a personal photo or save an event photo to start building your Memories.' : 'Complete an official MA Adventure and your Memories can begin.'}</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={styles.timeline}>
            <View style={styles.rail}>
              <View style={styles.timelineDot} />
              {index < journey.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <Pressable style={styles.timelineCard} onPress={() => router.push(`/passport/reflection/${item.adventure_id}`)}>
              <Text style={styles.date}>{new Date(item.experienced_at || item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={styles.tileTitle}>{item.title}</Text>
              <Text style={styles.muted}>{item.category} · {item.city}, {item.state}</Text>
              <Text style={styles.link}>Open Stamp & Memories</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48 },
  header: { gap: 14, marginBottom: 12 },
  pageIntro: { gap: 4 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 36, fontWeight: '900' },
  identity: { minHeight: 184, backgroundColor: '#1B2922', borderRadius: 24, borderWidth: 1, borderColor: '#35483C', padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  identityGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -50, top: -35, backgroundColor: 'rgba(215,180,90,0.065)' },
  identityText: { flex: 1, zIndex: 2, paddingRight: 8 },
  heroEmblem: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  name: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' },
  username: { color: '#A4B0A8', marginTop: 3 },
  rank: { color: '#F0D083', fontWeight: '900', marginTop: 9, fontSize: 16 },
  joined: { color: '#87948B', fontSize: 11, marginTop: 4, lineHeight: 16 },
  rankProgress: { color: '#C7B77F', fontSize: 11, fontWeight: '800', marginTop: 8 },
  journeyBar: { minHeight: 120, backgroundColor: '#18271F', borderWidth: 1, borderColor: '#34483C', borderRadius: 20, padding: 16 },
  journeyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  journeyMini: { color: '#89968E', fontSize: 10, fontWeight: '700' },
  journeyHero: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', lineHeight: 25, marginTop: 9, maxWidth: '88%' },
  ladder: { backgroundColor: '#151F1A', borderRadius: 20, borderWidth: 1, borderColor: '#2B3931', padding: 16 },
  rankTrailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  rankTrailCopy: { flex: 1 },
  ladderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  rankStep: { width: '16%', alignItems: 'center' },
  rankEmblemShell: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  rankEmblemCurrent: { backgroundColor: 'rgba(215,180,90,0.09)', borderWidth: 1, borderColor: 'rgba(215,180,90,0.46)' },
  rankLabel: { color: '#657169', fontSize: 8, lineHeight: 10, textAlign: 'center', marginTop: 7 },
  rankDone: { color: '#D4DAD6', fontWeight: '800' },
  rankCurrent: { color: '#F0D083' },
  rankMin: { color: '#5E6A62', fontSize: 8, marginTop: 3 },
  rankMinCurrent: { color: '#BFA653' },
  rankTrailCount: { color: '#8D998F', fontSize: 10, fontWeight: '700', paddingTop: 4 },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 12 },
  modeTabs: { flexDirection: 'row', backgroundColor: '#141E19', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 4, gap: 3 },
  modeTab: { flex: 1, minHeight: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  modeTabActive: { backgroundColor: '#213028', borderColor: '#D7B45A' },
  modeCount: { color: '#91A097', fontSize: 18, fontWeight: '900' },
  modeCountActive: { color: '#F2D476' },
  modeLabel: { color: '#7E8B83', fontSize: 9, fontWeight: '700', marginTop: 2 },
  modeLabelActive: { color: '#FFF2C7' },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, paddingTop: 2 },
  sectionBlock: { gap: 10 },
  sectionPanel: { backgroundColor: '#18231D', borderRadius: 18, borderWidth: 1, borderColor: '#2A3830', padding: 18 },
  panelEyebrow: { color: '#9A8860', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  panelTitle: { color: '#FFF8E8', fontSize: 19, lineHeight: 23, fontWeight: '900', marginTop: 4 },
  panelBody: { color: '#8F9B93', lineHeight: 19, marginTop: 7 },
  muted: { color: '#8F9B93', lineHeight: 19, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 2, alignItems: 'flex-start' },
  stamp: { width: '48%', backgroundColor: '#141D18', borderRadius: 18, borderWidth: 1, borderColor: '#3B463E', padding: 10, alignItems: 'center' },
  stampArtwork: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  stampSeal: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 18 },
  stampGlyph: { color: '#D7B45A', fontSize: 17, fontWeight: '900' },
  tileTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 7, alignSelf: 'stretch' },
  badgeTile: { width: '48%', backgroundColor: '#141D18', borderRadius: 18, borderWidth: 1, borderColor: '#445447', padding: 10, alignItems: 'center' },
  badgeArtwork: { minHeight: 146, width: '100%', alignItems: 'center', justifyContent: 'center' },
  badgeCategory: { color: '#C7A953', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, alignSelf: 'stretch', marginTop: 4 },
  badgeEarned: { color: '#75837A', fontSize: 10, alignSelf: 'stretch', marginTop: 4 },
  medal: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#26372D', borderWidth: 3, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  medalGlyph: { color: '#F0D083', fontSize: 17, fontWeight: '900' },
  memoryActions: { flexDirection: 'row', gap: 9 },
  memoryPrimary: { flex: 1, backgroundColor: '#D7B45A', borderRadius: 13, padding: 13, alignItems: 'center' },
  memoryPrimaryText: { color: '#142019', fontWeight: '900' },
  memorySecondary: { minWidth: 78, borderWidth: 1, borderColor: '#D7B45A', borderRadius: 13, padding: 13, alignItems: 'center' },
  memorySecondaryText: { color: '#F0D083', fontWeight: '900' },
  photoTile: { width: '48%', backgroundColor: '#17211C', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3931' },
  photo: { width: '100%', aspectRatio: 1 },
  photoText: { color: '#C7D0CA', fontSize: 12, padding: 9 },
  timeline: { flexDirection: 'row' },
  rail: { width: 26, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7B45A', marginTop: 20 },
  line: { width: 1, flex: 1, backgroundColor: '#405047', marginTop: 5 },
  timelineCard: { flex: 1, backgroundColor: '#17211C', borderRadius: 17, borderWidth: 1, borderColor: '#28362E', padding: 16, marginBottom: 12 },
  date: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  error: { color: '#FFB4A9' },
});
