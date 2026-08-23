import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [campfires, setCampfires] = useState<LocalEvent[]>([]);
  const [canCreateCampfire, setCanCreateCampfire] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GroupTab>('feed');
  const [composerOpen, setComposerOpen] = useState(false);
  const [openLearnSection, setOpenLearnSection] = useState<string | null>(null);

  const learnSections = useMemo(() => defaultLearnSections(group?.name), [group?.name]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [nextGroup, nextPosts, nextCampfires, nextAccess] = await Promise.all([
        getGroup(id),
        getCommunityFeed(undefined, id),
        listGroupCampfires(id).catch(() => []),
        getGroupCampfireAccess(id).catch(() => false),
      ]);
      setGroup(nextGroup);
      setPosts(nextPosts);
      setCampfires(nextCampfires);
      setCanCreateCampfire(nextAccess);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Community.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

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
  const official = group?.kind === 'interest' || group?.kind === 'adventure';

  const hero = (
    <View style={styles.heroShell}>
      <ImageBackground source={heroImage ? { uri: heroImage } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <Pressable onPress={() => router.back()} style={styles.backPill}><Text style={styles.back}>‹ Communities</Text></Pressable>
          <View style={styles.heroSpacer} />
          <Text style={styles.eyebrow}>{official ? 'OFFICIAL COMMUNITY' : 'COMMUNITY'}</Text>
          <Text style={styles.title}>{group?.name ?? 'Community'}</Text>
          <View style={styles.memberRow}>
            <Text style={styles.memberMeta}>{memberLabel}</Text>
            {group?.city && group.state ? <Text style={styles.memberMeta}> · {group.city}, {group.state}</Text> : null}
          </View>
          <View style={styles.heroBottomRow}>
            <Text numberOfLines={2} style={styles.intro}>{group?.description ?? 'Learn, connect, and get outside together.'}</Text>
            <Pressable onPress={() => void toggleMembership()} disabled={membershipBusy} style={[styles.joinButton, group?.is_member && styles.joinedButton]}>
              <Text style={[styles.joinButtonText, group?.is_member && styles.joinedButtonText]}>{membershipBusy ? '…' : group?.is_member ? 'Joined ✓' : 'Join'}</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );

  const tabs = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {([
        ['feed', 'Feed'],
        ['learn', 'Learn'],
        ['campfire', 'Campfire'],
        ['members', 'Members'],
        ['about', 'About'],
      ] as [GroupTab, string][]).map(([key, label]) => (
        <Pressable key={key} onPress={() => setActiveTab(key)} style={[styles.tab, activeTab === key && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
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
            <View>
              <Text style={styles.sectionEyebrow}>COMMUNITY FEED</Text>
              <Text style={styles.sectionTitle}>{group?.name}</Text>
            </View>

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
                <View style={styles.actions}><Pressable onPress={() => void support(item.id)}><Text style={styles.action}>Support {item.reaction_count ? `· ${item.reaction_count}` : ''}</Text></Pressable><Pressable onPress={() => router.push(`/community/${item.id}`)}><Text style={styles.action}>Comments · {item.comment_count}</Text></Pressable></View>
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
            <Text style={styles.sectionIntro}>Start with the basics, then dig into practical guides, safety, gear, and common questions.</Text>
            <View style={styles.learnGrid}>
              {learnSections.map((section) => {
                const isOpen = openLearnSection === section.title;
                return (
                  <Pressable key={section.title} onPress={() => setOpenLearnSection(isOpen ? null : section.title)} style={styles.learnCard}>
                    <View style={styles.learnRow}><Text style={styles.learnIcon}>{section.icon}</Text><View style={styles.flex}><Text style={styles.learnTitle}>{section.title}</Text><Text style={styles.learnDescription} numberOfLines={isOpen ? undefined : 2}>{section.description}</Text></View><Text style={styles.learnChevron}>{isOpen ? '−' : '+'}</Text></View>
                    {isOpen ? <View style={styles.learnItems}>{section.items.map((item) => <Text key={item} style={styles.learnItem}>• {item}</Text>)}<Pressable onPress={() => { setActiveTab('feed'); setComposerOpen(true); }} style={styles.askCommunityButton}><Text style={styles.askCommunityText}>Ask the Community</Text></Pressable></View> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeTab === 'campfire' ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.flex}><Text style={styles.sectionEyebrow}>GET TOGETHER</Text><Text style={styles.sectionTitle}>Community Campfires</Text></View>
              {canCreateCampfire ? <Pressable onPress={() => router.push({ pathname: '/local-events/create', params: { groupId: id, groupName: group?.name ?? 'Community' } })} style={styles.smallPrimary}><Text style={styles.smallPrimaryText}>+ Campfire</Text></Pressable> : null}
            </View>
            <Text style={styles.sectionIntro}>Casual meetups connected to this Community. Creation is limited to Community Leaders and master accounts.</Text>
            {campfires.length ? <View style={styles.campfireList}>{campfires.map((event) => <CampfireCard key={event.id} event={event} />)}</View> : (
              <View style={styles.compactEmptyStatic}>
                <Text style={styles.compactEmptyIcon}>🔥</Text>
                <View style={styles.flex}><Text style={styles.compactEmptyTitle}>No Campfires planned yet</Text><Text style={styles.compactEmptyText}>{canCreateCampfire ? 'Create the first gathering for this Community.' : 'When a Community Leader plans one, it will appear here.'}</Text></View>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'members' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>COMMUNITY</Text>
            <Text style={styles.sectionTitle}>{memberLabel}</Text>
            <View style={styles.compactEmptyStatic}><Text style={styles.compactEmptyIcon}>🧑🏾‍🤝‍🧑🏿</Text><View style={styles.flex}><Text style={styles.compactEmptyTitle}>People who are into this too</Text><Text style={styles.compactEmptyText}>Member profiles and Community roles will appear here as the directory expands.</Text></View></View>
          </View>
        ) : null}

        {activeTab === 'about' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>ABOUT THIS COMMUNITY</Text>
            <Text style={styles.sectionTitle}>{group?.name}</Text>
            <View style={styles.aboutSurface}>
              <View style={styles.aboutSection}><Text style={styles.aboutHeading}>About</Text><Text style={styles.featureText}>{group?.description ?? 'A Melanated community built around a shared outdoor interest.'}</Text></View>
              <View style={styles.aboutDivider} />
              <View style={styles.aboutSection}><Text style={styles.aboutHeading}>How it works</Text><Text style={styles.featureText}>Learn is curated knowledge. Feed is where members ask questions and share experience. Campfire connects the Community through casual leader-planned meetups.</Text></View>
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
  heroShell: { margin: 16, marginBottom: 10, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1A251F' },
  hero: { minHeight: 300 },
  heroImage: { borderRadius: 24 },
  heroOverlay: { flex: 1, minHeight: 300, padding: 18, backgroundColor: 'rgba(9,15,12,0.58)' },
  heroSpacer: { flex: 1, minHeight: 72 },
  backPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(15,23,19,0.78)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  back: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  memberMeta: { color: '#D7DDD9', fontSize: 13, fontWeight: '700' },
  heroBottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 12 },
  intro: { flex: 1, color: '#F1F4F2', lineHeight: 20, fontSize: 14 },
  joinButton: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  joinedButton: { backgroundColor: 'rgba(255,248,232,0.12)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.38)' },
  joinButtonText: { color: '#17211C', fontWeight: '900' },
  joinedButtonText: { color: '#FFF8E8' },
  tabs: { paddingHorizontal: 16, gap: 7, paddingBottom: 10 },
  tab: { borderRadius: 999, borderWidth: 1, borderColor: '#2A3931', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#151F1A' },
  activeTab: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  tabText: { color: '#B8C1BB', fontWeight: '800', fontSize: 12.5 },
  activeTabText: { color: '#17211C' },
  sectionBlock: { paddingHorizontal: 18, paddingTop: 10, gap: 11 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionEyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1, fontSize: 10 },
  sectionTitle: { color: '#FFF8E8', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 2 },
  sectionIntro: { color: '#AEB8B1', fontSize: 14, lineHeight: 20 },
  error: { color: '#FFB4A9', marginHorizontal: 18, marginTop: 4 },
  composerPrompt: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#28362E', padding: 13, gap: 10 },
  composerPromptText: { color: '#8E9A92', fontSize: 15 },
  quickActions: { flexDirection: 'row', gap: 15, flexWrap: 'wrap' },
  quickAction: { color: '#D9E0DC', fontWeight: '800', fontSize: 12 },
  composer: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#3A493F', padding: 13, gap: 9 },
  composerLabel: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  input: { minHeight: 84, color: '#FFF8E8', fontSize: 15, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancelText: { color: '#9AA69E', fontWeight: '800' },
  postButton: { backgroundColor: '#D7B45A', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  postButtonText: { color: '#17211C', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  card: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#28362E', padding: 15, gap: 7 },
  authorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  author: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  pinned: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  time: { color: '#7F8D84', fontSize: 12 },
  body: { color: '#E1E7E3', fontSize: 15, lineHeight: 22, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 4 },
  action: { color: '#D7B45A', fontWeight: '800' },
  compactEmpty: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#141E19', padding: 13 },
  compactEmptyStatic: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#141E19', padding: 13 },
  compactEmptyIcon: { fontSize: 24 },
  compactEmptyTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  compactEmptyText: { color: '#99A59D', fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  chevron: { color: '#D7B45A', fontSize: 28, fontWeight: '500' },
  learnGrid: { gap: 9 },
  learnCard: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#28362E', padding: 14 },
  learnRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  learnIcon: { fontSize: 23 },
  learnChevron: { color: '#D7B45A', fontSize: 21, fontWeight: '700' },
  learnTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  learnDescription: { color: '#AEB8B1', lineHeight: 19, marginTop: 3, fontSize: 13 },
  learnItems: { borderTopWidth: 1, borderTopColor: '#2A3931', marginTop: 12, paddingTop: 10, gap: 7 },
  learnItem: { color: '#DCE3DE', lineHeight: 19, fontSize: 13 },
  askCommunityButton: { alignSelf: 'flex-start', marginTop: 4, borderRadius: 999, borderWidth: 1, borderColor: '#D7B45A', paddingHorizontal: 12, paddingVertical: 7 },
  askCommunityText: { color: '#D7B45A', fontWeight: '900', fontSize: 12 },
  smallPrimary: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  smallPrimaryText: { color: '#17211C', fontWeight: '900', fontSize: 12 },
  campfireList: { gap: 8 },
  campfireCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#28362E', padding: 12 },
  campfireIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#25281F', alignItems: 'center', justifyContent: 'center' },
  campfireEmoji: { fontSize: 20 },
  campfireTitle: { color: '#FFF8E8', fontSize: 14.5, fontWeight: '900' },
  campfireMeta: { color: '#9DA9A1', fontSize: 11.5, marginTop: 2 },
  aboutSurface: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 16 },
  aboutSection: { gap: 5 },
  aboutHeading: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  aboutDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#314038', marginVertical: 13 },
  featureText: { color: '#B6C0B9', fontSize: 14, lineHeight: 21 },
});
