import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { downloadEventPack, getEventPack } from '../../src/offline/eventPack';
import type { OfflineEventPack } from '../../src/offline/safetyTypes';

export default function AdventureUpdatesScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [pack, setPack] = useState<OfflineEventPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adventureId) return;
    setLoading(true);
    try {
      setPack(await getEventPack(adventureId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load saved updates.');
    } finally {
      setLoading(false);
    }
  }, [adventureId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function refresh() {
    if (!adventureId) return;
    setRefreshing(true);
    try {
      setPack(await downloadEventPack(adventureId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No connection. Saved updates remain available.');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !pack) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D3A94F" /></SafeAreaView>;
  }

  const messages = pack?.messages ?? [];
  const announcements = pack?.announcements ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color="#FFF8E8" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>EVENT COMMUNICATION</Text>
          <Text style={styles.headerTitle}>Saved updates</Text>
        </View>
        <Pressable accessibilityLabel="Refresh event updates" onPress={() => void refresh()} style={styles.iconButton}>
          {refreshing ? <ActivityIndicator color="#D3A94F" /> : <Ionicons name="refresh" size={20} color="#D3A94F" />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <Ionicons name="cloud-offline-outline" size={22} color="#76D1B7" />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>{pack ? 'Available offline' : 'No event pack saved'}</Text>
            <Text style={styles.statusText}>
              {pack
                ? `Last refreshed ${new Date(pack.downloadedAt).toLocaleString()}. New updates cannot arrive with no network connection.`
                : 'Prepare this Adventure for offline use before leaving reliable service.'}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.warning}>{error}</Text> : null}

        {!pack ? (
          <Pressable style={styles.primaryButton} onPress={() => void refresh()}>
            <Ionicons name="download-outline" size={19} color="#10231C" />
            <Text style={styles.primaryText}>Download event updates</Text>
          </Pressable>
        ) : null}

        {messages.length ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>HOST UPDATES</Text>
            {messages.map((message) => (
              <View key={message.id} style={styles.updateItem}>
                <View style={styles.rowBetween}>
                  <Text style={styles.updateTitle}>{message.subject}</Text>
                  <Text style={styles.audience}>{message.audience.replace('_', ' ').toUpperCase()}</Text>
                </View>
                <Text style={styles.updateBody}>{message.body}</Text>
                <Text style={styles.time}>{new Date(message.sent_at).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {announcements.length ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>ANNOUNCEMENTS</Text>
            {announcements.map((item) => (
              <View key={item.id} style={styles.updateItem}>
                <Text style={styles.updateTitle}>{item.priority === 'critical' ? '⚠ ' : ''}{item.title}</Text>
                <Text style={styles.updateBody}>{item.body}</Text>
                <Text style={styles.time}>{new Date(item.starts_at).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {pack && !messages.length && !announcements.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={26} color="#76D1B7" />
            <Text style={styles.emptyTitle}>No saved updates</Text>
            <Text style={styles.statusText}>Your downloaded event pack does not contain any current host updates or announcements.</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>Offline communication shows the last information saved on this device. It does not imply that a newer message does not exist.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#28352F' },
  headerCopy: { flex: 1, marginHorizontal: 10 },
  eyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  headerTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  flex: { flex: 1 },
  statusCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#14251F', borderWidth: 1, borderColor: '#315A4C' },
  statusTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 13 },
  statusText: { color: '#B6C0BA', fontSize: 11, lineHeight: 17, marginTop: 2 },
  warning: { color: '#FFB4A9', backgroundColor: '#2B1916', borderRadius: 12, padding: 12, fontSize: 12 },
  primaryButton: { minHeight: 48, backgroundColor: '#D3A94F', borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#10231C', fontWeight: '900' },
  card: { backgroundColor: '#121A18', borderRadius: 18, borderWidth: 1, borderColor: '#2C3C36', padding: 15, gap: 10 },
  cardEyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  updateItem: { borderTopWidth: 1, borderTopColor: '#2A3732', paddingTop: 11, gap: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  updateTitle: { flex: 1, color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  audience: { color: '#D3A94F', fontSize: 8, fontWeight: '900' },
  updateBody: { color: '#D4DAD6', fontSize: 12, lineHeight: 18 },
  time: { color: '#7E8983', fontSize: 9 },
  emptyCard: { alignItems: 'center', gap: 6, backgroundColor: '#121A18', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#2C3C36' },
  emptyTitle: { color: '#FFF8E8', fontWeight: '900' },
  footer: { color: '#748079', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
});
