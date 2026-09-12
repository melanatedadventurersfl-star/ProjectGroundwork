import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '../lib/supabase'
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt'
import { rankFor, rankLadder } from '../passport/RankEmblem'
import { resolveStampCatalogItem, type StampCatalogItem } from '../passport/StampCatalog'
import {
  getCommunityProfile,
  getConnectionStatus,
  getViewerInterests,
  requestConnection,
  respondToConnection,
  type CommunityFeaturedBadge,
  type CommunityFeaturedStamp,
  type CommunityProfile,
  type ConnectionStatus,
} from '../social/api'
import { AppIcon } from '../ui/AppIcon'
import { ProfilePosts } from './ProfilePosts'
import { SocialProfileHeader, socialProfileHeaderStyles } from './SocialProfileHeader'

type ProfileTab = 'journey' | 'posts' | 'photos' | 'about'
type PublicStampCard = { stamp: CommunityFeaturedStamp, art: StampCatalogItem }

function FeaturedBadge({ badge }: { badge: CommunityFeaturedBadge }) {
  return <View style={styles.recognitionItem}>
    <BadgeArt title={badge.title} size={100} />
    <Text style={styles.recognitionTitle} numberOfLines={2}>{badge.title}</Text>
  </View>
}

function FeaturedStamp({ item }: { item: PublicStampCard }) {
  return <View style={styles.recognitionItem}>
    <Image source={item.art.source} style={styles.stampImage} resizeMode="contain" />
    <Text style={styles.recognitionTitle} numberOfLines={2}>{item.stamp.title}</Text>
  </View>
}

export default function PublicMemberProfileExperienceV2() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [viewerInterests, setViewerInterests] = useState<string[]>([])
  const [canViewAsMember, setCanViewAsMember] = useState(false)
  const [tab, setTab] = useState<ProfileTab>('journey')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [nextProfile, connection, interests, viewAsGate] = await Promise.all([
        getCommunityProfile(id),
        getConnectionStatus(id),
        getViewerInterests(),
        supabase.rpc('can_view_as_member'),
      ])
      setProfile(nextProfile)
      setConnectionStatus(connection.status)
      setConnectionId(connection.connectionId)
      setViewerInterests(interests)
      setCanViewAsMember(!viewAsGate.error && viewAsGate.data === true)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this member profile.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  async function act(action: 'request' | 'accept' | 'decline') {
    if (!id) return
    setWorking(true)
    try {
      if (action === 'request') await requestConnection(id)
      if (action === 'accept' && connectionId) await respondToConnection(connectionId, 'accepted')
      if (action === 'decline' && connectionId) await respondToConnection(connectionId, 'declined')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this TrailMate connection.')
    } finally {
      setWorking(false)
    }
  }

  const adventureCount = profile?.adventure_count ?? 0
  const rank = useMemo(() => rankFor(adventureCount), [adventureCount])
  const currentRank = useMemo(() => rankLadder.find(([name]) => name === rank), [rank])
  const nextRank = useMemo(() => rankLadder.find(([, minimum]) => minimum > adventureCount), [adventureCount])
  const remaining = nextRank ? Math.max(0, nextRank[1] - adventureCount) : 0
  const rankProgress = useMemo(() => {
    if (!nextRank) return 1
    const floor = currentRank?.[1] ?? 0
    return Math.min(1, Math.max(0, (adventureCount - floor) / Math.max(1, nextRank[1] - floor)))
  }, [adventureCount, currentRank, nextRank])
  const viewerInterestSet = useMemo(() => new Set(viewerInterests.map((item) => item.trim().toLowerCase())), [viewerInterests])

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.errorText}>{error ?? 'Profile not found.'}</Text></SafeAreaView>
  if (connectionStatus === 'self') {
    router.replace('/member/profile')
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>
  }

  const member = profile
  const location = [member.home_city, member.home_state].filter(Boolean).join(', ')
  const sharedInterests = (member.interests ?? []).filter((item) => viewerInterestSet.has(item.trim().toLowerCase()))
  const headerStats = [
    { label: 'Adventures', value: member.adventure_count },
    { label: 'Albums', value: member.photo_albums.length },
    { label: 'Posts', value: member.post_count },
    { label: 'Stamps', value: member.stamp_count },
  ].filter((item) => item.value > 0)
  const joined = new Date(member.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const latestAlbum = member.photo_albums[0] ?? null

  const featuredBadges = (() => {
    const seen = new Set<string>()
    return member.featured_badges.filter((badge) => {
      const key = badge.title.trim().toLowerCase()
      if (!hasBadgeArt(badge.title) || seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 3)
  })()

  const featuredStamps = (() => {
    const seen = new Set<string>()
    const items: PublicStampCard[] = []
    for (const stamp of member.featured_stamps) {
      const art = resolveStampCatalogItem(stamp)
      if (!art || seen.has(art.id)) continue
      seen.add(art.id)
      items.push({ stamp, art })
      if (items.length === 3) break
    }
    return items
  })()

  async function shareProfile() {
    const summary = [
      member.adventure_count ? `${member.adventure_count} adventures` : null,
      member.stamp_count ? `${member.stamp_count} stamps` : null,
    ].filter(Boolean).join(', ')
    await Share.share({ message: `${member.display_name ?? 'A Go Melanated member'}${member.username ? ` (@${member.username})` : ''} on Go Melanated${summary ? `: ${summary}` : '.'}` })
  }

  function openMore() {
    const actions: Parameters<typeof Alert.alert>[2] = []
    if (canViewAsMember) actions.push({ text: 'View as member', onPress: () => router.push(`/member/view-as-profile/${member.id}` as never) })
    actions.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert('Profile', undefined, actions)
  }

  function connectionAction() {
    if (connectionStatus === 'accepted') return <View style={socialProfileHeaderStyles.secondaryAction}><AppIcon name="connections" color="#FFF8E8" size={16} /><Text style={socialProfileHeaderStyles.secondaryActionText}>TrailMate</Text></View>
    if (connectionStatus === 'pending_sent') return <View style={socialProfileHeaderStyles.secondaryAction}><AppIcon name="checkmark" color="#F5C341" size={15} /><Text style={socialProfileHeaderStyles.secondaryActionText}>Request sent</Text></View>
    if (connectionStatus === 'pending_received') return <>
      <Pressable disabled={working} onPress={() => void act('accept')} style={socialProfileHeaderStyles.primaryAction}><Text style={socialProfileHeaderStyles.primaryActionText}>Accept</Text></Pressable>
      <Pressable disabled={working} onPress={() => void act('decline')} style={socialProfileHeaderStyles.secondaryAction}><Text style={socialProfileHeaderStyles.secondaryActionText}>Decline</Text></Pressable>
    </>
    if (connectionStatus === 'blocked') return null
    return <Pressable disabled={working} onPress={() => void act('request')} style={socialProfileHeaderStyles.primaryAction}><AppIcon name="connections" color="#111A17" size={16} /><Text style={socialProfileHeaderStyles.primaryActionText}>{working ? 'Sending…' : 'Add TrailMate'}</Text></Pressable>
  }

  const header = <View>
    {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
    <SocialProfileHeader
      coverUrl={member.cover_url}
      avatarUrl={member.avatar_url}
      displayName={member.display_name}
      username={member.username}
      location={location}
      rank={rank}
      rankDetail={nextRank ? `${remaining} to ${nextRank[0]}` : 'Highest rank'}
      bio={member.bio}
      interests={member.interests_visible ? member.interests ?? [] : []}
      stats={member.can_see_full_profile ? headerStats : []}
      peopleLabel={sharedInterests.length ? `${sharedInterests.length} interest${sharedInterests.length === 1 ? '' : 's'} in common` : null}
      peopleMeta={sharedInterests.length ? sharedInterests.slice(0, 4).join(' · ') : null}
      coverActions={<Pressable onPress={() => router.back()} style={socialProfileHeaderStyles.coverIconAction}><AppIcon name="chevron-forward" color="#FFF8E8" size={21} style={{ transform: [{ rotate: '180deg' }] }} /></Pressable>}
      actions={<>{connectionAction()}<Pressable onPress={() => void shareProfile()} style={socialProfileHeaderStyles.secondaryAction}><AppIcon name="share" color="#FFF8E8" size={16} /><Text style={socialProfileHeaderStyles.secondaryActionText}>Share</Text></Pressable><Pressable onPress={openMore} style={socialProfileHeaderStyles.iconAction}><AppIcon name="more" color="#FFF8E8" size={18} /></Pressable></>}
    />
  </View>

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView stickyHeaderIndices={member.can_see_full_profile ? [1] : undefined} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {header}

      {member.can_see_full_profile ? <View style={styles.tabsShell}><View style={styles.tabs}>{(['journey', 'posts', 'photos', 'about'] as ProfileTab[]).map((value) => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>{tab === value ? <View style={styles.tabUnderline} /> : null}</Pressable>)}</View></View> : <View />}

      <View style={styles.body}>
        {!member.can_see_full_profile ? <View style={styles.privateCard}><AppIcon name="privacy" color="#F5C341" size={24} /><View style={{ flex: 1 }}><Text style={styles.privateTitle}>Private profile</Text><Text style={styles.privateBody}>More profile details become visible after this member approves your connection.</Text></View></View> : null}

        {member.can_see_full_profile && tab === 'journey' ? <View style={styles.tabContent}>
          {latestAlbum ? <>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>THEIR TRAIL</Text><Text style={styles.sectionTitle}>Latest Shared Chapter</Text></View></View>
            <View style={styles.latestChapter}>
              {latestAlbum.cover_url && /^(https?:|data:)/i.test(latestAlbum.cover_url) ? <Image source={{ uri: latestAlbum.cover_url }} style={styles.latestImage} /> : <View style={styles.latestFallback}><AppIcon name="photos" color="#D7B45A" size={34} /></View>}
              <View style={styles.latestShade} />
              <View style={styles.latestBody}><Text style={styles.latestTitle}>{latestAlbum.title}</Text><Text style={styles.latestMeta}>{latestAlbum.photo_count} shared photo{latestAlbum.photo_count === 1 ? '' : 's'}</Text></View>
            </View>
          </> : <View style={styles.trailSummary}><Text style={styles.sectionEyebrow}>THEIR TRAIL</Text><Text style={styles.trailSummaryTitle}>{member.adventure_count ? `${member.adventure_count} completed adventure${member.adventure_count === 1 ? '' : 's'}` : 'Their Trail is just getting started'}</Text><Text style={styles.sectionSub}>{member.adventure_count ? 'Completed adventures are part of this member’s outdoor story.' : 'Their first completed adventure will become chapter one.'}</Text></View>}

          {member.photo_albums.length > 1 ? <>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Shared Adventures</Text><Text style={styles.sectionSub}>Adventure albums this member chose to share.</Text></View></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRail}>{member.photo_albums.slice(1, 6).map((album) => <View key={album.adventure_id} style={styles.sharedAdventureCard}>{album.cover_url && /^(https?:|data:)/i.test(album.cover_url) ? <Image source={{ uri: album.cover_url }} style={styles.sharedAdventureImage} /> : <View style={styles.sharedAdventureFallback}><AppIcon name="photos" color="#D7B45A" size={25} /></View>}<View style={styles.sharedAdventureBody}><Text style={styles.sharedAdventureTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.sharedAdventureMeta}>{album.photo_count} photo{album.photo_count === 1 ? '' : 's'}</Text></View></View>)}</ScrollView>
          </> : null}

          {featuredBadges.length ? <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Badge Showcase</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{featuredBadges.map((badge) => <FeaturedBadge key={badge.badge_id} badge={badge} />)}</ScrollView></> : null}
          {featuredStamps.length ? <><View style={[styles.sectionHeader, { marginTop: 8 }]}><Text style={styles.sectionTitle}>Featured Stamps</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{featuredStamps.map((item) => <FeaturedStamp key={item.stamp.stamp_id} item={item} />)}</ScrollView></> : null}
        </View> : null}

        {member.can_see_full_profile && tab === 'posts' ? <View style={styles.tabContent}><ProfilePosts profileId={member.id} /></View> : null}

        {member.can_see_full_profile && tab === 'photos' ? <View style={styles.tabContent}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.sectionSub}>Adventure moments this member chose to share.</Text></View></View>
          <View style={styles.photoGrid}>{member.photo_albums.map((album) => <View key={album.adventure_id} style={styles.photoTile}>{album.cover_url && /^(https?:|data:)/i.test(album.cover_url) ? <Image source={{ uri: album.cover_url }} style={styles.photoTileImage} /> : <View style={styles.photoTileFallback}><AppIcon name="photos" color="#D7B45A" size={28} /></View>}<View style={styles.photoTileShade} /><View style={styles.photoTileCopy}><Text style={styles.photoTileTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.photoTileMeta}>{album.photo_count} photo{album.photo_count === 1 ? '' : 's'}</Text></View></View>)}</View>
          {!member.photo_albums.length ? <View style={styles.empty}><AppIcon name="photos" color="#D7B45A" size={28} /><Text style={styles.emptyTitle}>No shared adventure photos yet</Text></View> : null}
        </View> : null}

        {member.can_see_full_profile && tab === 'about' ? <View style={styles.tabContent}>
          <View style={styles.aboutBlock}><Text style={styles.sectionTitle}>{rank}</Text><Text style={styles.sectionSub}>{nextRank ? `${remaining} adventure${remaining === 1 ? '' : 's'} to ${nextRank[0]}` : 'Highest rank reached'}</Text><View style={styles.rankTrack}><View style={[styles.rankFill, { width: `${Math.max(8, rankProgress * 100)}%` }]} /></View></View>
          <View style={styles.aboutBlock}><Text style={styles.sectionTitle}>About</Text>{location ? <View style={styles.aboutRow}><AppIcon name="location" color="#D7B45A" size={18} /><View><Text style={styles.aboutLabel}>Home base</Text><Text style={styles.aboutValue}>{location}</Text></View></View> : null}<View style={styles.aboutRow}><AppIcon name="calendar" color="#D7B45A" size={18} /><View><Text style={styles.aboutLabel}>Member since</Text><Text style={styles.aboutValue}>{joined}</Text></View></View>{member.interests_visible && member.interests?.length ? <View style={styles.aboutRow}><AppIcon name="adventure" color="#D7B45A" size={18} /><View style={{ flex: 1 }}><Text style={styles.aboutLabel}>Outdoor interests</Text><Text style={styles.aboutValue}>{member.interests.join(' · ')}</Text></View></View> : null}</View>
        </View> : null}
      </View>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  scrollContent: { paddingBottom: 150 },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  tabContent: { gap: 16 },
  tabsShell: { backgroundColor: '#09110F', borderBottomWidth: 1, borderBottomColor: '#28322E', paddingHorizontal: 12 },
  tabs: { height: 48, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { color: '#9EAAA4', fontSize: 12.5, fontWeight: '800' },
  tabTextActive: { color: '#F5C341' },
  tabUnderline: { position: 'absolute', left: 15, right: 15, bottom: 0, height: 3, borderRadius: 3, backgroundColor: '#F5C341' },
  errorBanner: { margin: 12, padding: 10, borderRadius: 12, backgroundColor: '#2A1818' },
  errorText: { color: '#F4CACA', fontSize: 12, textAlign: 'center' },
  privateCard: { minHeight: 90, borderRadius: 18, backgroundColor: '#111A17', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  privateTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  privateBody: { color: '#8F9C95', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#F7F8F3', fontSize: 21, fontWeight: '900' },
  sectionSub: { color: '#8F9C95', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  latestChapter: { minHeight: 230, borderRadius: 22, overflow: 'hidden', position: 'relative', backgroundColor: '#16231D' },
  latestImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  latestFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17251F' },
  latestShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,13,10,.45)' },
  latestBody: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  latestTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 26, fontWeight: '900' },
  latestMeta: { color: '#D0DAD5', fontSize: 12, marginTop: 5 },
  trailSummary: { paddingVertical: 8, gap: 4 },
  trailSummaryTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 27, fontWeight: '900' },
  albumRail: { gap: 10, paddingRight: 14 },
  sharedAdventureCard: { width: 184, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111A17' },
  sharedAdventureImage: { width: '100%', height: 112, resizeMode: 'cover' },
  sharedAdventureFallback: { height: 112, backgroundColor: '#17251F', alignItems: 'center', justifyContent: 'center' },
  sharedAdventureBody: { padding: 11 },
  sharedAdventureTitle: { color: '#FFF8E8', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  sharedAdventureMeta: { color: '#8F9C95', fontSize: 10.5, marginTop: 3 },
  recognitionRail: { gap: 18, paddingRight: 16, paddingVertical: 3 },
  recognitionItem: { width: 118, minHeight: 136, alignItems: 'center' },
  stampImage: { width: 114, height: 124 },
  recognitionTitle: { width: 118, color: '#F7F8F3', fontSize: 11.5, lineHeight: 14, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: { width: '48.7%', aspectRatio: .92, borderRadius: 16, overflow: 'hidden', backgroundColor: '#17251F', position: 'relative' },
  photoTileImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoTileFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  photoTileShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,12,9,.18)' },
  photoTileCopy: { position: 'absolute', left: 10, right: 10, bottom: 9 },
  photoTileTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  photoTileMeta: { color: '#D0DAD5', fontSize: 9.5, marginTop: 2 },
  empty: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyTitle: { color: '#F7F8F3', fontSize: 14, fontWeight: '900' },
  aboutBlock: { gap: 12, paddingVertical: 4 },
  rankTrack: { height: 7, borderRadius: 99, backgroundColor: '#29352F', overflow: 'hidden' },
  rankFill: { height: '100%', backgroundColor: '#D7B45A' },
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aboutLabel: { color: '#8E9A94', fontSize: 10, fontWeight: '800' },
  aboutValue: { color: '#FFF8E8', fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 1 },
})
