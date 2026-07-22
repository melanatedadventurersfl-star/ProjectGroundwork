import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';

type Comment = { id: string; body: string; created_at: string; author_id: string; profiles: { display_name: string | null; first_name: string | null } | null };

export default function CampfireConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const { data, error: queryError } = await supabase
      .from('community_comments')
      .select('id,body,created_at,author_id,profiles!community_comments_author_id_fkey(display_name,first_name)')
      .eq('post_id', id)
      .eq('status', 'published')
      .order('created_at');
    if (queryError) setError(queryError.message);
    else setComments((data ?? []) as unknown as Comment[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [id]);

  async function submit() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId || !id || !draft.trim()) return;
    const { error: insertError } = await supabase.from('community_comments').insert({ post_id: id, author_id: userId, body: draft.trim() });
    if (insertError) setError(insertError.message);
    else { setDraft(''); await load(); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<><Text style={styles.eyebrow}>CAMPFIRE THREAD</Text><Text style={styles.title}>Conversation</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</>}
        ListEmptyComponent={<Text style={styles.empty}>No replies yet. Add the first log to the fire.</Text>}
        renderItem={({ item }) => <View style={styles.comment}><Text style={styles.author}>{item.profiles?.display_name ?? item.profiles?.first_name ?? 'Member'}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text></View>}
        ListFooterComponent={<View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Add a comment" placeholderTextColor="#77827b" style={styles.input} /><Pressable style={styles.button} onPress={() => void submit()}><Text style={styles.buttonText}>Reply</Text></Pressable></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' }, center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 44, gap: 12 }, eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#fff8e8', fontSize: 32, fontWeight: '900', marginBottom: 8 },
  comment: { backgroundColor: '#17211c', borderRadius: 16, padding: 15, gap: 7 }, author: { color: '#fff8e8', fontWeight: '900' }, body: { color: '#e4e9e5', fontSize: 16, lineHeight: 23 }, date: { color: '#859188', fontSize: 12 },
  composer: { marginTop: 10, backgroundColor: '#17211c', borderRadius: 16, padding: 14, gap: 10 }, input: { minHeight: 72, color: '#fff8e8', textAlignVertical: 'top' }, button: { backgroundColor: '#d3a94f', padding: 13, borderRadius: 12, alignItems: 'center' }, buttonText: { color: '#17211c', fontWeight: '900' }, error: { color: '#ffb4a9' }, empty: { color: '#cbd2cd', textAlign: 'center', marginVertical: 24 }
});