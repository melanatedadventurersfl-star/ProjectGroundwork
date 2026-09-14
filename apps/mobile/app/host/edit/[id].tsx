import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, updateHostOuting, type EventLocationType, type HostOuting } from '../../../src/hosting/api';
import { setHostOutingInterests } from '../../../src/hosting/communityIntegration';
import { EventDateTimeField } from '../../../src/hosting/EventDateTimeField';
import { resolveEventBuilderConfig, type EventBuilderConfig, type EventBuilderDifficulty } from '../../../src/hosting/eventBuilderConfig';
import { EventTagPicker } from '../../../src/hosting/EventTagPicker';
import { persistSelectedVenueMetadata } from '../../../src/hosting/venueDiscovery';
import { VenueSearchField, type SelectedVenueSnapshot } from '../../../src/hosting/VenueSearchField';
import { listMyOrganizations } from '../../../src/platform/organizations';

const difficulties: EventBuilderDifficulty[] = ['easy', 'moderate', 'challenging'];
const locationTypes: { value: EventLocationType; label: string }[] = [
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'tbd', label: 'TBD' },
];

export default function EditHostOutingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [outing, setOuting] = useState<HostOuting | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [config, setConfig] = useState<EventBuilderConfig>(() => resolveEventBuilderConfig(null));
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Social');
  const [tags, setTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<EventBuilderDifficulty>('easy');
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<EventLocationType>('physical');
  const [venueName, setVenueName] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenueSnapshot | null>(null);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [capacityMode, setCapacityMode] = useState<'unlimited' | 'limited'>('unlimited');
  const [capacity, setCapacity] = useState('');
  const [meetingInstructions, setMeetingInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [found, organizations] = await Promise.all([getHostOutingById(id), listMyOrganizations()]);
        const owningOrganization = organizations.find((item) => item.id === found.platform_organization_id)
          ?? organizations.find((item) => item.isActive)
          ?? organizations[0]
          ?? null;
        setConfig(resolveEventBuilderConfig(owningOrganization));
        setOrganizationId(owningOrganization?.id ?? found.platform_organization_id ?? null);
        setOuting(found);
        setTitle(found.title);
        setSummary(found.summary);
        setDescription(found.description);
        setCategory(found.category);
        setTags(Array.isArray(found.event_tags) ? found.event_tags : []);
        setDifficulty(found.difficulty);
        setStartsAt(found.starts_at);
        setEndsAt(found.ends_at);
        setLocationType(found.location_type ?? 'physical');
        setVenueName(found.venue_name ?? '');
        setCity(found.location_type === 'online' || found.location_type === 'tbd' ? '' : found.city);
        setState(found.state ?? '');
        setOnlineUrl(found.online_url ?? '');
        setCapacityMode(found.capacity == null ? 'unlimited' : 'limited');
        setCapacity(found.capacity == null ? '' : String(found.capacity));
        setMeetingInstructions(found.meeting_instructions ?? '');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load this event.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function save() {
    if (!id || !outing || !startsAt || !endsAt) return;
    const parsedCapacity = capacityMode === 'limited' ? Number.parseInt(capacity, 10) : null;
    if (capacityMode === 'limited' && (!Number.isFinite(parsedCapacity) || parsedCapacity == null || parsedCapacity < 1)) {
      setError('Capacity must be a whole number of at least 1.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const difficultyApplicable = config.difficultyEventTypes.includes(category);
      await updateHostOuting(id, {
        title,
        summary,
        description,
        category,
        difficulty,
        difficultyApplicable,
        startsAt,
        endsAt,
        locationType,
        city,
        state,
        venueName,
        onlineUrl,
        capacity: parsedCapacity,
        meetingInstructions,
        hostOrganizationId: outing.organization_id,
        platformOrganizationId: outing.platform_organization_id,
      });
      await setHostOutingInterests(id, tags);
      if (selectedVenue) {
        await persistSelectedVenueMetadata(id, {
          address: selectedVenue.address,
          latitude: selectedVenue.latitude,
          longitude: selectedVenue.longitude,
          placeId: selectedVenue.placeId,
          source: selectedVenue.source,
        });
      }
      router.replace(`/host/review/${id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!outing) return <SafeAreaView style={styles.center}><Text style={styles.error}>Event not found.</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;
  const readOnly = outing.status === 'cancelled' || outing.status === 'completed';
  const difficultyApplies = config.difficultyEventTypes.includes(category);
  const physicalNeeded = locationType === 'physical' || locationType === 'hybrid';
  const onlineNeeded = locationType === 'online' || locationType === 'hybrid';
  const parsedCapacity = capacityMode === 'limited' ? Number.parseInt(capacity, 10) : null;
  const capacityNumber = parsedCapacity != null && Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event review</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT DETAILS</Text>
        <Text style={styles.title}>{readOnly ? 'Archived details' : 'Edit the event'}</Text>
        <Text style={styles.subtitle}>{readOnly ? 'Completed and cancelled events stay read-only for a reliable history.' : 'Changes save to this event. Existing registrations stay attached.'}</Text>

        <Field label="Title" value={title} onChangeText={setTitle} editable={!readOnly} />
        <Field label="Short description" value={summary} onChangeText={setSummary} editable={!readOnly} />
        <Field label="Description" value={description} onChangeText={setDescription} editable={!readOnly} multiline />

        <Text style={styles.label}>Event type</Text>
        <View style={styles.chips}>{config.eventTypes.map((item) => <Chip key={item} label={item} active={category === item} disabled={readOnly} onPress={() => setCategory(item)} />)}</View>

        <EventTagPicker label={config.labels.tags} options={config.tags} selected={tags} allowCustomTags={config.allowCustomTags && !readOnly} onChange={readOnly ? () => undefined : setTags} />

        {difficultyApplies ? (
          <>
            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.chips}>{difficulties.map((item) => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} active={difficulty === item} disabled={readOnly} onPress={() => setDifficulty(item)} />)}</View>
          </>
        ) : null}

        <EventDateTimeField label="Starts" value={startsAt} onChange={readOnly ? () => undefined : setStartsAt} />
        <EventDateTimeField label="Ends" value={endsAt} minimum={startsAt} fallbackOffsetMinutes={120} onChange={readOnly ? () => undefined : setEndsAt} />

        <Text style={styles.label}>Location type</Text>
        <View style={styles.chips}>{locationTypes.map((item) => <Chip key={item.value} label={item.label} active={locationType === item.value} disabled={readOnly} onPress={() => setLocationType(item.value)} />)}</View>

        {physicalNeeded ? (
          <>
            <View style={styles.row}>
              <View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} editable={!readOnly} /></View>
              <View style={styles.state}><Field label="State" value={state} onChangeText={(next) => setState(next.toUpperCase().slice(0, 2))} editable={!readOnly} autoCapitalize="characters" /></View>
            </View>
            {readOnly ? <Field label="Venue or location" value={venueName} editable={false} /> : (
              <VenueSearchField
                organizationId={organizationId}
                value={venueName}
                city={city}
                state={state}
                eventType={category}
                capacity={capacityNumber}
                selectedVenue={selectedVenue}
                onChangeText={(next) => { setVenueName(next); setSelectedVenue(null); }}
                onSelect={(venue) => {
                  setSelectedVenue(venue);
                  setVenueName(venue.name);
                  if (venue.city) setCity(venue.city);
                  if (venue.state) setState(venue.state);
                }}
                onUseCustom={() => setSelectedVenue(null)}
              />
            )}
          </>
        ) : null}
        {onlineNeeded ? <Field label="Online meeting or streaming link" value={onlineUrl} onChangeText={setOnlineUrl} editable={!readOnly} autoCapitalize="none" keyboardType="url" /> : null}
        {locationType === 'tbd' ? <Text style={styles.helper}>Add the final location before publishing when your organization requires it.</Text> : null}

        <Text style={styles.label}>{config.labels.capacity}</Text>
        <View style={styles.segment}>
          <Pressable disabled={readOnly} style={[styles.segmentButton, capacityMode === 'unlimited' && styles.segmentActive]} onPress={() => { setCapacityMode('unlimited'); setCapacity(''); }}><Text style={[styles.segmentText, capacityMode === 'unlimited' && styles.segmentTextActive]}>Unlimited</Text></Pressable>
          <Pressable disabled={readOnly} style={[styles.segmentButton, capacityMode === 'limited' && styles.segmentActive]} onPress={() => setCapacityMode('limited')}><Text style={[styles.segmentText, capacityMode === 'limited' && styles.segmentTextActive]}>Limited</Text></Pressable>
        </View>
        {capacityMode === 'limited' ? <Field label="Maximum attendees" value={capacity} onChangeText={setCapacity} editable={!readOnly} keyboardType="number-pad" /> : null}
        <Field label={config.labels.meetingInstructions} value={meetingInstructions} onChangeText={setMeetingInstructions} editable={!readOnly} multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!readOnly ? <Pressable disabled={saving} style={[styles.primary, saving && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Save Changes</Text>}</Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, multiline = false, editable = true, ...props }: TextInputProps & { label: string; multiline?: boolean; editable?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} editable={editable} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#66736B" style={[styles.input, multiline && styles.multiline, !editable && styles.readOnly]} /></View>;
}

function Chip({ label, active, disabled = false, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} style={[styles.chip, active && styles.chipActive, disabled && styles.readOnly]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 76, maxWidth: 760, width: '100%', alignSelf: 'center' },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 14 },
  field: { marginTop: 13 },
  label: { color: '#D4DAD6', fontSize: 10.5, fontWeight: '900', marginTop: 13, marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', borderRadius: 13, color: '#FFF8E8', paddingHorizontal: 13, fontSize: 15 },
  multiline: { minHeight: 105, paddingTop: 13 },
  readOnly: { opacity: .58 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#364139', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151B17' },
  chipActive: { backgroundColor: '#443616', borderColor: '#8A6A25' },
  chipText: { color: '#A9B1AC', fontSize: 10, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  state: { width: 95 },
  helper: { color: '#718078', fontSize: 9.5, lineHeight: 14, marginTop: 8 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginTop: 8 },
  segmentButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1410' },
  segmentActive: { backgroundColor: '#322A14' },
  segmentText: { color: '#9FA9A3', fontWeight: '900', fontSize: 10 },
  segmentTextActive: { color: '#E7C464' },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  disabled: { opacity: .68 },
  primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  error: { color: '#FF8A80', fontSize: 11, lineHeight: 17, marginTop: 16 },
});
