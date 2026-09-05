import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, type HostCampaign } from '../../../../src/hosting/campaigns';
import {
  createCampaignMarketingItem,
  listCampaignMarketingItems,
  updateCampaignMarketingDraft,
  updateCampaignMarketingStatus,
  type CampaignMarketingContentType,
  type CampaignMarketingItem,
  type CampaignMarketingPlatform,
  type CampaignMarketingStatus,
} from '../../../../src/hosting/campaignMarketing';
import {
  DISTRIBUTION_PROVIDERS,
  getEventDistributionState,
  isProviderConnected,
  publishEventToGoMelanated,
  publishMarketingItemToGoMelanated,
  type DistributionProviderId,
  type EventDistributionState,
} from '../../../../src/hosting/distribution';

const statusLabels: Record<CampaignMarketingStatus, string> = {
  idea: 'Idea',
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  published: 'Published',
  skipped: 'Skipped',
};

const manualStatuses: CampaignMarketingStatus[] = ['idea', 'draft', 'ready', 'scheduled', 'skipped'];
type MarketingFilter = 'all' | 'go_melanated' | 'social' | 'email';
const composerTypes: { value: CampaignMarketingContentType; label: string }[] = [
  { value: 'post', label: 'Event Update' },
  { value: 'static_post', label: 'Static Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'email', label: 'Email' },
];

const selectablePlatforms: CampaignMarketingPlatform[] = ['go_melanated', 'facebook', 'instagram', 'eventbrite', 'email', 'sms'];

export default function CampaignMarketingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [distribution, setDistribution] = useState<EventDistributionState | null>(null);
  const [items, setItems] = useState<CampaignMarketingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<MarketingFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CampaignMarketingItem | null>(null);
  const [selectedCopy, setSelectedCopy] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<CampaignMarketingPlatform[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCopy, setNewCopy] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<CampaignMarketingContentType>('post');
  const [newPlatforms, setNewPlatforms] = useState<CampaignMarketingPlatform[]>(['go_melanated']);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCampaign = await getHostCampaign(String(params.id));
      setCampaign(nextCampaign);
      if (!nextCampaign) {
        setItems([]);
        setDistribution(null);
        return;
      }
      const [nextItems, nextDistribution] = await Promise.all([
        listCampaignMarketingItems(nextCampaign.id),
        getEventDistributionState(nextCampaign.id, nextCampaign.adventureId),
      ]);
      setItems(nextItems);
      setDistribution(nextDistribution);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event marketing.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredItems = useMemo(() => items.filter((item) => {
    if (filter === 'email') return item.contentType === 'email' || item.platforms.includes('email');
    if (filter === 'go_melanated') return item.platforms.includes('go_melanated');
    if (filter === 'social') return item.platforms.some((platform) => ['facebook', 'instagram'].includes(platform));
    return true;
  }), [filter, items]);

  const groups = useMemo(() => {
    const byDate = new Map<string, CampaignMarketingItem[]>();
    for (const item of filteredItems) byDate.set(item.plannedFor, [...(byDate.get(item.plannedFor) ?? []), item]);
    return Array.from(byDate.entries());
  }, [filteredItems]);

  const planned = items.filter((item) => !['published', 'skipped'].includes(item.status)).length;
  const ready = items.filter((item) => item.status === 'ready').length;
  const published = items.filter((item) => item.status === 'published').length;
  const externalConnections = distribution?.connections.filter((connection) => connection.provider !== 'go_melanated' && connection.status === 'connected').length ?? 0;
  const goMelanatedConnected = distribution ? isProviderConnected(distribution, 'go_melanated') : false;
  const eventLive = distribution ? ['published', 'sold_out', 'scheduled'].includes(distribution.adventureStatus) : false;

  function togglePlatform(platform: CampaignMarketingPlatform, current: CampaignMarketingPlatform[], setCurrent: (value: CampaignMarketingPlatform[]) => void) {
    setCurrent(current.includes(platform) ? current.filter((value) => value !== platform) : [...current, platform]);
  }

  function openItem(item: CampaignMarketingItem) {
    setSelectedItem(item);
    setSelectedCopy(item.copyText ?? '');
    setSelectedPlatforms(item.platforms.length ? item.platforms : ['go_melanated']);
    setSuccess('');
  }

  async function addItem() {
    if (!campaign) return;
    if (!newPlatforms.length) {
      setError('Choose at least one destination.');
      return;
    }
    setSavingId('new');
    setError('');
    setSuccess('');
    try {
      await createCampaignMarketingItem({
        campaignId: campaign.id,
        title: newTitle,
        plannedFor: newDate,
        contentType: newType,
        platforms: newPlatforms,
        copyText: newCopy,
      });
      setNewTitle('');
      setNewCopy('');
      setNewDate('');
      setNewType('post');
      setNewPlatforms(['go_melanated']);
      setComposerOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add marketing item.');
    } finally {
      setSavingId(null);
    }
  }

  async function saveSelectedDraft() {
    if (!selectedItem) return;
    if (!selectedPlatforms.length) {
      setError('Choose at least one destination.');
      return;
    }
    setSavingId(selectedItem.id);
    setError('');
    setSuccess('');
    try {
      await updateCampaignMarketingDraft(selectedItem.id, { copyText: selectedCopy, platforms: selectedPlatforms });
      setSuccess('Draft updated.');
      await load();
      setSelectedItem((current) => current ? { ...current, copyText: selectedCopy, platforms: selectedPlatforms } : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this item.');
    } finally {
      setSavingId(null);
    }
  }

  async function changeStatus(itemId: string, status: CampaignMarketingStatus) {
    setSavingId(itemId);
    setError('');
    setSuccess('');
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

  async function publishSelectedToGoMelanated() {
    if (!selectedItem) return;
    setSavingId(selectedItem.id);
    setError('');
    setSuccess('');
    try {
      if (!selectedPlatforms.includes('go_melanated')) {
        await updateCampaignMarketingDraft(selectedItem.id, { copyText: selectedCopy, platforms: [...selectedPlatforms, 'go_melanated'] });
      } else {
        await updateCampaignMarketingDraft(selectedItem.id, { copyText: selectedCopy, platforms: selectedPlatforms });
      }
      await publishMarketingItemToGoMelanated(selectedItem.id);
      setSuccess('Published to Go Melanated. Members can now see this event update.');
      setSelectedItem(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish to Go Melanated.');
    } finally {
      setSavingId(null);
    }
  }

  async function publishEvent() {
    if (!campaign) return;
    setSavingId('event-publish');
    setError('');
    setSuccess('');
    try {
      await publishEventToGoMelanated(campaign.adventureId);
      setSuccess('Event published to Go Melanated.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish the event to Go Melanated.');
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

  return <SafeAreaView style={styles.safe}>
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT DISTRIBUTION</Text>
        <Text style={styles.title}>Marketing</Text>
        <Text style={styles.subtitle}>{campaign.shortTitle}</Text>

        <View style={styles.connectionStrip}>
          <View style={styles.connectionMark}><Text style={styles.connectionMarkText}>GM</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.connectionTitle}>Go Melanated</Text>
            <Text style={styles.connectionCopy}>{goMelanatedConnected ? 'Native connection active' : 'Native connection is being prepared'} · {eventLive ? 'Event live' : 'Event draft'}</Text>
          </View>
          {!eventLive && campaign.canManage ? <Pressable disabled={savingId === 'event-publish'} style={styles.publishEventButton} onPress={() => void publishEvent()}>{savingId === 'event-publish' ? <ActivityIndicator size="small" color="#151B16" /> : <Text style={styles.publishEventText}>Publish event</Text>}</Pressable> : <Text style={styles.liveLabel}>{eventLive ? 'LIVE' : ''}</Text>}
        </View>

        <Pressable style={styles.appsStrip} onPress={() => router.push('/host/connections' as never)}>
          <View style={{ flex: 1 }}><Text style={styles.appsTitle}>Connections & Apps</Text><Text style={styles.appsCopy}>{externalConnections} external channel{externalConnections === 1 ? '' : 's'} connected · Future apps use the same destination model</Text></View>
          <Text style={styles.connectionAction}>Manage →</Text>
        </Pressable>

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
        {success ? <View style={styles.successCard}><Text style={styles.successText}>{success}</Text></View> : null}

        <View style={styles.metrics}>
          <Metric value={planned} label="Planned" />
          <Metric value={ready} label="Ready" />
          <Metric value={published} label="Published" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Content calendar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['all', 'go_melanated', 'social', 'email'] as MarketingFilter[]).map((value) => <Pressable key={value} style={[styles.filterChip, filter === value && styles.filterChipActive]} onPress={() => setFilter(value)}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'go_melanated' ? 'Go Melanated' : capitalize(value)}</Text></Pressable>)}
          </ScrollView>
        </View>

        {groups.length === 0 ? <View style={styles.emptyCard}><Text style={styles.muted}>No marketing items in this view.</Text></View> : groups.map(([date, dayItems]) => <View key={date} style={styles.dayGroup}>
          <Text style={styles.dateLabel}>{formatDate(date)}</Text>
          {dayItems.map((item) => <MarketingCard key={item.id} item={item} onPress={() => openItem(item)} />)}
        </View>)}
      </ScrollView>

      {campaign.canManage ? <Pressable accessibilityLabel="Add marketing item" style={styles.fab} onPress={() => setComposerOpen(true)}><Text style={styles.fabPlus}>＋</Text></Pressable> : null}
    </View>

    <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setComposerOpen(false)}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Create content</Text>
          <Text style={styles.sheetSub}>Create once, then choose where it should go.</Text>
          <Text style={styles.sheetLabel}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>{composerTypes.map((type) => <Pressable key={type.value} style={[styles.typeChip, newType === type.value && styles.typeChipActive]} onPress={() => setNewType(type.value)}><Text style={[styles.typeText, newType === type.value && styles.typeTextActive]}>{type.label}</Text></Pressable>)}</ScrollView>
          <Text style={styles.sheetLabel}>DESTINATIONS</Text>
          <View style={styles.destinationGrid}>{selectablePlatforms.map((platform) => <DestinationChip key={platform} platform={platform} active={newPlatforms.includes(platform)} connected={platform === 'go_melanated' || Boolean(distribution && isProviderConnected(distribution, platform as DistributionProviderId))} onPress={() => togglePlatform(platform, newPlatforms, setNewPlatforms)} />)}</View>
          <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="Internal title" placeholderTextColor="#68736C" />
          <TextInput style={[styles.input, styles.copyInput]} value={newCopy} onChangeText={setNewCopy} placeholder="What should members or followers see?" placeholderTextColor="#68736C" multiline />
          <TextInput style={styles.input} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor="#68736C" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          <Text style={styles.helper}>Go Melanated can publish now. Other selected destinations stay planned until their provider connection supports publishing.</Text>
          <Pressable disabled={savingId === 'new'} style={styles.primary} onPress={() => void addItem()}>{savingId === 'new' ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Add to calendar</Text>}</Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={selectedItem !== null} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setSelectedItem(null)}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{selectedItem?.title}</Text>
          <Text style={styles.sheetSub}>{selectedItem ? `${formatDate(selectedItem.plannedFor)} · ${statusLabels[selectedItem.status]}` : ''}</Text>
          {selectedItem?.status === 'published' ? <View style={styles.publishedBanner}><Text style={styles.publishedTitle}>Published</Text><Text style={styles.publishedBody}>This item has a recorded publication. Go Melanated publications create a real member-facing event update.</Text></View> : null}
          <Text style={styles.sheetLabel}>DESTINATIONS</Text>
          <View style={styles.destinationGrid}>{selectablePlatforms.map((platform) => <DestinationChip key={platform} platform={platform} active={selectedPlatforms.includes(platform)} connected={platform === 'go_melanated' || Boolean(distribution && isProviderConnected(distribution, platform as DistributionProviderId))} onPress={() => togglePlatform(platform, selectedPlatforms, setSelectedPlatforms)} />)}</View>
          <Text style={styles.sheetLabel}>COPY</Text>
          <TextInput style={[styles.input, styles.copyInput]} value={selectedCopy} onChangeText={setSelectedCopy} placeholder="Add the post or message copy" placeholderTextColor="#68736C" multiline />
          {campaign.canManage ? <Pressable disabled={!selectedItem || savingId === selectedItem?.id} style={styles.secondaryButton} onPress={() => void saveSelectedDraft()}><Text style={styles.secondaryButtonText}>Save destinations & copy</Text></Pressable> : null}
          {campaign.canManage && selectedItem && selectedItem.status !== 'published' ? <Pressable disabled={savingId === selectedItem.id} style={styles.gmPublishButton} onPress={() => void publishSelectedToGoMelanated()}>{savingId === selectedItem.id ? <ActivityIndicator color="#151B16" /> : <Text style={styles.gmPublishText}>Publish to Go Melanated</Text>}</Pressable> : null}
          {selectedItem?.status === 'published' ? <Pressable style={styles.secondaryButton} onPress={() => { setSelectedItem(null); router.push({ pathname: '/adventures/[id]', params: { id: campaign.adventureId } } as never); }}><Text style={styles.secondaryButtonText}>Open member event</Text></Pressable> : null}
          {campaign.canManage && selectedItem?.status !== 'published' ? <><Text style={styles.sheetLabel}>WORKFLOW STATUS</Text>{manualStatuses.map((status) => <Pressable key={status} disabled={!selectedItem || savingId === selectedItem.id} style={styles.statusRow} onPress={() => selectedItem ? void changeStatus(selectedItem.id, status) : undefined}><Text style={styles.statusRowText}>{statusLabels[status]}</Text>{selectedItem?.status === status ? <Text style={styles.selected}>✓</Text> : null}</Pressable>)}</> : null}
        </Pressable>
      </Pressable>
    </Modal>
  </SafeAreaView>;
}

function MarketingCard({ item, onPress }: { item: CampaignMarketingItem; onPress: () => void }) {
  return <Pressable style={styles.itemCard} onPress={onPress}>
    <View style={styles.itemTop}><Text style={[styles.status, item.status === 'published' && styles.statusPublished]}>{statusLabels[item.status].toUpperCase()}</Text><Text style={styles.type}>{item.contentType.replaceAll('_', ' ').toUpperCase()}</Text></View>
    <Text style={styles.itemTitle}>{item.title}</Text>
    {item.copyText ? <Text style={styles.copyPreview} numberOfLines={2}>{item.copyText}</Text> : null}
    <Text style={styles.platforms}>{item.platforms.length ? item.platforms.map(platformLabel).join(' · ') : 'Destinations not selected'}</Text>
    {item.scheduledAt ? <Text style={styles.detail}>{new Date(item.scheduledAt).toLocaleString()}</Text> : null}
  </Pressable>;
}

function DestinationChip({ platform, active, connected, onPress }: { platform: CampaignMarketingPlatform; active: boolean; connected: boolean; onPress: () => void }) {
  return <Pressable style={[styles.destinationChip, active && styles.destinationChipActive]} onPress={onPress}>
    <View style={[styles.destinationDot, connected && styles.destinationDotConnected]} />
    <Text style={[styles.destinationText, active && styles.destinationTextActive]}>{platformLabel(platform)}</Text>
    <Text style={styles.destinationState}>{connected ? 'Ready' : 'Plan'}</Text>
  </Pressable>;
}

function Metric({ value, label }: { value: number; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function formatDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function platformLabel(value: CampaignMarketingPlatform) { if (value === 'go_melanated') return 'Go Melanated'; if (value === 'sms') return 'SMS'; return capitalize(value); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, screen: { flex: 1 }, content: { padding: 20, paddingBottom: 118 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  back: { color: '#CBD4CE', fontWeight: '900', marginBottom: 14 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 33, lineHeight: 39, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#8D9891', fontSize: 13, marginTop: 5, marginBottom: 16 },
  connectionStrip: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: '#4B5835', backgroundColor: '#171E13', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, connectionMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, connectionMarkText: { color: '#151B16', fontSize: 12, fontWeight: '900' }, connectionTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, connectionCopy: { color: '#8D9891', fontSize: 9.5, lineHeight: 13, marginTop: 3 }, publishEventButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, publishEventText: { color: '#151B16', fontSize: 9.5, fontWeight: '900' }, liveLabel: { color: '#A8D46B', fontSize: 9, fontWeight: '900' },
  appsStrip: { minHeight: 59, marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: '#323D36', backgroundColor: '#141A16', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, appsTitle: { color: '#FFF8E8', fontSize: 12.5, fontWeight: '900' }, appsCopy: { color: '#76827B', fontSize: 9.5, marginTop: 3 }, connectionAction: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 12, marginTop: 12 }, errorText: { color: '#D7A398', fontSize: 11, lineHeight: 17 }, successCard: { borderRadius: 12, borderWidth: 1, borderColor: '#405C38', backgroundColor: '#152116', padding: 12, marginTop: 12 }, successText: { color: '#AFCB9D', fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 13 }, metric: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: '#2B342E', backgroundColor: '#141A16', padding: 12 }, metricValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, metricLabel: { color: '#7D8881', fontSize: 9, fontWeight: '900', marginTop: 3 },
  sectionHeader: { marginTop: 24, marginBottom: 12 }, sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase', marginBottom: 9 }, filters: { gap: 7 }, filterChip: { borderRadius: 17, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 11, paddingVertical: 7 }, filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' }, filterText: { color: '#8D9891', fontSize: 9.5, fontWeight: '900' }, filterTextActive: { color: '#E7C464' },
  dayGroup: { marginBottom: 18 }, dateLabel: { color: '#A9B3AC', fontSize: 12, fontWeight: '900', marginBottom: 7 }, itemCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3630', backgroundColor: '#151B17', padding: 14, marginBottom: 8 }, itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, status: { color: '#E88633', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, statusPublished: { color: '#91D172' }, type: { color: '#707B74', fontSize: 8, fontWeight: '900' }, itemTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 6 }, copyPreview: { color: '#8E9992', fontSize: 10.5, lineHeight: 15, marginTop: 5 }, platforms: { color: '#B1BBB4', fontSize: 10, fontWeight: '800', marginTop: 6 }, detail: { color: '#77827B', fontSize: 10, marginTop: 5 }, emptyCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3630', backgroundColor: '#151B17', padding: 16 }, muted: { color: '#7D8881', fontSize: 11, lineHeight: 17 },
  fab: { position: 'absolute', right: 22, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: .35, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 7 }, fabPlus: { color: '#151B16', fontSize: 28, fontWeight: '900', marginTop: -2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', backgroundColor: '#111814', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#303B34', padding: 18, paddingBottom: 32 }, sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#526058', alignSelf: 'center', marginBottom: 14 }, sheetTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, sheetSub: { color: '#839087', fontSize: 10.5, lineHeight: 15, marginTop: 4 }, sheetLabel: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: .8, marginTop: 16, marginBottom: 7 },
  typeRow: { gap: 6 }, typeChip: { borderRadius: 16, borderWidth: 1, borderColor: '#38433C', paddingHorizontal: 10, paddingVertical: 7 }, typeChipActive: { borderColor: '#D7B45A', backgroundColor: '#332C18' }, typeText: { color: '#909B94', fontSize: 9.5, fontWeight: '900' }, typeTextActive: { color: '#E8CA70' }, destinationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, destinationChip: { minWidth: '47%', borderRadius: 12, borderWidth: 1, borderColor: '#354038', backgroundColor: '#151C18', paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }, destinationChipActive: { borderColor: '#D7B45A', backgroundColor: '#302A18' }, destinationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#59645D' }, destinationDotConnected: { backgroundColor: '#8CCF72' }, destinationText: { flex: 1, color: '#A0AAA3', fontSize: 9.5, fontWeight: '900' }, destinationTextActive: { color: '#FFF1C9' }, destinationState: { color: '#6F7A73', fontSize: 7.5, fontWeight: '800' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#364139', backgroundColor: '#0D120F', color: '#FFF8E8', paddingHorizontal: 12, paddingVertical: 10, marginTop: 9, fontSize: 12 }, copyInput: { minHeight: 88, textAlignVertical: 'top' }, helper: { color: '#758078', fontSize: 9.5, lineHeight: 14, marginTop: 9 }, primary: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#151B16', fontSize: 11, fontWeight: '900' }, secondaryButton: { minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: '#445148', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryButtonText: { color: '#DCE2DE', fontSize: 10.5, fontWeight: '900' }, gmPublishButton: { minHeight: 47, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 9 }, gmPublishText: { color: '#151B16', fontSize: 11, fontWeight: '900' },
  publishedBanner: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#405A37', backgroundColor: '#152015', padding: 11 }, publishedTitle: { color: '#BDE59A', fontSize: 11.5, fontWeight: '900' }, publishedBody: { color: '#8DA284', fontSize: 9.5, lineHeight: 14, marginTop: 3 }, statusRow: { minHeight: 43, borderTopWidth: 1, borderTopColor: '#28322C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, statusRowText: { color: '#DDE2DF', fontSize: 11, fontWeight: '800' }, selected: { color: '#D7B45A', fontSize: 13, fontWeight: '900' },
});
