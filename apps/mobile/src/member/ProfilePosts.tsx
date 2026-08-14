import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../lib/supabase';

export type ProfilePost = {
  id: string;
  body: string;
  image_url: string | null;
  post_type: string | null;
  created_at: string;
};

async function signCommunityMedia(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

async function getMyProfilePosts(): Promise<ProfilePost[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('community_posts')
    .select('id, body, image_url, post_type, created_at')
    .eq('author_id', userId)
    .eq('status', 'published')
    .eq('audience', 'everyone')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all((data ?? []).map(async (row: any) => ({
    id: row.id,
    body: row.body,
    image_url: await signCommunityMedia(row.image_url),
    post_type: row.post_type,
    created_at: row.created_at,
  })));
}

function formatPostDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

export function ProfilePosts() {
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPosts(await getMyProfilePosts());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load posts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <View style={styles.card}><Text style={styles.title}>Posts</Text><ActivityIndicator color="#F5C341" /></View>;
  }

  if (error) {
    return <View style={styles.card}><Text style={styles.title}>Posts</Text><Text style={styles.muted}>{error}</Text></View>;
  }

  if (!posts.length) {
    return <View style={styles.card}><Text style={styles.title}>Posts</Text><View style={styles.empty}><Text style={styles.emptyTitle}>No public posts yet</Text><Text style={styles.muted}>Posts shared with Everyone will appear here automatically.</Text></View></View>;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}><Text style={styles.title}>Posts</Text><Text style={styles.count}>{posts.length}</Text></View>
      <ScrollView
        scrollEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#F5C341" />}
      >
        {posts.map((post) => (
          <View key={post.id} style={styles.post}>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{post.post_type ? post.post_type.replace(/_/g, ' ') : 'Post'}</Text>
              <Text style={styles.meta}>{formatPostDate(post.created_at)}</Text>
            </View>
            <Text style={styles.body}>{post.body}</Text>
            {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.image} resizeMode="cover" /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},
  headingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},
  count:{color:'#67CFC8',fontSize:12,fontWeight:'900'},
  post:{paddingVertical:14,borderTopWidth:1,borderTopColor:'#26332C',gap:9},
  metaRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},
  meta:{color:'#67CFC8',fontSize:11.5,fontWeight:'800',textTransform:'capitalize'},
  body:{color:'#D4DBD7',fontSize:14.5,lineHeight:21},
  image:{width:'100%',aspectRatio:1.45,borderRadius:14,backgroundColor:'#0C1411'},
  empty:{backgroundColor:'#0C1411',borderRadius:14,padding:15,marginTop:4},
  emptyTitle:{color:'#F7F8F3',fontWeight:'900'},
  muted:{color:'#96A39B',lineHeight:20,marginTop:4},
});
