import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addEventComponent,
  EVENT_COMPONENTS,
  getCampaignForAdventure,
  getEventOperationsSummary,
  listEventComponents,
  removeEventComponent,
  type EventComponentKey,
} from '../../../src/hosting/eventBuilder';

const recommendedByType: Record<string, EventComponentKey[]> = {
  Camping: ['tickets','food','communications','team','finance','venue','schedule','activities','lodging','equipment','safety'],
  Workshop: ['tickets','communications','team','finance','venue','schedule','pages'],
  Social: ['tickets','communications','team','finance','venue','schedule','marketing','pages'],
};

export default function BuildEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
      const [componentRows, operations] = await Promise.all([
        listEventComponents(campaignRow.id),
        getEventOperationsSummary(campaignRow.id),
      ]);
      setCampaign(campaignRow);
      setComponents(componentRows);
      setSummary(operations);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the event builder.');
    } finally {
      setLoading(false);
    }
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
    try {
      if (activeKeys.has(key)) await removeEventComponent(campaign.id, key);
      else await addEventComponent(campaign.id, key, campaign.starts_at);
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to update event', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { setWorkingKey(null); }
  }

  async function addRecommended() {
    if (!campaign || recommended.length === 0) return;
    setWorkingKey('recommended');
    try {
      for (const key of recommended) await addEventComponent(campaign.id, key, campaign.starts_at);
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to add recommendations', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { setWorkingKey(null); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event builder unavailable.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;

  const profit = summary ? summary.profitCents / 100 : 0;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace(`/host/manage/${id}` as never)}><Text style={styles.back}>‹ Event workspace</Text></Pressable>
      <Text style={styles.eyebrow}>BUILD AN EVENT</Text>
      <Text style={styles.title}>{campaign.title}</Text>
      <Text style={styles.subtitle}>{campaign.location} · {new Date(campaign.starts_at).toLocaleDateString()}</Text>

      <View style={styles.statusCard}>
        <View style={{ flex: 1 }}><Text style={styles.statusLabel}>EVENT READINESS</Text><Text style={styles.statusValue}>{summary?.progress ?? 0}%</Text><Text style={styles.statusMeta}>{summary?.completeTaskCount ?? 0} of {summary?.taskCount ?? 0} tasks complete</Text></View>
        <View style={styles.statusRight}><Text style={styles.alertValue}>{summary?.overdueTaskCount ?? 0}</Text><Text style={styles.alertLabel}>overdue</Text></View>
      </View>

      {recommended.length > 0 ? <View style={styles.aiCard}>
        <Text style={styles.aiEyebrow}>AI EVENT HELPER</Text>
        <Text style={styles.aiTitle}>Recommended for this event</Text>
        <Text style={styles.aiBody}>Add the common operating pieces now. You can remove or change them later.</Text>
        <View style={styles.recommendChips}>{recommended.slice(0, 6).map((key) => <Text key={key} style={styles.recommendChip}>{EVENT_COMPONENTS.find((item) => item.key === key)?.title}</Text>)}</View>
        <Pressable disabled={workingKey === 'recommended'} style={styles.aiButton} onPress={() => void addRecommended()}><Text style={styles.aiButtonText}>{workingKey === 'recommended' ? 'Adding…' : 'Add Recommended'}</Text></Pressable>
      </View> : null}

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>What does your event need?</Text><Text style={styles.sectionMeta}>Add only the pieces this event needs. Each one creates its own setup tasks.</Text></View></View>

      <View style={styles.grid}>
        {EVENT_COMPONENTS.map((item) => {
          const added = activeKeys.has(item.key);
          return <View key={item.key} style={[styles.componentCard, added && styles.componentAdded]}>
            <View style={styles.componentTop}><View style={styles.icon}><Text style={styles.iconText}>{item.icon}</Text></View><View style={{ flex: 1 }}><Text style={styles.componentTitle}>{item.title}</Text><Text style={styles.componentBody}>{item.description}</Text></View></View>
            <Pressable disabled={workingKey != null} style={[styles.componentButton, added && styles.componentButtonAdded]} onPress={() => void toggleComponent(item.key)}>
              <Text style={[styles.componentButtonText, added && styles.componentButtonTextAdded]}>{workingKey === item.key ? 'Working…' : added ? '✓ Added' : '+ Add'}</Text>
            </Pressable>
          </View>;
        })}
      </View>

      <Text style={styles.sectionTitle}>Operations snapshot</Text>
      <View style={styles.metricsRow}>
        <Metric label="Revenue" value={`$${((summary?.revenueCents ?? 0) / 100).toFixed(0)}`} />
        <Metric label="Expenses" value={`$${((summary?.expenseCents ?? 0) / 100).toFixed(0)}`} />
        <Metric label="Profit" value={`${profit < 0 ? '-' : ''}$${Math.abs(profit).toFixed(0)}`} />
      </View>
      <View style={styles.metricsRow}>
        <Metric label="Confirmed vendors" value={String(summary?.confirmedVendors ?? 0)} />
        <Metric label="Pending vendors" value={String(summary?.pendingVendors ?? 0)} />
        <Metric label="Messages scheduled" value={String(summary?.scheduledCommunications ?? 0)} />
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextTitle}>Your event workspace is the operating hub.</Text>
        <Text style={styles.nextBody}>Tickets, vendors, money, communications and checklist progress stay attached to this event so one update can feed the rest of the workspace.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace(`/host/manage/${id}` as never)}><Text style={styles.primaryText}>Open Event Workspace</Text></Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 72 },
  back: { color: '#D7B45A', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 12, lineHeight: 18, marginTop: 5 },
  statusCard: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: '#334039', backgroundColor: '#151B17', padding: 16, flexDirection: 'row', alignItems: 'center' }, statusLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, statusValue: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 2 }, statusMeta: { color: '#89958D', fontSize: 11, marginTop: 2 }, statusRight: { minWidth: 70, alignItems: 'center', paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: '#2D3731' }, alertValue: { color: '#FF8A80', fontSize: 23, fontWeight: '900' }, alertLabel: { color: '#89958D', fontSize: 10 },
  aiCard: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: '#6A54B5', backgroundColor: '#1B1724', padding: 16 }, aiEyebrow: { color: '#B99BFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, aiTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 5 }, aiBody: { color: '#AFA7BB', fontSize: 11, lineHeight: 17, marginTop: 5 }, recommendChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }, recommendChip: { color: '#D9CDF7', fontSize: 9, fontWeight: '800', backgroundColor: '#2B2239', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 }, aiButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#7652D7', alignItems: 'center', justifyContent: 'center', marginTop: 13 }, aiButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  sectionHeader: { marginTop: 24 }, sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 24 }, sectionMeta: { color: '#849087', fontSize: 11, lineHeight: 16, marginTop: 4 }, grid: { gap: 9, marginTop: 12 }, componentCard: { borderRadius: 16, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#141A16', padding: 13 }, componentAdded: { borderColor: '#496747', backgroundColor: '#151D16' }, componentTop: { flexDirection: 'row', gap: 11 }, icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#222B25', alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 19 }, componentTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, componentBody: { color: '#8D9991', fontSize: 10, lineHeight: 15, marginTop: 3 }, componentButton: { alignSelf: 'flex-start', marginTop: 11, borderRadius: 10, borderWidth: 1, borderColor: '#465149', paddingHorizontal: 11, paddingVertical: 7 }, componentButtonAdded: { borderColor: '#4B714C', backgroundColor: '#1A2B1C' }, componentButtonText: { color: '#D4DAD6', fontSize: 10, fontWeight: '900' }, componentButtonTextAdded: { color: '#8ED493' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 8 }, metric: { flex: 1, minHeight: 74, borderRadius: 14, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#141A16', padding: 11, justifyContent: 'center' }, metricValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, metricLabel: { color: '#7F8B83', fontSize: 9, lineHeight: 13, marginTop: 3 },
  nextCard: { marginTop: 24, borderRadius: 18, backgroundColor: '#171E19', borderWidth: 1, borderColor: '#334039', padding: 16 }, nextTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, nextBody: { color: '#8E9992', fontSize: 11, lineHeight: 17, marginTop: 5 }, primary: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' }, error: { color: '#FF8A80', fontSize: 11, lineHeight: 17, marginTop: 14 },
});
