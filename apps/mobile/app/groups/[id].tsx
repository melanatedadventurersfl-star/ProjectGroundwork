import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPost, getCommunityFeed, getGroup, setReaction, type CommunityGroup, type CommunityPost } from '../../src/community/api';

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

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await createPost(draft, group.adventure_id ?? undefined, id);
      setDraft('');
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

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Groups</Text></Pressable>
            <Text style={styles.eyebrow}>{group?.kind === 'adventure' ? 'ADVENTURE GROUP' : 'GROUP'}</Text>
            <Text style={styles.title}>{group?.name ?? 'Group'}</Text>
            {group?.city && group.state ? <Text style={styles.meta}>{group.city}, {group.state}</Text> : null}
            {group?.description ? <Text style={styles.intro}>{group.description}</Text> : null}
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Share an update, question, or trip note"
                placeholderTextColor="#76837B"
                multiline
                maxLength={4000}
                style={styles.input}
              />
              <Pressable disabled={!draft.trim() || submitting} onPress={() => void submit()} style={[styles.postButton, (!draft.trim() || submitting) && styles.disabled]}>
                <Text style={styles.postButtonText}>{submitting ? 'Posting…' : 'Post to group'}</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.sectionTitle}>Campfire</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No posts yet. This is a good place for the first packing question.</Text>}
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
  content: { padding: 18, paddingBottom: 42 },
  header: { gap: 8, marginBottom: 16 },
  back: { color: '#D7B45A', fontWeight: '800', fontSize: 16, marginBottom: 5 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 35, fontWeight: '900' },
  meta: { color: '#98A39C' },
  intro: { color: '#C8D0CB', lineHeight: 22, marginBottom: 5 },
  composer: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 14, gap: 10 },
  input: { minHeight: 68, color: '#FFF8E8', fontSize: 16, textAlignVertical: 'top' },
  postButton: { backgroundColor: '#D7B45A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  postButtonText: { color: '#17211C', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 8 },
  error: { color: '#FFB4A9' },
  card: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 16, gap: 7 },
  authorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  author: { color: '#FFF8E8', fontWeight: '900', fontSize: 16 },
  pinned: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  time: { color: '#7F8D84', fontSize: 12 },
  body: { color: '#E1E7E3', fontSize: 16, lineHeight: 23, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 5 },
  action: { color: '#D7B45A', fontWeight: '800' },
  empty: { color: '#99A59D', textAlign: 'center', paddingVertical: 34, lineHeight: 21 },
});
