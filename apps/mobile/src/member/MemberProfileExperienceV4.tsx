import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getConnections, type Connection } from '../community/circles'
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt'
import { getJourney, getMemberBadges, getMemoryAlbums, getPassportStamps, type JourneyItem, type MemberBadge, type MemoryAlbum, type MemoryPhoto, type PassportStamp } from '../passport/api'
import { rankFor, rankLadder } from '../passport/RankEmblem'
import { resolveStampCatalogItem, type StampCatalogItem } from '../passport/StampCatalog'
import { getTrailheadFavorites } from '../trailhead/favorites'
import { AppIcon } from '../ui/AppIcon'
import LegacyMemberProfileExperience from './MemberProfileExperience'
import { getMemberBasecamp } from './api'
import { ProfilePosts } from './ProfilePosts'
import { SocialProfileHeader, socialProfileHeaderStyles, type SocialProfilePerson } from './SocialProfileHeader'

type ProfileTab = 'journey' | 'posts' | 'photos' | 'about'
type EarnedStampCard = { stamp: PassportStamp, art: StampCatalogItem }

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function placeLabel(item: JourneyItem | MemoryAlbum) {
  return [item.city, item.state].filter(Boolean).join(', ')
}

function FeaturedBadge({ badge }: { badge: MemberBadge }) {
  return <Pressable style={({ pressed }) => [styles.badgeRecognitionItem, pressed && styles.pressed]} onPress={() => router.push('/member/badges')}>
    {hasBadgeArt(badge.title) ? <BadgeArt title={badge.title} size={104} /> : <View style={styles.badgeFallback}><AppIcon name="badge" color="#D7B45A" size={42} /></View>}
    <Text style={styles.badgeRecognitionTitle} numberOfLines={2}>{badge.title}</Text>
  </Pressable>
}

function FeaturedStamp({ item }: { item: EarnedStampCard }) {
  return <Pressable style={({ pressed }) => [styles.stampRecognitionItem, pressed && styles.pressed]} onPress={() => router.push('/member/stamps')}>
    <Image source={item.art.source} style={styles.stampImage} resizeMode="contain" />
    <Text style={styles.stampRecognitionTitle} numberOfLines={2}>{item.stamp.title}</Text>
  </Pressable>
}

export default function MemberProfileExperienceV4() {
  const params = useLocalSearchParams<{ edit?: string }>()
  if (params.edit === '1') return <LegacyMemberProfileExperience />
  return <SocialOwnerProfile />
}

function SocialOwnerProfile() {
  const [tab, setTab] = useState<ProfileTab>('journey')
  const [data, setData] = useState<any>(null)
  const [journey, setJourney] = useState<JourneyItem[]>([])
  const [stamps, setStamps] = useState<PassportStamp[]>([])
  const [badges, setBadges] = useState<MemberBadge[]>([])
  const [albums, setAlbums] = useState<MemoryAlbum[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [favoriteBadgeTitles, setFavoriteBadgeTitles] = useState<string[]>([])
  const [favoriteStampCodes, setFavoriteStampCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [base, nextJourney, nextStamps, nextBadges, nextAlbums, nextConnections] = await Promise.all([
        getMemberBasecamp(), getJourney(), getPassportStamps(), getMemberBadges(), getMemoryAlbums(), getConnections(),
      ])
      const favorites = await getTrailheadFavorites(base?.profile?.id)
      setData(base)
      setJourney(nextJourney)
      setStamps(nextStamps)
      setBadges(nextBadges)
      setAlbums(nextAlbums)
      setConnections(nextConnections)
      setFavoriteBadgeTitles(favorites.badges)
      setFavoriteStampCodes(favorites.stamps)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const profile = data?.profile ?? {}
  const trailmates = useMemo(() => connections.filter((item) => item.status === 'accepted'), [connections])
  const pendingConnections = useMemo(() => connections.filter((item) => item.status === 'pending'), [connections])
  const uniquePlaces = useMemo(() => new Set(journey.map((item) => `${item.city}|${item.state}`.toLowerCase()).filter(Boolean)).size, [journey])
  const rank = useMemo(() => rankFor(journey.length), [journey.length])
  const currentRank = useMemo(() => rankLadder.find(([name]) => name === rank), [rank])
  const nextRank = useMemo(() => rankLadder.find(([, minimum]) => minimum > journey.length), [journey.length])
  const remaining = nextRank ? Math.max(0, nextRank[1] - journey.length) : 0
  const rankProgress = useMemo(() => {
    if (!nextRank) return 1
    const floor = currentRank?.[1] ?? 0
    return Math.min(1, Math.max(0, (journey.length - floor) / Math.max(1, nextRank[1] - floor)))
  }, [journey.length, currentRank, nextRank])
  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ')

  const featuredBadges = useMemo(() => {
    const seen = new Set<string>()
    const unique = badges.filter((badge) => {
      const key = badge.title.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    return unique.sort((left, right) => {
      const leftIndex = favoriteBadgeTitles.indexOf(left.title)
      const rightIndex = favoriteBadgeTitles.indexOf(right.title)
      if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex
      if (leftIndex >= 0) return -1
      if (rightIndex >= 0) return 1
      return new Date(right.earned_at).getTime() - new Date(left.earned_at).getTime()
    })
  }, [badges, favoriteBadgeTitles])

  const featuredStamps = useMemo<EarnedStampCard[]>(() => {
    const seen = new Set<string>()
    const resolved: EarnedStampCard[] = []
    for (const stamp of stamps) {
      const art = resolveStampCatalogItem(stamp)
      if (!art || seen.has(art.id)) continue
      seen.add(art.id)
      resolved.push({ stamp, art })
    }
    return resolved.sort((left, right) => {
      const leftCode = left.art.code ?? left.stamp.code ?? ''
      const rightCode = right.art.code ?? right.stamp.code ?? ''
      const leftIndex = favoriteStampCodes.indexOf(leftCode)
      const rightIndex = favoriteStampCodes.indexOf(rightCode)
      if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex
      if (leftIndex >= 0) return -1
      if (rightIndex >= 0) return 1
      return new Date(right.stamp.earned_at).getTime() - new Date(left.stamp.earned_at).getTime()
    })
  }, [stamps, favoriteStampCodes])

  const collectibleStampCount = featuredStamps.length
  const albumByAdventure = useMemo(() => new Map(albums.map((album) => [album.adventure_id, album])), [albums])
  const stampArtByAdventure = useMemo(() => {
    const map = new Map<string, EarnedStampCard>()
    for (const stamp of stamps) {
      if (!stamp.adventure_id || map.has(stamp.adventure_id)) continue
      const art = resolveStampCatalogItem(stamp)
      if (art) map.set(stamp.adventure_id, { stamp, art })
    }
    return map
  }, [stamps])

  const latestAdventure = journey[0] ?? null
  const latestAlbum = latestAdventure ? albumByAdventure.get(latestAdventure.adventure_id) : null
  const latestStamp = latestAdventure ? stampArtByAdventure.get(latestAdventure.adventure_id) : null
  const coverUrl = profile.cover_url ?? albums[0]?.cover_url ?? null
  const recentAdventures = journey.slice(1, 6)

  const favoriteMemories = useMemo(() => {
    const all = albums.flatMap((album) => album.memories).filter((memory) => Boolean(memory.image_url))
    const ordered = [...all.filter((memory) => memory.featured), ...all.filter((memory) => !memory.featured)]
    const seen = new Set<string>()
    const unique: MemoryPhoto[] = []
    for (const memory of ordered) {
      const key = memory.image_url.trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      unique.push(memory)
      if (unique.length === 6) break
    }
    return unique
  }, [albums])

  const completionItems = useMemo(() => [
    Boolean(profile.avatar_url), Boolean(profile.cover_url), Boolean(profile.bio?.trim()), Boolean(profile.username?.trim()), Boolean(location), Array.isArray(profile.interests) && profile.interests.length > 0,
  ], [profile.avatar_url, profile.cover_url, profile.bio, profile.username, profile.interests, location])
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100)

  const socialPeople = useMemo<SocialProfilePerson[]>(() => trailmates.slice(0, 4).map((connection) => ({
    id: connection.connection_id,
    name: connection.display_name,
    avatarUrl: connection.avatar_url,
  })), [trailmates])

  const headerStats = [
    { label: 'Adventures', value: journey.length, onPress: () => router.push('/member/journey') },
    { label: 'Places', value: uniquePlaces, onPress: () => router.push('/member/journey') },
    { label: 'TrailMates', value: trailmates.length, onPress: () => router.push('/connections' as never) },
    { label: 'Stamps', value: collectibleStampCount, onPress: () => router.push('/member/stamps') },
  ].filter((item) => item.value > 0)

  async function shareProfile() {
    const display = profile.display_name ?? 'Go Melanated member'
    const summary = [journey.length ? `${journey.length} adventures` : null, uniquePlaces ? `${uniquePlaces} places` : null, trailmates.length ? `${trailmates.length} TrailMates` : null].filter(Boolean).join(', ')
    await Share.share({ message: `${display}${profile.username ? ` (@${profile.username})` : ''} on Go Melanated${summary ? `: ${summary}` : '.'}` })
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>

  const header = <View>
    {message ? <View style={styles.errorBanner}><Text style={styles.errorText}>{message}</Text></View> : null}
    <SocialProfileHeader
      coverUrl={coverUrl}
      avatarUrl={profile.avatar_url}
      displayName={profile.display_name}
      username={profile.username}
      location={profile.city_visible === false ? null : location}
      rank={rank}
      rankDetail={nextRank ? `${remaining} to ${nextRank[0]}` : 'Highest rank'}
      bio={profile.bio}
      interests={Array.isArray(profile.interests) ? profile.interests : []}
      stats={headerStats}
      people={socialPeople}
      peopleLabel={trailmates.length ? `${trailmates.length} TrailMate${trailmates.length === 1 ? '' : 's'}` : 'Build your Trail Crew'}
      peopleMeta={pendingConnections.length ? `${pendingConnections.length} pending request${pendingConnections.length === 1 ? '' : 's'}` : trailmates.length ? 'Your outdoor connections' : 'Connections you make can live here'}
      onPeoplePress={() => router.push('/connections' as never)}
      onAvatarPress={() => router.push('/member/profile?edit=1' as never)}
      actions={<>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/member/profile?edit=1' as never)} style={socialProfileHeaderStyles.coverIconAction}><AppIcon name="edit" color="#FFF8E8" size={18} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={() => void shareProfile()} style={socialProfileHeaderStyles.coverIconAction}><AppIcon name="share" color="#FFF8E8" size={18} /></Pressable>
      </>}
    />
  </View>

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {header}
      <View style={styles.tabsShell}><View style={styles.tabs}>{(['journey', 'posts', 'photos', 'about'] as ProfileTab[]).map((value) => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>{tab === value ? <View style={styles.tabUnderline} /> : null}</Pressable>)}</View></View>

      <View style={styles.body}>
        {tab === 'journey' ? <View style={styles.tabContent}>
          {completion < 100 ? <Pressable onPress={() => router.push('/member/profile?edit=1' as never)} style={styles.completionNudge}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>PROFILE</Text><Text style={styles.completionText}>{completion}% complete</Text></View><View style={styles.completionTrack}><View style={[styles.completionFill, { width: `${completion}%` }]} /></View><Text style={styles.sectionLink}>Finish</Text></Pressable> : null}

          {latestAdventure ? <>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>YOUR TRAIL</Text><Text style={styles.sectionTitle}>Latest Chapter</Text></View><Pressable onPress={() => router.push('/member/journey')}><Text style={styles.sectionLink}>View full Trail</Text></Pressable></View>
            <Pressable onPress={() => router.push(`/passport/memories/${latestAdventure.adventure_id}` as never)} style={({ pressed }) => [styles.latestChapter, pressed && styles.pressed]}>
              {latestAlbum?.cover_url ? <Image source={{ uri: latestAlbum.cover_url }} style={styles.latestImage} /> : latestStamp ? <View style={styles.latestStampStage}><Image source={latestStamp.art.source} style={styles.latestStampArt} resizeMode="contain" /></View> : <View style={styles.latestFallback}><AppIcon name="adventure" color="#D7B45A" size={34} /></View>}
              <View style={styles.latestShade} />
              <View style={styles.latestBody}><Text style={styles.latestTitle}>{latestAdventure.title}</Text><Text style={styles.latestMeta}>{placeLabel(latestAdventure)}{placeLabel(latestAdventure) ? ' · ' : ''}{formatDate(latestAdventure.experienced_at || latestAdventure.starts_at)}</Text><View style={styles.latestLink}><Text style={styles.latestLinkText}>Open chapter</Text><AppIcon name="chevron-forward" color="#111A17" size={16} /></View></View>
            </Pressable>
          </> : <Pressable onPress={() => router.push('/(tabs)/explore' as never)} style={styles.emptyTrail}><View style={styles.emptyTrailIcon}><AppIcon name="adventure" color="#D7B45A" size={22} /></View><View style={{ flex: 1 }}><Text style={styles.emptyTrailTitle}>Your Trail starts with a completed adventure</Text><Text style={styles.emptyTrailBody}>Your newest chapter will appear here once an adventure becomes part of your history.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18} /></Pressable>}

          {recentAdventures.length ? <>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Recent Adventures</Text><Text style={styles.sectionSub}>The chapters before your latest one.</Text></View><Pressable onPress={() => router.push('/member/journey')}><Text style={styles.sectionLink}>View all</Text></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adventureRail}>{recentAdventures.map((item) => {
              const album = albumByAdventure.get(item.adventure_id)
              const stamp = stampArtByAdventure.get(item.adventure_id)
              return <Pressable key={item.adventure_id} onPress={() => router.push(`/passport/memories/${item.adventure_id}` as never)} style={({ pressed }) => [styles.adventureCard, pressed && styles.pressed]}>
                {album?.cover_url ? <Image source={{ uri: album.cover_url }} style={styles.adventureImage} /> : stamp ? <View style={styles.adventureStampStage}><Image source={stamp.art.source} style={styles.adventureStampArt} resizeMode="contain" /></View> : <View style={styles.adventureFallback}><AppIcon name="adventure" color="#D7B45A" size={26} /></View>}
                <View style={styles.adventureBody}><Text style={styles.adventureTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.adventureMeta} numberOfLines={1}>{placeLabel(item)}</Text><Text style={styles.adventureMeta}>{formatDate(item.experienced_at || item.starts_at)}</Text></View>
              </Pressable>
            })}</ScrollView>
          </> : null}

          {favoriteMemories.length ? <>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Favorite Memories</Text><Text style={styles.sectionSub}>Photos worth keeping close.</Text></View><Pressable onPress={() => setTab('photos')}><Text style={styles.sectionLink}>See photos</Text></Pressable></View>
            <View style={styles.memoryGrid}>{favoriteMemories.slice(0, 3).map((memory, index) => <Pressable key={memory.id} onPress={() => router.push(`/passport/memories/photo/${memory.id}` as never)} style={[styles.memoryTile, favoriteMemories.length === 2 && styles.memoryTileHalf, index === 0 && favoriteMemories.length >= 3 && styles.memoryTileLead]}><Image source={{ uri: memory.image_url }} style={styles.memoryImage} />{memory.featured ? <View style={styles.favoritePill}><Text style={styles.favoriteText}>Favorite</Text></View> : null}</Pressable>)}</View>
          </> : null}

          {featuredBadges.length ? <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Badge Showcase</Text><Pressable onPress={() => router.push('/member/badges')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal decelerationRate="fast" snapToInterval={138} snapToAlignment="start" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRail}>{featuredBadges.map((badge) => <FeaturedBadge key={badge.badge_id} badge={badge} />)}</ScrollView></> : null}

          {featuredStamps.length ? <><View style={[styles.sectionHeader, { marginTop: 8 }]}><Text style={styles.sectionTitle}>Featured Stamps</Text><Pressable onPress={() => router.push('/member/stamps')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal decelerationRate="fast" snapToInterval={160} snapToAlignment="start" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stampRail}>{featuredStamps.map((item) => <FeaturedStamp key={item.stamp.stamp_id} item={item} />)}</ScrollView></> : null}
        </View> : null}

        {tab === 'posts' ? <View style={styles.tabContent}><ProfilePosts /></View> : null}

        {tab === 'photos' ? <View style={styles.tabContent}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.sectionSub}>Your adventure albums and saved memories.</Text></View></View>{albums.map((album) => <Pressable key={album.adventure_id} onPress={() => router.push(`/passport/photos/${album.adventure_id}` as never)} style={({ pressed }) => [styles.albumCard, pressed && styles.pressed]}>{album.cover_url ? <Image source={{ uri: album.cover_url }} style={styles.albumImage} /> : <View style={styles.albumFallback}><AppIcon name="photos" color="#D7B45A" size={30} /></View>}<View style={styles.albumBody}><View style={{ flex: 1 }}><Text style={styles.albumTitle}>{album.title}</Text><Text style={styles.albumMeta}>{placeLabel(album)}{placeLabel(album) ? ' · ' : ''}{album.memories.length} photo{album.memories.length === 1 ? '' : 's'}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18} /></View></Pressable>)}{!albums.length ? <View style={styles.empty}><AppIcon name="photos" color="#D7B45A" size={28} /><Text style={styles.emptyTitle}>Your photo story starts with a memory</Text></View> : null}</View> : null}

        {tab === 'about' ? <View style={styles.tabContent}>
          <View style={styles.aboutBlock}><Text style={styles.sectionTitle}>{rank}</Text><Text style={styles.sectionSub}>{nextRank ? `${remaining} adventure${remaining === 1 ? '' : 's'} to ${nextRank[0]}` : 'Highest rank reached'}</Text><View style={styles.rankTrack}><View style={[styles.rankFill, { width: `${Math.max(8, rankProgress * 100)}%` }]} /></View></View>
          <View style={styles.aboutBlock}><Text style={styles.sectionTitle}>About</Text>{location ? <View style={styles.aboutRow}><AppIcon name="location" color="#D7B45A" size={18} /><View><Text style={styles.aboutLabel}>Home base</Text><Text style={styles.aboutValue}>{location}</Text></View></View> : null}<View style={styles.aboutRow}><AppIcon name="calendar" color="#D7B45A" size={18} /><View><Text style={styles.aboutLabel}>Member since</Text><Text style={styles.aboutValue}>{profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Recently'}</Text></View></View>{Array.isArray(profile.interests) && profile.interests.length ? <View style={styles.aboutRow}><AppIcon name="adventure" color="#D7B45A" size={18} /><View style={{ flex: 1 }}><Text style={styles.aboutLabel}>Outdoor interests</Text><Text style={styles.aboutValue}>{profile.interests.join(' · ')}</Text></View></View> : null}</View>
          <View style={styles.aboutBlock}><Text style={styles.sectionTitle}>Profile controls</Text><Pressable onPress={() => router.push('/member/profile?edit=1' as never)} style={styles.settingsRow}><AppIcon name="edit" color="#D7B45A" size={18} /><View style={{ flex: 1 }}><Text style={styles.settingsTitle}>Edit profile</Text><Text style={styles.settingsBody}>Photo, cover, bio, interests and home base.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable><Pressable onPress={() => router.push('/member/privacy' as never)} style={styles.settingsRow}><AppIcon name="privacy" color="#D7B45A" size={18} /><View style={{ flex: 1 }}><Text style={styles.settingsTitle}>Privacy</Text><Text style={styles.settingsBody}>Control what other members can see.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable><Pressable onPress={() => router.push('/member/discovery-settings' as never)} style={styles.settingsRow}><AppIcon name="explore" color="#D7B45A" size={18} /><View style={{ flex: 1 }}><Text style={styles.settingsTitle}>Discovery</Text><Text style={styles.settingsBody}>Choose whether people can find you.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable>{profile.id ? <Pressable onPress={() => router.push(`/member/view-as-profile/${profile.id}` as never)} style={styles.settingsRow}><AppIcon name="privacy" color="#D7B45A" size={18} /><View style={{ flex: 1 }}><Text style={styles.settingsTitle}>View as member</Text><Text style={styles.settingsBody}>Preview what someone else sees.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17} /></Pressable> : null}</View>
        </View> : null}
      </View>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 150 },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  tabContent: { gap: 16 },
  tabsShell: { backgroundColor: '#09110F', borderBottomWidth: 1, borderBottomColor: '#28322E', paddingHorizontal: 12 },
  tabs: { height: 48, flexDirection: 'row', alignItems: 'stretch' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { color: '#9EAAA4', fontSize: 12.5, fontWeight: '800' },
  tabTextActive: { color: '#F5C341' },
  tabUnderline: { position: 'absolute', left: 15, right: 15, bottom: 0, height: 3, borderRadius: 3, backgroundColor: '#F5C341' },
  errorBanner: { marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: '#2A1818' },
  errorText: { color: '#F4CACA', fontSize: 12, textAlign: 'center' },
  completionNudge: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#132019' },
  eyebrow: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  completionText: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', marginTop: 1 },
  completionTrack: { width: 72, height: 5, borderRadius: 99, backgroundColor: '#2B3730', overflow: 'hidden' },
  completionFill: { height: '100%', backgroundColor: '#D7B45A' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#F7F8F3', fontSize: 21, fontWeight: '900' },
  sectionSub: { color: '#8F9C95', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  sectionLink: { color: '#67CFC8', fontSize: 12, fontWeight: '900' },
  latestChapter: { minHeight: 236, borderRadius: 22, overflow: 'hidden', position: 'relative', backgroundColor: '#16231D' },
  latestImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  latestStampStage: { ...StyleSheet.absoluteFillObject, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  latestStampArt: { width: '64%', height: '78%' },
  latestFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  latestShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,13,10,.45)' },
  latestBody: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', padding: 18 },
  latestTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 27, fontWeight: '900', maxWidth: 310 },
  latestMeta: { color: '#D0DAD5', fontSize: 12, marginTop: 5 },
  latestLink: { minHeight: 34, borderRadius: 17, backgroundColor: '#D7B45A', paddingHorizontal: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  latestLinkText: { color: '#111A17', fontSize: 11.5, fontWeight: '900' },
  emptyTrail: { minHeight: 86, borderRadius: 17, backgroundColor: '#111A17', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  emptyTrailIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1C2B24', alignItems: 'center', justifyContent: 'center' },
  emptyTrailTitle: { color: '#FFF8E8', fontSize: 13.5, lineHeight: 17, fontWeight: '900' },
  emptyTrailBody: { color: '#8F9C95', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  adventureRail: { gap: 10, paddingRight: 14 },
  adventureCard: { width: 184, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111A17' },
  adventureImage: { width: '100%', height: 112, resizeMode: 'cover' },
  adventureStampStage: { height: 112, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  adventureStampArt: { width: 86, height: 100 },
  adventureFallback: { height: 112, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  adventureBody: { padding: 11, gap: 3 },
  adventureTitle: { color: '#FFF8E8', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  adventureMeta: { color: '#8F9C95', fontSize: 10.5 },
  memoryGrid: { flexDirection: 'row', gap: 8, minHeight: 132 },
  memoryTile: { flex: 1, minWidth: 0, height: 132, borderRadius: 16, overflow: 'hidden', backgroundColor: '#18251F', position: 'relative' },
  memoryTileLead: { flex: 1.25 },
  memoryTileHalf: { flex: 1 },
  memoryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  favoritePill: { position: 'absolute', left: 7, bottom: 7, borderRadius: 99, backgroundColor: 'rgba(9,17,15,.84)', paddingHorizontal: 8, paddingVertical: 4 },
  favoriteText: { color: '#F5C341', fontSize: 8.5, fontWeight: '900' },
  badgeRail: { gap: 14, paddingRight: 30, paddingVertical: 3 },
  badgeRecognitionItem: { width: 124, minHeight: 142, alignItems: 'center' },
  badgeFallback: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  badgeRecognitionTitle: { width: 124, color: '#F7F8F3', fontSize: 11.5, lineHeight: 14, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  stampRail: { gap: 14, paddingRight: 32, paddingVertical: 3 },
  stampRecognitionItem: { width: 146, minHeight: 170, alignItems: 'center' },
  stampImage: { width: 142, height: 142 },
  stampRecognitionTitle: { width: 146, color: '#F7F8F3', fontSize: 11.5, lineHeight: 14, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  albumCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#111A17' },
  albumImage: { width: '100%', height: 170, resizeMode: 'cover' },
  albumFallback: { height: 150, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  albumBody: { minHeight: 58, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  albumTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  albumMeta: { color: '#8F9C95', fontSize: 10.5, marginTop: 2 },
  empty: { minHeight: 120, borderRadius: 18, backgroundColor: '#111A17', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 18 },
  emptyTitle: { color: '#F7F8F3', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  aboutBlock: { gap: 12, paddingVertical: 4 },
  rankTrack: { height: 7, borderRadius: 99, backgroundColor: '#29352F', overflow: 'hidden' },
  rankFill: { height: '100%', backgroundColor: '#D7B45A' },
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aboutLabel: { color: '#8E9A94', fontSize: 10, fontWeight: '800' },
  aboutValue: { color: '#FFF8E8', fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 1 },
  settingsRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#25312B', paddingTop: 10 },
  settingsTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  settingsBody: { color: '#8F9C95', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  pressed: { opacity: .65 },
})
