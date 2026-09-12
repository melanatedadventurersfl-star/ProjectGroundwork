import { Children, type ReactNode, useEffect, useState } from 'react'
import { router } from 'expo-router'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { supabase } from '../lib/supabase'
import { RankEmblem, type RankName } from '../passport/RankEmblem'
import { AppIcon } from '../ui/AppIcon'

export type SocialProfileStat = {
  label: string
  value: number | string
  onPress?: () => void
}

export type SocialProfilePerson = {
  id: string
  name?: string | null
  avatarUrl?: string | null
}

type Props = {
  coverUrl?: string | null
  avatarUrl?: string | null
  displayName?: string | null
  username?: string | null
  location?: string | null
  rank: RankName
  rankDetail?: string | null
  bio?: string | null
  interests?: string[]
  stats?: SocialProfileStat[]
  people?: SocialProfilePerson[]
  peopleLabel?: string | null
  peopleMeta?: string | null
  onPeoplePress?: () => void
  onAvatarPress?: () => void
  coverActions?: ReactNode
  actions?: ReactNode
}

type OwnerPassportState = {
  effectiveRank: RankName
  hasOverride: boolean
  badgeCount: number
}

const rankNames: RankName[] = ['Explorer', 'Pathfinder', 'Trailblazer', 'Adventurer', 'Summit Seeker', 'Ascendant']

function initials(name?: string | null) {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MA'
}

function Avatar({ url, name, size = 108 }: { url?: string | null, name?: string | null, size?: number }) {
  const radius = size / 2
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#1A2822' }} />
  return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#111A17', fontSize: size * .34, fontWeight: '900' }}>{initials(name)}</Text></View>
}

export function SocialProfileHeader({
  coverUrl,
  avatarUrl,
  displayName,
  username,
  location,
  rank,
  rankDetail,
  bio,
  interests = [],
  stats = [],
  people = [],
  peopleLabel,
  peopleMeta,
  onPeoplePress,
  onAvatarPress,
  coverActions,
  actions,
}: Props) {
  const isOwner = Boolean(onAvatarPress)
  const [ownerPassport, setOwnerPassport] = useState<OwnerPassportState | null>(null)

  useEffect(() => {
    let active = true
    if (!isOwner) {
      setOwnerPassport(null)
      return () => { active = false }
    }

    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const profileId = authData.user?.id
        if (!profileId) return

        const [rankResult, badgeResult] = await Promise.all([
          supabase.rpc('get_my_passport_rank'),
          supabase.from('member_badges').select('id', { count: 'exact', head: true }).eq('profile_id', profileId),
        ])

        if (!active) return
        const payload = rankResult.data as { effective_rank?: string | null, rank_override?: string | null } | null
        const candidate = payload?.effective_rank
        const effectiveRank = candidate && rankNames.includes(candidate as RankName) ? candidate as RankName : rank
        setOwnerPassport({
          effectiveRank,
          hasOverride: Boolean(payload?.rank_override),
          badgeCount: badgeResult.error ? 0 : badgeResult.count ?? 0,
        })
      } catch {
        if (active) setOwnerPassport({ effectiveRank: rank, hasOverride: false, badgeCount: 0 })
      }
    })()

    return () => { active = false }
  }, [isOwner, rank])

  const displayRank = ownerPassport?.effectiveRank ?? rank
  const displayRankDetail = ownerPassport?.hasOverride ? null : rankDetail
  const displayStats = isOwner
    ? [...stats.filter((stat) => stat.label.toLowerCase() !== 'badges'), { label: 'Badges', value: ownerPassport?.badgeCount ?? 0, onPress: () => router.push('/member/badges') }]
    : stats
  const ownerActions = isOwner && actions ? Children.toArray(actions).slice(0, 2) : []

  return <View style={styles.shell}>
    <View style={styles.cover}>
      {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.coverImage} /> : <View style={styles.coverFallback}><AppIcon name="adventure" color="#D7B45A" size={42} /></View>}
      <View style={styles.coverShade} />
      <View style={styles.coverBottomFade} />
      {ownerActions.length ? <View style={styles.ownerCoverActions}>{ownerActions.map((action, index) => <View key={index} style={styles.ownerCoverActionSlot}>{action}</View>)}</View> : coverActions ? <View style={styles.coverActions}>{coverActions}</View> : null}
    </View>

    <View style={styles.body}>
      <View style={styles.identityTop}>
        <Pressable disabled={!onAvatarPress} onPress={onAvatarPress} style={styles.avatarWrap}>
          <Avatar url={avatarUrl} name={displayName} />
          {onAvatarPress ? <View style={styles.cameraBadge}><AppIcon name="camera" color="#111A17" size={16} /></View> : null}
        </Pressable>
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={2}>{displayName ?? 'Adventurer'}</Text>
          {username ? <Text style={styles.handle}>@{username}</Text> : null}
          {location ? <View style={styles.locationLine}><AppIcon name="location" color="#AEB9B4" size={14} /><Text style={styles.location}>{location}</Text></View> : null}
          <View style={styles.rankLine}><RankEmblem rank={displayRank} size={24} /><Text style={styles.rankText}>{displayRank}</Text>{displayRankDetail ? <Text style={styles.rankDetail}>· {displayRankDetail}</Text> : null}</View>
        </View>
      </View>

      {displayStats.length ? <View style={styles.statsLine}>{displayStats.map((stat, index) => <View key={stat.label} style={styles.statWrap}>{index ? <Text style={styles.dot}>·</Text> : null}<Pressable disabled={!stat.onPress} onPress={stat.onPress} style={styles.statPress}><Text style={styles.statValue}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text></Pressable></View>)}</View> : null}

      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {interests.length ? <View style={styles.detailsLine}><AppIcon name="adventure" color="#D7B45A" size={16} /><Text style={styles.detailsText}>{interests.slice(0, 5).join(' · ')}</Text></View> : null}

      {peopleLabel || people.length ? <Pressable disabled={!onPeoplePress} onPress={onPeoplePress} style={({ pressed }) => [styles.peopleRow, pressed && onPeoplePress ? styles.pressed : null]}>
        <View style={styles.avatarStack}>{people.slice(0, 4).map((person, index) => <View key={person.id} style={[styles.personAvatar, index > 0 && styles.personOverlap]}>{person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={styles.personImage} /> : <Text style={styles.personInitials}>{initials(person.name)}</Text>}</View>)}</View>
        <View style={styles.peopleCopy}><Text style={styles.peopleLabel}>{peopleLabel ?? `${people.length} TrailMates`}</Text>{peopleMeta ? <Text style={styles.peopleMeta}>{peopleMeta}</Text> : null}</View>
        {onPeoplePress ? <AppIcon name="chevron-forward" color="#D7B45A" size={18} /> : null}
      </Pressable> : null}

      {actions && !isOwner ? <View style={styles.actionRow}>{actions}</View> : null}
    </View>
  </View>
}

export const socialProfileHeaderStyles = StyleSheet.create({
  primaryAction: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  primaryActionText: { color: '#111A17', fontSize: 13, fontWeight: '900' },
  secondaryAction: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#1A2621', borderWidth: 1, borderColor: '#34433B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  secondaryActionText: { color: '#F7F8F3', fontSize: 13, fontWeight: '900' },
  iconAction: { width: 44, height: 42, borderRadius: 12, backgroundColor: '#1A2621', borderWidth: 1, borderColor: '#34433B', alignItems: 'center', justifyContent: 'center' },
  coverIconAction: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(8,15,12,.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
})

const styles = StyleSheet.create({
  shell: { backgroundColor: '#09110F' },
  cover: { height: 260, backgroundColor: '#13221B', position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14231C' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,9,7,.18)' },
  coverBottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, backgroundColor: 'rgba(9,17,15,.42)' },
  coverActions: { position: 'absolute', right: 14, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerCoverActions: { position: 'absolute', right: 14, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerCoverActionSlot: { width: 118, height: 42 },
  body: { paddingHorizontal: 18, paddingBottom: 14 },
  identityTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-end', marginTop: -54 },
  avatarWrap: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: '#09110F', backgroundColor: '#09110F', position: 'relative' },
  cameraBadge: { position: 'absolute', right: -2, bottom: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F2EB', borderWidth: 3, borderColor: '#09110F', alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, minWidth: 0, paddingBottom: 4 },
  name: { color: '#FFF8E8', fontSize: 29, lineHeight: 32, fontWeight: '900', letterSpacing: -.5 },
  handle: { color: '#D7B45A', fontSize: 13, fontWeight: '800', marginTop: 2 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  location: { color: '#AEB9B4', fontSize: 13 },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  rankText: { color: '#FFF8E8', fontSize: 12.5, fontWeight: '900' },
  rankDetail: { color: '#94A19A', fontSize: 11.5, fontWeight: '700' },
  statsLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 16, gap: 6 },
  statWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { color: '#6F7D76', fontSize: 15 },
  statPress: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  statLabel: { color: '#B5C0BA', fontSize: 13, fontWeight: '700' },
  bio: { color: '#EEF1EC', fontSize: 15.5, lineHeight: 21, marginTop: 14 },
  detailsLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  detailsText: { flex: 1, color: '#C9D1CD', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  peopleRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 6 },
  avatarStack: { flexDirection: 'row', alignItems: 'center', paddingLeft: 2 },
  personAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#09110F', backgroundColor: '#25342B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  personOverlap: { marginLeft: -10 },
  personImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  personInitials: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  peopleCopy: { flex: 1, minWidth: 0 },
  peopleLabel: { color: '#FFF8E8', fontSize: 13.5, fontWeight: '900' },
  peopleMeta: { color: '#8F9C95', fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pressed: { opacity: .65 },
})
