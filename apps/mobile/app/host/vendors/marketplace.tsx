import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listMarketplaceVendors,
  listSavedVendorIds,
  removeSavedMarketplaceVendor,
  saveMarketplaceVendor,
  vendorAvailabilityLabel,
  vendorSetupSummary,
  vendorVerificationLabel,
  type HostVendorProfile,
} from '../../../src/hosting/vendors';

type AvailabilityFilter = 'all' | 'available' | 'limited' | 'booking_ahead';
type MarketplaceIntent = 'all' | 'services' | 'vending';

const PRIMARY_CATEGORIES = [
  'All',
  'Food & Beverage',
  'Retail & Sales',
  'Entertainment',
  'Event Services',
  'Wellness & Activities',
  'Venues & Lodging',
];

const VENDING_SUBCATEGORIES = new Set([
  'Food Trucks',
  'Desserts',
  'Coffee',
  'Jewelry',
  'Apparel',
  'Art',
  'Gifts',
]);

function vendorSupportsServices(vendor: HostVendorProfile) {
  return vendor.vendor_kind === 'service' || vendor.vendor_kind === 'venue';
}

function vendorSupportsVending(vendor: HostVendorProfile) {
  if (vendor.vendor_kind === 'product') return true;
  if (vendor.marketplace_category === 'Food & Beverage') return true;
  return VENDING_SUBCATEGORIES.has(vendor.marketplace_subcategory ?? '');
}

function vendorMatchesIntent(vendor: HostVendorProfile, intent: MarketplaceIntent) {
  if (intent === 'services') return vendorSupportsServices(vendor);
  if (intent === 'vending') return vendorSupportsVending(vendor);
  return true;
}

function vendorRoleLabel(vendor: HostVendorProfile) {
  const services = vendorSupportsServices(vendor);
  const vending = vendorSupportsVending(vendor);
  if (services && vending) return 'FOR HIRE · EVENT VENDOR';
  if (vending) return 'EVENT VENDOR';
  return 'FOR HIRE';
}

export default function HostMarketplaceScreen() {
  const [vendors, setVendors] = useState<HostVendorProfile[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [intent, setIntent] = useState<MarketplaceIntent>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [subcategory, setSubcategory] = useState('All');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [marketplace, saved] = await Promise.all([listMarketplaceVendors(), listSavedVendorIds()]);
      setVendors(marketplace);
      setSavedIds(saved);
    } catch {
      setError('We couldn’t load the marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const intentVendors = useMemo(
    () => vendors.filter((vendor) => vendorMatchesIntent(vendor, intent)),
    [intent, vendors],
  );

  const subcategories = useMemo(() => {
    const source = category === 'All'
      ? intentVendors
      : intentVendors.filter((vendor) => vendor.marketplace_category === category);
    return ['All', ...Array.from(new Set(source.map((vendor) => vendor.marketplace_subcategory).filter(Boolean) as string[])).sort()];
  }, [category, intentVendors]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return intentVendors.filter((vendor) => {
      if (category !== 'All' && vendor.marketplace_category !== category) return false;
      if (subcategory !== 'All' && vendor.marketplace_subcategory !== subcategory) return false;
      if (availability !== 'all' && vendor.availability_status !== availability) return false;
      if (!query) return true;
      return [
        vendor.business_name,
        vendor.marketplace_category,
        vendor.marketplace_subcategory,
        vendor.description,
        vendor.service_area,
        vendorRoleLabel(vendor),
        ...(vendor.event_types ?? []),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [availability, category, intentVendors, search, subcategory]);

  const featured = useMemo(() => filtered.filter((vendor) => vendor.featured).slice(0, 5), [filtered]);
  const serviceCount = vendors.filter(vendorSupportsServices).length;
  const vendingCount = vendors.filter(vendorSupportsVending).length;
  const availableCount = vendors.filter((vendor) => vendor.availability_status === 'available').length;

  const selectIntent = (value: MarketplaceIntent) => {
    setIntent(value);
    setCategory('All');
    setSubcategory('All');
  };

  const selectCategory = (value: string) => {
    setCategory(value);
    setSubcategory('All');
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setSubcategory('All');
    setAvailability('all');
  };

  const toggleSaved = async (vendor: HostVendorProfile) => {
    const isSaved = savedIds.includes(vendor.id);
    setSavingId(vendor.id);
    try {
      if (isSaved) {
        await removeSavedMarketplaceVendor(vendor.id);
        setSavedIds((current) => current.filter((id) => id !== vendor.id));
      } else {
        await saveMarketplaceVendor(vendor.id);
        setSavedIds((current) => [...current, vendor.id]);
      }
    } catch (caught) {
      Alert.alert('Vendor not updated', caught instanceof Error ? caught.message : 'Try again.');
    } finally {
      setSavingId(null);
    }
  };

  const intentTitle = intent === 'services' ? 'Services for hire' : intent === 'vending' ? 'Event vendors' : 'All businesses';

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>HOST CENTER · MARKETPLACE</Text>
        <Text style={styles.title}>Find the right businesses for your event.</Text>
        <Text style={styles.subtitle}>Hire event services or find businesses that want to vend at your event. Some businesses can do both.</Text>
        <View style={styles.metrics}>
          <Metric value={String(serviceCount)} label="For hire" />
          <Metric value={String(vendingCount)} label="Event vendors" />
          <Metric value={String(availableCount)} label="Available now" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workspaceNav}>
        <NavButton label="Discover" active onPress={() => undefined} />
        <NavButton label="My Vendors" onPress={() => router.push('/host/vendors' as never)} />
        <NavButton label="Opportunities" onPress={() => router.push('/host/opportunities' as never)} />
        <NavButton label="Messages" onPress={() => router.push('/host/communications' as never)} />
      </ScrollView>

      <View style={styles.intentCard}>
        <Text style={styles.intentEyebrow}>WHAT DO YOU NEED?</Text>
        <Text style={styles.intentTitle}>Choose how this business will participate.</Text>
        <View style={styles.intentRow}>
          <IntentButton label="All" caption="See everything" active={intent === 'all'} onPress={() => selectIntent('all')} />
          <IntentButton label="Hire a Service" caption="DJ, catering, rentals…" active={intent === 'services'} onPress={() => selectIntent('services')} />
          <IntentButton label="Find Event Vendors" caption="Food, jewelry, apparel…" active={intent === 'vending'} onPress={() => selectIntent('vending')} />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={intent === 'vending' ? 'Search food, jewelry, apparel, gifts…' : intent === 'services' ? 'Search DJs, catering, venues, rentals…' : 'Search vendors, services, products or location…'}
          placeholderTextColor="#758078"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search ? <Pressable onPress={() => setSearch('')}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
      </View>

      <Text style={styles.filterLabel}>CATEGORY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PRIMARY_CATEGORIES.map((item) => <FilterChip key={item} label={item} active={category === item} onPress={() => selectCategory(item)} />)}
      </ScrollView>

      {subcategories.length > 1 ? <>
        <Text style={styles.filterLabel}>SUBCATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {subcategories.map((item) => <FilterChip key={item} label={item} active={subcategory === item} onPress={() => setSubcategory(item)} />)}
        </ScrollView>
      </> : null}

      <Text style={styles.filterLabel}>AVAILABILITY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label="Any" active={availability === 'all'} onPress={() => setAvailability('all')} />
        <FilterChip label="Available now" active={availability === 'available'} onPress={() => setAvailability('available')} />
        <FilterChip label="Limited" active={availability === 'limited'} onPress={() => setAvailability('limited')} />
        <FilterChip label="Booking ahead" active={availability === 'booking_ahead'} onPress={() => setAvailability('booking_ahead')} />
      </ScrollView>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Loading marketplace…</Text></View> : null}
      {!loading && error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>{error}</Text><Text style={styles.errorBody}>Try again. Your private vendor list is still available.</Text><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try Again</Text></Pressable></View> : null}

      {!loading && !error && featured.length > 0 && category === 'All' && subcategory === 'All' && !search ? <View style={styles.section}>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>FEATURED</Text><Text style={styles.sectionTitle}>{intentTitle}</Text></View><Text style={styles.sectionCount}>{featured.length}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {featured.map((vendor) => <FeaturedVendorCard key={vendor.id} vendor={vendor} intent={intent} saved={savedIds.includes(vendor.id)} saving={savingId === vendor.id} onSave={() => void toggleSaved(vendor)} />)}
        </ScrollView>
      </View> : null}

      {!loading && !error ? <View style={styles.section}>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>DISCOVER</Text><Text style={styles.sectionTitle}>{intentTitle}</Text></View><Text style={styles.sectionCount}>{filtered.length}</Text></View>
        {filtered.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No businesses match this view</Text><Text style={styles.emptyBody}>Clear a filter or search another service, product, category or location.</Text><Pressable style={styles.secondaryButton} onPress={clearFilters}><Text style={styles.secondaryButtonText}>Clear Filters</Text></Pressable></View> : null}
        <View style={styles.vendorList}>{filtered.map((vendor) => <MarketplaceVendorCard key={vendor.id} vendor={vendor} intent={intent} saved={savedIds.includes(vendor.id)} saving={savingId === vendor.id} onSave={() => void toggleSaved(vendor)} />)}</View>
      </View> : null}

      <View style={styles.privateCard}>
        <Text style={styles.privateEyebrow}>MY VENDORS</Text>
        <Text style={styles.privateTitle}>Move relationships into your working list.</Text>
        <Text style={styles.privateBody}>Keep private contacts, documents, notes, quotes and relationship history once you start working with a business.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/host/vendors' as never)}><Text style={styles.secondaryButtonText}>Open My Vendors</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function MarketplaceVendorCard({ vendor, intent, saved, saving, onSave }: { vendor: HostVendorProfile; intent: MarketplaceIntent; saved: boolean; saving: boolean; onSave: () => void }) {
  const initials = vendor.business_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const travel = vendor.travel_radius_miles ? `Travels ${vendor.travel_radius_miles} mi` : vendor.service_area || 'Area varies';
  const vendingView = intent === 'vending' || (intent === 'all' && vendorSupportsVending(vendor) && !vendorSupportsServices(vendor));

  return <View style={styles.vendorCard}>
    <View style={styles.vendorTop}>
      <View style={styles.logo}><Text style={styles.logoText}>{initials}</Text></View>
      <View style={styles.vendorHeading}>
        <View style={styles.nameRow}><Text style={styles.vendorName}>{vendor.business_name}</Text>{vendor.is_demo ? <Badge text="DEMO" tone="demo" /> : null}</View>
        <Text style={styles.vendorCategory}>{vendor.marketplace_subcategory || vendor.category} · {vendor.service_area || 'Area varies'}</Text>
      </View>
      <Pressable style={[styles.saveIcon, saved && styles.saveIconActive]} disabled={saving} onPress={onSave}><Text style={[styles.saveIconText, saved && styles.saveIconTextActive]}>{saving ? '…' : saved ? '★' : '☆'}</Text></Pressable>
    </View>

    <View style={styles.roleRow}><Badge text={vendorRoleLabel(vendor)} tone="role" /></View>
    {vendor.description ? <Text style={styles.vendorDescription} numberOfLines={2}>{vendor.description}</Text> : null}

    <View style={styles.badgeRow}>
      <Badge text={vendorAvailabilityLabel(vendor.availability_status)} tone={vendor.availability_status === 'available' ? 'good' : 'neutral'} />
      <Badge text={vendorVerificationLabel(vendor.verification_status)} tone={vendor.verification_status.includes('verified') ? 'verified' : 'neutral'} />
      {vendor.rating != null ? <Badge text={`${vendor.rating.toFixed(1)} ★`} tone="neutral" /> : null}
    </View>

    <View style={styles.detailsGrid}>
      <Detail label={vendingView ? 'PRICE RANGE' : 'STARTING PRICE'} value={vendor.starting_price_text || (vendingView ? 'Ask vendor' : 'Request quote')} />
      <Detail label="TRAVEL" value={travel} />
      <Detail label={vendingView ? 'BOOTH / SETUP' : 'SETUP'} value={vendorSetupSummary(vendor)} />
      <Detail label="RESPONSE" value={vendor.response_time_text || 'Contact vendor'} />
    </View>

    {vendor.event_types?.length ? <Text style={styles.eventTypes}>Good for: {vendor.event_types.slice(0, 3).join(' · ')}</Text> : null}

    <View style={styles.cardActions}>
      <Pressable style={styles.primaryAction} onPress={() => router.push('/host/communications' as never)}><Text style={styles.primaryActionText}>{vendingView ? 'Invite to Vend' : 'Request Quote'}</Text></Pressable>
      <Pressable style={styles.secondaryAction} onPress={onSave} disabled={saving}><Text style={styles.secondaryActionText}>{saved ? 'Saved' : 'Save'}</Text></Pressable>
    </View>
  </View>;
}

function FeaturedVendorCard({ vendor, intent, saved, saving, onSave }: { vendor: HostVendorProfile; intent: MarketplaceIntent; saved: boolean; saving: boolean; onSave: () => void }) {
  const vendingView = intent === 'vending' || (intent === 'all' && vendorSupportsVending(vendor) && !vendorSupportsServices(vendor));
  return <View style={styles.featuredCard}>
    <Text style={styles.featuredCategory}>{vendorRoleLabel(vendor)}</Text>
    <Text style={styles.featuredName}>{vendor.business_name}</Text>
    <Text style={styles.featuredMeta}>{vendor.marketplace_subcategory || vendor.category} · {vendor.service_area || 'Area varies'}</Text>
    <View style={styles.featuredStatus}><Text style={styles.featuredStatusText}>{vendorAvailabilityLabel(vendor.availability_status)}</Text></View>
    <Text style={styles.featuredPrice}>{vendor.starting_price_text || (vendingView ? 'Ask vendor' : 'Request quote')}</Text>
    <View style={styles.featuredActions}>
      <Pressable style={styles.featuredPrimary} onPress={() => router.push('/host/communications' as never)}><Text style={styles.featuredPrimaryText}>{vendingView ? 'Invite' : 'Quote'}</Text></Pressable>
      <Pressable style={[styles.featuredSave, saved && styles.featuredSaveActive]} disabled={saving} onPress={onSave}><Text style={styles.featuredSaveText}>{saving ? '…' : saved ? 'Saved ★' : 'Save ☆'}</Text></Pressable>
    </View>
  </View>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function NavButton({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) { return <Pressable style={[styles.navButton, active && styles.navButtonActive]} onPress={onPress}><Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>{label}</Text></Pressable>; }
function IntentButton({ label, caption, active, onPress }: { label: string; caption: string; active: boolean; onPress: () => void }) { return <Pressable style={[styles.intentButton, active && styles.intentButtonActive]} onPress={onPress}><Text style={[styles.intentButtonLabel, active && styles.intentButtonLabelActive]}>{label}</Text><Text style={styles.intentButtonCaption}>{caption}</Text></Pressable>; }
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function Badge({ text, tone }: { text: string; tone: 'demo' | 'good' | 'verified' | 'neutral' | 'role' }) { return <View style={[styles.badge, tone === 'demo' && styles.badgeDemo, tone === 'good' && styles.badgeGood, tone === 'verified' && styles.badgeVerified, tone === 'role' && styles.badgeRole]}><Text style={[styles.badgeText, tone === 'demo' && styles.badgeTextDemo, tone === 'good' && styles.badgeTextGood, tone === 'verified' && styles.badgeTextVerified, tone === 'role' && styles.badgeTextRole]}>{text}</Text></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue} numberOfLines={2}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 80 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  hero: { position: 'relative', overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#3B4A40', backgroundColor: '#18261D', padding: 18 },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -60, top: -80, backgroundColor: '#31553D', opacity: 0.72 },
  eyebrow: { color: '#E3C468', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 32, fontWeight: '900', maxWidth: 320, marginTop: 5 },
  subtitle: { color: '#BCC8C0', fontSize: 11, lineHeight: 16, maxWidth: 350, marginTop: 7 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 15 },
  metric: { flex: 1, backgroundColor: 'rgba(8,15,11,.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)', borderRadius: 13, padding: 9 },
  metricValue: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  metricLabel: { color: '#99A69D', fontSize: 8, fontWeight: '800', marginTop: 2 },
  workspaceNav: { gap: 7, paddingVertical: 13 },
  navButton: { borderRadius: 17, borderWidth: 1, borderColor: '#354139', backgroundColor: '#131A16', paddingHorizontal: 13, paddingVertical: 8 },
  navButtonActive: { borderColor: '#8B6D2B', backgroundColor: '#352D19' },
  navButtonText: { color: '#9DA8A1', fontSize: 9, fontWeight: '900' },
  navButtonTextActive: { color: '#E8C86C' },
  intentCard: { borderRadius: 18, borderWidth: 1, borderColor: '#35423A', backgroundColor: '#131B16', padding: 13, marginBottom: 12 },
  intentEyebrow: { color: '#C19D45', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  intentTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 3, marginBottom: 10 },
  intentRow: { flexDirection: 'row', gap: 7 },
  intentButton: { flex: 1, minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#0F1511', padding: 9 },
  intentButtonActive: { borderColor: '#8A6A25', backgroundColor: '#342C17' },
  intentButtonLabel: { color: '#D4DBD6', fontSize: 10, fontWeight: '900' },
  intentButtonLabelActive: { color: '#E7C464' },
  intentButtonCaption: { color: '#7F8B83', fontSize: 8, lineHeight: 11, marginTop: 4 },
  searchWrap: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#35423A', backgroundColor: '#141B17', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  searchIcon: { color: '#D7B45A', fontSize: 22, marginRight: 8 },
  searchInput: { flex: 1, color: '#FFF8E8', fontSize: 12, paddingVertical: 13 },
  clearSearch: { color: '#AAB5AD', fontSize: 22, paddingLeft: 10 },
  filterLabel: { color: '#748078', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 13, marginBottom: 6 },
  chipRow: { gap: 7, paddingRight: 8 },
  chip: { borderRadius: 16, borderWidth: 1, borderColor: '#303D35', backgroundColor: '#111713', paddingHorizontal: 11, paddingVertical: 7 },
  chipActive: { borderColor: '#8A6A25', backgroundColor: '#342C17' },
  chipText: { color: '#929D96', fontSize: 9, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  loading: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  loadingText: { color: '#8E9992', fontSize: 10 },
  errorCard: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: '#7B4B42', backgroundColor: '#2B1715', padding: 16 },
  errorTitle: { color: '#FFD4CB', fontSize: 14, fontWeight: '900' },
  errorBody: { color: '#CBA9A1', fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 11 },
  primaryButton: { alignSelf: 'flex-start', borderRadius: 13, backgroundColor: '#D7B45A', paddingHorizontal: 14, paddingVertical: 9 },
  primaryButtonText: { color: '#17140C', fontSize: 9, fontWeight: '900' },
  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  sectionEyebrow: { color: '#C19D45', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 2 },
  sectionCount: { color: '#7F8B83', fontSize: 10, fontWeight: '800' },
  featuredRow: { gap: 10, paddingRight: 8 },
  featuredCard: { width: 220, minHeight: 205, borderRadius: 19, borderWidth: 1, borderColor: '#5B4A23', backgroundColor: '#221F14', padding: 14 },
  featuredCategory: { color: '#D5B45D', fontSize: 8, fontWeight: '900' },
  featuredName: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 5 },
  featuredMeta: { color: '#9DA89F', fontSize: 9, lineHeight: 13, marginTop: 4 },
  featuredStatus: { alignSelf: 'flex-start', borderRadius: 10, backgroundColor: '#1C3827', paddingHorizontal: 8, paddingVertical: 5, marginTop: 10 },
  featuredStatusText: { color: '#91D6A7', fontSize: 8, fontWeight: '900' },
  featuredPrice: { color: '#E8CA73', fontSize: 11, fontWeight: '900', marginTop: 10 },
  featuredActions: { flexDirection: 'row', gap: 7, marginTop: 'auto' },
  featuredPrimary: { flex: 1, borderRadius: 11, backgroundColor: '#D7B45A', paddingVertical: 8, alignItems: 'center' },
  featuredPrimaryText: { color: '#17140C', fontSize: 9, fontWeight: '900' },
  featuredSave: { flex: 1, borderRadius: 11, borderWidth: 1, borderColor: '#5B5136', paddingVertical: 8, alignItems: 'center' },
  featuredSaveActive: { backgroundColor: '#3A311A', borderColor: '#8A6A25' },
  featuredSaveText: { color: '#E5C76E', fontSize: 9, fontWeight: '900' },
  vendorList: { gap: 10 },
  vendorCard: { borderRadius: 20, borderWidth: 1, borderColor: '#314038', backgroundColor: '#131A16', padding: 14 },
  vendorTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#273D2E', borderWidth: 1, borderColor: '#45634E', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#E6C869', fontSize: 13, fontWeight: '900' },
  vendorHeading: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  vendorName: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', flexShrink: 1 },
  vendorCategory: { color: '#96A199', fontSize: 9, marginTop: 3 },
  saveIcon: { width: 35, height: 35, borderRadius: 12, borderWidth: 1, borderColor: '#36433B', alignItems: 'center', justifyContent: 'center' },
  saveIconActive: { backgroundColor: '#352D18', borderColor: '#8A6A25' },
  saveIconText: { color: '#98A39B', fontSize: 18 },
  saveIconTextActive: { color: '#E2C467' },
  roleRow: { flexDirection: 'row', marginTop: 10 },
  vendorDescription: { color: '#BCC6BF', fontSize: 10, lineHeight: 15, marginTop: 9 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { borderRadius: 10, borderWidth: 1, borderColor: '#3C4740', backgroundColor: '#1B211D', paddingHorizontal: 7, paddingVertical: 4 },
  badgeGood: { borderColor: '#315A3E', backgroundColor: '#173121' },
  badgeVerified: { borderColor: '#5D512A', backgroundColor: '#302A18' },
  badgeDemo: { borderColor: '#514A38', backgroundColor: '#26231B' },
  badgeRole: { borderColor: '#38516D', backgroundColor: '#182536' },
  badgeText: { color: '#AEB8B1', fontSize: 7, fontWeight: '900' },
  badgeTextGood: { color: '#8CD5A4' },
  badgeTextVerified: { color: '#E1C367' },
  badgeTextDemo: { color: '#C8B98A' },
  badgeTextRole: { color: '#9EC5EC' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  detail: { width: '48%', borderRadius: 11, backgroundColor: '#0F1511', borderWidth: 1, borderColor: '#26322B', padding: 8 },
  detailLabel: { color: '#68756D', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  detailValue: { color: '#D7DED9', fontSize: 9, fontWeight: '700', marginTop: 3 },
  eventTypes: { color: '#829087', fontSize: 8, marginTop: 9 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryAction: { flex: 1, borderRadius: 12, backgroundColor: '#D7B45A', paddingVertical: 10, alignItems: 'center' },
  primaryActionText: { color: '#17140C', fontSize: 9, fontWeight: '900' },
  secondaryAction: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#4A554E', paddingVertical: 10, alignItems: 'center' },
  secondaryActionText: { color: '#D7DED9', fontSize: 9, fontWeight: '900' },
  empty: { borderRadius: 17, borderWidth: 1, borderColor: '#2F3B34', backgroundColor: '#111713', padding: 16 },
  emptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  emptyBody: { color: '#8E9A92', fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 10 },
  secondaryButton: { alignSelf: 'flex-start', borderRadius: 12, borderWidth: 1, borderColor: '#786329', paddingHorizontal: 12, paddingVertical: 9 },
  secondaryButtonText: { color: '#E3C469', fontSize: 9, fontWeight: '900' },
  privateCard: { marginTop: 24, borderRadius: 20, borderWidth: 1, borderColor: '#304039', backgroundColor: '#162019', padding: 16 },
  privateEyebrow: { color: '#7E8A82', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  privateTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 4 },
  privateBody: { color: '#9DA9A1', fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 11 },
});
