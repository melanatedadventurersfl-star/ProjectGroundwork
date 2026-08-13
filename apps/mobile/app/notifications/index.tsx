import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../src/notifications/api';
import type { MemberNotification } from '../../src/notifications/types';

const signalSources = [
  'Adventure changes, cancellations, and important announcements',
  'Reservation, payment, and ticket status',
  'Readiness deadlines, waivers, and check-in blockers',
  'Adventure Group announcements and community activity',
  'Trail Family invitations and account updates',
  'Emergency or time-sensitive operations messages',
];

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

  useEffect(() => { void load(); }, [load]);

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
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <View style={styles.header}>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>CAMPFIRE SIGNALS</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</Text>
          </View>
          {unreadCount > 0 ? <Pressable onPress={() => void markAllRead()} style={styles.markButton}><Text style={styles.markButtonText}>Mark all read</Text></Pressable> : null}
        </View>

        {loading ? <ActivityIndicator color="#D7B45A" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No notifications right now.</Text>
            <Text style={styles.emptyBody}>When something needs your attention, it will show up here.</Text>
            <Text style={styles.sourceHeading}>What can generate an alert?</Text>
            {signalSources.map((source) => <View key={source} style={styles.sourceRow}><View style={styles.sourceDot} /><Text style={styles.sourceText}>{source}</Text></View>)}
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => (
            <Pressable key={item.id} onPress={() => void openNotification(item)} style={[styles.card, !item.read_at && styles.unreadCard, item.priority === 'critical' && styles.criticalCard]}>
              <View style={styles.cardTop}><Text style={styles.kind}>{item.kind}</Text><Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text></View>
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
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 48 }, back: { color: '#D7B45A', fontWeight: '800', fontSize: 16, marginBottom: 12 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }, headingText: { flex: 1 }, eyebrow: { color: '#D3A94F', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#AEB8B2', marginTop: 4 }, markButton: { borderWidth: 1, borderColor: '#D3A94F', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, markButtonText: { color: '#D3A94F', fontWeight: '800' },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 19, gap: 8 }, emptyTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, emptyBody: { color: '#AEB8B2', lineHeight: 21 }, sourceHeading: { color: '#F0D083', fontWeight: '900', marginTop: 8 }, sourceRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' }, sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D7B45A', marginTop: 7 }, sourceText: { color: '#C9D0CC', flex: 1, lineHeight: 19 },
  list: { gap: 12, marginTop: 14 }, card: { backgroundColor: '#17211C', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#26332C' }, unreadCard: { borderColor: '#D3A94F' }, criticalCard: { borderColor: '#FF7A66', borderWidth: 2 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, kind: { color: '#D3A94F', fontWeight: '900', textTransform: 'uppercase', fontSize: 12 }, time: { color: '#819087', fontSize: 11, flexShrink: 1, textAlign: 'right' }, cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 8 }, body: { color: '#D4D8D5', fontSize: 15, lineHeight: 22, marginTop: 6 }, unreadLabel: { color: '#D3A94F', fontSize: 11, fontWeight: '900', marginTop: 10 }, error: { color: '#FFB4A9', marginBottom: 16 },
});
