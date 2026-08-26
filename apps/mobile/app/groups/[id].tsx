import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPost,
  getCommunityFeed,
  getGroup,
  joinGroup,
  leaveGroup,
  setReaction,
  type CommunityGroup,
  type CommunityPost,
} from '../../src/community/api';
import { supabase } from '../../src/lib/supabase';
import {
  getGroupCampfireAccess,
  listGroupCampfires,
  type LocalEvent,
} from '../../src/local-events/api';

type GroupTab = 'feed' | 'learn' | 'campfire' | 'members' | 'about';

type LearnSection = {
  title: string;
  description: string;
  icon: string;
  items: string[];
};

type CommunityMember = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  group_role: string;
  platform_role: string | null;
  event_host_level: string | null;
  joined_at: string;
};

const CAMPING_LEARN: LearnSection[] = [
  { title: 'Camping 101', description: 'The basics for choosing a campsite and feeling comfortable once you arrive.', icon: '🏕️', items: ['Choosing a campsite', 'Campground etiquette', 'What to expect at check-in'] },
  { title: 'First-Time Camping', description: 'A beginner path from “I have never camped” to planning your first night outside.', icon: '🌙', items: ['Your first overnight checklist', 'What to pack', 'How to set up camp before dark'] },
  { title: 'Tips & Tricks', description: 'Small lessons that make camp easier, warmer, drier, and better organized.', icon: '💡', items: ['Staying dry', 'Organizing your campsite', 'Comfort upgrades that matter'] },
  { title: 'Gear Guides', description: 'Plain-language guidance for tents, sleep systems, camp kitchens, and more.', icon: '🎒', items: ['Choosing your first tent', 'Sleeping bags and pads', 'Camp stove basics'] },
  { title: 'Safety', description: 'Weather, wildlife, food storage, fire safety, and emergency readiness.', icon: '🛟', items: ['Weather awareness', 'Wildlife and food storage', 'Fire and emergency basics'] },
  { title: 'Camp Cooking', description: 'Easy meals, smart food storage, and cleanup that keeps camp pleasant.', icon: '🍳', items: ['Simple first-night meals', 'Cooler organization', 'Leave-no-trace cleanup'] },
  { title: 'Types of Camping', description: 'Understand the differences before choosing the kind of trip you want.', icon: '🗺️', items: ['Car camping', 'Dispersed camping', 'Backpacking, glamping, and RV camping'] },
  { title: 'FAQ', description: 'Quick answers to the questions new campers ask most often.', icon: '❓', items: ['What size tent do I need?', 'Can I camp in the rain?', 'Do I need a reservation?'] },
];

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function defaultLearnSections(groupName?: string | null): LearnSection[] {
  if ((groupName ?? '').toLowerCase().includes('camp')) return CAMPING_LEARN;
  return [
    { title: 'Getting Started', description: `Start here for the essentials of ${groupName ?? 'this activity'}.`, icon: '🧭', items: ['What to know before you go', 'Beginner basics', 'Planning your first outing'] },
    { title: 'Tips & Tricks', description: 'Curated practical advice from the Melanated team.', icon: '💡', items: ['Preparation tips', 'Common beginner mistakes', 'How to build confidence'] },
    { title: 'Gear Guides', description: 'Understand what you need, what you do not, and how to choose it.', icon: '🎒', items: ['Essential gear', 'Nice-to-have gear', 'How to choose the right fit'] },
    { title: 'Safety', description: 'Core safety guidance for enjoying the outdoors responsibly.', icon: '🛟', items: ['Before-you-go safety', 'Weather awareness', 'Emergency basics'] },
    { title: 'FAQ', description: 'Fast answers to the most common questions about this activity.', icon: '❓', items: ['What should I know first?', 'What should I bring?', 'Where can I learn more?'] },
  ];
}

function CampfireCard({ event }: { event: LocalEvent }) {
  const start = new Date(event.starts_at);
  return (
    <Pressable style={styles.campfireCard} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <View style={styles.campfireIcon}><Text style={styles.campfireEmoji}>🔥</Text></View>
      <View style={styles.flex}>
        <Text style={styles.campfireTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.campfireMeta}>{start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.campfireMeta} numberOfLines={1}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function MemberRow({ member }: { member: CommunityMember }) {
  const role = ['host', 'lead', 'leader', 'moderator'].includes(member.group_role.toLowerCase())
    ? 'Community Leader'
    : member.platform_role === 'founder' || member.platform_role === 'admin'
      ? 'Go Melanated'
      : 'Member';
  const location = [member.home_city, member.home_state].filter(Boolean).join(', ');

  return (
    <Pressable style={styles.memberCard} onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: member.profile_id } })}>
      <View style={styles.memberAvatar}>
        {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.memberAvatarImage} /> : <Text style={styles.memberAvatarInitials}>{initials(member.display_name)}</Text>}
      </View>
      <View style={styles.flex}>
        <View style={styles.memberNameLine}>
          <Text style={styles.memberName} numberOfLines={1}>{member.display_name}</Text>
          {role !== 'Member' ? <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{role}</Text></View> : null}
        </View>
        <Text style={styles.memberMetaText} numberOfLines={1}>{location || 'Community member'}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [campfires, setCampfires] = useState<LocalEvent[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [canCreateCampfire, setCanCreateCampfire] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [membershipMenuOpen, setMembershipMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GroupTab>('feed');
  const [composerOpen, setComposerOpen] = useState(false);
  const [openLearnSection, setOpenLearnSection] = useState<string | null>(null);

  const learnSections = useMemo(() => defaultLearnSections(group?.name), [group?.name]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const nextGroup = await getGroup(id);
      const isLocal = nextGroup.kind === 'local';
      const [nextPosts, nextCampfires, nextAccess, memberResult] = await Promise.all([
        getCommunityFeed(undefined, id),
        isLocal ? listGroupCampfires(id).catch(() => []) : Promise.resolve([]),
        isLocal ? getGroupCampfireAccess(id).catch(() => false) : Promise.resolve(false),
        supabase.rpc('get_group_member_directory', { target_group_id: id }),
      ]);
      setGroup(nextGroup);
      setPosts(nextPosts);
      setCampfires(nextCampfires);
      setCanCreateCampfire(nextAccess);
      setMembers((memberResult.data ?? []) as CommunityMember[]);
      if (!isLocal && activeTab === 'campfire') setActiveTab('feed');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Community.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, id]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!id || !draft.trim() || !group) return;
    setSubmitting(true);
    try {
      await createPost({ body: draft, adventureId: group.adventure_id, groupId: id, audience: 'group', postType: 'update' });
      setDraft('');
      setComposerOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to post to this Community.');
    } finally {
      setSubmitting(false);
    }
  }

  async function support(postId: string) {
    try {
      await setReaction(postId, 'support');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add support.');
    }
  }

  async function toggleMembership() {
    if (!id || !group || membershipBusy) return;
    setMembershipBusy(true);
    setMembershipMenuOpen(false);
    try {
      if (group.is_member) await leaveGroup(id);
      else await joinGroup(id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update Community membership.');
    } finally {
      setMembershipBusy(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  const memberLabel = `${group?.member_count ?? 0} member${group?.member_count === 1 ? '' : 's'}`;
  const heroImage = group?.cover_image_url || group?.image_url;
  const localCommunity = group?.kind === 'local';
  const communityLabel = localCommunity
    ? group?.city ? `${group.city.toUpperCase()} COMMUNITY` : 'LOCAL COMMUNITY'
    : 'OFFICIAL COMMUNITY';
  const tabItems: [GroupTab, string][] = localCommunity
    ? [['feed', 'Feed'], ['learn', 'Learn'], ['campfire', 'Campfire'], ['members', 'Members'], ['about', 'About']]
    : [['feed', 'Feed'], ['learn', 'Learn'], ['members', 'Members'], ['about', 'About']];

  const hero = (
    <View style={styles.heroShell}>
      <ImageBackground source={heroImage ? { uri: heroImage } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <Pressable onPress={() => router.back()} style={styles.backPill}><Text style={styles.back}>‹ Communities</Text></Pressable>
          <View style={styles.heroSpacer} />
          <View style={styles.heroIdentityRow}>
            <View style={styles.communityAvatar}>
              {group?.image_url ? <Image source={{ uri: group.image_url }} style={styles.communityAvatarImage} /> : <Text style={styles.communityAvatarInitials}>{initials(group?.name ?? 'Community')}</Text>}
            </View>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>{communityLabel}</Text>
              <Text style={styles.title} numberOfLines={1}>{group?.name ?? 'Community'}</Text>
              <View style={styles.memberRow}>
                <Text style={styles.memberMeta}>{memberLabel}</Text>
                {group?.city && group.state ? <Text style={styles.memberMeta}> · {group.city}, {group.state}</Text> : null}
              </View>
            </View>
          </View>
          <View style={styles.heroBottomRow}>
            <Text numberOfLines={2} style={styles.intro}>{group?.description ?? 'Learn, connect, and get outside together.'}</Text>
            <View style={styles.membershipWrap}>
              <Pressable
                onPress={() => group?.is_member ? setMembershipMenuOpen((value) => !value) : void toggleMembership()}
                disabled={membershipBusy}
                style={[styles.joinButton, group?.is_member && styles.joinedButton]}
              >
                <Text style={[styles.joinButtonText, group?.is_member && styles.joinedButtonText]}>{membershipBusy ? '…' : group?.is_member ? 'Joined ⌄' : 'Join'}</Text>
              </Pressable>
              {membershipMenuOpen && group?.is_member ? (
                <View style={styles.membershipMenu}>
                  <Text style={styles.membershipMenuTitle}>Membership</Text>
                  <Pressable style={styles.membershipMenuRow} onPress={() => void toggleMembership()}><Text style={styles.leaveText}>Leave Community</Text></Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );

  const tabs = (
    <View style={styles.tabBar}>
      {tabItems.map(([key, label]) => (
        <Pressable key={key} onPress={() => setActiveTab(key)} style={styles.tab}>
          <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
          <View style={[styles.tabIndicator, activeTab === key && styles.tabIndicatorActive]} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
      >
        {hero}
        {tabs}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {activeTab === 'feed' ? (
          <View style={styles.sectionBlock}>
            <View><Text style={styles.sectionEyebrow}>COMMUNITY FEED</Text><Text style={styles.sectionTitle}>{group?.name}</Text></View>
            {composerOpen ? (
              <View style={styles.composer}>
                <Text style={styles.composerLabel}>Share with {group?.name}</Text>
                <TextInput value={draft} onChangeText={setDraft} placeholder="Share an update, question, or trip note…" placeholderTextColor="#76837B" multiline autoFocus maxLength={4000} style={styles.input} />
                <View style={styles.composerActions}>
                  <Pressable onPress={() => { setComposerOpen(false); setDraft(''); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                  <Pressable disabled={!draft.trim() || submitting} onPress={() => void submit()} style={[styles.postButton, (!draft.trim() || submitting) && styles.disabled]}><Text style={styles.postButtonText}>{submitting ? 'Posting…' : 'Post'}</Text></Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setComposerOpen(true)} style={styles.composerPrompt}>
                <Text style={styles.composerPromptText}>Share with {group?.name}…</Text>
                <View style={styles.quickActions}><Text style={styles.quickAction}>📷 Photo</Text><Text style={styles.quickAction}>❓ Question</Text><Text style={styles.quickAction}>🗺️ Trip</Text></View>
              </Pressable>
            )}
            {posts.length ? posts.map((item) => (
              <View key={item.id} style={styles.card}>
                <Pressable onPress={() => router.push(`/community/${item.id}`)}>
                  <View style={styles.authorRow}><Text style={styles.author}>{item.author_name}</Text>{item.is_pinned ? <Text style={styles.pinned}>PINNED</Text> : null}</View>
                  <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable onPress={() => void support(item.id)}><Text style={styles.action}>Support {item.reaction_count ? `· ${item.reaction_count}` : ''}</Text></Pressable>
                  <Pressable onPress={() => router.push(`/community/${item.id}`)}><Text style={styles.action}>Comments · {item.comment_count}</Text></Pressable>
                </View>
              </View>
            )) : (
              <Pressable onPress={() => setComposerOpen(true)} style={styles.compactEmpty}>
                <Text style={styles.compactEmptyIcon}>💬</Text>
                <View style={styles.flex}><Text style={styles.compactEmptyTitle}>Be the first to post</Text><Text style={styles.compactEmptyText}>Ask a question, share a tip, or tell the Community what you’re planning.</Text></View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {activeTab === 'learn' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>CURATED KNOWLEDGE</Text>
            <Text style={styles.sectionTitle}>Learn {group?.name}</Text>
            <Text style={styles.sectionIntro}>Practical guides, safety, gear, and common questions.</Text>
            <View style={styles.learnGrid}>
              {learnSections.map((section) => {
                const isOpen = openLearnSection === section.title;
                return (
                  <Pressable key={section.title} onPress={() => setOpenLearnSection(isOpen ? null : section.title)} style={styles.learnCard}>
                    <View style={styles.learnRow}>
                      <View style={styles.learnIconWrap}><Text style={styles.learnIcon}>{section.icon}</Text></View>
                      <View style={styles.flex}><Text style={styles.learnTitle}>{section.title}</Text><Text style={styles.learnDescription} numberOfLines={isOpen ? undefined : 1}>{section.description}</Text></View>
                      <Text style={styles.learnChevron}>{isOpen ? '−' : '+'}</Text>
                    </View>
                    {isOpen ? <View style={styles.learnItems}>{section.items.map((item) => <Text key={item} style={styles.learnItem}>• {item}</Text>)}<Pressable onPress={() => { setActiveTab('feed'); setComposerOpen(true); }} style={styles.askCommunityButton}><Text style={styles.askCommunityText}>Ask the Community</Text></Pressable></View> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {localCommunity && activeTab === 'campfire' ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.flex}><Text style={styles.sectionEyebrow}>LOCAL GATHERINGS</Text><Text style={styles.sectionTitle}>Community Campfires</Text></View>
              {canCreateCampfire ? <Pressable onPress={() => router.push({ pathname: '/local-events/create', params: { groupId: id, groupName: group?.name ?? 'Community' } })} style={styles.smallPrimary}><Text style={styles.smallPrimaryText}>+ Campfire</Text></Pressable> : null}
            </View>
            <Text style={styles.sectionIntro}>Casual meetups for this local Community.</Text>
            {campfires.length ? <View style={styles.campfireList}>{campfires.map((event) => <CampfireCard key={event.id} event={event} />)}</View> : (
              <View style={styles.compactEmptyStatic}>
                <Text style={styles.compactEmptyIcon}>🔥</Text>
                <View style={styles.flex}><Text style={styles.compactEmptyTitle}>No Campfires planned yet</Text><Text style={styles.compactEmptyText}>{canCreateCampfire ? 'Create the first local gathering for this Community.' : 'When a Community Leader plans one, it will appear here.'}</Text></View>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'members' ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionTitleRow}><View style={styles.flex}><Text style={styles.sectionEyebrow}>COMMUNITY</Text><Text style={styles.sectionTitle}>{memberLabel}</Text></View></View>
            {members.length ? <View style={styles.memberList}>{members.map((member) => <MemberRow key={member.profile_id} member={member} />)}</View> : (
              <View style={styles.compactEmptyStatic}><Text style={styles.compactEmptyIcon}>🧑🏾‍🤝‍🧑🏿</Text><View style={styles.flex}><Text style={styles.compactEmptyTitle}>No members to show yet</Text><Text style={styles.compactEmptyText}>Member profiles will appear here as people join.</Text></View></View>
            )}
          </View>
        ) : null}

        {activeTab === 'about' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>ABOUT THIS COMMUNITY</Text>
            <Text style={styles.sectionTitle}>{group?.name}</Text>
            <View style={styles.aboutSurface}>
              <View style={styles.aboutSection}><Text style={styles.aboutHeading}>About</Text><Text style={styles.featureText}>{group?.description ?? 'A Melanated community built around a shared outdoor interest.'}</Text></View>
              <View style={styles.aboutDivider} />
              <View style={styles.aboutSection}><Text style={styles.aboutHeading}>How it works</Text><Text style={styles.featureText}>{localCommunity ? 'Learn is curated knowledge. Feed is where members ask questions and share experience. Campfire is for casual local gatherings planned by Community Leaders.' : 'Learn is curated knowledge. Feed is where members ask questions and share experience. Members connects people around the shared interest.'}</Text></View>
              <View style={styles.aboutDivider} />
              <View style={styles.aboutSection}><Text style={styles.aboutHeading}>Community standard</Text><Text style={styles.featureText}>Keep it useful, welcoming, safe, and rooted in helping people enjoy the outdoors with confidence.</Text></View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  pageContent: { paddingBottom: 54 },
  flex: { flex: 1 },
  heroShell: { margin: 16, marginBottom: 4, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1A251F' },
  hero: { minHeight: 276 },
  heroImage: { borderRadius: 22 },
  heroOverlay: { flex: 1, minHeight: 276, padding: 16, backgroundColor: 'rgba(9,15,12,0.58)' },
  heroSpacer: { flex: 1, minHeight: 54 },
  backPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(15,23,19,0.78)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  back: { color: '#FFF8E8', fontWeight: '900', fontSize: 13 },
  heroIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  communityAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1F3027', borderWidth: 2, borderColor: 'rgba(255,248,232,0.86)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  communityAvatarImage: { width: '100%', height: '100%' },
  communityAvatarInitials: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 10 },
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 33, fontWeight: '900', marginTop: 2 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 },
  memberMeta: { color: '#D7DDD9', fontSize: 11.5, fontWeight: '700' },
  heroBottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 },
  intro: { flex: 1, color: '#F1F4F2', lineHeight: 18, fontSize: 12.5 },
  membershipWrap: { position: 'relative', alignItems: 'flex-end' },
  joinButton: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  joinedButton: { backgroundColor: 'rgba(255,248,232,0.12)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.38)' },
  joinButtonText: { color: '#17211C', fontWeight: '900', fontSize: 12 },
  joinedButtonText: { color: '#FFF8E8' },
  membershipMenu: { position: 'absolute', right: 0, top: 38, minWidth: 164, zIndex: 20, backgroundColor: '#101813', borderRadius: 12, borderWidth: 1, borderColor: '#3A493F', overflow: 'hidden' },
  membershipMenuTitle: { color: '#8E9A92', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  membershipMenuRow: { paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#334139' },
  leaveText: { color: '#FFB4A9', fontWeight: '800', fontSize: 12.5 },
  tabBar: { marginHorizontal: 16, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A3931' },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 9 },
  tabText: { color: '#8F9B93', fontWeight: '800', fontSize: 11.5, paddingBottom: 8 },
  activeTabText: { color: '#FFF8E8' },
  tabIndicator: { height: 2, width: '72%', borderRadius: 2, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: '#D7B45A' },
  sectionBlock: { paddingHorizontal: 18, paddingTop: 14, gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 0.9, fontSize: 9.5 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 26, fontWeight: '900', marginTop: 1 },
  sectionIntro: { color: '#AEB8B1', fontSize: 12.5, lineHeight: 18 },
  error: { color: '#FFB4A9', marginHorizontal: 18, marginTop: 6 },
  composerPrompt: { backgroundColor: '#17211C', borderRadius: 15, borderWidth: 1, borderColor: '#28362E', padding: 12, gap: 9 },
  composerPromptText: { color: '#8E9A92', fontSize: 14 },
  quickActions: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  quickAction: { color: '#D9E0DC', fontWeight: '800', fontSize: 11 },
  composer: { backgroundColor: '#17211C', borderRadius: 15, borderWidth: 1, borderColor: '#3A493F', padding: 12, gap: 8 },
  composerLabel: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  input: { minHeight: 78, color: '#FFF8E8', fontSize: 14, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 },
  cancelText: { color: '#9AA69E', fontWeight: '800', fontSize: 12 },
  postButton: { backgroundColor: '#D7B45A', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9, alignItems: 'center' },
  postButtonText: { color: '#17211C', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.45 },
  card: { backgroundColor: '#17211C', borderRadius: 15, borderWidth: 1, borderColor: '#28362E', padding: 14, gap: 6 },
  authorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  author: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  pinned: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  time: { color: '#7F8D84', fontSize: 11 },
  body: { color: '#E1E7E3', fontSize: 14, lineHeight: 20, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 3 },
  action: { color: '#D7B45A', fontWeight: '800', fontSize: 12 },
  compactEmpty: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#141E19', padding: 12 },
  compactEmptyStatic: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#141E19', padding: 12 },
  compactEmptyIcon: { fontSize: 22 },
  compactEmptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  compactEmptyText: { color: '#99A59D', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  chevron: { color: '#D7B45A', fontSize: 25, fontWeight: '500' },
  learnGrid: { gap: 7 },
  learnCard: { backgroundColor: '#17211C', borderRadius: 14, borderWidth: 1, borderColor: '#28362E', padding: 11 },
  learnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  learnIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#202C25', alignItems: 'center', justifyContent: 'center' },
  learnIcon: { fontSize: 18 },
  learnChevron: { color: '#D7B45A', fontSize: 19, fontWeight: '700' },
  learnTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  learnDescription: { color: '#AEB8B1', lineHeight: 17, marginTop: 2, fontSize: 11.5 },
  learnItems: { borderTopWidth: 1, borderTopColor: '#2A3931', marginTop: 10, paddingTop: 9, gap: 6 },
  learnItem: { color: '#DCE3DE', lineHeight: 18, fontSize: 12 },
  askCommunityButton: { alignSelf: 'flex-start', marginTop: 3, borderRadius: 999, borderWidth: 1, borderColor: '#D7B45A', paddingHorizontal: 11, paddingVertical: 6 },
  askCommunityText: { color: '#D7B45A', fontWeight: '900', fontSize: 11 },
  smallPrimary: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  smallPrimaryText: { color: '#17211C', fontWeight: '900', fontSize: 11 },
  campfireList: { gap: 7 },
  campfireCard: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#17211C', borderRadius: 14, borderWidth: 1, borderColor: '#28362E', padding: 10 },
  campfireIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#25281F', alignItems: 'center', justifyContent: 'center' },
  campfireEmoji: { fontSize: 18 },
  campfireTitle: { color: '#FFF8E8', fontSize: 13.5, fontWeight: '900' },
  campfireMeta: { color: '#9DA9A1', fontSize: 10.5, marginTop: 1 },
  memberList: { gap: 7 },
  memberCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#17211C', padding: 9 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#213229', borderWidth: 1, borderColor: '#405247', alignItems: 'center', justifyContent: 'center' },
  memberAvatarImage: { width: '100%', height: '100%' },
  memberAvatarInitials: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' },
  memberNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  memberName: { color: '#FFF8E8', fontSize: 13.5, fontWeight: '900', flexShrink: 1 },
  memberMetaText: { color: '#8F9B93', fontSize: 10.5, marginTop: 2 },
  roleBadge: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#2B2B20', borderWidth: 1, borderColor: '#564D2B' },
  roleBadgeText: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  aboutSurface: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#28362E', padding: 14 },
  aboutSection: { gap: 4 },
  aboutHeading: { color: '#FFF8E8', fontSize: 14.5, fontWeight: '900' },
  aboutDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#314038', marginVertical: 11 },
  featureText: { color: '#B6C0B9', fontSize: 12.5, lineHeight: 18 },
});