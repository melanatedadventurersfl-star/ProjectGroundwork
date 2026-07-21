import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../src/notifications/api';
import type { MemberNotification } from '../../src/notifications/types';

export default function NotificationCenterScreen() {
  const [items, setItems] = useState<MemberNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listNotifications());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openNotification(item: MemberNotification) {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, read_at: new Date().toISOString() } : candidate));
    }
    if (item.action_url) router.push(item.action_url as never);
  }

  async function markAllRead() {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>CAMPFIRE SIGNALS</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          </View>
          {unreadCount > 0 ? (
            <Pressable onPress={() => void markAllRead()} style={styles.markButton}>
              <Text style={styles.markButtonText}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? <ActivityIndicator /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && items.length === 0 ? <Text style={styles.empty}>No signals yet. The trail is quiet.</Text> : null}

        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void openNotification(item)}
              style={[styles.card, !item.read_at && styles.unreadCard, item.priority === 'critical' && styles.criticalCard]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.kind}>{item.kind}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              {!item.read_at ? <Text style={styles.unreadLabel}>NEW</Text> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  content: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  eyebrow: { color: '#d3a94f', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#aeb8b2', marginTop: 4 },
  markButton: { borderWidth: 1, borderColor: '#d3a94f', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  markButtonText: { color: '#d3a94f', fontWeight: '800' },
  list: { gap: 12 },
  card: { backgroundColor: '#17211c', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#26332c' },
  unreadCard: { borderColor: '#d3a94f' },
  criticalCard: { borderColor: '#ff7a66', borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kind: { color: '#d3a94f', fontWeight: '900', textTransform: 'uppercase', fontSize: 12 },
  time: { color: '#819087', fontSize: 11, flexShrink: 1, textAlign: 'right' },
  cardTitle: { color: '#fff8e8', fontSize: 18, fontWeight: '900', marginTop: 8 },
  body: { color: '#d4d8d5', fontSize: 15, lineHeight: 22, marginTop: 6 },
  unreadLabel: { color: '#d3a94f', fontSize: 11, fontWeight: '900', marginTop: 10 },
  error: { color: '#ffb4a9', marginBottom: 16 },
  empty: { color: '#aeb8b2', fontSize: 16, textAlign: 'center', marginTop: 48 },
});