import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostDistributionProviders, type HostDistributionProviderSummary } from '../../src/hosting/distribution';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = {
  bg: '#0B100D', panel: '#141B17', raised: '#1A231D', line: '#2C3831', cream: '#FFF8E8',
  muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#8CCF72', orange: '#E6A155', red: '#E8786F',
};

export default function HostConnectionsScreen() {
  const [providers, setProviders] = useState<HostDistributionProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProviders(await listHostDistributionProviders());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load connected apps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.gold} /><Text style={styles.muted}>Loading connections…</Text></View></SafeAreaView>;
  }

  const nativeProviders = providers.filter((provider) => provider.native);
  const externalProviders = providers.filter((provider) => !provider.native);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <View style={styles.iconButton}><AppIcon name="connections" color={COLORS.gold} size={20} /></View>
      </View>

      <Text style={styles.eyebrow}>DISTRIBUTION</Text>
      <Text style={styles.title}>Connections & Apps</Text>
      <Text style={styles.subtitle}>Host Center is the control point. Connect an app once, then choose which destinations each event and promotion should use.</Text>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      <View style={styles.nativeBanner}>
        <View style={styles.nativeIcon}><Text style={styles.nativeIconText}>GM</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.nativeTitle}>Go Melanated is built in</Text><Text style={styles.nativeBody}>Events, member posts, RSVP, tickets, waitlists and first-party analytics use the same event identity.</Text></View>
      </View>

      <SectionTitle title="Native apps" />
      {nativeProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}

      <SectionTitle title="External channels" />
      <Text style={styles.sectionIntro}>These destinations use the same provider model. Live authorization and publishing can be added without rebuilding Host Center.</Text>
      {externalProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}

      <View style={styles.architectureCard}>
        <Text style={styles.architectureEyebrow}>ONE EVENT IDENTITY</Text>
        <Text style={styles.architectureTitle}>One Host Center event can publish to many destinations.</Text>
        <Text style={styles.architectureBody}>Each destination keeps its own external ID and capabilities. Analytics and ticket activity still roll back into the same Host Center event.</Text>
        <View style={styles.flowRow}><FlowPill label="Host Event" active /><Text style={styles.arrow}>→</Text><FlowPill label="Go Melanated" active /><FlowPill label="Future apps" /></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function ProviderCard({ provider }: { provider: HostDistributionProviderSummary }) {
  const connected = provider.status === 'native' || provider.status === 'connected';
  const attention = provider.status === 'attention';
  const statusLabel = provider.status === 'native' ? 'Native · Always connected' : provider.status === 'connected' ? 'Connected' : provider.status === 'attention' ? 'Needs attention' : 'Not connected';
  return <View style={styles.providerCard}>
    <View style={styles.providerTop}>
      <View style={[styles.providerMark, provider.native && styles.providerMarkNative]}><Text style={styles.providerMarkText}>{provider.id === 'go_melanated' ? 'GM' : provider.label.slice(0, 2).toUpperCase()}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.providerTitle}>{provider.label}</Text><Text style={styles.providerDescription}>{provider.description}</Text></View>
      <View style={[styles.statusDot, connected && styles.statusConnected, attention && styles.statusAttention]} />
    </View>
    <View style={styles.providerMetaRow}>
      <Text style={[styles.providerStatus, connected && styles.providerStatusConnected, attention && styles.providerStatusAttention]}>{statusLabel}</Text>
      <Text style={styles.providerMeta}>{provider.eventCount ? `${provider.eventCount} event${provider.eventCount === 1 ? '' : 's'}` : 'No linked events'}</Text>
    </View>
    <View style={styles.capabilityRow}>{provider.capabilities.slice(0, 4).map((capability) => <Text key={capability} style={styles.capability}>{formatCapability(capability)}</Text>)}</View>
    {!provider.native && provider.status === 'not_connected' ? <Text style={styles.futureNote}>Connection setup will appear here when authorization for this provider is enabled.</Text> : null}
  </View>;
}

function SectionTitle({ title }: { title: string }) { return <Text style={styles.sectionTitle}>{title}</Text>; }
function FlowPill({ label, active }: { label: string; active?: boolean }) { return <View style={[styles.flowPill, active && styles.flowPillActive]}><Text style={[styles.flowText, active && styles.flowTextActive]}>{label}</Text></View>; }
function formatCapability(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  back: { color: '#CAD3CD', fontSize: 12, fontWeight: '900' },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: COLORS.cream, fontSize: 31, lineHeight: 37, fontWeight: '900', marginTop: 4 },
  subtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 610 },
  muted: { color: COLORS.muted, fontSize: 11 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#6B403A', backgroundColor: '#241816', padding: 12, marginTop: 14 },
  errorText: { color: '#E3A39C', fontSize: 11, lineHeight: 16 }, retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 7 },
  nativeBanner: { marginTop: 18, borderRadius: 17, borderWidth: 1, borderColor: '#506332', backgroundColor: '#172116', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nativeIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, nativeIconText: { color: '#151B16', fontSize: 15, fontWeight: '900' },
  nativeTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900' }, nativeBody: { color: '#9DA99F', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  sectionTitle: { color: COLORS.gold, fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase', marginTop: 24, marginBottom: 9 },
  sectionIntro: { color: COLORS.dim, fontSize: 10.5, lineHeight: 16, marginTop: -3, marginBottom: 9 },
  providerCard: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 13, marginBottom: 9 },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, providerMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#27312B', alignItems: 'center', justifyContent: 'center' }, providerMarkNative: { backgroundColor: '#3B351C' }, providerMarkText: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  providerTitle: { color: COLORS.cream, fontSize: 14, fontWeight: '900' }, providerDescription: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#59645D' }, statusConnected: { backgroundColor: COLORS.green }, statusAttention: { backgroundColor: COLORS.orange },
  providerMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 11 }, providerStatus: { color: COLORS.muted, fontSize: 9.5, fontWeight: '900' }, providerStatusConnected: { color: COLORS.green }, providerStatusAttention: { color: COLORS.orange }, providerMeta: { color: COLORS.dim, fontSize: 9 },
  capabilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 }, capability: { color: '#AEB8B1', fontSize: 8.5, fontWeight: '800', backgroundColor: '#202A24', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 }, futureNote: { color: COLORS.dim, fontSize: 9, lineHeight: 13, marginTop: 9 },
  architectureCard: { marginTop: 21, borderRadius: 18, borderWidth: 1, borderColor: '#3A453E', backgroundColor: '#111814', padding: 15 }, architectureEyebrow: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: .8 }, architectureTitle: { color: COLORS.cream, fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 5 }, architectureBody: { color: COLORS.muted, fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  flowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 13 }, flowPill: { borderRadius: 99, borderWidth: 1, borderColor: '#38443D', paddingHorizontal: 9, paddingVertical: 6 }, flowPillActive: { borderColor: '#697C37', backgroundColor: '#253017' }, flowText: { color: COLORS.muted, fontSize: 8.5, fontWeight: '900' }, flowTextActive: { color: '#D8EA7F' }, arrow: { color: COLORS.gold, fontSize: 15, fontWeight: '900' },
});
