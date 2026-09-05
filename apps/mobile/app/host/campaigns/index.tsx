import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCampaignDaysUntil, listHostCampaigns, type HostCampaign } from '../../../src/hosting/campaigns';
import { campaignProgress, canonicalCampaigns, isOverdue, needsScheduling, openTasksForCampaign } from '../../../src/hosting/workModel';

export default function HostCampaignsScreen() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCampaigns(canonicalCampaigns(await listHostCampaigns()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <Text style={styles.eyebrow}>HOST CENTER</Text>
        <Text style={styles.title}>Campaigns</Text>
        <Text style={styles.subtitle}>Plan the work behind every adventure, from first decision to event-day execution.</Text>

        {loading ? <View style={styles.stateCard}><ActivityIndicator color="#D7B45A" /><Text style={styles.stateText}>Loading campaigns…</Text></View> : null}
        {!loading && error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Campaigns couldn’t load.</Text><Text style={styles.errorText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!loading && !error && campaigns.length === 0 ? <View style={styles.stateCard}><Text style={styles.emptyTitle}>No campaigns yet.</Text><Text style={styles.stateText}>Campaigns you own or support will appear here.</Text></View> : null}

        {!loading && !error ? campaigns.map((campaign) => {
          const readiness = campaignProgress(campaign);
          const days = getCampaignDaysUntil(campaign);
          const tasks = openTasksForCampaign(campaign).map((task) => ({ ...task, campaign }));
          const blocked = tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting').length;
          const overdue = tasks.filter(isOverdue).length;
          const scheduling = tasks.filter(needsScheduling).length;
          return (
            <View key={campaign.id} style={styles.cardWrap}>
              <Pressable style={styles.card} onPress={() => router.push(`/host/event-work/${campaign.slug}` as never)}>
                <View style={styles.cardTop}>
                  <View style={[styles.accentDot, { backgroundColor: campaign.accent }]} />
                  <Text style={styles.status}>{campaign.status.toUpperCase()}</Text>
                  {campaign.canManage ? <View style={styles.managerPill}><Text style={styles.managerPillText}>MANAGE</Text></View> : null}
                </View>
                <Text style={styles.cardTitle}>{campaign.shortTitle}</Text>
                <Text style={styles.meta}>{campaign.location}</Text>
                <Text style={styles.meta}>{days} days to go</Text>

                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${readiness}%`, backgroundColor: campaign.accent }]} /></View>
                <View style={styles.metrics}>
                  <Metric value={`${readiness}%`} label="Task complete" />
                  <Metric value={String(tasks.length)} label="Open" />
                  <Metric value={String(overdue)} label="Overdue" />
                </View>
                <Text style={styles.integrityMeta}>{blocked} blocked or waiting · {scheduling} need scheduling</Text>
                <Text style={[styles.openAction, { color: campaign.accent }]}>Open event work →</Text>
              </Pressable>
              <Pressable style={styles.marketingAction} onPress={() => router.push(`/host/campaigns/${campaign.slug}/marketing` as never)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.marketingKicker}>MARKETING</Text>
                  <Text style={styles.marketingTitle}>Open campaign calendar</Text>
                </View>
                <Text style={styles.marketingChevron}>›</Text>
              </Pressable>
            </View>
          );
        }) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 60 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A8B1AB', fontSize: 15, lineHeight: 22, marginTop: 5, marginBottom: 22 },
  stateCard: { backgroundColor: '#151B17', borderWidth: 1, borderColor: '#303A34', borderRadius: 18, padding: 20, alignItems: 'center', gap: 10 },
  stateText: { color: '#8E9891', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  errorCard: { backgroundColor: '#211715', borderWidth: 1, borderColor: '#684139', borderRadius: 18, padding: 18 },
  errorTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  errorText: { color: '#BB8F87', fontSize: 11, lineHeight: 17, marginTop: 6 },
  retry: { alignSelf: 'flex-start', backgroundColor: '#D7B45A', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, marginTop: 12 },
  retryText: { color: '#172017', fontWeight: '900', fontSize: 11 },
  cardWrap: { marginBottom: 14 },
  card: { backgroundColor: '#151B17', borderWidth: 1, borderColor: '#303A34', borderRadius: 22, padding: 18 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentDot: { width: 9, height: 9, borderRadius: 5 },
  status: { color: '#AAB4AD', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  managerPill: { marginLeft: 'auto', borderRadius: 12, backgroundColor: '#28371E', paddingHorizontal: 8, paddingVertical: 4 },
  managerPillText: { color: '#A8CF7A', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  cardTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 9 },
  meta: { color: '#8E9891', fontSize: 12, marginTop: 5 },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: '#252E29', overflow: 'hidden', marginTop: 18 },
  progressFill: { height: '100%', borderRadius: 6 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 14 },
  metric: { flex: 1, backgroundColor: '#101512', borderRadius: 13, padding: 12 },
  metricValue: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  metricLabel: { color: '#7F8A83', fontSize: 9, fontWeight: '800', marginTop: 2 },
  integrityMeta: { color: '#7F8A83', fontSize: 9, marginTop: 10 },
  openAction: { fontWeight: '900', marginTop: 14 },
  marketingAction: { flexDirection: 'row', alignItems: 'center', marginTop: 7, borderRadius: 14, borderWidth: 1, borderColor: '#4C3D22', backgroundColor: '#1C1810', paddingHorizontal: 14, paddingVertical: 11 },
  marketingKicker: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  marketingTitle: { color: '#D8D1BF', fontSize: 12, fontWeight: '900', marginTop: 2 },
  marketingChevron: { color: '#D7B45A', fontSize: 23 },
});
