import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type FeedbackRow = {
  id: string;
  user_id: string;
  category: string;
  message: string;
  screen_path: string | null;
  app_version: string | null;
  build_number: string | null;
  platform: string | null;
  status: string;
  created_at: string;
};

export default function AdminTesterFeedbackScreen() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace('/(auth)/sign-in' as never);
      return;
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc('is_platform_admin', { check_profile_id: userData.user.id });
    if (adminError || !isAdmin) {
      setError('Admin access is required.');
      setLoading(false);
      return;
    }

    const { data, error: feedbackError } = await supabase
      .from('tester_feedback')
      .select('id,user_id,category,message,screen_path,app_version,build_number,platform,status,created_at')
      .order('created_at', { ascending: false })
      .limit(250);

    if (feedbackError) setError(feedbackError.message);
    else setRows((data ?? []) as FeedbackRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#D7B45A" /><Text style={styles.muted}>Loading tester feedback…</Text></View>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.eyebrow}>PILOT OPERATIONS</Text>
        <Text style={styles.title}>Tester feedback</Text>
        <Text style={styles.subtitle}>Newest reports first. Problem reports also trigger an admin notification.</Text>
      </View>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#D7B45A" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No tester feedback yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.category}>{item.category.toUpperCase()}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.meta}>{item.screen_path ?? 'Unknown screen'}</Text>
            <Text style={styles.meta}>{[item.platform, item.app_version ? `v${item.app_version}` : null, item.build_number ? `build ${item.build_number}` : null].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.ticket}>GM-{item.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1713', gap: 10 },
  muted: { color: '#8F9A93' },
  header: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 14 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, letterSpacing: 1.4, fontWeight: '900' },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#9DA8A1', fontSize: 13, lineHeight: 19, marginTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  card: { backgroundColor: '#17231C', borderWidth: 1, borderColor: '#2C3B32', borderRadius: 18, padding: 15 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  category: { color: '#D7B45A', fontSize: 10, letterSpacing: 1.1, fontWeight: '900' },
  status: { color: '#A8B2AC', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  message: { color: '#FFF8E8', fontSize: 15, lineHeight: 21, fontWeight: '700', marginTop: 9 },
  meta: { color: '#849088', fontSize: 11, lineHeight: 16, marginTop: 5 },
  ticket: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginTop: 8 },
  errorCard: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: '#3A1C1C' },
  errorText: { color: '#FFB4AB', fontSize: 13 },
  empty: { color: '#8F9A93', textAlign: 'center', paddingTop: 40 },
});
