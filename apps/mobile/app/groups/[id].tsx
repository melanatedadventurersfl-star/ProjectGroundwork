import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

type GroupTab = 'campfire' | 'learn' | 'adventures' | 'members' | 'about';

type LearnSection = {
  title: string;
  description: string;
  icon: string;
  items: string[];
};

const CAMPING_LEARN: LearnSection[] = [
  {
    title: 'Camping 101',
    description: 'The basics for choosing a campsite and feeling comfortable once you arrive.',
    icon: '🏕️',
    items: ['Choosing a campsite', 'Campground etiquette', 'What to expect at check-in'],
  },
  {
    title: 'First-Time Camping',
    description: 'A beginner path from “I have never camped” to planning your first night outside.',
    icon: '🌙',
    items: ['Your first overnight checklist', 'What to pack', 'How to set up camp before dark'],
  },
  {
    title: 'Tips & Tricks',
    description: 'Small lessons that make camp easier, warmer, drier, and better organized.',
    icon: '💡',
    items: ['Staying dry', 'Organizing your campsite', 'Comfort upgrades that matter'],
  },
  {
    title: 'Gear Guides',
    description: 'Plain-language guidance for tents, sleep systems, camp kitchens, and more.',
    icon: '🎒',
    items: ['Choosing your first tent', 'Sleeping bags and pads', 'Camp stove basics'],
  },
  {
    title: 'Safety',
    description: 'Weather, wildlife, food storage, fire safety, and emergency readiness.',
    icon: '🛟',
    items: ['Weather awareness', 'Wildlife and food storage', 'Fire and emergency basics'],
  },
  {
    title: 'Camp Cooking',
    description: 'Easy meals, smart food storage, and cleanup that keeps camp pleasant.',
    icon: '🍳',
    items: ['Simple first-night meals', 'Cooler organization', 'Leave-no-trace cleanup'],
  },
  {
    title: 'Types of Camping',
    description: 'Understand the differences before choosing the kind of trip you want.',
    icon: '🗺️',
    items: ['Car camping', 'Dispersed camping', 'Backpacking, glamping, and RV camping'],
  },
  {
    title: 'FAQ',
    description: 'Quick answers to the questions new campers ask most often.',
    icon: '❓',
    items: ['What size tent do I need?', 'Can I camp in the rain?', 'Do I need a reservation?'],
  },
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
    {
      title: 'Getting Started',
      description: `Start here for the essentials of ${groupName ?? 'this activity'}.`,
      icon: '🧭',
      items: ['What to know before you go', 'Beginner basics', 'Planning your first outing'],
    },
    {
      title: 'Tips & Tricks',
      description: 'Curated practical advice from the Melanated team.',
      icon: '💡',
      items: ['Preparation tips', 'Common beginner mistakes', 'How to build confidence'],
    },
    {
      title: 'Gear Guides',
      description: 'Understand what you need, what you do not, and how to choose it.',
      icon: '🎒',
      items: ['Essential gear', 'Nice-to-have gear', 'How to choose the right fit'],
    },
    {
      title: 'Safety',
      description: 'Core safety guidance for enjoying the outdoors responsibly.',
      icon: '🛟',
      items: ['Before-you-go safety', 'Weather awareness', 'Emergency basics'],
    },
    {
      title: 'FAQ',
      description: 'Fast answers to the most common questions about this activity.',
      icon: '❓',
      items: ['What should I know first?', 'What should I bring?', 'Where can I learn more?'],
    },
  ];
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GroupTab>('campfire');
  const [composerOpen, setComposerOpen] = useState(false);
  const [openLearnSection, setOpenLearnSection] = useState<string | null>(null);

  const learnSections = useMemo(() => defaultLearnSections(group?.name), [group?.name]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [nextGroup, nextPosts] = await Promise.all([getGroup(id), getCommunityFeed(undefined, id)]);
      setGroup(nextGroup);
      setPosts(nextPosts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this group.');
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
      await createPost({
        body: draft,
        adventureId: group.adventure_id,
        groupId: id,
        audience: 'group',
        postType: 'update',
      });
      setDraft('');
      setComposerOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to post to this group.');
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
      setError(caught instanceof Error ? caught.message : 'Unable to update group membership.');
    } finally {
      setMembershipBusy(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  const memberLabel = `${group?.member_count ?? 0} member${group?.member_count === 1 ? '' : 's'}`;

  const hero = (
    <View style={styles.heroShell}>
      <ImageBackground
        source={group?.image_url ? { uri: group.image_url } : undefined}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay}>
          <Pressable onPress={() => router.back()} style={styles.backPill}>
            <Text style={styles.back}>‹ Groups</Text>
          </Pressable>
          <View style={styles.heroSpacer} />
          <Text style={styles.eyebrow}>{group?.kind === 'adventure' ? 'ADVENTURE GROUP' : 'CURATED GROUP'}</Text>
          <Text style={styles.title}>{group?.name ?? 'Group'}</Text>
          <View style={styles.memberRow}>
            <Text style={styles.memberMeta}>{memberLabel}</Text>
            {group?.city && group.state ? <Text style={styles.memberMeta}>· {group.city}, {group.state}</Text> : null}
          </View>
          <View style={styles.heroBottomRow}>
            <Text numberOfLines={2} style={styles.intro}>{group?.description ?? 'Learn, connect, and get outside together.'}</Text>
            <Pressable onPress={() => void toggleMembership()} disabled={membershipBusy} style={[styles.joinButton, group?.is_member && styles.joinedButton]}>
              <Text style={[styles.joinButtonText, group?.is_member && styles.joinedButtonText]}>
                {membershipBusy ? '…' : group?.is_member ? 'Joined ✓' : 'Join'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );

  const tabs = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {([
        ['campfire', 'Campfire'],
        ['learn', 'Learn'],
        ['adventures', 'Adventures'],
        ['members', 'Members'],
        ['about', 'About'],
      ] as [GroupTab, string][]).map(([key, label]) => (
        <Pressable key={key} onPress={() => setActiveTab(key)} style={[styles.tab, activeTab === key && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  if (activeTab !== 'campfire') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {hero}
          {tabs}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {activeTab === 'learn' ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>CURATED KNOWLEDGE</Text>
              <Text style={styles.sectionTitle}>Learn {group?.name}</Text>
              <Text style={styles.sectionIntro}>Start with the basics, then dig into practical guides, safety, gear, and answers to common questions.</Text>
              <View style={styles.learnGrid}>
                {learnSections.map((section) => {
                  const isOpen = openLearnSection === section.title;
                  return (
                    <Pressable key={section.title} onPress={() => setOpenLearnSection(isOpen ? null : section.title)} style={styles.learnCard}>
                      <View style={styles.learnCardTop}>
                        <Text style={styles.learnIcon}>{section.icon}</Text>
                        <Text style={styles.learnChevron}>{isOpen ? '−' : '+'}</Text>
                      </View>
                      <Text style={styles.learnTitle}>{section.title}</Text>
                      <Text style={styles.learnDescription}>{section.description}</Text>
                      {isOpen ? (
                        <View style={styles.learnItems}>
                          {section.items.map((item) => <Text key={item} style={styles.learnItem}>• {item}</Text>)}
                          <Pressable onPress={() => { setActiveTab('campfire'); setComposerOpen(true); }} style={styles.askGroupButton}>
                            <Text style={styles.askGroupText}>Ask the group</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeTab === 'adventures' ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>GO DO THE THING</Text>
              <Text style={styles.sectionTitle}>{group?.name} Adventures</Text>
              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>🗓️</Text>
                <Text style={styles.featureTitle}>Relevant adventures will live here</Text>
                <Text style={styles.featureText}>Curated trips and events tied to this group will be surfaced here so learning can turn into actual time outside.</Text>
                <Pressable onPress={() => router.push('/(tabs)/explore')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Explore adventures</Text></Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'members' ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>COMMUNITY</Text>
              <Text style={styles.sectionTitle}>{memberLabel}</Text>
              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>🧑🏾‍🤝‍🧑🏿</Text>
                <Text style={styles.featureTitle}>Find people who are into this too</Text>
                <Text style={styles.featureText}>Member discovery, Trusted Hosts, moderators, and community roles will appear here as the group grows.</Text>
              </View>
            </View>
          ) : null}

          {activeTab === 'about' ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionEyebrow}>ABOUT THIS GROUP</Text>
              <Text style={styles.sectionTitle}>{group?.name}</Text>
              <View style={styles.featureCard}>
                <Text style={styles.featureText}>{group?.description ?? 'A curated Melanated community built around a shared outdoor interest.'}</Text>
              </View>
              <View style={styles.featureCard}>
                <Text style={styles.featureTitle}>How this group works</Text>
                <Text style={styles.featureText}>The Learn section is curated by Melanated. Campfire is where members ask questions, share experience, and help each other. Adventures connects the knowledge to real outings.</Text>
              </View>
              <View style={styles.featureCard}>
                <Text style={styles.featureTitle}>Community standard</Text>
                <Text style={styles.featureText}>Keep it useful, welcoming, safe, and rooted in helping people enjoy the outdoors with confidence.</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
        ListHeaderComponent={
          <View>
            {hero}
            {tabs}
            <View style={styles.campfireHeader}>
              <View style={styles.campfireTitleRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>GROUP CONVERSATION</Text>
                  <Text style={styles.sectionTitle}>Campfire</Text>
                </View>
                {!composerOpen ? (
                  <Pressable onPress={() => setComposerOpen(true)} style={styles.newPostButton}><Text style={styles.newPostText}>+ Post</Text></Pressable>
                ) : null}
              </View>

              {composerOpen ? (
                <View style={styles.composer}>
                  <Text style={styles.composerLabel}>Share with {group?.name}</Text>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Share an update, question, or trip note…"
                    placeholderTextColor="#76837B"
                    multiline
                    autoFocus
                    maxLength={4000}
                    style={styles.input}
                  />
                  <View style={styles.composerActions}>
                    <Pressable onPress={() => { setComposerOpen(false); setDraft(''); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                    <Pressable disabled={!draft.trim() || submitting} onPress={() => void submit()} style={[styles.postButton, (!draft.trim() || submitting) && styles.disabled]}>
                      <Text style={styles.postButtonText}>{submitting ? 'Posting…' : 'Post to group'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setComposerOpen(true)} style={styles.composerPrompt}>
                  <Text style={styles.composerPromptText}>Share with {group?.name}…</Text>
                  <View style={styles.quickActions}>
                    <Text style={styles.quickAction}>📷 Photo</Text>
                    <Text style={styles.quickAction}>❓ Question</Text>
                    <Text style={styles.quickAction}>🗺️ Trip</Text>
                  </View>
                </Pressable>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔥</Text>
            <Text style={styles.emptyTitle}>Start the campfire</Text>
            <Text style={styles.empty}>There are no posts here yet. Ask a question, share a tip, or tell the group what you are planning.</Text>
            <Pressable onPress={() => setComposerOpen(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Start the first conversation</Text></Pressable>
            <Pressable onPress={() => setActiveTab('learn')}><Text style={styles.learnLink}>Or explore {group?.name} tips & guides →</Text></Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable onPress={() => router.push(`/community/${item.id}`)}>
              <View style={styles.authorRow}>
                <Text style={styles.author}>{item.author_name}</Text>
                {item.is_pinned ? <Text style={styles.pinned}>PINNED</Text> : null}
              </View>
              <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </Pressable>
            <View style={styles.actions}>
              <Pressable onPress={() => void support(item.id)}><Text style={styles.action}>Support {item.reaction_count ? `· ${item.reaction_count}` : ''}</Text></Pressable>
              <Pressable onPress={() => router.push(`/community/${item.id}`)}><Text style={styles.action}>Comments · {item.comment_count}</Text></Pressable>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 42 },
  pageContent: { paddingBottom: 48 },
  heroShell: { margin: 16, marginBottom: 10, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1A251F' },
  hero: { minHeight: 300 },
  heroImage: { borderRadius: 24 },
  heroOverlay: { flex: 1, minHeight: 300, padding: 18, backgroundColor: 'rgba(9, 15, 12, 0.58)' },
  heroSpacer: { flex: 1, minHeight: 72 },
  backPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(15, 23, 19, 0.78)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  back: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  memberMeta: { color: '#D7DDD9', fontSize: 13, fontWeight: '700' },
  heroBottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 12 },
  intro: { flex: 1, color: '#F1F4F2', lineHeight: 20, fontSize: 14 },
  joinButton: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  joinedButton: { backgroundColor: 'rgba(255, 248, 232, 0.12)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.38)' },
  joinButtonText: { color: '#17211C', fontWeight: '900' },
  joinedButtonText: { color: '#FFF8E8' },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  tab: { borderRadius: 999, borderWidth: 1, borderColor: '#2A3931', paddingHorizontal: 15, paddingVertical: 9, backgroundColor: '#151F1A' },
  activeTab: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  tabText: { color: '#B8C1BB', fontWeight: '800', fontSize: 13 },
  activeTabText: { color: '#17211C' },
  campfireHeader: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  campfireTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionBlock: { paddingHorizontal: 18, paddingTop: 12, gap: 12 },
  sectionEyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1, fontSize: 10 },
  sectionTitle: { color: '#FFF8E8', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 2 },
  sectionIntro: { color: '#AEB8B1', fontSize: 15, lineHeight: 22, marginBottom: 4 },
  newPostButton: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  newPostText: { color: '#17211C', fontWeight: '900' },
  composerPrompt: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 14, gap: 12 },
  composerPromptText: { color: '#8E9A92', fontSize: 15 },
  quickActions: { flexDirection: 'row', gap: 15, flexWrap: 'wrap' },
  quickAction: { color: '#D9E0DC', fontWeight: '800', fontSize: 12 },
  composer: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#3A493F', padding: 14, gap: 10 },
  composerLabel: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  input: { minHeight: 92, color: '#FFF8E8', fontSize: 16, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancelText: { color: '#9AA69E', fontWeight: '800' },
  postButton: { backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
  postButtonText: { color: '#17211C', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { color: '#FFB4A9', marginTop: 8 },
  card: { marginHorizontal: 18, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 16, gap: 7 },
  authorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  author: { color: '#FFF8E8', fontWeight: '900', fontSize: 16 },
  pinned: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  time: { color: '#7F8D84', fontSize: 12 },
  body: { color: '#E1E7E3', fontSize: 16, lineHeight: 23, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 5 },
  action: { color: '#D7B45A', fontWeight: '800' },
  emptyState: { marginHorizontal: 18, backgroundColor: '#141E19', borderRadius: 22, borderWidth: 1, borderColor: '#26352D', padding: 22, alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  empty: { color: '#99A59D', textAlign: 'center', lineHeight: 21 },
  secondaryButton: { marginTop: 5, borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 16, paddingVertical: 11, alignSelf: 'flex-start' },
  secondaryButtonText: { color: '#17211C', fontWeight: '900' },
  learnLink: { color: '#D7B45A', fontWeight: '800', marginTop: 4 },
  learnGrid: { gap: 11 },
  learnCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 16 },
  learnCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  learnIcon: { fontSize: 24 },
  learnChevron: { color: '#D7B45A', fontSize: 22, fontWeight: '700' },
  learnTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 8 },
  learnDescription: { color: '#AEB8B1', lineHeight: 20, marginTop: 5 },
  learnItems: { borderTopWidth: 1, borderTopColor: '#2A3931', marginTop: 13, paddingTop: 11, gap: 8 },
  learnItem: { color: '#DCE3DE', lineHeight: 20 },
  askGroupButton: { alignSelf: 'flex-start', marginTop: 5, borderRadius: 999, borderWidth: 1, borderColor: '#D7B45A', paddingHorizontal: 13, paddingVertical: 8 },
  askGroupText: { color: '#D7B45A', fontWeight: '900', fontSize: 12 },
  featureCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 17, gap: 8 },
  featureIcon: { fontSize: 28 },
  featureTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  featureText: { color: '#B6C0B9', fontSize: 14, lineHeight: 21 },
});
