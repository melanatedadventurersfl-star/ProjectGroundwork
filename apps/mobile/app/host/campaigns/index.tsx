import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCampaignDaysUntil, getCampaignReadiness, listHostCampaigns, type HostCampaign } from '../../../src/hosting/campaigns';

export default function HostCampaignsScreen() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCampaigns(await listHostCampaigns());
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
          const readiness = getCampaignReadiness(campaign);
          const days = getCampaignDaysUntil(campaign);
          const openTasks = campaign.tasks.filter((task) => task.status !== 'complete').length;
          const blocked = campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting').length;
          return (
            <Pressable key={campaign.id} style={styles.card} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}>
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
                <Metric value={`${readiness}%`} label="Ready" />
                <Metric value={String(openTasks)} label="Open" />
                <Metric value={String(blocked)} label="Waiting" />
              </View>
              <Text style={[styles.openAction, { color: campaign.accent }]}>Open campaign →</Text>
            </Pressable>
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
  card: { backgroundColor: '#151B17', borderWidth: 1, borderColor: '#303A34', borderRadius: 22, padding: 18, marginBottom: 12 },
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
  metricLabel: { color: '#7F8A83', fontSize: 10, fontWeight: '800', marginTop: 2 },
  openAction: { fontWeight: '900', marginTop: 18 },
});
