import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { AdventureJourney } from '../../src/passport/AdventureJourney';
import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { RankEmblem, rankFor, rankLadder, type RankName } from '../../src/passport/RankEmblem';
import { isLegacyStampCode, StampArt } from '../../src/passport/StampArt';

const STAMP_PREVIEW_COUNT = 6;
const BADGE_PREVIEW_COUNT = 4;

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
  const [showAllStamps, setShowAllStamps] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
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
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || 'Member';
  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Recently';
  const visibleStamps = showAllStamps ? stamps : stamps.slice(0, STAMP_PREVIEW_COUNT);
  const visibleBadges = showAllBadges ? badges : badges.slice(0, BADGE_PREVIEW_COUNT);
  const featuredMemory = photos[0] ?? null;
  const featuredAdventure = featuredMemory
    ? journey.find((item) => item.adventure_id === featuredMemory.adventure_id) ?? null
    : null;

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor="#D7B45A"
          />
        )}
      >
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>EVERY ADVENTURE LEAVES A MARK</Text>
          <Text style={styles.title}>Passport</Text>
        </View>

        <View style={styles.identity}>
          <View style={styles.identityGlow} />
          <View style={styles.identityMainRow}>
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
            <View style={styles.heroEmblem}><RankEmblem rank={currentRank} size={112} /></View>
          </View>
          <View style={styles.identityStats}>
            <View style={styles.identityStat}>
              <Text style={styles.identityStatNumber}>{stamps.length}</Text>
              <Text style={styles.identityStatLabel}>STAMPS</Text>
            </View>
            <View style={styles.identityStatDivider} />
            <View style={styles.identityStat}>
              <Text style={styles.identityStatNumber}>{badges.length}</Text>
              <Text style={styles.identityStatLabel}>BADGES</Text>
            </View>
          </View>
        </View>

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.panelEyebrow}>MY JOURNEY</Text>
              <Text style={styles.sectionTitle}>Adventure Journey</Text>
            </View>
            <Text style={styles.muted}>{journey.length} adventure{journey.length === 1 ? '' : 's'}</Text>
          </View>
          {journey.length ? (
            <AdventureJourney />
          ) : (
            <View style={styles.sectionPanel}>
              <Text style={styles.panelTitle}>Your first chapter is waiting.</Text>
              <Text style={styles.panelBody}>Complete an official MA Adventure and your searchable journey will begin here.</Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionBlock, styles.collectionSection]}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.panelEyebrow}>COLLECTED SEALS</Text>
              <Text style={styles.sectionTitle}>Stamp Book</Text>
              <Text style={styles.sectionSub}>Proof of the adventures you were there for.</Text>
            </View>
            {stamps.length > STAMP_PREVIEW_COUNT ? (
              <Pressable onPress={() => setShowAllStamps((value) => !value)} hitSlop={8}>
                <Text style={styles.viewAll}>{showAllStamps ? 'Show less' : 'View all'}</Text>
              </Pressable>
            ) : null}
          </View>
          {stamps.length ? (
            <View style={styles.grid}>
              {visibleStamps.map((stamp) => (
                <Pressable
                  key={`${stamp.stamp_id}-${stamp.adventure_id}`}
                  style={styles.stamp}
                  onPress={() => stamp.adventure_id && router.push(`/passport/reflection/${stamp.adventure_id}`)}
                >
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

        <View style={[styles.sectionBlock, styles.collectionSection]}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.panelEyebrow}>SPECIAL MILESTONES</Text>
              <Text style={styles.sectionTitle}>Achievement Badges</Text>
              <Text style={styles.sectionSub}>Recognition for what you accomplish along the way.</Text>
            </View>
            {badges.length > BADGE_PREVIEW_COUNT ? (
              <Pressable onPress={() => setShowAllBadges((value) => !value)} hitSlop={8}>
                <Text style={styles.viewAll}>{showAllBadges ? 'Show less' : 'View all'}</Text>
              </Pressable>
            ) : null}
          </View>
          {badges.length ? (
            <View style={styles.grid}>
              {visibleBadges.map((badge) => (
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

        <View style={[styles.sectionBlock, styles.collectionSection]}>
          <View style={styles.memoryHeadingRow}>
            <View style={styles.memoryHeadingCopy}>
              <Text style={styles.panelEyebrow}>YOUR PERSONAL ARCHIVE</Text>
              <Text style={styles.sectionTitle}>Memories</Text>
            </View>
            <View style={styles.memoryCountChip}>
              <Text style={styles.memoryCountText}>{photos.length} SAVED</Text>
            </View>
          </View>
          <Text style={styles.memoryIntro}>The moments you chose to keep.</Text>

          {featuredMemory ? (
            <>
              <Pressable style={styles.memoryHeroCard} onPress={() => router.push(`/passport/memories/photo/${featuredMemory.id}`)}>
                <Image source={{ uri: featuredMemory.image_url }} style={styles.memoryHeroImage} />
                <View style={styles.memoryHeroShade} />
                <View style={styles.memoryHeroTopRow}>
                  <View style={styles.memoryHeroBadge}>
                    <Text style={styles.memoryHeroBadgeText}>LATEST MEMORY</Text>
                  </View>
                </View>
                <View style={styles.memoryHeroCopy}>
                  <Text style={styles.memoryHeroTitle} numberOfLines={2}>{featuredMemory.caption || featuredAdventure?.title || 'Adventure memory'}</Text>
                  <Text style={styles.memoryHeroMeta} numberOfLines={1}>
                    {featuredAdventure
                      ? `${new Date(featuredAdventure.experienced_at || featuredAdventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${featuredAdventure.city}, ${featuredAdventure.state}`
                      : 'Saved to your Passport'}
                  </Text>
                  {featuredMemory.caption && featuredAdventure ? (
                    <Text style={styles.memoryHeroAdventure} numberOfLines={1}>{featuredAdventure.title}</Text>
                  ) : null}
                </View>
                <View style={styles.memoryHeroArrow}><Text style={styles.memoryHeroArrowText}>→</Text></View>
              </Pressable>

              <View style={styles.memoryFooterActions}>
                <Pressable style={styles.memoryAddButton} onPress={() => router.push('/passport/memories/add')}>
                  <Text style={styles.memoryAddButtonText}>+ Add Memory</Text>
                </Pressable>
                <Pressable style={styles.memoryViewAll} onPress={() => router.push('/passport/memories')}>
                  <Text style={styles.memoryViewAllText}>View All Memories →</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.sectionPanel}>
              <Text style={styles.panelTitle}>{journey.length ? 'Your adventures already have stories.' : 'Your scrapbook has open pages.'}</Text>
              <Text style={styles.panelBody}>{journey.length ? 'Add a personal photo or save an event photo to start building your Memories.' : 'Complete an official MA Adventure and your Memories can begin.'}</Text>
              {journey.length ? (
                <Pressable style={styles.memoryEmptyAction} onPress={() => router.push('/passport/memories/add')}>
                  <Text style={styles.memoryEmptyActionText}>+ Add your first memory</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  pageIntro: { gap: 4 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 36, fontWeight: '900' },
  identity: { backgroundColor: '#1B2922', borderRadius: 24, borderWidth: 1, borderColor: '#35483C', padding: 18, overflow: 'hidden' },
  identityGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -50, top: -35, backgroundColor: 'rgba(215,180,90,0.065)' },
  identityMainRow: { flexDirection: 'row', alignItems: 'center' },
  identityText: { flex: 1, zIndex: 2, paddingRight: 8 },
  heroEmblem: { width: 116, height: 116, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  name: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' },
  username: { color: '#A4B0A8', marginTop: 3 },
  rank: { color: '#F0D083', fontWeight: '900', marginTop: 9, fontSize: 16 },
  joined: { color: '#87948B', fontSize: 11, marginTop: 4, lineHeight: 16 },
  rankProgress: { color: '#C7B77F', fontSize: 11, fontWeight: '800', marginTop: 8 },
  identityStats: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#35483C', flexDirection: 'row', alignItems: 'center' },
  identityStat: { flex: 1, alignItems: 'center' },
  identityStatNumber: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  identityStatLabel: { color: '#8B9990', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  identityStatDivider: { width: 1, height: 28, backgroundColor: '#3A4B41' },
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
  sectionSub: { color: '#8F9B93', fontSize: 11, marginTop: 3, maxWidth: 260 },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 12 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, paddingTop: 2 },
  sectionBlock: { gap: 10 },
  collectionSection: { marginTop: 6 },
  sectionPanel: { backgroundColor: '#18231D', borderRadius: 18, borderWidth: 1, borderColor: '#2A3830', padding: 18 },
  panelEyebrow: { color: '#9A8860', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  panelTitle: { color: '#FFF8E8', fontSize: 19, lineHeight: 23, fontWeight: '900', marginTop: 4 },
  panelBody: { color: '#8F9B93', lineHeight: 19, marginTop: 7 },
  muted: { color: '#8F9B93', lineHeight: 19, marginTop: 4 },
  viewAll: { color: '#35D4C8', fontSize: 11, fontWeight: '900', paddingBottom: 2 },
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
  memoryHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  memoryHeadingCopy: { flex: 1 },
  memoryCountChip: { borderWidth: 1, borderColor: 'rgba(215,180,90,0.42)', backgroundColor: 'rgba(215,180,90,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  memoryCountText: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  memoryIntro: { color: '#9AA79F', fontSize: 14, lineHeight: 19 },
  memoryHeroCard: { minHeight: 300, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#405346', backgroundColor: '#17211C', position: 'relative' },
  memoryHeroImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  memoryHeroShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(7,12,9,0.34)' },
  memoryHeroTopRow: { position: 'absolute', left: 14, right: 14, top: 14, flexDirection: 'row', justifyContent: 'space-between' },
  memoryHeroBadge: { backgroundColor: 'rgba(15,23,19,0.78)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,248,232,0.18)', paddingHorizontal: 9, paddingVertical: 6 },
  memoryHeroBadgeText: { color: '#FFF1C4', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  memoryHeroCopy: { marginTop: 'auto', padding: 18, paddingRight: 54, backgroundColor: 'rgba(9,14,11,0.58)' },
  memoryHeroTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  memoryHeroMeta: { color: '#E3E9E5', fontSize: 11, marginTop: 5 },
  memoryHeroAdventure: { color: '#E6C76D', fontSize: 11, fontWeight: '900', marginTop: 6 },
  memoryHeroArrow: { position: 'absolute', right: 16, bottom: 18, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(215,180,90,0.94)', alignItems: 'center', justifyContent: 'center' },
  memoryHeroArrowText: { color: '#142019', fontSize: 18, lineHeight: 20, fontWeight: '900' },
  memoryFooterActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 2 },
  memoryAddButton: { borderWidth: 1, borderColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  memoryAddButtonText: { color: '#F0D083', fontSize: 12, fontWeight: '900' },
  memoryViewAll: { flex: 1, alignItems: 'flex-end', paddingVertical: 10 },
  memoryViewAllText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  memoryEmptyAction: { marginTop: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  memoryEmptyActionText: { color: '#F0D083', fontWeight: '900', fontSize: 12 },
  error: { color: '#FFB4A9' },
});