import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createHostVendorProfile, listHostVendorProfiles, vendorDocumentSummary, vendorSetupSummary, type HostVendorProfile } from '../../../src/hosting/vendors';

type Filter = 'all' | 'active' | 'demo';

export default function HostVendorDirectoryScreen() {
  const [vendors, setVendors] = useState<HostVendorProfile[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setVendors(await listHostVendorProfiles()); }
    catch { setError('We couldn’t load your vendors.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const liveVendors = useMemo(() => vendors.filter((vendor) => !vendor.is_demo), [vendors]);
  const demoCount = vendors.length - liveVendors.length;
  const usedBefore = liveVendors.filter((vendor) => vendor.demo_event_count > 0).length;
  const needsFollowUp = liveVendors.filter((vendor) => vendorDocumentSummary(vendor).pending > 0).length;
  const categories = useMemo(() => ['All', ...Array.from(new Set(vendors.map((vendor) => vendor.category).filter(Boolean))).sort()], [vendors]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (filter === 'demo' && !vendor.is_demo) return false;
      if (filter === 'active' && vendor.is_demo) return false;
      if (category !== 'All' && vendor.category !== category) return false;
      if (!query) return true;
      return [vendor.business_name, vendor.category, vendor.service_area, vendor.contact_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [category, filter, search, vendors]);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

      <View style={styles.hero}>
        <View style={styles.heroGlowOne} />
        <Text style={styles.eyebrow}>VENDOR HUB</Text>
        <Text style={styles.title}>Vendor Directory</Text>
        <Text style={styles.subtitle}>Keep every company you work with, what you know about them and what needs attention in one place.</Text>
        <View style={styles.metrics}>
          <Metric value={String(liveVendors.length)} label="Active vendors" />
          <Metric value={String(usedBefore)} label="Used before" />
          <Metric value={String(needsFollowUp)} label="Need follow-up" />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search vendors, services or locations"
          placeholderTextColor="#77827B"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search ? <Pressable onPress={() => setSearch('')}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilters}>
        {categories.map((item) => <Pressable key={item} style={[styles.categoryChip, category === item && styles.categoryChipActive]} onPress={() => setCategory(item)}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.rowBetween}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all','active','demo'] as Filter[]).map((item) => <Pressable key={item} style={[styles.filter, filter === item && styles.filterActive]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'all' ? 'All' : item === 'active' ? 'Live' : `Demo${demoCount ? ` (${demoCount})` : ''}`}</Text></Pressable>)}
        </ScrollView>
        <Pressable style={styles.addButton} onPress={() => setAddOpen(true)}><Text style={styles.addButtonText}>＋ Add Vendor</Text></Pressable>
      </View>

      {demoCount > 0 ? <View style={styles.demoBanner}>
        <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>DEMO</Text></View>
        <Text style={styles.demoBody}>{demoCount} sample vendor{demoCount === 1 ? '' : 's'} available for testing. Demo records are clearly labeled.</Text>
      </View> : null}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{search || category !== 'All' ? 'Matching vendors' : filter === 'demo' ? 'Demo vendors' : filter === 'active' ? 'Live vendors' : 'All vendors'}</Text>
          <Text style={styles.sectionMeta}>{filtered.length} profile{filtered.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Loading vendors…</Text></View> : null}
      {!loading && error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>We couldn’t load your vendors.</Text><Text style={styles.errorBody}>Your vendor tools are still available. Try loading the directory again.</Text><View style={styles.errorActions}><Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryButtonText}>Try Again</Text></Pressable><Pressable style={styles.errorAddButton} onPress={() => setAddOpen(true)}><Text style={styles.errorAddText}>Add Vendor</Text></Pressable></View></View> : null}
      {!loading && !error && filtered.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>{vendors.length === 0 ? 'Build your vendor bench' : 'No vendors match this view'}</Text><Text style={styles.emptyBody}>{vendors.length === 0 ? 'Add your first vendor now. You can start with only a business name and category.' : 'Clear a filter or search for another business, service or location.'}</Text><Pressable style={styles.emptyButton} onPress={() => vendors.length === 0 ? setAddOpen(true) : (setSearch(''), setCategory('All'), setFilter('all'))}><Text style={styles.emptyButtonText}>{vendors.length === 0 ? '＋ Add First Vendor' : 'Clear Filters'}</Text></Pressable></View> : null}

      {!error ? <View style={styles.vendorList}>{filtered.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)}</View> : null}
    </ScrollView>

    <AddVendorModal visible={addOpen} onClose={() => setAddOpen(false)} onSaved={async () => { setAddOpen(false); await load(); }} />
  </SafeAreaView>;
}

function AddVendorModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Other');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!businessName.trim()) { Alert.alert('Business name required', 'Enter a business name before saving.'); return; }
    setSaving(true);
    try {
      await createHostVendorProfile({ businessName, category, contactName, email, phone, serviceArea });
      setBusinessName(''); setCategory('Other'); setContactName(''); setEmail(''); setPhone(''); setServiceArea('');
      await onSaved();
    } catch (caught) {
      Alert.alert('Vendor not saved', caught instanceof Error ? caught.message : 'Try again.');
    } finally { setSaving(false); }
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>QUICK ADD</Text><Text style={styles.modalTitle}>Add Vendor</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>×</Text></Pressable></View>
        <Text style={styles.modalBody}>Start with the basics. You can complete the vendor record later.</Text>
        <Field label="Business name *" value={businessName} onChangeText={setBusinessName} placeholder="Business name" />
        <Field label="Category" value={category} onChangeText={setCategory} placeholder="Catering, Venue, Rentals…" />
        <Field label="Contact name" value={contactName} onChangeText={setContactName} placeholder="Primary contact" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="name@business.com" autoCapitalize="none" keyboardType="email-address" />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
        <Field label="Service area" value={serviceArea} onChangeText={setServiceArea} placeholder="Jacksonville, North Florida…" />
        <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} disabled={saving} onPress={() => void save()}><Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Vendor'}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; keyboardType?: 'default' | 'email-address' | 'phone-pad' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor="#6F7A73" style={styles.fieldInput} /></View>;
}

function VendorCard({ vendor }: { vendor: HostVendorProfile }) {
  const docs = vendorDocumentSummary(vendor);
  const setup = vendorSetupSummary(vendor);
  const initials = vendor.business_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const historyLabel = vendor.demo_event_count > 0 ? `Used for ${vendor.demo_event_count} ${vendor.is_demo ? 'demo ' : ''}event${vendor.demo_event_count === 1 ? '' : 's'}` : 'No event history yet';

  return <View style={[styles.vendorCard, vendor.is_demo && styles.vendorCardDemo]}>
    <View style={styles.vendorTop}>
      <View style={[styles.logoPlaceholder, vendor.is_demo && styles.logoPlaceholderDemo]}><Text style={styles.logoText}>{initials}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}><Text style={styles.vendorName}>{vendor.business_name}</Text>{vendor.is_demo ? <View style={styles.inlineDemo}><Text style={styles.inlineDemoText}>DEMO</Text></View> : null}</View>
        <Text style={styles.vendorCategory}>{vendor.category} · {vendor.service_area || 'Service area not set'}</Text>
      </View>
    </View>
    <View style={styles.infoRow}>
      <InfoPill text={historyLabel} />
      {vendor.rating != null ? <InfoPill text={`${vendor.rating.toFixed(1)} ★`} /> : null}
      <InfoPill text={setup} />
    </View>
    <View style={styles.cardFooter}>
      <Text style={[styles.docStatus, docs.pending > 0 && styles.docAttention]}>{docs.pending > 0 ? `${docs.pending} document${docs.pending === 1 ? '' : 's'} need follow-up` : docs.total > 0 ? `${docs.onFile}/${docs.total} documents on file` : 'No documents on file'}</Text>
      {(vendor.email || vendor.phone) ? <Text style={styles.contactReady}>Contact ready</Text> : <Text style={styles.contactMissing}>Contact needed</Text>}
    </View>
  </View>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function InfoPill({ text }: { text: string }) { return <View style={styles.infoPill}><Text style={styles.infoPillText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 72 }, back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  hero: { position: 'relative', overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#3A493F', backgroundColor: '#18251D', padding: 17 }, heroGlowOne: { position: 'absolute', width: 145, height: 145, borderRadius: 73, backgroundColor: '#294735', right: -48, top: -62, opacity: .75 }, eyebrow: { color: '#E3C468', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#C1CBC4', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 330 }, metrics: { flexDirection: 'row', gap: 8, marginTop: 13 }, metric: { flex: 1, borderRadius: 13, backgroundColor: 'rgba(9,16,12,.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', padding: 9 }, metricValue: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' }, metricLabel: { color: '#9EAAA2', fontSize: 8, fontWeight: '800', marginTop: 2 },
  searchWrap: { minHeight: 48, marginTop: 14, borderRadius: 15, borderWidth: 1, borderColor: '#35423A', backgroundColor: '#141B17', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }, searchIcon: { color: '#D7B45A', fontSize: 22, marginRight: 8 }, searchInput: { flex: 1, color: '#FFF8E8', fontSize: 12, paddingVertical: 12 }, clearSearch: { color: '#AEB8B1', fontSize: 22, paddingLeft: 10 },
  categoryFilters: { gap: 7, paddingVertical: 11 }, categoryChip: { borderRadius: 16, borderWidth: 1, borderColor: '#303C35', backgroundColor: '#111713', paddingHorizontal: 11, paddingVertical: 7 }, categoryChipActive: { borderColor: '#8A6A25', backgroundColor: '#342C17' }, categoryText: { color: '#929D96', fontSize: 9, fontWeight: '800' }, categoryTextActive: { color: '#E7C464' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, filters: { gap: 7, paddingRight: 6 }, filter: { borderRadius: 17, borderWidth: 1, borderColor: '#344039', backgroundColor: '#151B17', paddingHorizontal: 10, paddingVertical: 7 }, filterActive: { backgroundColor: '#3B3116', borderColor: '#8A6A25' }, filterText: { color: '#9BA69E', fontSize: 9, fontWeight: '900' }, filterTextActive: { color: '#E7C464' }, addButton: { borderRadius: 11, backgroundColor: '#D7B45A', paddingHorizontal: 10, paddingVertical: 9 }, addButtonText: { color: '#172017', fontSize: 9, fontWeight: '900' },
  demoBanner: { marginBottom: 13, borderRadius: 13, borderWidth: 1, borderColor: '#5E4B22', backgroundColor: '#211C11', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, demoBadge: { backgroundColor: '#D7B45A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 }, demoBadgeText: { color: '#1A1D18', fontSize: 7, fontWeight: '900', letterSpacing: .5 }, demoBody: { flex: 1, color: '#BBAF89', fontSize: 9, lineHeight: 13 },
  sectionHeader: { marginBottom: 9 }, sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, sectionMeta: { color: '#7E8A82', fontSize: 10, marginTop: 2 },
  loading: { alignItems: 'center', gap: 9, padding: 28 }, loadingText: { color: '#8D9991', fontSize: 11 }, errorCard: { borderRadius: 16, backgroundColor: '#241817', borderWidth: 1, borderColor: '#6B403B', padding: 15 }, errorTitle: { color: '#FFF0EC', fontSize: 14, fontWeight: '900' }, errorBody: { color: '#C7AAA5', fontSize: 10, lineHeight: 15, marginTop: 4 }, errorActions: { flexDirection: 'row', gap: 8, marginTop: 12 }, retryButton: { borderRadius: 10, backgroundColor: '#D7B45A', paddingHorizontal: 13, paddingVertical: 9 }, retryButtonText: { color: '#172017', fontSize: 9, fontWeight: '900' }, errorAddButton: { borderRadius: 10, borderWidth: 1, borderColor: '#72584B', paddingHorizontal: 13, paddingVertical: 9 }, errorAddText: { color: '#E8C7BD', fontSize: 9, fontWeight: '900' },
  empty: { alignItems: 'flex-start', borderRadius: 18, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#141A16', padding: 20 }, emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, emptyBody: { color: '#87928B', fontSize: 10, lineHeight: 15, marginTop: 5 }, emptyButton: { marginTop: 13, borderRadius: 10, backgroundColor: '#D7B45A', paddingHorizontal: 12, paddingVertical: 9 }, emptyButtonText: { color: '#172017', fontSize: 9, fontWeight: '900' },
  vendorList: { gap: 10 }, vendorCard: { borderRadius: 18, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#141A16', padding: 14 }, vendorCardDemo: { borderColor: '#5D512A', backgroundColor: '#171914' }, vendorTop: { flexDirection: 'row', gap: 11, alignItems: 'center' }, logoPlaceholder: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#26332B', alignItems: 'center', justifyContent: 'center' }, logoPlaceholderDemo: { backgroundColor: '#39331D' }, logoText: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }, vendorName: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', flexShrink: 1 }, inlineDemo: { borderRadius: 6, borderWidth: 1, borderColor: '#8A6A25', backgroundColor: '#302813', paddingHorizontal: 5, paddingVertical: 3 }, inlineDemoText: { color: '#E7C464', fontSize: 7, fontWeight: '900' }, vendorCategory: { color: '#8D9991', fontSize: 9, lineHeight: 13, marginTop: 3 }, infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }, infoPill: { borderRadius: 11, backgroundColor: '#202823', paddingHorizontal: 8, paddingVertical: 5 }, infoPillText: { color: '#AEB9B1', fontSize: 8, fontWeight: '800' }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#323A35', paddingTop: 11, marginTop: 11 }, docStatus: { color: '#87928B', fontSize: 9, flex: 1 }, docAttention: { color: '#E7C464', fontWeight: '800' }, contactReady: { color: '#8CC49A', fontSize: 8, fontWeight: '900' }, contactMissing: { color: '#A99C95', fontSize: 8, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.68)', justifyContent: 'flex-end' }, modalCard: { maxHeight: '92%', backgroundColor: '#121914', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#344039', padding: 20, paddingBottom: 32 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, modalEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, modalTitle: { color: '#FFF8E8', fontSize: 25, fontWeight: '900', marginTop: 2 }, modalClose: { color: '#AEB8B1', fontSize: 30, lineHeight: 30 }, modalBody: { color: '#939E97', fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 12 }, field: { marginTop: 9 }, fieldLabel: { color: '#C6D0C9', fontSize: 9, fontWeight: '800', marginBottom: 5 }, fieldInput: { borderRadius: 11, borderWidth: 1, borderColor: '#334038', backgroundColor: '#0C120E', color: '#FFF8E8', fontSize: 11, paddingHorizontal: 11, paddingVertical: 10 }, saveButton: { marginTop: 16, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', paddingVertical: 12 }, saveButtonDisabled: { opacity: .55 }, saveButtonText: { color: '#172017', fontSize: 11, fontWeight: '900' },
});
