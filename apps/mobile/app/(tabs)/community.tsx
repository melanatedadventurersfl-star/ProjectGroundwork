import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPost, getCommunityFeed, reportPost, setReaction, type CommunityPost } from '../../src/community/api';

export default function CommunityScreen() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPosts(await getCommunityFeed());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the Campfire.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitPost() {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await createPost(draft);
      setDraft('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish your post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function react(postId: string) {
    try {
      await setReaction(postId, 'support');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to react.');
    }
  }

  function report(postId: string) {
    Alert.alert('Report this post?', 'A moderator will review it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => void reportPost(postId, 'community_guidelines') },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>AROUND THE CAMPFIRE</Text>
            <Text style={styles.title}>Community</Text>
            <Text style={styles.intro}>Share moments, ask questions, and keep the adventure moving beyond the event itself.</Text>
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="What are you bringing to the Campfire?"
                placeholderTextColor="#77827b"
                multiline
                maxLength={4000}
                style={styles.input}
              />
              <Pressable style={[styles.button, (!draft.trim() || submitting) && styles.disabled]} disabled={!draft.trim() || submitting} onPress={() => void submitPost()}>
                <Text style={styles.buttonText}>{submitting ? 'Posting…' : 'Post'}</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>The Campfire is quiet. Start the first conversation.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.author}>{item.author_name}</Text>
              {item.is_pinned ? <Text style={styles.pinned}>PINNED</Text> : null}
            </View>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => void react(item.id)}><Text style={styles.action}>Support · {item.reaction_count}</Text></Pressable>
              <Text style={styles.action}>Comments · {item.comment_count}</Text>
              <Pressable onLongPress={() => report(item.id)}><Text style={styles.report}>Hold to report</Text></Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 42, gap: 12 },
  header: { gap: 10, marginBottom: 8 },
  eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900' },
  intro: { color: '#cbd2cd', fontSize: 16, lineHeight: 23 },
  composer: { backgroundColor: '#17211c', borderRadius: 18, padding: 14, gap: 10 },
  input: { minHeight: 82, color: '#fff8e8', fontSize: 16, textAlignVertical: 'top' },
  button: { backgroundColor: '#d3a94f', padding: 13, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#17211c', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  card: { backgroundColor: '#17211c', borderRadius: 18, padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { color: '#fff8e8', fontWeight: '900', fontSize: 17 },
  pinned: { color: '#d3a94f', fontWeight: '900', fontSize: 11 },
  date: { color: '#859188', fontSize: 12 },
  body: { color: '#e4e9e5', fontSize: 16, lineHeight: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  action: { color: '#d3a94f', fontWeight: '800' },
  report: { color: '#859188', fontSize: 12 },
  error: { color: '#ffb4a9' },
  empty: { color: '#cbd2cd', textAlign: 'center', marginTop: 28 },
});