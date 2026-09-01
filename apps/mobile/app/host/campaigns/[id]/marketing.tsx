import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, type HostCampaign } from '../../../../src/hosting/campaigns';
import {
  createCampaignMarketingItem,
  listCampaignMarketingItems,
  updateCampaignMarketingStatus,
  type CampaignMarketingContentType,
  type CampaignMarketingItem,
  type CampaignMarketingPlatform,
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

type MarketingFilter = 'all' | 'social' | 'email';
const composerTypes: { value: CampaignMarketingContentType; label: string }[] = [
  { value: 'post', label: 'Social Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'email', label: 'Email' },
];

export default function CampaignMarketingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [items, setItems] = useState<CampaignMarketingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<MarketingFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CampaignMarketingItem | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<CampaignMarketingContentType>('post');

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

  const filteredItems = useMemo(() => items.filter((item) => {
    if (filter === 'email') return item.contentType === 'email' || item.platforms.includes('email');
    if (filter === 'social') return item.contentType !== 'email' && !item.platforms.includes('email');
    return true;
  }), [filter, items]);

  const groups = useMemo(() => {
    const byDate = new Map<string, CampaignMarketingItem[]>();
    for (const item of filteredItems) byDate.set(item.plannedFor, [...(byDate.get(item.plannedFor) ?? []), item]);
    return Array.from(byDate.entries());
  }, [filteredItems]);

  async function addItem() {
    if (!campaign) return;
    setSavingId('new');
    setError('');
    try {
      const platforms: CampaignMarketingPlatform[] = newType === 'email' ? ['email'] : ['facebook', 'instagram'];
      await createCampaignMarketingItem({ campaignId: campaign.id, title: newTitle, plannedFor: newDate, contentType: newType, platforms });
      setNewTitle('');
      setNewDate('');
      setNewType('post');
      setComposerOpen(false);
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
      setSelectedItem(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update marketing item.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading && !campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading marketing…</Text></View></SafeAreaView>;
  }

  if (!campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Marketing unavailable</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}<Pressable style={styles.primary} onPress={() => void load()}><Text style={styles.primaryText}>Try again</Text></Pressable></View></SafeAreaView>;
  }

  const planned = items.filter((item) => !['published', 'skipped'].includes(item.status)).length;
  const ready = items.filter((item) => item.status === 'ready').length;
  const published = items.filter((item) => item.status === 'published').length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
          <Text style={styles.eyebrow}>EVENT MARKETING</Text>
          <Text style={styles.title}>Marketing</Text>
          <Text style={styles.subtitle}>{campaign.shortTitle}</Text>

          <Pressable style={styles.connectionStrip}>
            <View style={{ flex: 1 }}><Text style={styles.connectionTitle}>Facebook · Instagram</Text><Text style={styles.connectionCopy}>Publishing not connected</Text></View>
            <Text style={styles.connectionAction}>Connect →</Text>
          </Pressable>

          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

          <View style={styles.metrics}>
            <Metric value={planned} label="Planned" />
            <Metric value={ready} label="Ready" />
            <Metric value={published} label="Published" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Calendar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {(['all', 'social', 'email'] as MarketingFilter[]).map((value) => <Pressable key={value} style={[styles.filterChip, filter === value && styles.filterChipActive]} onPress={() => setFilter(value)}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{capitalize(value)}</Text></Pressable>)}
            </ScrollView>
          </View>

          {groups.length === 0 ? <View style={styles.emptyCard}><Text style={styles.muted}>No marketing items in this view.</Text></View> : groups.map(([date, dayItems]) => (
            <View key={date} style={styles.dayGroup}>
              <Text style={styles.dateLabel}>{formatDate(date)}</Text>
              {dayItems.map((item) => <MarketingCard key={item.id} item={item} onPress={() => setSelectedItem(item)} />)}
            </View>
          ))}
        </ScrollView>

        {campaign.canManage ? <Pressable accessibilityLabel="Add marketing item" style={styles.fab} onPress={() => setComposerOpen(true)}><Text style={styles.fabPlus}>＋</Text></Pressable> : null}
      </View>

      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setComposerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add marketing item</Text>
            <Text style={styles.sheetLabel}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {composerTypes.map((type) => <Pressable key={type.value} style={[styles.typeChip, newType === type.value && styles.typeChipActive]} onPress={() => setNewType(type.value)}><Text style={[styles.typeText, newType === type.value && styles.typeTextActive]}>{type.label}</Text></Pressable>)}
            </ScrollView>
            <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="Title" placeholderTextColor="#68736C" />
            <TextInput style={styles.input} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor="#68736C" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Text style={styles.helper}>{newType === 'email' ? 'This item will be planned for Email.' : 'Social items currently default to Facebook + Instagram.'}</Text>
            <Pressable disabled={savingId === 'new'} style={styles.primary} onPress={() => void addItem()}>{savingId === 'new' ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Add to calendar</Text>}</Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={selectedItem !== null} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedItem(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{selectedItem?.title}</Text>
            <Text style={styles.sheetSub}>{selectedItem ? `${formatDate(selectedItem.plannedFor)} · ${selectedItem.platforms.map(capitalize).join(' · ')}` : ''}</Text>
            <Text style={styles.sheetLabel}>STATUS</Text>
            {(['idea', 'draft', 'ready', 'scheduled', 'published', 'skipped'] as CampaignMarketingStatus[]).map((status) => <Pressable key={status} disabled={!selectedItem || savingId === selectedItem.id} style={styles.statusRow} onPress={() => selectedItem ? void changeStatus(selectedItem.id, status) : undefined}><Text style={styles.statusRowText}>{statusLabels[status]}</Text>{selectedItem?.status === status ? <Text style={styles.selected}>✓</Text> : null}</Pressable>)}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function MarketingCard({ item, onPress }: { item: CampaignMarketingItem; onPress: () => void }) {
  return (
    <Pressable style={styles.itemCard} onPress={onPress}>
      <View style={styles.itemTop}><Text style={styles.status}>{statusLabels[item.status].toUpperCase()}</Text><Text style={styles.type}>{item.contentType.replaceAll('_', ' ').toUpperCase()}</Text></View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.platforms}>{item.platforms.length ? item.platforms.map(capitalize).join(' · ') : 'Platforms not selected'}</Text>
      {item.scheduledAt ? <Text style={styles.detail}>{new Date(item.scheduledAt).toLocaleString()}</Text> : null}
    </Pressable>
  );
}

function Metric({ value, label }: { value: number; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function formatDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 118 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  back: { color: '#CBD4CE', fontWeight: '900', marginBottom: 14 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 33, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8D9891', fontSize: 13, marginTop: 5, marginBottom: 16 },
  connectionStrip: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: '#3D452F', backgroundColor: '#161A12', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  connectionTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  connectionCopy: { color: '#8D9891', fontSize: 10.5, marginTop: 3 },
  connectionAction: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 12, marginTop: 12 },
  errorText: { color: '#D7A398', fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 13 },
  metric: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: '#2B342E', backgroundColor: '#141A16', padding: 12 },
  metricValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  metricLabel: { color: '#7D8881', fontSize: 9, fontWeight: '900', marginTop: 3 },
  sectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase', marginBottom: 9 },
  filters: { gap: 7 },
  filterChip: { borderRadius: 17, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 11, paddingVertical: 7 },
  filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' },
  filterText: { color: '#8D9891', fontSize: 9.5, fontWeight: '900' },
  filterTextActive: { color: '#E7C464' },
  dayGroup: { marginBottom: 18 },
  dateLabel: { color: '#A9B3AC', fontSize: 12, fontWeight: '900', marginBottom: 7 },
  itemCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3630', backgroundColor: '#151B17', padding: 14, marginBottom: 8 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  status: { color: '#E88633', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  type: { color: '#707B74', fontSize: 8, fontWeight: '900' },
  itemTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 6 },
  platforms: { color: '#B1BBB4', fontSize: 10, fontWeight: '800', marginTop: 5 },
  detail: { color: '#77827B', fontSize: 10, marginTop: 5 },
  emptyCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3630', backgroundColor: '#151B17', padding: 16 },
  muted: { color: '#7D8881', fontSize: 11, lineHeight: 17 },
  fab: { position: 'absolute', right: 22, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D47B', elevation: 8 },
  fabPlus: { color: '#172017', fontSize: 31, lineHeight: 34, fontWeight: '500', marginTop: -2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.58)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#121814', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, borderWidth: 1, borderColor: '#2F3933' },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#47514B', marginBottom: 13 },
  sheetTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginBottom: 5 },
  sheetSub: { color: '#849087', fontSize: 11, lineHeight: 16, marginBottom: 16 },
  sheetLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8, marginTop: 10, marginBottom: 8 },
  typeRow: { gap: 7, paddingBottom: 12 },
  typeChip: { borderRadius: 17, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 11, paddingVertical: 8 },
  typeChipActive: { borderColor: '#A8CF55', backgroundColor: '#26341D' },
  typeText: { color: '#8D9891', fontSize: 10, fontWeight: '900' },
  typeTextActive: { color: '#CDE58E' },
  input: { minHeight: 47, borderRadius: 11, borderWidth: 1, borderColor: '#39433D', backgroundColor: '#101512', color: '#FFF8E8', paddingHorizontal: 12, marginBottom: 9 },
  helper: { color: '#6F7B73', fontSize: 10, lineHeight: 15 },
  primary: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 16 },
  primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  statusRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' },
  statusRowText: { color: '#F4F1E8', fontSize: 14, fontWeight: '800' },
  selected: { color: '#A8CF55', fontSize: 18, fontWeight: '900' },
});