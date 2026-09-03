import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addEventComponent, EVENT_COMPONENTS, getCampaignForAdventure, getEventOperationsSummary, listEventComponents, removeEventComponent, type EventComponentKey } from '../../../src/hosting/eventBuilder';

const componentAccent: Record<EventComponentKey, string> = {
  tickets: '#A990ED', food: '#78BD83', vendors: '#75AEE8', marketing: '#E7A05C', communications: '#A990ED', team: '#69B9AD', volunteers: '#E98C7A', finance: '#84C992', venue: '#D8B26A', schedule: '#D7B45A', activities: '#E0A869', lodging: '#78A98A', equipment: '#8EA19A', safety: '#E47768', sponsors: '#D7B45A', transportation: '#75AEE8', pages: '#A990ED',
};

const heroByType: Record<string, string> = {
  Camping: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1400&q=80',
  Social: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1400&q=80',
  Workshop: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1400&q=80',
};

const recommendedByType: Record<string, EventComponentKey[]> = {
  Camping: ['tickets','food','communications','team','finance','venue','schedule','activities','lodging','equipment','safety'],
  Workshop: ['tickets','communications','team','finance','venue','schedule','pages'],
  Social: ['tickets','communications','team','finance','venue','schedule','marketing','pages'],
};

export default function BuildEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const roomy = width >= 700;
  const [campaign, setCampaign] = useState<any>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const campaignRow = await getCampaignForAdventure(id);
      if (!campaignRow) throw new Error('This event does not have a Host workspace yet.');
      const [componentRows, operations] = await Promise.all([listEventComponents(campaignRow.id), getEventOperationsSummary(campaignRow.id)]);
      setCampaign(campaignRow); setComponents(componentRows); setSummary(operations);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load the event builder.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeKeys = useMemo(() => new Set(components.filter((item) => item.status !== 'disabled').map((item) => item.component_key)), [components]);
  const recommended = useMemo(() => {
    const base = ['communications','team','finance','schedule'] as EventComponentKey[];
    return Array.from(new Set([...(recommendedByType[campaign?.category] ?? []), ...base])).filter((key) => !activeKeys.has(key));
  }, [activeKeys, campaign?.category]);

  async function toggleComponent(key: EventComponentKey) {
    if (!campaign) return;
    setWorkingKey(key);
    try { if (activeKeys.has(key)) await removeEventComponent(campaign.id, key); else await addEventComponent(campaign.id, key, campaign.starts_at); await refresh(); }
    catch (caught) { Alert.alert('Unable to update event', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setWorkingKey(null); }
  }

  async function addRecommended() {
    if (!campaign || recommended.length === 0) return;
    setWorkingKey('recommended');
    try { for (const key of recommended) await addEventComponent(campaign.id, key, campaign.starts_at); await refresh(); }
    catch (caught) { Alert.alert('Unable to add recommendations', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setWorkingKey(null); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.loading}>Opening event builder…</Text></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event builder unavailable.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;

  const profit = (summary?.profitCents ?? 0) / 100;
  const hero = heroByType[campaign.category] || 'https://images.unsplash.com/photo-1475483768296-6163e08872a1?auto=format&fit=crop&w=1400&q=80';

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace(`/host/manage/${id}` as never)}><Text style={styles.back}>‹ Event workspace</Text></Pressable>

      <ImageBackground source={{ uri: hero }} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroOverlay} />
        <View style={styles.heroTop}><View style={styles.heroPill}><Text style={styles.heroPillText}>BUILD AN EVENT</Text></View><View style={styles.readinessPill}><Text style={styles.readinessPillText}>{summary?.progress ?? 0}% READY</Text></View></View>
        <View style={styles.heroBottom}><Text style={styles.heroTitle}>{campaign.title}</Text><Text style={styles.heroMeta}>{campaign.location} · {new Date(campaign.starts_at).toLocaleDateString()}</Text></View>
      </ImageBackground>

      {(summary?.overdueTaskCount ?? 0) > 0 ? <Pressable style={styles.attentionStrip} onPress={() => router.push(`/host/campaigns/${campaign.id}` as never)}><View style={styles.attentionDot} /><View style={{ flex: 1 }}><Text style={styles.attentionTitle}>{summary.overdueTaskCount} overdue task{summary.overdueTaskCount === 1 ? '' : 's'}</Text><Text style={styles.attentionMeta}>Open the event workspace to resolve what needs attention.</Text></View><Text style={styles.chevron}>›</Text></Pressable> : null}

      <View style={[styles.metrics, roomy && styles.metricsRoomy]}>
        <Metric value={`${summary?.progress ?? 0}%`} label="Ready" accent="#D7B45A" />
        <Metric value={`$${((summary?.revenueCents ?? 0) / 100).toLocaleString()}`} label="Revenue" accent="#84C992" />
        <Metric value={`$${((summary?.expenseCents ?? 0) / 100).toLocaleString()}`} label="Expenses" accent="#E7A05C" />
        <Metric value={`${profit < 0 ? '-' : ''}$${Math.abs(profit).toLocaleString()}`} label="Profit" accent={profit >= 0 ? '#84C992' : '#E47768'} />
        <Metric value={String(summary?.confirmedVendors ?? 0)} label="Vendors" accent="#75AEE8" />
        <Metric value={String(summary?.scheduledCommunications ?? 0)} label="Messages" accent="#A990ED" />
      </View>

      {recommended.length > 0 ? <View style={styles.aiCard}>
        <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.aiLabel}>AI EVENT HELPER</Text><Text style={styles.aiTitle}>Recommended setup</Text><Text style={styles.aiBody}>{recommended.slice(0, 4).map((key) => EVENT_COMPONENTS.find((item) => item.key === key)?.title).filter(Boolean).join(' · ')}</Text></View>
        <Pressable disabled={workingKey === 'recommended'} style={styles.aiButton} onPress={() => void addRecommended()}><Text style={styles.aiButtonText}>{workingKey === 'recommended' ? 'Adding…' : 'Add all'}</Text></Pressable>
      </View> : null}

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Build your event</Text><Text style={styles.sectionMeta}>Add the pieces you need. Open added components from the event workspace to finish setup.</Text></View><Text style={styles.addedCount}>{activeKeys.size} ADDED</Text></View>

      <View style={styles.componentGrid}>{EVENT_COMPONENTS.map((item) => {
        const added = activeKeys.has(item.key);
        const recommendedItem = recommended.includes(item.key);
        const accent = componentAccent[item.key];
        return <Pressable key={item.key} disabled={workingKey != null} style={[styles.componentCard, added && styles.componentCardAdded]} onPress={() => void toggleComponent(item.key)}>
          <View style={styles.componentHeader}><View style={[styles.componentIcon, { backgroundColor: `${accent}20` }]}><Text style={styles.componentIconText}>{item.icon}</Text></View>{added ? <View style={styles.addedBadge}><Text style={styles.addedBadgeText}>✓ ADDED</Text></View> : recommendedItem ? <View style={styles.recommendedBadge}><Text style={styles.recommendedBadgeText}>RECOMMENDED</Text></View> : null}</View>
          <Text style={styles.componentTitle}>{item.title}</Text>
          <Text style={styles.componentStatus}>{workingKey === item.key ? 'Updating…' : added ? componentStatus(item.key, summary) : item.description}</Text>
          <Text style={[styles.componentAction, { color: accent }]}>{added ? 'Remove' : '+ Add'}</Text>
        </Pressable>;
      })}</View>

      <View style={styles.workspaceCard}><View><Text style={styles.workspaceLabel}>EVENT WORKSPACE</Text><Text style={styles.workspaceTitle}>Keep building from one operating hub.</Text><Text style={styles.workspaceBody}>Checklist, tickets, vendors, money, communications and team work stay connected to this event.</Text></View><Pressable style={styles.primary} onPress={() => router.replace(`/host/manage/${id}` as never)}><Text style={styles.primaryText}>Open Event Workspace</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function componentStatus(key: EventComponentKey, summary: any) {
  if (key === 'vendors') return `${summary?.confirmedVendors ?? 0} confirmed · ${summary?.pendingVendors ?? 0} pending`;
  if (key === 'communications') return `${summary?.scheduledCommunications ?? 0} scheduled · ${summary?.draftCommunications ?? 0} drafts`;
  if (key === 'finance') return `$${((summary?.profitCents ?? 0) / 100).toLocaleString()} projected profit`;
  if (key === 'tickets') return 'Ticketing attached to this event';
  return 'Added to event · Open to finish setup';
}
function Metric({ value, label, accent }: { value: string; label: string; accent: string }) { return <View style={styles.metric}><View style={[styles.metricLine, { backgroundColor: accent }]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 9 }, loading: { color: '#89958D', fontSize: 10 }, content: { padding: 18, paddingBottom: 80 }, back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 13 }, hero: { minHeight: 245, borderRadius: 24, overflow: 'hidden', justifyContent: 'space-between', padding: 16 }, heroImage: { borderRadius: 24 }, heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,12,8,.56)' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, heroPill: { borderRadius: 9, backgroundColor: 'rgba(10,16,12,.72)', paddingHorizontal: 8, paddingVertical: 6 }, heroPillText: { color: '#E8CB74', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, readinessPill: { borderRadius: 9, backgroundColor: '#D7B45A', paddingHorizontal: 8, paddingVertical: 6 }, readinessPillText: { color: '#172017', fontSize: 8, fontWeight: '900' }, heroBottom: { marginTop: 90 }, heroTitle: { color: '#FFF8E8', fontSize: 28, lineHeight: 33, fontWeight: '900', maxWidth: 560 }, heroMeta: { color: '#D1D9D3', fontSize: 10, marginTop: 5 }, attentionStrip: { minHeight: 63, borderRadius: 15, borderWidth: 1, borderColor: '#71483F', backgroundColor: '#261815', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginTop: 10 }, attentionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E47768' }, attentionTitle: { color: '#FFD5CE', fontSize: 11, fontWeight: '900' }, attentionMeta: { color: '#B99089', fontSize: 8, marginTop: 2 }, chevron: { color: '#8E9992', fontSize: 18 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, metricsRoomy: { flexWrap: 'nowrap' }, metric: { width: '31.7%', minHeight: 70, borderRadius: 13, borderWidth: 1, borderColor: '#2C3831', backgroundColor: '#141B16', padding: 10, overflow: 'hidden' }, metricLine: { position: 'absolute', left: 0, top: 0, right: 0, height: 2 }, metricValue: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#78857D', fontSize: 8, marginTop: 3 }, aiCard: { borderRadius: 16, borderWidth: 1, borderColor: '#55477A', backgroundColor: '#1B1824', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }, aiIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2D2540', alignItems: 'center', justifyContent: 'center' }, aiIconText: { color: '#C4ADFF', fontSize: 19 }, aiLabel: { color: '#BDA7F2', fontSize: 7, fontWeight: '900', letterSpacing: .8 }, aiTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', marginTop: 2 }, aiBody: { color: '#8F879D', fontSize: 8, marginTop: 2 }, aiButton: { borderRadius: 10, backgroundColor: '#7652D7', paddingHorizontal: 10, paddingVertical: 8 }, aiButtonText: { color: '#FFF', fontSize: 8, fontWeight: '900' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 23, marginBottom: 10 }, sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, sectionMeta: { color: '#7F8C83', fontSize: 9, lineHeight: 14, marginTop: 3, maxWidth: 510 }, addedCount: { color: '#8D9991', fontSize: 8, fontWeight: '900' }, componentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, componentCard: { width: '48.7%', minHeight: 155, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12 }, componentCardAdded: { backgroundColor: '#172019', borderColor: '#415348' }, componentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }, componentIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, componentIconText: { fontSize: 18 }, addedBadge: { borderRadius: 8, backgroundColor: '#1F3526', paddingHorizontal: 5, paddingVertical: 4 }, addedBadgeText: { color: '#84C992', fontSize: 6, fontWeight: '900' }, recommendedBadge: { borderRadius: 8, backgroundColor: '#302813', paddingHorizontal: 5, paddingVertical: 4 }, recommendedBadgeText: { color: '#E7C464', fontSize: 5.5, fontWeight: '900' }, componentTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginTop: 10 }, componentStatus: { color: '#7F8B83', fontSize: 8, lineHeight: 12, marginTop: 3, minHeight: 28 }, componentAction: { fontSize: 8, fontWeight: '900', marginTop: 8 }, workspaceCard: { borderRadius: 19, borderWidth: 1, borderColor: '#4A442D', backgroundColor: '#1E1E16', padding: 16, marginTop: 22 }, workspaceLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, workspaceTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 4 }, workspaceBody: { color: '#918E78', fontSize: 9, lineHeight: 14, marginTop: 4 }, primary: { minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 13 }, primaryText: { color: '#172017', fontSize: 10, fontWeight: '900' }, error: { color: '#FF8A80', fontSize: 10, lineHeight: 15, marginTop: 14 } });
