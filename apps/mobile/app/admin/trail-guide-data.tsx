import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { trailGuidePlaces, type TrailGuideCityKey, type TrailGuidePlace } from '../../src/trailGuide/catalog';

const SOURCE_TYPES = [
  { key: 'official_website', label: 'Official page', priority: 90 },
  { key: 'official_rules', label: 'Rules / PDF', priority: 95 },
  { key: 'reservation', label: 'Reservation', priority: 85 },
] as const;

type SourceType = (typeof SOURCE_TYPES)[number]['key'];

type PlaceProfile = {
  place_id: string;
  display_name: string;
  category: string | null;
  operator_name: string | null;
  city: string | null;
  state: string | null;
  completeness_score: number | null;
  last_verified_at: string | null;
};

type SourceRow = {
  id: string;
  place_id: string;
  source_type: string;
  source_name: string;
  source_url: string;
  source_date: string | null;
  priority: number | null;
  status: string;
  last_checked_at: string | null;
  last_error: string | null;
};

type ConflictRow = {
  id: string;
  place_id: string;
  field_key: string;
  status: string;
};

type IngestResult = {
  placeId: string;
  placeName: string;
  extractedFacts: number;
  completeness: number;
  conflicts: string[];
  sources: Array<{
    sourceId: string;
    sourceName: string;
    status: string;
    facts?: number;
    warnings?: string[];
    error?: string;
  }>;
};

function cityLabel(city: TrailGuideCityKey) {
  const labels: Record<TrailGuideCityKey, string> = {
    jacksonville: 'Jacksonville',
    orlando: 'Orlando',
    miami: 'Miami',
    tampa: 'Tampa',
    'st-petersburg': 'St. Petersburg',
    'fort-lauderdale': 'Fort Lauderdale',
    'west-palm-beach': 'West Palm Beach',
    naples: 'Naples',
    'fort-myers': 'Fort Myers',
    sarasota: 'Sarasota',
  };
  return labels[city];
}

function formatDate(value: string | null) {
  if (!value) return 'Not checked yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not checked yet';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function schemaMissing(error: { code?: string | null } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

export default function TrailGuideDataAdminScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [profiles, setProfiles] = useState<PlaceProfile[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState('huguenot-memorial-park');
  const [search, setSearch] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('official_website');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [savingSource, setSavingSource] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [latestResult, setLatestResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState('');

  async function load() {
    if (!session?.user.id) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const adminResult = await supabase.rpc('is_platform_admin');
    if (adminResult.error) {
      setError(adminResult.error.message);
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const isAdmin = adminResult.data === true;
    setAuthorized(isAdmin);
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const [profileResult, sourceResult, conflictResult] = await Promise.all([
      supabase
        .from('trail_guide_place_profiles')
        .select('place_id,display_name,category,operator_name,city,state,completeness_score,last_verified_at')
        .order('display_name'),
      supabase
        .from('trail_guide_sources')
        .select('id,place_id,source_type,source_name,source_url,source_date,priority,status,last_checked_at,last_error')
        .order('priority', { ascending: false }),
      supabase
        .from('trail_guide_conflicts')
        .select('id,place_id,field_key,status')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
    ]);

    const missing = schemaMissing(profileResult.error) || schemaMissing(sourceResult.error) || schemaMissing(conflictResult.error);
    setSchemaReady(!missing);
    if (missing) {
      setProfiles([]);
      setSources([]);
      setConflicts([]);
      setLoading(false);
      return;
    }

    if (profileResult.error) setError(profileResult.error.message);
    else setProfiles((profileResult.data ?? []) as PlaceProfile[]);
    if (sourceResult.error) setError(sourceResult.error.message);
    else setSources((sourceResult.data ?? []) as SourceRow[]);
    if (conflictResult.error) setError(conflictResult.error.message);
    else setConflicts((conflictResult.data ?? []) as ConflictRow[]);

    const availableProfiles = (profileResult.data ?? []) as PlaceProfile[];
    if (availableProfiles.length && !availableProfiles.some((profile) => profile.place_id === selectedPlaceId)) {
      setSelectedPlaceId(availableProfiles[0].place_id);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [session?.user.id]);

  const selectedProfile = profiles.find((profile) => profile.place_id === selectedPlaceId) ?? null;
  const selectedSources = sources.filter((source) => source.place_id === selectedPlaceId);
  const selectedConflicts = conflicts.filter((conflict) => conflict.place_id === selectedPlaceId);

  const unconfiguredPlaces = useMemo(() => {
    const configured = new Set(profiles.map((profile) => profile.place_id));
    const query = search.trim().toLowerCase();
    return trailGuidePlaces
      .filter((place) => !configured.has(place.id))
      .filter((place) => !query || `${place.name} ${place.area} ${place.category}`.toLowerCase().includes(query))
      .slice(0, 12);
  }, [profiles, search]);

  async function initializePlace(place: TrailGuidePlace) {
    setError('');
    const { error: insertError } = await supabase.from('trail_guide_place_profiles').insert({
      place_id: place.id,
      display_name: place.name,
      category: place.category,
      city: cityLabel(place.city),
      state: 'FL',
      completeness_score: 0,
      is_published: true,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSelectedPlaceId(place.id);
    setSearch('');
    await load();
  }

  async function addSource() {
    if (!selectedProfile) return;
    const trimmedUrl = sourceUrl.trim();
    if (!/^https:\/\//i.test(trimmedUrl)) {
      Alert.alert('Use a public HTTPS URL', 'Add the official park page, rules PDF, or reservation URL.');
      return;
    }

    const definition = SOURCE_TYPES.find((item) => item.key === sourceType)!;
    setSavingSource(true);
    setError('');
    const { error: sourceError } = await supabase.from('trail_guide_sources').upsert({
      place_id: selectedProfile.place_id,
      source_type: sourceType,
      source_name: sourceName.trim() || `${selectedProfile.display_name} · ${definition.label}`,
      source_url: trimmedUrl,
      priority: definition.priority,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'place_id,source_url' });
    setSavingSource(false);

    if (sourceError) {
      setError(sourceError.message);
      return;
    }
    setSourceName('');
    setSourceUrl('');
    await load();
  }

  async function ingest() {
    if (!selectedProfile) return;
    setIngesting(true);
    setLatestResult(null);
    setError('');
    const { data, error: ingestError } = await supabase.functions.invoke('trail-guide-ingest', {
      body: { placeId: selectedProfile.place_id },
    });
    setIngesting(false);

    if (ingestError) {
      setError(ingestError.message);
      return;
    }
    if (data?.error) {
      setError(String(data.error));
      return;
    }
    setLatestResult(data as IngestResult);
    await load();
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.loadingText}>Loading Trail Guide data…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.deniedWrap}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Back</Text></Pressable><View style={styles.deniedCard}><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text><Text style={styles.bodyCopy}>Trail Guide source ingestion can change member-facing destination facts.</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Admin</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRAIL GUIDE DATA</Text>
          <Text style={styles.title}>Official-source ingestion</Text>
          <Text style={styles.bodyCopy}>Bring park pages, campground rules, and reservation information into structured Trail Guide fields. Unknown facts stay unknown.</Text>
        </View>

        {!schemaReady ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Database update required</Text>
            <Text style={styles.warningText}>The Trail Guide ingestion migration has not reached this environment yet. Deploy the migration before adding or refreshing sources.</Text>
          </View>
        ) : null}

        {schemaReady ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DESTINATIONS IN THE PIPELINE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeChips}>
                {profiles.map((profile) => {
                  const active = profile.place_id === selectedPlaceId;
                  return <Pressable key={profile.place_id} onPress={() => { setSelectedPlaceId(profile.place_id); setLatestResult(null); }} style={[styles.placeChip, active && styles.placeChipActive]}><Text style={[styles.placeChipText, active && styles.placeChipTextActive]}>{profile.display_name}</Text></Pressable>;
                })}
              </ScrollView>
            </View>

            {selectedProfile ? (
              <View style={styles.profileCard}>
                <View style={styles.profileTop}>
                  <View style={styles.flex}>
                    <Text style={styles.profileName}>{selectedProfile.display_name}</Text>
                    <Text style={styles.profileMeta}>{[selectedProfile.operator_name, selectedProfile.city, selectedProfile.state].filter(Boolean).join(' · ') || selectedProfile.category || 'Trail Guide place'}</Text>
                  </View>
                  <View style={styles.score}><Text style={styles.scoreValue}>{selectedProfile.completeness_score ?? 0}%</Text><Text style={styles.scoreLabel}>COMPLETE</Text></View>
                </View>
                <View style={styles.metrics}>
                  <View style={styles.metric}><Text style={styles.metricValue}>{selectedSources.length}</Text><Text style={styles.metricLabel}>Sources</Text></View>
                  <View style={styles.metric}><Text style={styles.metricValue}>{selectedConflicts.length}</Text><Text style={styles.metricLabel}>Conflicts</Text></View>
                  <View style={styles.metric}><Text style={styles.metricValue}>{formatDate(selectedProfile.last_verified_at)}</Text><Text style={styles.metricLabel}>Verified</Text></View>
                </View>
                <Pressable disabled={ingesting || selectedSources.length === 0} onPress={() => void ingest()} style={[styles.refreshButton, (ingesting || selectedSources.length === 0) && styles.disabled]}>
                  {ingesting ? <ActivityIndicator color="#17211C" size="small" /> : null}
                  <Text style={styles.refreshButtonText}>{ingesting ? 'Reading official sources…' : 'Refresh official sources'}</Text>
                </Pressable>
              </View>
            ) : null}

            {latestResult ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Refresh complete</Text>
                <Text style={styles.resultLine}>{latestResult.extractedFacts} supported facts extracted · {latestResult.completeness}% core completeness</Text>
                <Text style={styles.resultLine}>{latestResult.conflicts.length ? `${latestResult.conflicts.length} field conflict${latestResult.conflicts.length === 1 ? '' : 's'} need review.` : 'No source conflicts detected.'}</Text>
                {latestResult.sources.filter((item) => item.status === 'failed').map((item) => <Text key={item.sourceId} style={styles.resultError}>{item.sourceName}: {item.error}</Text>)}
              </View>
            ) : null}

            {selectedProfile ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>OFFICIAL SOURCES</Text>
                <View style={styles.card}>
                  {selectedSources.length ? selectedSources.map((source, index) => (
                    <View key={source.id} style={[styles.sourceRow, index > 0 && styles.divider]}>
                      <View style={styles.flex}>
                        <View style={styles.sourceTitleRow}><Text style={styles.sourceName}>{source.source_name}</Text><View style={[styles.statusPill, source.status === 'failed' && styles.statusPillFailed]}><Text style={[styles.statusText, source.status === 'failed' && styles.statusTextFailed]}>{source.status.toUpperCase()}</Text></View></View>
                        <Text style={styles.sourceMeta}>{source.source_type.replace(/_/g, ' ')} · Priority {source.priority ?? 0} · {formatDate(source.last_checked_at)}</Text>
                        <Text numberOfLines={2} style={styles.sourceUrl}>{source.source_url}</Text>
                        {source.last_error ? <Text style={styles.sourceError}>{source.last_error}</Text> : null}
                      </View>
                    </View>
                  )) : <View style={styles.emptyPad}><Text style={styles.emptyText}>No source URLs yet. Add the official destination page first.</Text></View>}
                </View>
              </View>
            ) : null}

            {selectedProfile ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ADD SOURCE</Text>
                <View style={styles.formCard}>
                  <View style={styles.typeRow}>{SOURCE_TYPES.map((item) => <Pressable key={item.key} onPress={() => setSourceType(item.key)} style={[styles.typeChip, sourceType === item.key && styles.typeChipActive]}><Text style={[styles.typeChipText, sourceType === item.key && styles.typeChipTextActive]}>{item.label}</Text></Pressable>)}</View>
                  <TextInput value={sourceName} onChangeText={setSourceName} placeholder="Source name, optional" placeholderTextColor="#6F7B74" style={styles.input} />
                  <TextInput value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://official-source.gov/..." placeholderTextColor="#6F7B74" style={styles.input} />
                  <Pressable disabled={savingSource || !sourceUrl.trim()} onPress={() => void addSource()} style={[styles.addButton, (savingSource || !sourceUrl.trim()) && styles.disabled]}><Text style={styles.addButtonText}>{savingSource ? 'Saving…' : 'Add official source'}</Text></Pressable>
                </View>
              </View>
            ) : null}

            {selectedConflicts.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>NEEDS REVIEW</Text>
                <View style={styles.conflictCard}>{selectedConflicts.map((conflict) => <View key={conflict.id} style={styles.conflictRow}><View style={styles.conflictDot} /><Text style={styles.conflictText}>{conflict.field_key.replace(/\./g, ' ')}</Text></View>)}</View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ADD A TRAIL GUIDE PLACE</Text>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search current Trail Guide destinations" placeholderTextColor="#6F7B74" style={styles.input} />
              {search.trim() ? <View style={styles.searchResults}>{unconfiguredPlaces.map((place) => <Pressable key={place.id} onPress={() => void initializePlace(place)} style={styles.searchRow}><View style={styles.flex}><Text style={styles.searchName}>{place.name}</Text><Text style={styles.searchMeta}>{place.category} · {place.area}</Text></View><Text style={styles.setupText}>Set up</Text></Pressable>)}{!unconfiguredPlaces.length ? <Text style={styles.emptyText}>No unconfigured destination matches that search.</Text> : null}</View> : null}
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 54 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#A9B4AD', fontSize: 13, fontWeight: '700' },
  deniedWrap: { flex: 1, padding: 20 },
  deniedCard: { marginTop: 28, borderRadius: 18, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#38463E', padding: 18, gap: 7 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  header: { marginTop: 8, marginBottom: 22, gap: 5 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 35, fontWeight: '900' },
  bodyCopy: { color: '#9EAAA3', fontSize: 13, lineHeight: 19 },
  warningCard: { borderRadius: 16, borderWidth: 1, borderColor: '#715F2D', backgroundColor: '#292414', padding: 15, marginBottom: 20, gap: 5 },
  warningTitle: { color: '#F2D675', fontSize: 14, fontWeight: '900' },
  warningText: { color: '#C4B889', fontSize: 11, lineHeight: 17 },
  section: { marginBottom: 22 },
  sectionLabel: { color: '#7F8C84', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  placeChips: { gap: 7, paddingRight: 12 },
  placeChip: { borderRadius: 999, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151C18', paddingHorizontal: 11, paddingVertical: 8 },
  placeChipActive: { borderColor: '#D7B45A', backgroundColor: '#2A2718' },
  placeChipText: { color: '#AAB5AE', fontSize: 10, fontWeight: '800' },
  placeChipTextActive: { color: '#F1D679' },
  profileCard: { borderRadius: 20, borderWidth: 1, borderColor: '#3A493F', backgroundColor: '#17211C', padding: 15, gap: 14, marginBottom: 22 },
  profileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  profileName: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  profileMeta: { color: '#8F9A93', fontSize: 10, lineHeight: 15, marginTop: 3 },
  score: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#222417', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: '#F1D679', fontSize: 16, fontWeight: '900' },
  scoreLabel: { color: '#968A5C', fontSize: 6, fontWeight: '900', letterSpacing: 0.5 },
  metrics: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2B3730', paddingTop: 11 },
  metric: { flex: 1, gap: 2 },
  metricValue: { color: '#DEE5E0', fontSize: 11, fontWeight: '900' },
  metricLabel: { color: '#718078', fontSize: 8, fontWeight: '800' },
  refreshButton: { minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  refreshButtonText: { color: '#17211C', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  resultCard: { borderRadius: 15, borderWidth: 1, borderColor: '#31513A', backgroundColor: '#102017', padding: 13, marginBottom: 22, gap: 4 },
  resultTitle: { color: '#AEE5A3', fontSize: 13, fontWeight: '900' },
  resultLine: { color: '#AFC4B4', fontSize: 10, lineHeight: 15 },
  resultError: { color: '#F1ACA2', fontSize: 9, lineHeight: 14 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#151D18', overflow: 'hidden' },
  sourceRow: { padding: 13 },
  divider: { borderTopWidth: 1, borderTopColor: '#29362F' },
  sourceTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sourceName: { flex: 1, color: '#E8EEE9', fontSize: 12, fontWeight: '900' },
  sourceMeta: { color: '#7D8982', fontSize: 8, marginTop: 4, textTransform: 'capitalize' },
  sourceUrl: { color: '#9AAF9F', fontSize: 8, lineHeight: 12, marginTop: 5 },
  sourceError: { color: '#ECA39B', fontSize: 8, lineHeight: 12, marginTop: 5 },
  statusPill: { borderRadius: 999, borderWidth: 1, borderColor: '#356340', backgroundColor: '#14291A', paddingHorizontal: 6, paddingVertical: 3 },
  statusPillFailed: { borderColor: '#6C3C35', backgroundColor: '#2A1816' },
  statusText: { color: '#8ED585', fontSize: 6, fontWeight: '900' },
  statusTextFailed: { color: '#ECA39B' },
  emptyPad: { padding: 14 },
  emptyText: { color: '#7F8B84', fontSize: 10, lineHeight: 15 },
  formCard: { borderRadius: 16, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#151D18', padding: 13, gap: 9 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { borderRadius: 999, borderWidth: 1, borderColor: '#354139', paddingHorizontal: 9, paddingVertical: 7 },
  typeChipActive: { borderColor: '#D7B45A', backgroundColor: '#2B2818' },
  typeChipText: { color: '#9CA7A0', fontSize: 9, fontWeight: '800' },
  typeChipTextActive: { color: '#F1D679' },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#344139', backgroundColor: '#101713', color: '#EDF1EE', paddingHorizontal: 12, fontSize: 11 },
  addButton: { minHeight: 43, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#17211C', fontSize: 10, fontWeight: '900' },
  conflictCard: { borderRadius: 15, borderWidth: 1, borderColor: '#694F2F', backgroundColor: '#241E14', padding: 12, gap: 8 },
  conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  conflictDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E6B95D' },
  conflictText: { color: '#DCCB9D', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  searchResults: { marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#151D18', overflow: 'hidden' },
  searchRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: '#29362F', paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchName: { color: '#E5EBE7', fontSize: 11, fontWeight: '900' },
  searchMeta: { color: '#7F8B84', fontSize: 8, marginTop: 3 },
  setupText: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  errorText: { color: '#FFB4A9', fontSize: 11, lineHeight: 17, marginTop: 5 },
});
