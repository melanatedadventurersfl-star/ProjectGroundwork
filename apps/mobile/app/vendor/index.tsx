import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { listHostVendorProfiles, type HostVendorProfile, vendorAvailabilityLabel, vendorVerificationLabel } from '../../src/hosting/vendors';
import { AppIcon } from '../../src/ui/AppIcon';
import { VENDOR_WORKSPACE_ITEMS } from '../../src/vendor/vendorWorkspace';

const C = { bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#7FB7A3' };

export default function VendorCenterScreen() {
  const { session } = useAuth();
  const [vendors, setVendors] = useState<HostVendorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setVendors(await listHostVendorProfiles());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Vendor Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const ownedVendor = useMemo(() => {
    const userId = session?.user.id;
    if (!userId) return null;
    return vendors.find((vendor) => vendor.owner_profile_id === userId || vendor.created_by === userId) ?? null;
  }, [session?.user.id, vendors]);

  const marketplaceCount = vendors.filter((vendor) => vendor.marketplace_visible).length;
  const featuredCount = vendors.filter((vendor) => vendor.marketplace_visible && vendor.featured).length;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Vendor Center</Text>
          <Text style={styles.subtitle}>Find work, manage bookings and run your vendor business.</Text>
        </View>
        <Pressable accessibilityLabel="Open Vendor Center menu" style={styles.menuButton} onPress={() => router.push('/vendor/menu' as never)}><AppIcon name="menu" color={C.cream} size={24} /></Pressable>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={C.gold} /><Text style={styles.loadingText}>Loading your business workspace…</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading ? <>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{ownedVendor ? 'YOUR BUSINESS' : 'VENDOR PATHWAY'}</Text>
          <Text style={styles.heroTitle}>{ownedVendor?.business_name ?? 'Build your vendor presence'}</Text>
          <Text style={styles.heroBody}>{ownedVendor ? `${vendorVerificationLabel(ownedVendor.verification_status)} · ${vendorAvailabilityLabel(ownedVendor.availability_status)}` : 'Claim an existing marketplace profile or create a vendor profile to start receiving opportunities.'}</Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={() => router.push((ownedVendor ? '/vendor/profile' : '/vendor/profile') as never)}><Text style={styles.primaryButtonText}>{ownedVendor ? 'Manage Profile' : 'Set Up Vendor Profile'}</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/vendor/opportunities' as never)}><Text style={styles.secondaryButtonText}>Find Opportunities</Text></Pressable>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric value={ownedVendor?.rating?.toFixed(1) ?? '—'} label="Rating" />
          <Metric value={ownedVendor ? String(ownedVendor.demo_event_count) : '0'} label="Events" />
          <Metric value={String(marketplaceCount)} label="Marketplace" />
          <Metric value={String(featuredCount)} label="Featured" />
        </View>

        <Text style={styles.sectionTitle}>RUN YOUR BUSINESS</Text>
        <View style={styles.grid}>
          {VENDOR_WORKSPACE_ITEMS.slice(0, 8).map((item) => <Pressable key={item.key} style={styles.tile} onPress={() => router.push(item.route as never)}>
            <View style={[styles.tileIcon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={21} /></View>
            <Text style={styles.tileTitle}>{item.title}</Text>
            <Text style={styles.tileSubtitle}>{item.subtitle}</Text>
          </Pressable>)}
        </View>

        <Pressable style={styles.allTools} onPress={() => router.push('/vendor/menu' as never)}>
          <View><Text style={styles.allToolsTitle}>All Vendor Tools</Text><Text style={styles.allToolsMeta}>Services, portfolio, reviews, documents, team and settings</Text></View>
          <AppIcon name="chevron-forward" color={C.gold} size={20} />
        </Pressable>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, content: { padding: 18, paddingBottom: 90, maxWidth: 860, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 }, eyebrow: { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: C.cream, fontSize: 34, fontWeight: '900', marginTop: 2 }, subtitle: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 4, maxWidth: 390 },
  menuButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: 22, alignItems: 'center', gap: 10 }, loadingText: { color: C.muted, fontSize: 12 }, error: { color: '#FF8A80', marginBottom: 12 },
  heroCard: { borderRadius: 20, borderWidth: 1, borderColor: '#49604F', backgroundColor: '#15261C', padding: 18 }, heroEyebrow: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: C.cream, fontSize: 23, fontWeight: '900', marginTop: 5 }, heroBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }, heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  primaryButton: { minHeight: 43, borderRadius: 12, backgroundColor: C.gold, justifyContent: 'center', paddingHorizontal: 14 }, primaryButtonText: { color: C.bg, fontSize: 12, fontWeight: '900' }, secondaryButton: { minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: '#806B38', justifyContent: 'center', paddingHorizontal: 14 }, secondaryButtonText: { color: '#E4C469', fontSize: 12, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, metric: { flexGrow: 1, minWidth: 76, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 12 }, metricValue: { color: C.cream, fontSize: 20, fontWeight: '900' }, metricLabel: { color: C.dim, fontSize: 9, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  sectionTitle: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 24, marginBottom: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tile: { width: '48.5%', minHeight: 142, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 13 }, tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, tileTitle: { color: C.cream, fontSize: 14, fontWeight: '900' }, tileSubtitle: { color: C.dim, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  allTools: { marginTop: 10, minHeight: 68, borderRadius: 15, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, allToolsTitle: { color: C.cream, fontSize: 14, fontWeight: '900' }, allToolsMeta: { color: C.dim, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
});
