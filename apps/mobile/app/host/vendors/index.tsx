import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostVendorProfiles, vendorDocumentSummary, vendorSetupSummary, type HostVendorProfile } from '../../../src/hosting/vendors';

type Filter = 'all' | 'active' | 'demo';

export default function HostVendorDirectoryScreen() {
  const [vendors, setVendors] = useState<HostVendorProfile[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setVendors(await listHostVendorProfiles()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load vendors.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => vendors.filter((vendor) => {
    if (filter === 'demo') return vendor.is_demo;
    if (filter === 'active') return !vendor.is_demo;
    return true;
  }), [filter, vendors]);

  const demoCount = vendors.filter((vendor) => vendor.is_demo).length;
  const categories = new Set(vendors.map((vendor) => vendor.category)).size;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

      <View style={styles.hero}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <Text style={styles.eyebrow}>VENDOR HUB</Text>
        <Text style={styles.title}>Vendor Directory</Text>
        <Text style={styles.subtitle}>Reusable business profiles, branding, documents and event setup details in one place.</Text>
        <View style={styles.metrics}>
          <Metric value={String(vendors.length)} label="Vendors" />
          <Metric value={String(categories)} label="Categories" />
          <Metric value={String(demoCount)} label="Demo" />
        </View>
      </View>

      <View style={styles.demoBanner}>
        <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>DEMO DATA</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.demoTitle}>Sample vendors are included for testing.</Text>
          <Text style={styles.demoBody}>Demo vendors are clearly labeled and should never be treated as real businesses, contracts or outreach targets.</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all','active','demo'] as Filter[]).map((item) => <Pressable key={item} style={[styles.filter, filter === item && styles.filterActive]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'all' ? 'All' : item === 'active' ? 'Live Vendors' : 'Demo Vendors'}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>{filter === 'demo' ? 'Demo vendors' : filter === 'active' ? 'Live vendors' : 'All vendors'}</Text><Text style={styles.sectionMeta}>{filtered.length} profile{filtered.length === 1 ? '' : 's'}</Text></View>
        <Pressable style={styles.addButton}><Text style={styles.addButtonText}>＋ Add Vendor</Text></Pressable>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Loading vendors…</Text></View> : null}
      {!loading && error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {!loading && !error && filtered.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>🏪</Text><Text style={styles.emptyTitle}>No vendors in this view</Text><Text style={styles.emptyBody}>Add a vendor or switch filters to see available profiles.</Text></View> : null}

      <View style={styles.vendorList}>{filtered.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)}</View>
    </ScrollView>
  </SafeAreaView>;
}

function VendorCard({ vendor }: { vendor: HostVendorProfile }) {
  const docs = vendorDocumentSummary(vendor);
  const setup = vendorSetupSummary(vendor);
  const initials = vendor.business_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <Pressable style={[styles.vendorCard, vendor.is_demo && styles.vendorCardDemo]}>
    <View style={styles.vendorTop}>
      <View style={[styles.logoPlaceholder, vendor.is_demo && styles.logoPlaceholderDemo]}><Text style={styles.logoText}>{initials}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}><Text style={styles.vendorName}>{vendor.business_name}</Text>{vendor.is_demo ? <View style={styles.inlineDemo}><Text style={styles.inlineDemoText}>DEMO VENDOR</Text></View> : null}</View>
        <Text style={styles.vendorCategory}>{vendor.category} · {vendor.service_area || 'Service area not set'}</Text>
      </View>
    </View>
    {vendor.description ? <Text style={styles.vendorDescription}>{vendor.description}</Text> : null}
    <View style={styles.infoRow}>
      <InfoPill text={`${vendor.demo_event_count} ${vendor.is_demo ? 'demo ' : ''}events`} />
      <InfoPill text={vendor.rating != null ? `${vendor.rating.toFixed(1)} ★` : 'No rating'} />
      <InfoPill text={setup} />
    </View>
    <View style={styles.cardFooter}>
      <Text style={styles.docStatus}>{docs.pending > 0 ? `${docs.pending} document pending` : docs.total > 0 ? `${docs.onFile}/${docs.total} documents on file` : 'No documents'}</Text>
      <Text style={styles.viewText}>View profile ›</Text>
    </View>
  </Pressable>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function InfoPill({ text }: { text: string }) { return <View style={styles.infoPill}><Text style={styles.infoPillText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 72 }, back: { color: '#D7B45A', fontWeight: '900', marginBottom: 16 },
  hero: { position: 'relative', overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#3A493F', backgroundColor: '#18251D', padding: 18 }, heroGlowOne: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#294735', right: -45, top: -55, opacity: .75 }, heroGlowTwo: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#66531F', left: -50, bottom: -70, opacity: .45 }, eyebrow: { color: '#E3C468', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: 5 }, subtitle: { color: '#C1CBC4', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 330 }, metrics: { flexDirection: 'row', gap: 8, marginTop: 17 }, metric: { flex: 1, borderRadius: 13, backgroundColor: 'rgba(9,16,12,.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', padding: 10 }, metricValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, metricLabel: { color: '#9EAAA2', fontSize: 9, fontWeight: '800', marginTop: 2 },
  demoBanner: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#765C24', backgroundColor: '#2B2414', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, demoBadge: { backgroundColor: '#D7B45A', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 }, demoBadgeText: { color: '#1A1D18', fontSize: 8, fontWeight: '900', letterSpacing: .6 }, demoTitle: { color: '#FFF3CF', fontSize: 12, fontWeight: '900' }, demoBody: { color: '#C7B98E', fontSize: 10, lineHeight: 15, marginTop: 3 },
  filters: { gap: 8, paddingVertical: 16 }, filter: { borderRadius: 18, borderWidth: 1, borderColor: '#344039', backgroundColor: '#151B17', paddingHorizontal: 12, paddingVertical: 8 }, filterActive: { backgroundColor: '#3B3116', borderColor: '#8A6A25' }, filterText: { color: '#9BA69E', fontSize: 10, fontWeight: '900' }, filterTextActive: { color: '#E7C464' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }, sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, sectionMeta: { color: '#7E8A82', fontSize: 10, marginTop: 2 }, addButton: { borderRadius: 11, backgroundColor: '#D7B45A', paddingHorizontal: 11, paddingVertical: 9 }, addButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  loading: { alignItems: 'center', gap: 9, padding: 28 }, loadingText: { color: '#8D9991', fontSize: 11 }, errorCard: { borderRadius: 14, backgroundColor: '#271817', borderWidth: 1, borderColor: '#6B403B', padding: 14 }, error: { color: '#F0A099', fontSize: 11, lineHeight: 16 }, retry: { color: '#E7C464', fontWeight: '900', marginTop: 8 }, empty: { alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#141A16', padding: 28 }, emptyIcon: { fontSize: 32 }, emptyTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 8 }, emptyBody: { color: '#87928B', fontSize: 10, marginTop: 4, textAlign: 'center' },
  vendorList: { gap: 10 }, vendorCard: { borderRadius: 18, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#141A16', padding: 14 }, vendorCardDemo: { borderColor: '#5D512A', backgroundColor: '#171914' }, vendorTop: { flexDirection: 'row', gap: 11, alignItems: 'center' }, logoPlaceholder: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#26332B', alignItems: 'center', justifyContent: 'center' }, logoPlaceholderDemo: { backgroundColor: '#39331D' }, logoText: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }, vendorName: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', flexShrink: 1 }, inlineDemo: { borderRadius: 6, borderWidth: 1, borderColor: '#8A6A25', backgroundColor: '#302813', paddingHorizontal: 5, paddingVertical: 3 }, inlineDemoText: { color: '#E7C464', fontSize: 7, fontWeight: '900', letterSpacing: .4 }, vendorCategory: { color: '#8D9991', fontSize: 9, lineHeight: 13, marginTop: 3 }, vendorDescription: { color: '#B4BDB7', fontSize: 10, lineHeight: 15, marginTop: 11 }, infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }, infoPill: { borderRadius: 11, backgroundColor: '#202823', paddingHorizontal: 8, paddingVertical: 5 }, infoPillText: { color: '#AEB9B1', fontSize: 8, fontWeight: '800' }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#323A35', paddingTop: 11, marginTop: 11 }, docStatus: { color: '#87928B', fontSize: 9, flex: 1 }, viewText: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
});
