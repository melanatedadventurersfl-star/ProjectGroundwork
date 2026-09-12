import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

const PHOTO_BUCKET = 'trail-guide-photos';
const SOURCE_TYPES = [
  ['official', 'Official'],
  ['admin', 'Admin selected'],
  ['curated', 'Curated'],
] as const;

type SourceType = (typeof SOURCE_TYPES)[number][0];

type PlaceProfile = {
  place_id: string;
  display_name: string;
  city: string | null;
  state: string | null;
  hero_candidate_id: string | null;
  hero_selection_mode: string | null;
  hero_confidence: number | string | null;
  hero_selection_reason: string | null;
};

type CandidateRow = {
  id: string;
  place_id: string;
  source_type: string;
  source_name: string | null;
  image_url: string | null;
  storage_path: string | null;
  source_url: string | null;
  credit: string | null;
  license: string | null;
  tags: string[] | null;
  hero_score: number | string | null;
  status: string;
  is_preferred: boolean;
  is_generic: boolean;
  updated_at: string;
};

type CandidateView = CandidateRow & { previewUrl: string | null };

function scoreLabel(value: number | string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed * 100)}%` : 'Unscored';
}

function defaultScores(sourceType: SourceType) {
  if (sourceType === 'official') return { trust: 0.98, quality: 0.82, score: 0.93 };
  if (sourceType === 'admin') return { trust: 0.98, quality: 0.82, score: 0.92 };
  return { trust: 0.86, quality: 0.78, score: 0.86 };
}

export default function TrailGuideImagesAdminScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [profiles, setProfiles] = useState<PlaceProfile[]>([]);
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState('huguenot-memorial-park');
  const [sourceType, setSourceType] = useState<SourceType>('official');
  const [imageUrl, setImageUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [credit, setCredit] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
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
    if (adminResult.error || adminResult.data !== true) {
      setAuthorized(false);
      setError(adminResult.error?.message ?? 'Admin access required.');
      setLoading(false);
      return;
    }
    setAuthorized(true);

    const profileResult = await supabase
      .from('trail_guide_place_profiles')
      .select('place_id,display_name,city,state,hero_candidate_id,hero_selection_mode,hero_confidence,hero_selection_reason')
      .order('display_name');
    if (profileResult.error) {
      setError(profileResult.error.message);
      setLoading(false);
      return;
    }
    const nextProfiles = (profileResult.data ?? []) as PlaceProfile[];
    setProfiles(nextProfiles);
    const selected = nextProfiles.some((profile) => profile.place_id === selectedPlaceId) ? selectedPlaceId : nextProfiles[0]?.place_id;
    if (selected && selected !== selectedPlaceId) setSelectedPlaceId(selected);
    setLoading(false);
  }

  async function loadCandidates(placeId: string) {
    if (!placeId || !authorized) return;
    const result = await supabase
      .from('trail_guide_hero_candidates')
      .select('id,place_id,source_type,source_name,image_url,storage_path,source_url,credit,license,tags,hero_score,status,is_preferred,is_generic,updated_at')
      .eq('place_id', placeId)
      .order('is_preferred', { ascending: false })
      .order('is_generic', { ascending: true })
      .order('hero_score', { ascending: false });
    if (result.error) {
      setError(result.error.message);
      return;
    }

    const views: CandidateView[] = [];
    for (const row of (result.data ?? []) as CandidateRow[]) {
      let previewUrl = row.image_url;
      if (!previewUrl && row.storage_path) {
        const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, 60 * 30);
        previewUrl = signed?.signedUrl ?? null;
      }
      views.push({ ...row, previewUrl });
    }
    setCandidates(views);
  }

  useEffect(() => {
    void load();
  }, [session?.user.id]);

  useEffect(() => {
    if (authorized && selectedPlaceId) void loadCandidates(selectedPlaceId);
  }, [authorized, selectedPlaceId]);

  const selectedProfile = useMemo(() => profiles.find((profile) => profile.place_id === selectedPlaceId) ?? null, [profiles, selectedPlaceId]);

  async function refreshSelection(mode: 'preferred' | 'automatic' | 'refresh', candidateId?: string) {
    setSaving(true);
    setError('');
    const { data, error: functionError } = await supabase.functions.invoke('trail-guide-hero-select', {
      body: { placeId: selectedPlaceId, mode, candidateId },
    });
    setSaving(false);
    if (functionError || data?.error) {
      setError(functionError?.message ?? String(data?.error ?? 'Unable to update cover.'));
      return;
    }
    await Promise.all([load(), loadCandidates(selectedPlaceId)]);
  }

  async function addCandidate() {
    if (!selectedProfile) return;
    const trimmedImage = imageUrl.trim();
    if (!/^https:\/\//i.test(trimmedImage)) {
      Alert.alert('Image URL required', 'Add a public HTTPS image URL.');
      return;
    }
    const trimmedSource = sourceUrl.trim();
    if (trimmedSource && !/^https:\/\//i.test(trimmedSource)) {
      Alert.alert('Source URL', 'Source links must use HTTPS.');
      return;
    }
    const scores = defaultScores(sourceType);
    const tagList = tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12);
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('trail_guide_hero_candidates').upsert({
      place_id: selectedProfile.place_id,
      source_type: sourceType,
      source_name: sourceType === 'official' ? 'Official destination source' : sourceType === 'admin' ? 'Admin-selected destination photo' : 'Curated destination source',
      image_url: trimmedImage,
      source_url: trimmedSource || null,
      credit: credit.trim() || null,
      tags: tagList,
      destination_match_score: 1,
      source_trust_score: scores.trust,
      quality_score: scores.quality,
      recency_score: 0.75,
      hero_score: scores.score,
      status: 'approved',
      is_preferred: false,
      is_generic: false,
      classification_note: 'Added and approved by a Trail Guide administrator.',
      classified_at: new Date().toISOString(),
      last_scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'place_id,image_url' });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setImageUrl('');
    setSourceUrl('');
    setCredit('');
    setTags('');
    await loadCandidates(selectedPlaceId);
    await refreshSelection('refresh');
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading Trail Guide images…</Text></View></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Admin</Text></Pressable><Text style={styles.title}>Admin access required</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Admin</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRAIL GUIDE IMAGES</Text>
          <Text style={styles.title}>Destination covers</Text>
          <Text style={styles.muted}>Exact destination photos outrank generic category images. A preferred cover overrides automatic ranking.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow}>
          {profiles.map((profile) => <Pressable key={profile.place_id} onPress={() => setSelectedPlaceId(profile.place_id)} style={[styles.placeChip, profile.place_id === selectedPlaceId && styles.placeChipActive]}><Text style={[styles.placeChipText, profile.place_id === selectedPlaceId && styles.placeChipTextActive]}>{profile.display_name}</Text></Pressable>)}
        </ScrollView>

        {selectedProfile ? <View style={styles.selectionCard}><View style={styles.flex}><Text style={styles.selectionName}>{selectedProfile.display_name}</Text><Text style={styles.selectionMeta}>{selectedProfile.hero_selection_mode === 'manual' ? 'Preferred cover' : 'Automatic'} · confidence {scoreLabel(selectedProfile.hero_confidence)}</Text><Text style={styles.selectionReason}>{selectedProfile.hero_selection_reason || 'Selection will update when approved candidates become available.'}</Text></View><Pressable disabled={saving} onPress={() => void refreshSelection('automatic')} style={styles.autoButton}><Text style={styles.autoText}>Use automatic</Text></Pressable></View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CANDIDATES</Text>
          {candidates.length ? candidates.map((candidate) => (
            <View key={candidate.id} style={[styles.candidateCard, selectedProfile?.hero_candidate_id === candidate.id && styles.selectedCard]}>
              {candidate.previewUrl ? <Image source={{ uri: candidate.previewUrl }} style={styles.preview} resizeMode="cover" /> : <View style={[styles.preview, styles.previewEmpty]}><Text style={styles.previewEmptyText}>No preview</Text></View>}
              <View style={styles.candidateCopy}>
                <View style={styles.candidateTop}><Text style={styles.candidateSource}>{candidate.is_generic ? 'REPRESENTATIVE' : candidate.source_type.toUpperCase()}</Text><Text style={styles.score}>{scoreLabel(candidate.hero_score)}</Text></View>
                <Text numberOfLines={1} style={styles.candidateCredit}>{candidate.credit || candidate.source_name || 'Destination image'}</Text>
                <Text numberOfLines={1} style={styles.candidateTags}>{candidate.tags?.join(' · ') || 'No image tags'}</Text>
                <View style={styles.candidateActions}>
                  {candidate.is_preferred ? <View style={styles.preferredBadge}><Text style={styles.preferredText}>PREFERRED</Text></View> : <Pressable disabled={saving || candidate.status !== 'approved'} onPress={() => void refreshSelection('preferred', candidate.id)} style={styles.preferButton}><Text style={styles.preferText}>Set preferred</Text></Pressable>}
                  {selectedProfile?.hero_candidate_id === candidate.id ? <Text style={styles.currentText}>Current cover</Text> : null}
                </View>
              </View>
            </View>
          )) : <View style={styles.empty}><Text style={styles.emptyTitle}>No stored candidates yet</Text><Text style={styles.muted}>Runtime Google and curated imagery still act as fallbacks until a candidate is stored.</Text></View>}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>ADD DESTINATION PHOTO</Text>
          <View style={styles.typeRow}>{SOURCE_TYPES.map(([value, label]) => <Pressable key={value} onPress={() => setSourceType(value)} style={[styles.typeChip, sourceType === value && styles.typeChipActive]}><Text style={[styles.typeText, sourceType === value && styles.typeTextActive]}>{label}</Text></Pressable>)}</View>
          <TextInput value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" placeholder="Image URL https://…" placeholderTextColor="#65726B" style={styles.input} />
          <TextInput value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" placeholder="Source page URL https://…" placeholderTextColor="#65726B" style={styles.input} />
          <TextInput value={credit} onChangeText={setCredit} placeholder="Photo credit" placeholderTextColor="#65726B" style={styles.input} />
          <TextInput value={tags} onChangeText={setTags} placeholder="Tags: beach, dunes, campsite" placeholderTextColor="#65726B" style={styles.input} />
          <Pressable disabled={saving} onPress={() => void addCandidate()} style={[styles.addButton, saving && styles.disabled]}><Text style={styles.addText}>{saving ? 'Saving…' : 'Add approved candidate'}</Text></Pressable>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 54, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  denied: { flex: 1, padding: 22, gap: 16 },
  back: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  header: { gap: 4 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  muted: { color: '#859188', fontSize: 11, lineHeight: 16 },
  placeRow: { gap: 7, paddingRight: 8 },
  placeChip: { minHeight: 34, borderRadius: 999, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#111A15', justifyContent: 'center', paddingHorizontal: 11 },
  placeChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  placeChipText: { color: '#C6CEC9', fontSize: 10, fontWeight: '800' },
  placeChipTextActive: { color: '#17211C' },
  selectionCard: { borderRadius: 15, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#121C16', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  selectionName: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  selectionMeta: { color: '#D7B45A', fontSize: 9, fontWeight: '800', marginTop: 3 },
  selectionReason: { color: '#7E8B83', fontSize: 8.5, lineHeight: 12, marginTop: 3 },
  autoButton: { borderRadius: 10, borderWidth: 1, borderColor: '#5D512F', paddingHorizontal: 10, paddingVertical: 9 },
  autoText: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  section: { gap: 9 },
  sectionTitle: { color: '#8E9A92', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  candidateCard: { minHeight: 112, borderRadius: 14, borderWidth: 1, borderColor: '#29372E', backgroundColor: '#111A15', overflow: 'hidden', flexDirection: 'row' },
  selectedCard: { borderColor: '#8A7133' },
  preview: { width: 122, minHeight: 112, backgroundColor: '#18211C' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center' },
  previewEmptyText: { color: '#65726B', fontSize: 9 },
  candidateCopy: { flex: 1, padding: 10, gap: 4 },
  candidateTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  candidateSource: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  score: { color: '#9FAC9F', fontSize: 8, fontWeight: '900' },
  candidateCredit: { color: '#F1EEE4', fontSize: 10.5, fontWeight: '800' },
  candidateTags: { color: '#728078', fontSize: 8, textTransform: 'capitalize' },
  candidateActions: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  preferButton: { borderRadius: 8, backgroundColor: '#263128', borderWidth: 1, borderColor: '#645630', paddingHorizontal: 8, paddingVertical: 6 },
  preferText: { color: '#E3C362', fontSize: 7.5, fontWeight: '900' },
  preferredBadge: { borderRadius: 999, backgroundColor: '#D7B45A', paddingHorizontal: 7, paddingVertical: 4 },
  preferredText: { color: '#17211C', fontSize: 6.5, fontWeight: '900' },
  currentText: { color: '#8ED380', fontSize: 7.5, fontWeight: '800' },
  empty: { borderRadius: 14, borderWidth: 1, borderColor: '#29372E', backgroundColor: '#111A15', padding: 14, gap: 3 },
  emptyTitle: { color: '#F2EEE4', fontSize: 12, fontWeight: '900' },
  formCard: { borderRadius: 16, borderWidth: 1, borderColor: '#29372E', backgroundColor: '#111A15', padding: 13, gap: 9 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { borderRadius: 999, borderWidth: 1, borderColor: '#35443B', paddingHorizontal: 9, paddingVertical: 6 },
  typeChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  typeText: { color: '#ABB6AF', fontSize: 8.5, fontWeight: '800' },
  typeTextActive: { color: '#17211C' },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#2D3C33', backgroundColor: '#0E1611', color: '#FFF8E8', paddingHorizontal: 11, fontSize: 11 },
  addButton: { minHeight: 44, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#17211C', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  errorBox: { borderRadius: 12, borderWidth: 1, borderColor: '#75483F', backgroundColor: '#281B17', padding: 11 },
  error: { color: '#E6B5AA', fontSize: 10, lineHeight: 14, fontWeight: '700' },
});