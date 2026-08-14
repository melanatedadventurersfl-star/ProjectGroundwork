import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, joinGroup, type CommunityGroup } from '../../src/community/api';
import { getMemberBasecamp } from '../../src/member/api';

type CommunityTab = 'for-you' | 'nearby' | 'groups';

const GOLD = '#D7B45A';
const GOLD_MUTED = '#B79B58';
const BG = '#0F1713';
const CARD = '#17211C';
const CARD_ALT = '#1B2A22';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';

function GroupRow({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const isMember = group.is_member;

  return (
    <Pressable
      style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
      onPress={() => {
        if (isMember) {
          router.push({ pathname: '/groups/[id]', params: { id: group.id } });
        } else {
          onJoin(group);
        }
      }}
    >
      <View style={styles.groupAvatar}>
        <Text style={styles.groupAvatarText}>{group.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.groupCopy}>
        <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.groupMeta} numberOfLines={1}>
          {isMember ? `${group.member_count} member${group.member_count === 1 ? '' : 's'}` : joining ? 'Joining…' : `${group.member_count} members · Tap to join`}
        </Text>
      </View>
      <Ionicons name={isMember ? 'chevron-forward' : 'add-circle-outline'} size={22} color={isMember ? MUTED : GOLD} />
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon as never} size={18} color={GOLD_MUTED} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function CircleGateway({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.circleGateway, compact && styles.circleGatewayCompact, pressed && styles.pressed]} onPress={() => router.push('/circles')}>
      <View style={styles.circleGatewayIcon}><Ionicons name="people-circle-outline" size={27} color={GOLD} /></View>
      <View style={styles.groupCopy}>
        <Text style={styles.circleGatewayTitle}>Circles & Connections</Text>
        <Text style={styles.circleGatewayCopy} numberOfLines={compact ? 1 : 2}>Organize your people into private crews for invites, sharing, and adventures.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

function FeedCard() {
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <View style={styles.feedAvatar}><Text style={styles.feedAvatarText}>JOS</Text></View>
        <View style={styles.feedHeaderCopy}>
          <Text style={styles.feedName}>Jacksonville Outside Social</Text>
          <Text style={styles.feedMeta}>2h ago · Jacksonville, FL</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={21} color={MUTED} />
      </View>

      <View style={styles.photoCollage}>
        <View style={styles.photoHero}>
          <View style={styles.sun} />
          <View style={styles.waterLine} />
          <Text style={styles.photoLabel}>St. Johns River</Text>
        </View>
        <View style={styles.photoStack}>
          <View style={[styles.photoSmall, styles.photoPeople]}>
            <Ionicons name="people" size={31} color={TEXT} />
          </View>
          <View style={[styles.photoSmall, styles.photoTrail]}>
            <Ionicons name="leaf" size={29} color={TEXT} />
          </View>
        </View>
      </View>

      <Text style={styles.feedBody}>Sunset paddle on the St. Johns River never gets old 🌅 Perfect evening with a great crew.</Text>
      <View style={styles.engagementRow}>
        <View style={styles.engagementLeft}>
          <Ionicons name="heart" size={19} color={GOLD} />
          <Text style={styles.engagementText}>24 likes</Text>
          <Text style={styles.engagementDot}>·</Text>
          <Text style={styles.engagementText}>8 comments</Text>
        </View>
        <View style={styles.engagementActions}>
          <Ionicons name="chatbubble-outline" size={21} color={TEXT} />
          <Ionicons name="share-social-outline" size={22} color={TEXT} />
        </View>
      </View>
    </View>
  );
}

function PartnerPost() {
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <View style={[styles.memberAvatar, styles.memberAvatarWarm]}>
          <Ionicons name="person" size={19} color={TEXT} />
        </View>
        <View style={styles.feedHeaderCopy}>
          <Text style={styles.feedName}>Looking for hiking partners</Text>
          <Text style={styles.feedMeta}>Alex R. · 1h ago · Jacksonville, FL</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={21} color={MUTED} />
      </View>
      <Text style={styles.partnerBody}>New to the area and looking for friendly folks to hit some local trails with. Weekends work best for me!</Text>
      <View style={styles.partnerFooter}>
        <View style={styles.tagRow}>
          <View style={styles.tag}><Ionicons name="trail-sign-outline" size={15} color={MUTED} /><Text style={styles.tagText}>Intermediate</Text></View>
          <View style={styles.tag}><Ionicons name="people-outline" size={15} color={MUTED} /><Text style={styles.tagText}>Weekends</Text></View>
        </View>
        <Pressable style={styles.primaryButton}><Text style={styles.primaryButtonText}>I’m interested</Text></Pressable>
      </View>
      <Text style={styles.interestedCount}>12 interested</Text>
    </View>
  );
}

function NearbyEventCard({ location }: { location: string }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Happening near you</Text>
        <Pressable><Text style={styles.link}>View all</Text></Pressable>
      </View>
      <View style={styles.eventRow}>
        <View style={styles.eventThumb}>
          <Ionicons name="boat-outline" size={36} color={TEXT} />
        </View>
        <View style={styles.eventCopy}>
          <Text style={styles.eventTitle}>Sunrise Paddle on The St. Johns</Text>
          <View style={styles.metaLine}><Ionicons name="calendar-outline" size={15} color={MUTED} /><Text style={styles.metaLineText}>Sat, May 17 · 8:00 AM</Text></View>
          <View style={styles.metaLine}><Ionicons name="location-outline" size={15} color={MUTED} /><Text style={styles.metaLineText}>{location}</Text></View>
          <View style={styles.metaLine}><Ionicons name="people-outline" size={15} color={MUTED} /><Text style={styles.metaLineText}>18 going · 4 spots left</Text></View>
        </View>
      </View>
      <Pressable style={styles.fullButton} onPress={() => router.push('/local-events/create')}>
        <Text style={styles.primaryButtonText}>View meetup</Text>
      </Pressable>
    </View>
  );
}

export default function CommunityScreen() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CommunityTab>('for-you');

  const load = useCallback(async () => {
    try {
      const [nextGroups, basecamp] = await Promise.all([getGroups(), getMemberBasecamp()]);
      setGroups(nextGroups);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Community.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const yourGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const nearbyGroups = useMemo(
    () => groups.filter((group) => group.state && group.state === homeState && (!homeCity || !group.city || group.city === homeCity)),
    [groups, homeCity, homeState],
  );
  const locationLabel = homeCity && homeState ? `${homeCity}, ${homeState}` : 'Your area';
  const nearbyCount = nearbyGroups.reduce((total, group) => total + group.member_count, 0);

  async function handleJoin(group: CommunityGroup) {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to join this group.');
    } finally {
      setJoiningId(null);
    }
  }

  const visibleGroupList = tab === 'nearby' ? nearbyGroups : groups;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Community</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={MUTED} />
              <Text style={styles.subtitle}>{locationLabel} · {yourGroups.length} groups{nearbyCount ? ` · ${nearbyCount} adventurers nearby` : ''}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/notifications')}><Ionicons name="notifications-outline" size={23} color={TEXT} /></Pressable>
            <Pressable style={styles.profileButton} onPress={() => router.push('/member/profile')}><Ionicons name="person" size={17} color={TEXT} /></Pressable>
          </View>
        </View>

        <View style={styles.tabs}>
          {([
            ['for-you', 'For You'],
            ['nearby', 'Nearby'],
            ['groups', 'Groups'],
          ] as const).map(([value, label]) => (
            <Pressable key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'for-you' ? (
          <>
            <View style={styles.composer}>
              <Pressable style={({ pressed }) => [styles.composerPromptRow, pressed && styles.pressed]} onPress={() => router.push('/community/create')}>
                <View style={styles.memberAvatar}><Ionicons name="person" size={18} color={TEXT} /></View>
                <Text style={styles.composerPrompt}>What’s happening outside?</Text>
                <Ionicons name="chevron-forward" size={18} color={MUTED} />
              </Pressable>
              <View style={styles.quickActionsRow}>
                <QuickAction icon="images-outline" label="Photo" onPress={() => router.push({ pathname: '/community/create', params: { type: 'photo' } })} />
                <QuickAction icon="calendar-outline" label="Meetup" onPress={() => router.push('/local-events/create')} />
                <QuickAction icon="help-circle-outline" label="Ask" onPress={() => router.push({ pathname: '/community/create', params: { type: 'ask' } })} />
              </View>
            </View>

            <View style={styles.feedSectionHeader}>
              <Text style={styles.feedSectionLabel}>From your community</Text>
              <Text style={styles.feedSectionHint}>Groups, meetups, and people you connect with</Text>
            </View>

            <FeedCard />
            <PartnerPost />
            <NearbyEventCard location={locationLabel} />
            <CircleGateway />

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Your Communities</Text>
                <Pressable onPress={() => setTab('groups')}><Text style={styles.link}>Manage</Text></Pressable>
              </View>
              <View style={styles.groupList}>
                {yourGroups.slice(0, 3).map((group) => (
                  <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />
                ))}
                {!yourGroups.length && !loading ? <Text style={styles.emptyText}>Join a few communities and they’ll live here.</Text> : null}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionHeading}>{tab === 'nearby' ? 'Near You' : 'People & Groups'}</Text>
                <Text style={styles.sectionSubheading}>{tab === 'nearby' ? `Communities around ${locationLabel}.` : 'Your private circles and shared adventure communities.'}</Text>
              </View>
              {tab === 'nearby' ? <Ionicons name="navigate-outline" size={22} color={GOLD_MUTED} /> : <Ionicons name="people-outline" size={22} color={GOLD_MUTED} />}
            </View>
            {tab === 'groups' ? <CircleGateway compact /> : null}
            <View style={styles.groupList}>
              {visibleGroupList.map((group) => (
                <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />
              ))}
              {!visibleGroupList.length && !loading ? <Text style={styles.emptyText}>Nothing here yet. Pull to refresh or check back as the community grows.</Text> : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 42, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1 },
  title: { color: TEXT, fontSize: 32, lineHeight: 36, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  subtitle: { flex: 1, color: MUTED, fontSize: 12, lineHeight: 17 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, backgroundColor: CARD_ALT, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#18211D', borderRadius: 14, padding: 3 },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#2A2D28' },
  tabText: { color: '#A4ADA7', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: GOLD },
  loader: { marginVertical: 3 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 10, gap: 8 },
  composerPromptRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 2 },
  memberAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#294236' },
  memberAvatarWarm: { backgroundColor: '#5E4A2B' },
  composerPrompt: { flex: 1, color: '#E4E8E5', fontSize: 15.5, fontWeight: '600' },
  quickActionsRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#37443C', paddingTop: 7 },
  quickAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, gap: 3 },
  quickActionText: { color: '#D8DED9', fontSize: 10.5, textAlign: 'center', fontWeight: '700' },
  feedSectionHeader: { paddingHorizontal: 2, paddingTop: 2, gap: 1 },
  feedSectionLabel: { color: TEXT, fontSize: 15, fontWeight: '900' },
  feedSectionHint: { color: '#7F8B83', fontSize: 11.5 },
  feedCard: { backgroundColor: 'transparent', paddingHorizontal: 2, paddingVertical: 8, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332C' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  feedAvatar: { width: 41, height: 41, borderRadius: 21, borderWidth: 1, borderColor: '#738078', alignItems: 'center', justifyContent: 'center' },
  feedAvatarText: { color: TEXT, fontWeight: '900', fontSize: 15 },
  feedHeaderCopy: { flex: 1 },
  feedName: { color: TEXT, fontSize: 15.5, fontWeight: '900' },
  feedMeta: { color: '#8F9B93', fontSize: 11.5, marginTop: 2 },
  photoCollage: { flexDirection: 'row', gap: 5, height: 198, borderRadius: 14, overflow: 'hidden' },
  photoHero: { flex: 1.65, backgroundColor: '#263E50', justifyContent: 'flex-end', padding: 10, overflow: 'hidden' },
  photoStack: { flex: 1, gap: 5 },
  photoSmall: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoPeople: { backgroundColor: '#5B5A34' },
  photoTrail: { backgroundColor: '#2C4A33' },
  sun: { position: 'absolute', right: 18, top: 34, width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6A94C' },
  waterLine: { position: 'absolute', left: 0, right: 0, bottom: 36, height: 36, backgroundColor: '#1B3040', opacity: 0.85 },
  photoLabel: { color: TEXT, fontWeight: '900', fontSize: 13 },
  feedBody: { color: '#E0E5E1', fontSize: 13.5, lineHeight: 19 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  engagementLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  engagementText: { color: MUTED, fontSize: 12 },
  engagementDot: { color: '#6E7A72' },
  engagementActions: { flexDirection: 'row', alignItems: 'center', gap: 17 },
  partnerBody: { color: '#D9DFDB', lineHeight: 19 },
  partnerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#3B493F', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6 },
  tagText: { color: MUTED, fontSize: 10.5 },
  primaryButton: { backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  primaryButtonText: { color: '#101510', fontWeight: '900' },
  interestedCount: { color: '#8F9B93', fontSize: 11, textAlign: 'right', marginTop: -4 },
  sectionCard: { backgroundColor: CARD, borderRadius: 17, padding: 12, gap: 11 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionHeading: { color: TEXT, fontSize: 17.5, fontWeight: '900' },
  sectionSubheading: { color: '#8F9B93', fontSize: 12, marginTop: 2 },
  link: { color: GOLD_MUTED, fontWeight: '800' },
  circleGateway: { minHeight: 78, backgroundColor: CARD, borderWidth: 1, borderColor: '#3A463E', borderRadius: 17, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  circleGatewayCompact: { minHeight: 66, borderRadius: 14, backgroundColor: '#1A251F' },
  circleGatewayIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#89764A', backgroundColor: '#1C2A23', alignItems: 'center', justifyContent: 'center' },
  circleGatewayTitle: { color: TEXT, fontSize: 14.5, fontWeight: '900' },
  circleGatewayCopy: { color: '#98A49C', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  eventRow: { flexDirection: 'row', gap: 11 },
  eventThumb: { width: 104, minHeight: 110, borderRadius: 14, backgroundColor: '#294A3A', alignItems: 'center', justifyContent: 'center' },
  eventCopy: { flex: 1, gap: 5 },
  eventTitle: { color: TEXT, fontWeight: '900', fontSize: 14.5 },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaLineText: { flex: 1, color: MUTED, fontSize: 11, lineHeight: 15 },
  fullButton: { backgroundColor: GOLD, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupList: { borderWidth: 1, borderColor: '#334139', borderRadius: 14, overflow: 'hidden' },
  groupRow: { minHeight: 62, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#37443D' },
  groupAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#4A594F', backgroundColor: '#1D3026', alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { color: TEXT, fontWeight: '900', fontSize: 11.5 },
  groupCopy: { flex: 1 },
  groupName: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  groupMeta: { color: '#8F9B93', fontSize: 11, marginTop: 2 },
  emptyText: { color: '#8F9B93', padding: 14, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
