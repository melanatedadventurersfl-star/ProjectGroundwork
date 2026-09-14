import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { discoverVenues, type VenueCandidate } from './venueDiscovery';

export type SelectedVenueSnapshot = {
  placeId: string | null;
  name: string;
  address: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  source: string;
  sourceLabel: string;
};

function snapshot(candidate: VenueCandidate): SelectedVenueSnapshot {
  return {
    placeId: candidate.placeId,
    name: candidate.name,
    address: candidate.address,
    city: candidate.city,
    state: candidate.state,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    mapsUrl: candidate.mapsUrl,
    websiteUrl: candidate.websiteUrl,
    source: candidate.source,
    sourceLabel: candidate.sourceLabel,
  };
}

export function VenueSearchField({
  organizationId,
  value,
  city,
  state,
  eventType,
  capacity,
  selectedVenue,
  onChangeText,
  onSelect,
  onUseCustom,
}: {
  organizationId: string | null;
  value: string;
  city: string;
  state: string;
  eventType: string;
  capacity: number | null;
  selectedVenue: SelectedVenueSnapshot | null;
  onChangeText: (value: string) => void;
  onSelect: (venue: SelectedVenueSnapshot) => void;
  onUseCustom: () => void;
}) {
  const [results, setResults] = useState<VenueCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [ideasMode, setIdeasMode] = useState(false);
  const canSearch = Boolean(city.trim() && state.trim());
  const query = value.trim();

  useEffect(() => {
    if (customMode || selectedVenue || !canSearch || query.length < 2) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      void discoverVenues({
        organizationId,
        city,
        state,
        eventType,
        capacity,
        refinement: query,
        maxResults: 6,
      })
        .then((response) => {
          if (!active) return;
          setResults(response.candidates);
          setError(response.warnings[0] ?? '');
        })
        .catch(() => {
          if (!active) return;
          setResults([]);
          setError('Venue search is unavailable right now. You can still enter the location manually.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [canSearch, capacity, city, customMode, eventType, organizationId, query, selectedVenue, state]);

  const selectedMeta = useMemo(() => {
    if (!selectedVenue) return '';
    return [selectedVenue.address, selectedVenue.sourceLabel].filter(Boolean).join(' · ');
  }, [selectedVenue]);

  async function findIdeas() {
    if (!canSearch) {
      setError('Add the city and state first so venue ideas stay in the right area.');
      return;
    }
    setIdeasMode(true);
    setLoading(true);
    setError('');
    try {
      const response = await discoverVenues({
        organizationId,
        city,
        state,
        eventType,
        capacity,
        refinement: '',
        maxResults: 6,
      });
      setResults(response.candidates);
      setError(response.warnings[0] ?? '');
    } catch {
      setResults([]);
      setError('Venue ideas are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  function useCustom() {
    setCustomMode(true);
    setIdeasMode(false);
    setResults([]);
    setError('');
    onUseCustom();
  }

  function select(candidate: VenueCandidate) {
    setCustomMode(false);
    setIdeasMode(false);
    setResults([]);
    setError('');
    onSelect(snapshot(candidate));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Venue or location</Text>
      <View style={[styles.inputWrap, selectedVenue && styles.inputSelected]}>
        <TextInput
          value={value}
          onChangeText={(next) => {
            setCustomMode(false);
            setIdeasMode(false);
            onChangeText(next);
          }}
          placeholder="Search a venue or enter your own"
          placeholderTextColor="#68756D"
          style={styles.input}
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator size="small" color="#D7B45A" /> : selectedVenue ? <Text style={styles.check}>✓</Text> : <Text style={styles.searchIcon}>⌕</Text>}
      </View>

      {selectedVenue ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedName}>{selectedVenue.name}</Text>
            {selectedMeta ? <Text style={styles.selectedMeta}>{selectedMeta}</Text> : null}
          </View>
          <Pressable onPress={() => onChangeText(value)} hitSlop={8}><Text style={styles.change}>Change</Text></Pressable>
        </View>
      ) : null}

      {!selectedVenue && !canSearch && !customMode ? <Text style={styles.helper}>Add city and state to search live venues.</Text> : null}

      {!selectedVenue && results.length ? (
        <View style={styles.results}>
          <Text style={styles.resultLabel}>{ideasMode ? 'VENUE IDEAS' : 'MATCHING VENUES'}</Text>
          {results.map((candidate) => (
            <Pressable key={candidate.id} style={styles.resultRow} onPress={() => select(candidate)}>
              {candidate.photoUrl ? <Image source={{ uri: candidate.photoUrl }} style={styles.photo} /> : <View style={styles.photoFallback}><Text style={styles.photoFallbackText}>⌖</Text></View>}
              <View style={styles.resultCopy}>
                <Text style={styles.resultName} numberOfLines={1}>{candidate.name}</Text>
                <Text style={styles.resultMeta} numberOfLines={2}>{candidate.address ?? `${candidate.city}, ${candidate.state}`}</Text>
                <View style={styles.badges}>
                  {candidate.primaryType ? <Text style={styles.badge}>{candidate.primaryType}</Text> : null}
                  {candidate.historyUses > 0 ? <Text style={styles.historyBadge}>Used {candidate.historyUses}×</Text> : null}
                  {candidate.preferred ? <Text style={styles.preferredBadge}>Preferred</Text> : null}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!selectedVenue ? (
        <View style={styles.actions}>
          <Pressable onPress={useCustom}><Text style={styles.action}>Use custom location</Text></Pressable>
          <Text style={styles.dot}>•</Text>
          <Pressable onPress={() => void findIdeas()}><Text style={styles.action}>Find venues for me</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '900', marginBottom: 6 },
  inputWrap: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', paddingRight: 12, flexDirection: 'row', alignItems: 'center' },
  inputSelected: { borderColor: '#58705E' },
  input: { flex: 1, minHeight: 48, color: '#FFF8E8', paddingHorizontal: 12, fontSize: 16 },
  searchIcon: { color: '#78857D', fontSize: 19 },
  check: { color: '#8FD09E', fontSize: 14, fontWeight: '900' },
  helper: { color: '#6F7C74', fontSize: 9, marginTop: 6 },
  selectedCard: { marginTop: 7, borderRadius: 11, borderWidth: 1, borderColor: '#34463A', backgroundColor: '#0E1711', paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedCopy: { flex: 1 },
  selectedName: { color: '#E8EDE9', fontSize: 10.5, fontWeight: '900' },
  selectedMeta: { color: '#7E8A82', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  change: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  results: { marginTop: 7, borderRadius: 13, borderWidth: 1, borderColor: '#344039', backgroundColor: '#0D1410', overflow: 'hidden' },
  resultLabel: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 11, paddingTop: 10, paddingBottom: 6 },
  resultRow: { minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2B3730', paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  photo: { width: 48, height: 48, borderRadius: 9, backgroundColor: '#19231D' },
  photoFallback: { width: 48, height: 48, borderRadius: 9, backgroundColor: '#172019', alignItems: 'center', justifyContent: 'center' },
  photoFallbackText: { color: '#D7B45A', fontSize: 16 },
  resultCopy: { flex: 1 },
  resultName: { color: '#F0F3F1', fontSize: 10.5, fontWeight: '900' },
  resultMeta: { color: '#7D8981', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  badge: { color: '#AAB4AE', fontSize: 7.5, fontWeight: '800', backgroundColor: '#172019', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3 },
  historyBadge: { color: '#D9C274', fontSize: 7.5, fontWeight: '900', backgroundColor: '#2A2414', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3 },
  preferredBadge: { color: '#99D5A7', fontSize: 7.5, fontWeight: '900', backgroundColor: '#14231A', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3 },
  chevron: { color: '#D7B45A', fontSize: 19 },
  error: { color: '#DDA077', fontSize: 8.5, lineHeight: 13, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  action: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  dot: { color: '#465149', fontSize: 9 },
});
