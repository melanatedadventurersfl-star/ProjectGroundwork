import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  archiveAllNotifications,
  archiveNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../src/notifications/api';
import type { MemberNotification, NotificationKind } from '../../src/notifications/types';

type NotificationFilter = 'all' | 'unread';

type NotificationGroup = {
  label: string;
  items: MemberNotification[];
};

const signalSources = [
  'Adventure changes, cancellations, and important announcements',
  'Reservation, payment, and ticket status',
  'Readiness deadlines, waivers, and check-in blockers',
  'Adventure Group announcements and community activity',
  'Trail Family invitations and account updates',
  'Emergency or time-sensitive operations messages',
];

const categoryMeta: Record<NotificationKind, { icon: string; label: string }> = {
  readiness: { icon: '✓', label: 'Readiness' },
  announcement: { icon: '◇', label: 'Announcement' },
  emergency: { icon: '!', label: 'Urgent' },
  registration: { icon: '⌁', label: 'Registration' },
  payment: { icon: '$', label: 'Payment' },
  community: { icon: '♨', label: 'Campfire' },
  system: { icon: '•', label: 'System' },
};

function notificationMeta(kind: NotificationKind) {
  return categoryMeta[kind] ?? { icon: '•', label: 'Update' };
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) return 'Now';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dateGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}

function groupNotifications(items: MemberNotification[]): NotificationGroup[] {
  const order = ['Today', 'Yesterday', 'Earlier'];
  const groups = new Map<string, MemberNotification[]>();

  items.forEach((item) => {
    const label = dateGroup(item.created_at);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });

  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, items: groups.get(label) ?? [] }));
}

export default function NotificationCenterScreen() {
  const [items, setItems] = useState<MemberNotification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const visibleItems = useMemo(
    () => (filter === 'unread' ? items.filter((item) => !item.read_at) : items),
    [filter, items],
  );
  const groups = useMemo(() => groupNotifications(visibleItems), [visibleItems]);

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
    try {
      if (!item.read_at) {
        await markNotificationRead(item.id);
        const now = new Date().toISOString();
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, read_at: now } : candidate));
      }
      if (item.action_url) router.push(item.action_url as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this notification.');
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || working) return;
    setWorking(true);
    setError(null);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to mark notifications as read.');
    } finally {
      setWorking(false);
    }
  }

  async function clearNotification(item: MemberNotification) {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await archiveNotification(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to clear this notification.');
    } finally {
      setWorking(false);
    }
  }

  async function clearAll() {
    if (items.length === 0 || working) return;
    setWorking(true);
    setError(null);
    try {
      await archiveAllNotifications();
      setItems([]);
      setFilter('all');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to clear notifications.');
    } finally {
      setWorking(false);
    }
  }

  function confirmClearAll() {
    Alert.alert(
      'Clear all notifications?',
      'This removes them from your notification center. Your account and adventure history will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => { void clearAll(); } },
      ],
    );
  }

  function openOptions() {
    const buttons = [] as { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
    if (unreadCount > 0) buttons.push({ text: 'Mark all read', onPress: () => { void markAllRead(); } });
    if (items.length > 0) buttons.push({ text: 'Clear all', style: 'destructive', onPress: confirmClearAll });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Notification options', undefined, buttons);
  }

  const emptyForFilter = !loading && items.length > 0 && visibleItems.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹ Back</Text></Pressable>

        <View style={styles.header}>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>CAMPFIRE SIGNALS</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} unread` : 'No unread notifications'}</Text>
          </View>
          <Pressable
            accessibilityLabel="Notification options"
            disabled={working || items.length === 0}
            onPress={openOptions}
            style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed, (working || items.length === 0) && styles.disabled]}
          >
            <Text style={styles.optionsText}>•••</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          {(['all', 'unread'] as NotificationFilter[]).map((value) => {
            const active = filter === value;
            return (
              <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterButton, active && styles.filterButtonActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {value === 'all' ? `All ${items.length ? `(${items.length})` : ''}` : `Unread ${unreadCount ? `(${unreadCount})` : ''}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing waiting for you.</Text>
            <Text style={styles.emptyBody}>New Campfire activity, adventure updates, and account alerts will land here.</Text>
            <Text style={styles.sourceHeading}>What can generate an alert?</Text>
            {signalSources.map((source) => <View key={source} style={styles.sourceRow}><View style={styles.sourceDot} /><Text style={styles.sourceText}>{source}</Text></View>)}
          </View>
        ) : null}

        {emptyForFilter ? (
          <View style={styles.filterEmpty}>
            <Text style={styles.filterEmptyTitle}>You’re caught up.</Text>
            <Text style={styles.filterEmptyBody}>There are no unread notifications right now.</Text>
          </View>
        ) : null}

        <View style={styles.groupList}>
          {groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.list}>
                {group.items.map((item) => {
                  const meta = notificationMeta(item.kind);
                  const unread = !item.read_at;
                  return (
                    <View key={item.id} style={[styles.card, unread && styles.unreadCard, item.priority === 'critical' && styles.criticalCard]}>
                      {unread ? <View style={styles.unreadDot} /> : null}
                      <Pressable onPress={() => { void openNotification(item); }} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
                        <View style={styles.cardTop}>
                          <View style={styles.categoryRow}>
                            <View style={[styles.categoryIcon, unread && styles.categoryIconUnread]}><Text style={styles.categoryIconText}>{meta.icon}</Text></View>
                            <Text style={styles.kind}>{meta.label}</Text>
                          </View>
                          <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
                        </View>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                      </Pressable>
                      <View style={styles.cardActions}>
                        {item.action_url ? <Pressable onPress={() => { void openNotification(item); }}><Text style={styles.openAction}>Open</Text></Pressable> : <View />}
                        <Pressable onPress={() => { void clearNotification(item); }} hitSlop={8}><Text style={styles.clearAction}>Clear</Text></Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48 },
  back: { color: '#D7B45A', fontWeight: '800', fontSize: 16, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  headingText: { flex: 1 },
  eyebrow: { color: '#D3A94F', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#AEB8B2', marginTop: 3 },
  optionsButton: { minWidth: 42, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: '#34453B', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  optionsText: { color: '#F0D083', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.65 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterButton: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28362E' },
  filterButtonActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  filterText: { color: '#B7C1BB', fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#17211C' },
  loader: { marginVertical: 16 },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 19, gap: 8 },
  emptyTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  emptyBody: { color: '#AEB8B2', lineHeight: 21 },
  sourceHeading: { color: '#F0D083', fontWeight: '900', marginTop: 8 },
  sourceRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D7B45A', marginTop: 7 },
  sourceText: { color: '#C9D0CC', flex: 1, lineHeight: 19 },
  filterEmpty: { backgroundColor: '#141E19', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#25342C' },
  filterEmptyTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 18 },
  filterEmptyBody: { color: '#94A098', marginTop: 5, textAlign: 'center' },
  groupList: { gap: 20 },
  group: { gap: 8 },
  groupLabel: { color: '#8F9D95', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.05 },
  list: { gap: 8 },
  card: { position: 'relative', backgroundColor: '#17211C', borderRadius: 15, borderWidth: 1, borderColor: '#26332C', overflow: 'hidden' },
  unreadCard: { backgroundColor: '#1A261F', borderColor: '#445C4D' },
  criticalCard: { borderColor: '#FF7A66', borderWidth: 2 },
  unreadDot: { position: 'absolute', left: 0, top: 17, width: 4, height: 26, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#D7B45A' },
  cardMain: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryIcon: { width: 23, height: 23, borderRadius: 8, backgroundColor: '#243129', alignItems: 'center', justifyContent: 'center' },
  categoryIconUnread: { backgroundColor: '#3B3521' },
  categoryIconText: { color: '#E9CC78', fontSize: 12, fontWeight: '900' },
  kind: { color: '#C9D0CC', fontWeight: '800', fontSize: 11 },
  time: { color: '#819087', fontSize: 11, fontWeight: '700' },
  cardTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 8 },
  body: { color: '#C6CEC9', fontSize: 14, lineHeight: 19, marginTop: 4 },
  cardActions: { minHeight: 34, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A3930', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  openAction: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  clearAction: { color: '#9DAAA2', fontSize: 12, fontWeight: '800' },
  error: { color: '#FFB4A9', marginBottom: 16 },
});
