import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, type HostCampaign } from '../../../../src/hosting/campaigns';
import {
  createCampaignMarketingItem,
  listCampaignMarketingItems,
  updateCampaignMarketingStatus,
  type CampaignMarketingItem,
  type CampaignMarketingStatus,
} from '../../../../src/hosting/campaignMarketing';

const statusLabels: Record<CampaignMarketingStatus, string> = {
  idea: 'Idea',
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  published: 'Published',
  skipped: 'Skipped',
};

export default function CampaignMarketingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [items, setItems] = useState<CampaignMarketingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCampaign = await getHostCampaign(String(params.id));
      setCampaign(nextCampaign);
      if (!nextCampaign) {
        setItems([]);
        return;
      }
      setItems(await listCampaignMarketingItems(nextCampaign.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load marketing calendar.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const groups = useMemo(() => {
    const byDate = new Map<string, CampaignMarketingItem[]>();
    for (const item of items) byDate.set(item.plannedFor, [...(byDate.get(item.plannedFor) ?? []), item]);
    return Array.from(byDate.entries());
  }, [items]);

  async function addItem() {
    if (!campaign) return;
    setSavingId('new');
    setError('');
    try {
      await createCampaignMarketingItem({ campaignId: campaign.id, title: newTitle, plannedFor: newDate });
      setNewTitle('');
      setNewDate('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add marketing item.');
    } finally {
      setSavingId(null);
    }
  }

  async function changeStatus(itemId: string, status: CampaignMarketingStatus) {
    setSavingId(itemId);
    setError('');
    try {
      await updateCampaignMarketingStatus(itemId, status);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update marketing item.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading && !campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading marketing calendar…</Text></View></SafeAreaView>;
  }

  if (!campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Marketing calendar unavailable</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}<Pressable style={styles.primary} onPress={() => void load()}><Text style={styles.primaryText}>Try again</Text></Pressable></View></SafeAreaView>;
  }

  const planned = items.filter((item) => !['published', 'skipped'].includes(item.status)).length;
  const ready = items.filter((item) => item.status === 'ready').length;
  const published = items.filter((item) => item.status === 'published').length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Campaign</Text></Pressable>
        <Text style={styles.eyebrow}>CAMPAIGN MARKETING</Text>
        <Text style={styles.title}>Marketing Calendar</Text>
        <Text style={styles.subtitle}>{campaign.shortTitle}</Text>

        <View style={styles.connectionCard}>
          <Text style={styles.connectionKicker}>PUBLISHING CONNECTIONS</Text>
          <Text style={styles.connectionTitle}>Calendar planning is live.</Text>
          <Text style={styles.connectionCopy}>Facebook and Instagram publishing are not connected yet. Items here track what should go out and when without pretending a post has been sent.</Text>
        </View>

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.metrics}>
          <Metric value={planned} label="Planned" />
          <Metric value={ready} label="Ready" />
          <Metric value={published} label="Published" />
        </View>

        {campaign.canManage ? (
          <View style={styles.addCard}>
            <Text style={styles.sectionTitle}>Add to calendar</Text>
            <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="Post or campaign item" placeholderTextColor="#68736C" />
            <TextInput style={styles.input} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor="#68736C" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Text style={styles.helper}>New items start as ideas and default to Facebook + Instagram. Platform-specific editing comes with social connections.</Text>
            <Pressable disabled={savingId === 'new'} style={styles.primary} onPress={() => void addItem()}>{savingId === 'new' ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Add item</Text>}</Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calendar</Text>
          {groups.length === 0 ? <Text style={styles.muted}>No marketing items are planned yet.</Text> : groups.map(([date, dayItems]) => (
            <View key={date} style={styles.dayGroup}>
              <Text style={styles.dateLabel}>{formatDate(date)}</Text>
              {dayItems.map((item) => <MarketingCard key={item.id} item={item} canManage={campaign.canManage} saving={savingId === item.id} onStatus={changeStatus} />)}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketingCard({ item, canManage, saving, onStatus }: { item: CampaignMarketingItem; canManage: boolean; saving: boolean; onStatus: (itemId: string, status: CampaignMarketingStatus) => Promise<void> }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <Text style={styles.status}>{statusLabels[item.status].toUpperCase()}</Text>
        <Text style={styles.type}>{item.contentType.replaceAll('_', ' ').toUpperCase()}</Text>
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.platforms}>{item.platforms.length ? item.platforms.map(capitalize).join(' · ') : 'Platforms not selected'}</Text>
      {item.scheduledAt ? <Text style={styles.detail}>Scheduled time: {new Date(item.scheduledAt).toLocaleString()}</Text> : null}
      {canManage ? <View style={styles.actions}>{saving ? <ActivityIndicator color="#D7B45A" /> : <>
        {item.status !== 'draft' ? <Action label="Draft" onPress={() => void onStatus(item.id, 'draft')} /> : null}
        {item.status !== 'ready' ? <Action label="Ready" onPress={() => void onStatus(item.id, 'ready')} /> : null}
        {item.status !== 'published' ? <Action label="Published" onPress={() => void onStatus(item.id, 'published')} /> : null}
      </>}</View> : null}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.action} onPress={onPress}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 70 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 33, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8D9891', fontSize: 13, marginTop: 5, marginBottom: 18 },
  connectionCard: { borderRadius: 17, borderWidth: 1, borderColor: '#4B3F20', backgroundColor: '#1C1910', padding: 15 },
  connectionKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  connectionTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 5 },
  connectionCopy: { color: '#AFA68B', fontSize: 11, lineHeight: 17, marginTop: 5 },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 12, marginTop: 12 },
  errorText: { color: '#D7A398', fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 13 },
  metric: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: '#2B342E', backgroundColor: '#141A16', padding: 12 },
  metricValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  metricLabel: { color: '#7D8881', fontSize: 9, fontWeight: '900', marginTop: 3 },
  addCard: { marginTop: 22, borderRadius: 17, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 15 },
  section: { marginTop: 25 },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase', marginBottom: 10 },
  input: { minHeight: 45, borderRadius: 11, borderWidth: 1, borderColor: '#39433D', backgroundColor: '#101512', color: '#FFF8E8', paddingHorizontal: 12, marginBottom: 9 },
  helper: { color: '#6F7B73', fontSize: 10, lineHeight: 15 },
  primary: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 16 },
  primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  dayGroup: { marginBottom: 18 },
  dateLabel: { color: '#A9B3AC', fontSize: 12, fontWeight: '900', marginBottom: 7 },
  itemCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3630', backgroundColor: '#151B17', padding: 14, marginBottom: 8 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  status: { color: '#E88633', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  type: { color: '#707B74', fontSize: 8, fontWeight: '900' },
  itemTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 6 },
  platforms: { color: '#B1BBB4', fontSize: 10, fontWeight: '800', marginTop: 5 },
  detail: { color: '#77827B', fontSize: 10, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 11, minHeight: 30, alignItems: 'center' },
  action: { borderRadius: 10, borderWidth: 1, borderColor: '#3A443E', paddingHorizontal: 10, paddingVertical: 7 },
  actionText: { color: '#AAB4AD', fontSize: 9, fontWeight: '900' },
  muted: { color: '#7D8881', fontSize: 11, lineHeight: 17 },
});
