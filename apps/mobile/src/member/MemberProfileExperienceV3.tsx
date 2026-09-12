import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getConnections, type Connection } from '../community/circles';
import { getMemberBasecamp } from './api';
import LegacyMemberProfileExperience from './MemberProfileExperience';
import { ProfilePosts } from './ProfilePosts';
import {
  getJourney,
  getMemberBadges,
  getMemoryAlbums,
  getPassportStamps,
  type JourneyItem,
  type MemberBadge,
  type MemoryAlbum,
  type MemoryPhoto,
  type PassportStamp,
} from '../passport/api';
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import { resolveStampCatalogItem, type StampCatalogItem } from '../passport/StampCatalog';
import { RankEmblem, rankFor, rankLadder } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';

type ProfileTab = 'journey' | 'posts' | 'photos' | 'about';
type EarnedStampCard = { stamp: PassportStamp; art: StampCatalogItem };

function Avatar({ url, name, size = 76 }: { url?: string | null; name?: string | null; size?: number }) {
  const radius = size / 2;
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#F5C341' }} />;
  return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: size * .4, fontWeight: '900', color: '#121A17' }}>{String(name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>;
}

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function placeLabel(item: JourneyItem) {
  return [item.city, item.state].filter(Boolean).join(', ');
}

function FeaturedStamp({ item }: { item: EarnedStampCard }) {
  return <Pressable style={({ pressed }) => [styles.recognitionItem, pressed && styles.pressed]} onPress={() => router.push('/member/stamps')}>
    <Image source={item.art.source} style={styles.stampImage} resizeMode="contain" />
    <Text style={styles.recognitionTitle} numberOfLines={2}>{item.stamp.title}</Text>
  </Pressable>;
}

function FeaturedBadge({ badge }: { badge: MemberBadge }) {
  return <Pressable style={({ pressed }) => [styles.recognitionItem, pressed && styles.pressed]} onPress={() => router.push('/member/badges')}>
    <BadgeArt title={badge.title} size={96} />
    <Text style={styles.recognitionTitle} numberOfLines={2}>{badge.title}</Text>
  </Pressable>;
}

export default function MemberProfileExperienceV3() {
  const params = useLocalSearchParams<{ edit?: string }>();
  if (params.edit === '1') return <LegacyMemberProfileExperience />;
  return <OptimizedProfile />;
}

function OptimizedProfile() {
  const [tab, setTab] = useState<ProfileTab>('journey');
  const [data, setData] = useState<any>(null);
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [base, nextJourney, nextStamps, nextBadges, nextAlbums, nextConnections] = await Promise.all([
        getMemberBasecamp(), getJourney(), getPassportStamps(), getMemberBadges(), getMemoryAlbums(), getConnections(),
      ]);
      setData(base);
      setJourney(nextJourney);
      setStamps(nextStamps);
      setBadges(nextBadges);
      setAlbums(nextAlbums);
      setConnections(nextConnections);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const profile = data?.profile ?? {};
  const trailmates = useMemo(() => connections.filter((item) => item.status === 'accepted'), [connections]);
  const pendingConnections = useMemo(() => connections.filter((item) => item.status === 'pending'), [connections]);
  const uniquePlaces = useMemo(() => new Set(journey.map((item) => `${item.city}|${item.state}`.toLowerCase()).filter(Boolean)).size, [journey]);
  const rank = useMemo(() => rankFor(journey.length), [journey.length]);
  const currentRank = useMemo(() => rankLadder.find(([name]) => name === rank), [rank]);
  const nextRank = useMemo(() => rankLadder.find(([, minimum]) => minimum > journey.length), [journey.length]);
  const remaining = nextRank ? Math.max(0, nextRank[1] - journey.length) : 0;
  const rankProgress = useMemo(() => {
    if (!nextRank) return 1;
    const floor = currentRank?.[1] ?? 0;
    return Math.min(1, Math.max(0, (journey.length - floor) / Math.max(1, nextRank[1] - floor)));
  }, [journey.length, currentRank, nextRank]);
  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');

  const featuredBadges = useMemo(() => {
    const seen = new Set<string>();
    return badges.filter((badge) => {
      const key = badge.title.trim().toLowerCase();
      if (!hasBadgeArt(badge.title) || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }, [badges]);

  const earnedStampCards = useMemo<EarnedStampCard[]>(() => {
    const seen = new Set<string>();
    const resolved: EarnedStampCard[] = [];
    for (const stamp of stamps) {
      const art = resolveStampCatalogItem(stamp);
      if (!art || seen.has(art.id)) continue;
      seen.add(art.id);
      resolved.push({ stamp, art });
      if (resolved.length === 3) break;
    }
    return resolved;
  }, [stamps]);

  const albumByAdventure = useMemo(() => new Map(albums.map((album) => [album.adventure_id, album])), [albums]);
  const stampArtByAdventure = useMemo(() => {
    const map = new Map<string, EarnedStampCard>();
    for (const stamp of stamps) {
      if (!stamp.adventure_id || map.has(stamp.adventure_id)) continue;
      const art = resolveStampCatalogItem(stamp);
      if (art) map.set(stamp.adventure_id, { stamp, art });
    }
    return map;
  }, [stamps]);

  const latestAdventure = journey[0] ?? null;
  const latestAlbum = latestAdventure ? albumByAdventure.get(latestAdventure.adventure_id) : null;
  const latestStamp = latestAdventure ? stampArtByAdventure.get(latestAdventure.adventure_id) : null;
  const coverUrl = profile.cover_url ?? albums[0]?.cover_url ?? null;
  const recentAdventures = journey.slice(1, 6);

  const favoriteMemories = useMemo(() => {
    const all = albums.flatMap((album) => album.memories).filter((memory) => Boolean(memory.image_url));
    const ordered = [...all.filter((memory) => memory.featured), ...all.filter((memory) => !memory.featured)];
    const seen = new Set<string>();
    const unique: MemoryPhoto[] = [];
    for (const memory of ordered) {
      const key = memory.image_url.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(memory);
      if (unique.length === 6) break;
    }
    return unique;
  }, [albums]);

  const completionItems = useMemo(() => [
    Boolean(profile.avatar_url), Boolean(profile.cover_url), Boolean(profile.bio?.trim()), Boolean(profile.username?.trim()), Boolean(location), Array.isArray(profile.interests) && profile.interests.length > 0,
  ], [profile.avatar_url, profile.cover_url, profile.bio, profile.username, profile.interests, location]);
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  const statItems = [
    { label: 'Adventures', value: journey.length, onPress: () => router.push('/member/journey') },
    { label: 'Places', value: uniquePlaces, onPress: () => router.push('/member/journey') },
    { label: 'TrailMates', value: trailmates.length, onPress: () => router.push('/connections' as never) },
    { label: 'Stamps', value: stamps.length, onPress: () => router.push('/member/stamps') },
  ].filter((item) => item.value > 0);

  async function shareProfile() {
    const display = profile.display_name ?? 'Go Melanated member';
    const summary = [journey.length ? `${journey.length} adventures` : null, uniquePlaces ? `${uniquePlaces} places` : null, trailmates.length ? `${trailmates.length} Trailmates` : null].filter(Boolean).join(', ');
    await Share.share({ message: `${display}${profile.username ? ` (@${profile.username})` : ''} on Go Melanated${summary ? `: ${summary}` : '.'}` });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    {message ? <View style={styles.errorBanner}><Text style={styles.errorText}>{message}</Text></View> : null}

    <View style={styles.hero}>
      {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.coverImage} /> : <View style={styles.coverPlaceholder}><AppIcon name="adventure" color="#D7B45A" size={36} /></View>}
      <View style={styles.heroShade} />
      <View style={styles.heroActions}>
        <Pressable onPress={() => void shareProfile()} style={styles.heroAction}><AppIcon name="share" color="#FFF8E8" size={16} /></Pressable>
        <Pressable onPress={() => router.push('/member/profile?edit=1' as never)} style={styles.heroActionWide}><AppIcon name="edit" color="#FFF8E8" size={14} /><Text style={styles.heroActionText}>Edit</Text></Pressable>
      </View>
    </View>

    <View style={styles.identityRow}>
      <View style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name} size={88} /></View>
      <View style={styles.identityCopy}>
        <Text style={styles.name} numberOfLines={2}>{profile.display_name ?? 'Adventurer'}</Text>
        {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
        {profile.city_visible !== false && location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14} /><Text style={styles.location}>{location}</Text></View> : null}
        <View style={styles.rankLine}><RankEmblem rank={rank} size={23} /><Text style={styles.rankLineText}>{rank}</Text></View>
      </View>
    </View>

    {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : <Pressable onPress={() => router.push('/member/profile?edit=1' as never)} style={styles.bioPrompt}><AppIcon name="edit" color="#D7B45A" size={16} /><Text style={styles.bioPromptText}>Add a bio so people know what kind of outside you love.</Text></Pressable>}
    {Array.isArray(profile.interests) && profile.interests.length ? <View style={styles.headerChips}>{profile.interests.slice(0, 6).map((interest: string) => <Text key={interest} style={styles.headerChip}>{interest}</Text>)}</View> : null}

    {statItems.length ? <View style={styles.statsRow}>{statItems.map((item, index) => <Pressable key={item.label} onPress={item.onPress} style={styles.statCell}><Text style={styles.statValue}>{item.value}</Text><Text style={styles.statLabel}>{item.label}</Text>{index < statItems.length - 1 ? <View style={styles.statDivider} /> : null}</Pressable>)}</View> : null}

    <View style={styles.tabs}>{(['journey', 'posts', 'photos', 'about'] as ProfileTab[]).map((value) => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>{tab === value ? <View style={styles.tabUnderline} /> : null}</Pressable>)}</View>

    {tab === 'journey' ? <View style={styles.tabContent}>
      {completion < 100 ? <Pressable onPress={() => router.push('/member/profile?edit=1' as never)} style={styles.completionNudge}><View style={styles.completionCopy}><Text style={styles.eyebrow}>PROFILE</Text><Text style={styles.completionText}>{completion}% complete</Text></View><View style={styles.completionProgress}><View style={[styles.completionProgressFill, { width: `${completion}%` }]} /></View><Text style={styles.sectionLink}>Finish</Text></Pressable> : null}

      {latestAdventure ? <>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>YOUR TRAIL</Text><Text style={styles.sectionTitle}>Latest Chapter</Text></View><Pressable onPress={() => router.push('/member/journey')}><Text style={styles.sectionLink}>View full Trail</Text></Pressable></View>
        <Pressable onPress={() => router.push(`/passport/memories/${latestAdventure.adventure_id}` as never)} style={({ pressed }) => [styles.latestChapter, pressed && styles.pressed]}>
          {latestAlbum?.cover_url ? <Image source={{ uri: latestAlbum.cover_url }} style={styles.latestImage} /> : latestStamp ? <View style={styles.latestStampStage}><Image source={latestStamp.art.source} style={styles.latestStampArt} resizeMode="contain" /></View> : <View style={styles.latestFallback}><AppIcon name="adventure" color="#D7B45A" size={34} /></View>}
          <View style={styles.latestShade} />
          <View style={styles.latestBody}><Text style={styles.latestTitle}>{latestAdventure.title}</Text><Text style={styles.latestMeta}>{placeLabel(latestAdventure)}{placeLabel(latestAdventure) ? ' · ' : ''}{formatDate(latestAdventure.experienced_at || latestAdventure.starts_at)}</Text><View style={styles.latestLink}><Text style={styles.latestLinkText}>Open chapter</Text><AppIcon name="chevron-forward" color="#17211C" size={16} /></View></View>
        </Pressable>
      </> : <Pressable onPress={() => router.push('/(tabs)/explore' as never)} style={styles.emptyTrail}><View style={styles.emptyTrailIcon}><AppIcon name="adventure" color="#D7B45A" size={23} /></View><View style={styles.emptyTrailCopy}><Text style={styles.emptyTrailTitle}>Your Trail starts with your first completed adventure</Text><Text style={styles.emptyTrailBody}>When an adventure becomes part of your history, its chapter will appear here.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18} /></Pressable>}

      {recentAdventures.length ? <>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Recent Adventures</Text><Text style={styles.sectionSub}>More chapters from your Trail.</Text></View><Pressable onPress={() => router.push('/member/journey')}><Text style={styles.sectionLink}>View all</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adventureRail}>{recentAdventures.map((item) => {
          const album = albumByAdventure.get(item.adventure_id);
          const stamp = stampArtByAdventure.get(item.adventure_id);
          return <Pressable key={item.adventure_id} onPress={() => router.push(`/passport/memories/${item.adventure_id}` as never)} style={({ pressed }) => [styles.adventureCard, pressed && styles.pressed]}>
            <View style={styles.adventureMedia}>{album?.cover_url ? <Image source={{ uri: album.cover_url }} style={styles.adventureImage} /> : stamp ? <View style={styles.adventureStampStage}><Image source={stamp.art.source} style={styles.adventureStampArt} resizeMode="contain" /></View> : <View style={styles.adventureImageFallback}><AppIcon name="adventure" color="#D7B45A" size={24} /></View>}</View>
            <View style={styles.adventureBody}><Text style={styles.adventureTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.adventureMeta} numberOfLines={1}>{placeLabel(item)}</Text><Text style={styles.adventureMeta}>{formatDate(item.experienced_at || item.starts_at)}{item.photo_count ? ` · ${item.photo_count} photo${item.photo_count === 1 ? '' : 's'}` : ''}</Text></View>
          </Pressable>;
        })}</ScrollView>
      </> : null}

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Your People</Text><Text style={styles.sectionSub}>{trailmates.length ? `${trailmates.length} TrailMate${trailmates.length === 1 ? '' : 's'}` : 'Your Trail Crew grows with every connection.'}</Text></View><Pressable onPress={() => router.push('/connections' as never)}><Text style={styles.sectionLink}>View crew</Text></Pressable></View>
      <Pressable onPress={() => router.push('/connections' as never)} style={styles.peopleStrip}>
        <View style={styles.peopleAvatars}>{trailmates.slice(0, 6).map((connection, index) => <View key={connection.connection_id} style={[styles.personAvatar, index > 0 && styles.personAvatarOverlap]}>{connection.avatar_url ? <Image source={{ uri: connection.avatar_url }} style={styles.personAvatarImage} /> : <Text style={styles.personAvatarText}>{initials(connection.display_name)}</Text>}</View>)}{!trailmates.length ? <View style={styles.emptyPerson}><AppIcon name="connections" color="#D7B45A" size={22} /></View> : null}</View>
        <View style={styles.peopleCopy}><Text style={styles.peopleTitle}>{trailmates.length ? `${trailmates.length} in your Trail Crew` : 'Find your people'}</Text><Text style={styles.peopleMeta}>{pendingConnections.length ? `${pendingConnections.length} pending request${pendingConnections.length === 1 ? '' : 's'}` : trailmates.length ? 'See everyone you have connected with.' : 'Connections you make will appear here.'}</Text></View>
        <AppIcon name="chevron-forward" color="#D7B45A" size={18} />
      </Pressable>

      {favoriteMemories.length ? <>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Favorite Memories</Text><Text style={styles.sectionSub}>The photos worth keeping close.</Text></View><Pressable onPress={() => setTab('photos')}><Text style={styles.sectionLink}>See photos</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryRail}>{favoriteMemories.map((memory) => <Pressable key={memory.id} onPress={() => router.push(`/passport/memories/photo/${memory.id}` as never)} style={[styles.memoryCard, favoriteMemories.length < 3 && styles.memoryCardWide]}><Image source={{ uri: memory.image_url }} style={styles.memoryImage} />{memory.featured ? <View style={styles.favoritePill}><Text style={styles.favoriteText}>Favorite</Text></View> : null}</Pressable>)}</ScrollView>
      </> : null}

      {featuredBadges.length ? <><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Badge Showcase</Text><Text style={styles.sectionSub}>Recognition earned through participation.</Text></View><Pressable onPress={() => router.push('/member/badges')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{featuredBadges.map((badge) => <FeaturedBadge key={badge.badge_id} badge={badge} />)}</ScrollView></> : null}
      {earnedStampCards.length ? <><View style={[styles.sectionHeader, styles.recognitionSectionSpacing]}><View><Text style={styles.sectionTitle}>Featured Stamps</Text><Text style={styles.sectionSub}>Adventure stamps from your Trail.</Text></View><Pressable onPress={() => router.push('/member/stamps')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{earnedStampCards.map((item) => <FeaturedStamp key={item.stamp.stamp_id} item={item} />)}</ScrollView></> : null}
    </View> : null}

    {tab === 'posts' ? <View style={styles.tabContent}><ProfilePosts /></View> : null}

    {tab === 'photos' ? <View style={styles.tabContent}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.sectionSub}>Your adventure albums and saved memories.</Text></View></View>{albums.map((album) => <Pressable key={album.adventure_id} style={({ pressed }) => [styles.photoAlbumCard, pressed && styles.pressed]} onPress={() => router.push(`/passport/photos/${album.adventure_id}` as never)}><View style={styles.albumCoverWrap}>{album.cover_url ? <Image source={{ uri: album.cover_url }} style={styles.albumCover} /> : <View style={styles.albumCoverPlaceholder}><AppIcon name="photos" color="#D7B45A" size={34} /></View>}<View style={styles.albumCountPill}><AppIcon name="photos" color="#FFF8E8" size={12} /><Text style={styles.albumCountText}>{album.memories.length}</Text></View></View><View style={styles.albumFooter}><View style={{ flex: 1 }}><Text style={styles.albumTitle}>{album.title}</Text><Text style={styles.albumMeta}>{placeLabel(album)}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18} /></View></Pressable>)}{!albums.length ? <View style={styles.empty}><AppIcon name="photos" color="#D7B45A" size={28} /><Text style={styles.emptyTitle}>Your photo story starts with a memory</Text><Text style={styles.muted}>Photos you save from adventures will collect here.</Text></View> : null}</View> : null}

    {tab === 'about' ? <View style={styles.tabContent}>
      <View style={styles.aboutCard}><View style={styles.rankHeader}><RankEmblem rank={rank} size={38} /><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{rank}</Text><Text style={styles.sectionSub}>{nextRank ? `${remaining} adventure${remaining === 1 ? '' : 's'} to ${nextRank[0]}` : 'Highest rank reached'}</Text></View></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(8, rankProgress * 100)}%` }]} /></View></View>
      <View style={styles.aboutCard}><Text style={styles.sectionTitle}>About you</Text>{location ? <View style={styles.aboutRow}><AppIcon name="location" color="#D7B45A" size={18} /><View><Text style={styles.aboutLabel}>Home base</Text><Text style={styles.aboutValue}>{location}</Text></View></View> : null}<View style={styles.aboutRow}><AppIcon name="calendar" color="#D7B45A" size={18} /><View><Text style={styles.aboutLabel}>Member since</Text><Text style={styles.aboutValue}>{profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Recently'}</Text></View></View></View>
      <View style={styles.aboutCard}><Text style={styles.sectionTitle}>Profile controls</Text><Pressable onPress={() => router.push('/member/profile?edit=1' as never)} style={styles.settingsRow}><AppIcon name="edit" color="#D7B45A" size={18} /><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Edit profile</Text><Text style={styles.settingsBody}>Photo, cover, bio, interests and home base.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable><Pressable onPress={() => router.push('/member/privacy' as never)} style={styles.settingsRow}><AppIcon name="privacy" color="#D7B45A" size={18} /><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Privacy</Text><Text style={styles.settingsBody}>Control what other members can see.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable><Pressable onPress={() => router.push('/member/discovery-settings' as never)} style={styles.settingsRow}><AppIcon name="explore" color="#D7B45A" size={18} /><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Discovery</Text><Text style={styles.settingsBody}>Choose whether people can find you.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable>{profile.id ? <Pressable onPress={() => router.push(`/member/view-as-profile/${profile.id}` as never)} style={styles.settingsRow}><AppIcon name="privacy" color="#D7B45A" size={18} /><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>View as member</Text><Text style={styles.settingsBody}>Preview what your profile looks like to someone else.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable> : null}</View>
    </View> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 176, gap: 12 },
  tabContent: { gap: 18 },
  pressed: { opacity: .68 },
  errorBanner: { backgroundColor: '#2C1C19', borderWidth: 1, borderColor: '#6A3C33', borderRadius: 14, padding: 10 },
  errorText: { color: '#FFB4A9', fontSize: 12 },

  hero: { aspectRatio: 16 / 8.4, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#27332F', backgroundColor: '#111A17', position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,8,.2)' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14231C' },
  heroActions: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', gap: 8 },
  heroAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(9,17,15,.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  heroActionWide: { height: 36, borderRadius: 18, paddingHorizontal: 12, backgroundColor: 'rgba(9,17,15,.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,.2)', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  heroActionText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },

  identityRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 8, marginTop: -34, zIndex: 2 },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: '#09110F', backgroundColor: '#09110F' },
  identityCopy: { flex: 1, minWidth: 0, paddingTop: 38 },
  name: { fontSize: 27, lineHeight: 30, fontWeight: '900', color: '#F7F8F3', letterSpacing: -.4 },
  handle: { color: '#F5C341', fontSize: 13, fontWeight: '800', marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  location: { color: '#AEB9B4', fontSize: 13 },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rankLineText: { color: '#F7F8F3', fontSize: 12, fontWeight: '900' },
  bioText: { color: '#D4DBD7', fontSize: 14.5, lineHeight: 20, paddingHorizontal: 8 },
  bioPrompt: { marginHorizontal: 8, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#344239', backgroundColor: '#111A17', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bioPromptText: { color: '#BAC4BE', fontSize: 12.5, flex: 1 },
  headerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8 },
  headerChip: { color: '#E5C977', backgroundColor: '#203029', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10.5, fontWeight: '800' },

  statsRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#22302A' },
  statCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, position: 'relative' },
  statValue: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  statLabel: { color: '#93A097', fontSize: 10.5, fontWeight: '800' },
  statDivider: { position: 'absolute', right: 0, top: 5, bottom: 5, width: 1, backgroundColor: '#28352F' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#28322E' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabText: { color: '#A8B2AD', fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: '#F5C341' },
  tabUnderline: { height: 2, backgroundColor: '#F5C341', position: 'absolute', bottom: -1, left: 12, right: 12, borderRadius: 4 },

  completionNudge: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  completionCopy: { width: 82 },
  eyebrow: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  completionText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '900', marginTop: 2 },
  completionProgress: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#2B3730', overflow: 'hidden' },
  completionProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#D7B45A' },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 2 },
  sectionTitle: { color: '#F7F8F3', fontSize: 21, fontWeight: '900' },
  sectionSub: { color: '#8F9C95', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  sectionLink: { color: '#67CFC8', fontSize: 12, fontWeight: '900' },

  latestChapter: { minHeight: 238, borderRadius: 22, overflow: 'hidden', backgroundColor: '#15221C', position: 'relative' },
  latestImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  latestStampStage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15221C' },
  latestStampArt: { width: '58%', height: '78%' },
  latestFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15221C' },
  latestShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,8,.46)' },
  latestBody: { flex: 1, justifyContent: 'flex-end', padding: 17, alignItems: 'flex-start' },
  latestTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 28, fontWeight: '900', maxWidth: '92%' },
  latestMeta: { color: '#D4DED8', fontSize: 11.5, marginTop: 4 },
  latestLink: { marginTop: 11, minHeight: 34, borderRadius: 17, backgroundColor: '#D7B45A', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  latestLinkText: { color: '#17211C', fontSize: 11.5, fontWeight: '900' },
  emptyTrail: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  emptyTrailIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#18251F', alignItems: 'center', justifyContent: 'center' },
  emptyTrailCopy: { flex: 1 },
  emptyTrailTitle: { color: '#FFF8E8', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  emptyTrailBody: { color: '#8F9C95', fontSize: 10.5, lineHeight: 15, marginTop: 2 },

  adventureRail: { gap: 10, paddingRight: 54 },
  adventureCard: { width: 184, borderRadius: 17, overflow: 'hidden', backgroundColor: '#111A17' },
  adventureMedia: { height: 104, backgroundColor: '#18251F' },
  adventureImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  adventureStampStage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#17241E' },
  adventureStampArt: { width: '58%', height: '90%' },
  adventureImageFallback: { width: '100%', height: '100%', backgroundColor: '#192720', alignItems: 'center', justifyContent: 'center' },
  adventureBody: { paddingHorizontal: 10, paddingVertical: 10, gap: 3 },
  adventureTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', lineHeight: 17 },
  adventureMeta: { color: '#8F9C95', fontSize: 10.5 },

  peopleStrip: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#22302A' },
  peopleAvatars: { flexDirection: 'row', alignItems: 'center', paddingLeft: 2 },
  personAvatar: { width: 39, height: 39, borderRadius: 20, borderWidth: 2, borderColor: '#09110F', backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  personAvatarOverlap: { marginLeft: -10 },
  personAvatarImage: { width: '100%', height: '100%' },
  personAvatarText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  emptyPerson: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#223128', alignItems: 'center', justifyContent: 'center' },
  peopleCopy: { flex: 1, minWidth: 0 },
  peopleTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  peopleMeta: { color: '#8F9C95', fontSize: 10.5, lineHeight: 15, marginTop: 2 },

  memoryRail: { gap: 9, paddingRight: 16 },
  memoryCard: { width: 132, height: 132, borderRadius: 17, overflow: 'hidden', backgroundColor: '#18251F', position: 'relative' },
  memoryCardWide: { width: 168, height: 148 },
  memoryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  favoritePill: { position: 'absolute', left: 7, bottom: 7, backgroundColor: 'rgba(9,17,15,.84)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  favoriteText: { color: '#F5C341', fontSize: 8.5, fontWeight: '900' },

  recognitionSectionSpacing: { marginTop: 6 },
  recognitionRail: { gap: 15, paddingRight: 16, paddingVertical: 2 },
  recognitionItem: { width: 112, minHeight: 132, alignItems: 'center', justifyContent: 'flex-start' },
  stampImage: { width: 108, height: 120 },
  recognitionTitle: { width: 112, color: '#F7F8F3', fontWeight: '800', fontSize: 11.5, lineHeight: 14, textAlign: 'center', marginTop: 3 },

  photoAlbumCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#111A17', borderWidth: 1, borderColor: '#28362E' },
  albumCoverWrap: { width: '100%', aspectRatio: 16 / 8.5, position: 'relative', backgroundColor: '#17211C' },
  albumCover: { width: '100%', height: '100%', resizeMode: 'cover' },
  albumCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#17241E' },
  albumCountPill: { position: 'absolute', right: 10, top: 10, minHeight: 28, borderRadius: 14, paddingHorizontal: 9, backgroundColor: 'rgba(9,17,15,.82)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  albumCountText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' },
  albumFooter: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  albumTitle: { color: '#F7F8F3', fontSize: 15, fontWeight: '900' },
  albumMeta: { color: '#8F9B94', fontSize: 11, marginTop: 2 },
  empty: { borderRadius: 18, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#111A17', padding: 18, alignItems: 'center', gap: 5 },
  emptyTitle: { color: '#F7F8F3', fontWeight: '900', textAlign: 'center' },
  muted: { color: '#96A39B', lineHeight: 19 },

  aboutCard: { borderRadius: 18, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#111A17', padding: 15, gap: 12 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#2B3730', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#D7B45A' },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aboutLabel: { color: '#8E9A94', fontSize: 10, fontWeight: '800' },
  aboutValue: { color: '#FFF8E8', fontSize: 13, fontWeight: '800', marginTop: 1 },
  settingsRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#25312B', paddingTop: 10 },
  settingsCopy: { flex: 1 },
  settingsTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  settingsBody: { color: '#8F9C95', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
});
