import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, updateHostOuting, type EventLocationType, type HostOuting } from '../../../src/hosting/api';
import { setHostOutingInterests } from '../../../src/hosting/communityIntegration';
import { EventCoverPositioner } from '../../../src/hosting/EventCoverPositioner';
import { EventDateTimeField } from '../../../src/hosting/EventDateTimeField';
import { resolveEventBuilderConfig, type EventBuilderConfig, type EventBuilderDifficulty } from '../../../src/hosting/eventBuilderConfig';
import { EventTagPicker } from '../../../src/hosting/EventTagPicker';
import { uploadEventCover } from '../../../src/hosting/eventMedia';
import { getEventVenue, saveManualEventVenue, saveSelectedEventVenue } from '../../../src/hosting/eventVenue';
import { VenueSearchField, type SelectedVenueSnapshot } from '../../../src/hosting/VenueSearchField';
import { supabase } from '../../../src/lib/supabase';
import { listMyOrganizations } from '../../../src/platform/organizations';

const difficulties: EventBuilderDifficulty[] = ['easy', 'moderate', 'challenging'];
const locationTypes: { value: EventLocationType; label: string }[] = [
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'tbd', label: 'TBD' },
];

export default function EditHostOutingScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
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
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverAltText, setCoverAltText] = useState('');
  const [coverAltChanged, setCoverAltChanged] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverStatus, setCoverStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [found, organizations, eventVenue] = await Promise.all([
          getHostOutingById(id),
          listMyOrganizations(),
          getEventVenue(id).catch(() => null),
        ]);
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
        setCoverUri(found.hero_image_url ?? null);
        setCoverAltText(found.hero_alt_text ?? '');
        if (eventVenue && eventVenue.provider !== 'manual') {
          setSelectedVenue({
            placeId: eventVenue.providerPlaceId,
            name: eventVenue.venueName,
            address: eventVenue.address,
            city: eventVenue.city,
            state: eventVenue.state,
            postalCode: eventVenue.postalCode,
            latitude: eventVenue.latitude,
            longitude: eventVenue.longitude,
            primaryType: eventVenue.primaryType,
            rating: eventVenue.rating,
            ratingCount: eventVenue.ratingCount,
            photoUrl: eventVenue.photoUrl,
            mapsUrl: eventVenue.googleMapsUrl,
            websiteUrl: eventVenue.websiteUrl,
            source: eventVenue.provider,
            sourceLabel: eventVenue.provider === 'google_places' ? 'Google Places' : eventVenue.provider.replace(/_/g, ' '),
          });
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load this event.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function pickCover() {
    if (!id || coverUploading) return;
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library access is needed to add an event cover.');
        return;
      }
    }

    setCoverStatus('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.92,
      base64: Platform.OS === 'web',
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    const previousCover = outing?.hero_image_url ?? null;
    setCoverUri(asset.uri);
    setCoverUploading(true);
    setCoverStatus('Uploading cover…');
    setError('');
    try {
      const imageUrl = await uploadEventCover({
        adventureId: id,
        localUri: asset.uri,
        base64: asset.base64,
        altText: coverAltText,
      });
      setCoverUri(imageUrl);
      setCoverStatus('Cover saved. Drag it below to position it.');
      setOuting((current) => current ? { ...current, hero_image_url: imageUrl, hero_alt_text: coverAltText.trim() || null } : current);
    } catch (caught) {
      setCoverUri(previousCover);
      setCoverStatus('');
      setError(caught instanceof Error ? caught.message : 'Unable to upload the event cover.');
    } finally {
      setCoverUploading(false);
    }
  }

  async function removeCover() {
    if (!id || coverUploading) return;
    setCoverUploading(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase.from('adventures').update({
        hero_image_url: null,
        hero_alt_text: null,
        hero_focal_x: 0.5,
        hero_focal_y: 0.5,
        hero_zoom: 1,
      }).eq('id', id).select('id').maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('You do not have permission to remove this cover.');
      setCoverUri(null);
      setCoverAltText('');
      setCoverStatus('Cover removed');
      setOuting((current) => current ? { ...current, hero_image_url: null, hero_alt_text: null } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove the event cover.');
    } finally {
      setCoverUploading(false);
    }
  }

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
      if (physicalNeeded && organizationId && venueName.trim()) {
        if (selectedVenue) await saveSelectedEventVenue({ adventureId: id, organizationId, candidate: selectedVenue });
        else await saveManualEventVenue({ adventureId: id, organizationId, venueName, city, state });
      }
      if (coverAltChanged) {
        const { error: altError } = await supabase.from('adventures').update({ hero_alt_text: coverAltText.trim() || null }).eq('id', id);
        if (altError) throw altError;
      }
      router.replace(`/host/review/${id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!outing) return <SafeAreaView style={styles.center}><Text style={styles.error}>Event not found.</Text><Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>Back to events</Text></Pressable></SafeAreaView>;

  const readOnly = outing.status === 'cancelled' || outing.status === 'completed';
  const difficultyApplies = config.difficultyEventTypes.includes(category);
  const physicalNeeded = locationType === 'physical' || locationType === 'hybrid';
  const onlineNeeded = locationType === 'online' || locationType === 'hybrid';
  const parsedCapacity = capacityMode === 'limited' ? Number.parseInt(capacity, 10) : null;
  const capacityNumber = parsedCapacity != null && Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : null;
  const coverFocused = focus === 'cover';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace(`/host/review/${id}` as never)}><Text style={styles.back}>‹ Event review</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT DETAILS</Text>
        <Text style={styles.title}>{readOnly ? 'Archived details' : coverFocused ? 'Event cover' : 'Edit the event'}</Text>
        <Text style={styles.subtitle}>{readOnly ? 'Completed and cancelled events stay read-only.' : coverFocused ? 'Choose the image, then drag and zoom it into position.' : 'Changes save to this event. Existing registrations stay attached.'}</Text>

        <View style={[styles.coverSection, coverFocused && styles.coverSectionFocused]}>
          <View style={styles.coverHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Event cover</Text><Text style={styles.sectionCopy}>The original image stays intact. Positioning controls how it appears across event surfaces.</Text></View>{outing.hero_image_url ? <Text style={styles.savedBadge}>CURRENT</Text> : null}</View>
          <Pressable disabled={readOnly || coverUploading} style={styles.coverPicker} onPress={() => void pickCover()}>
            {coverUri ? <ImageBackground source={{ uri: coverUri }} style={styles.coverImage} imageStyle={styles.coverImageRadius}><View style={styles.coverShade} /><Text style={styles.coverAction}>{readOnly ? 'Event cover' : coverUploading ? 'Uploading…' : 'Change photo'}</Text></ImageBackground> : <View style={styles.coverEmpty}><Text style={styles.coverPlus}>＋</Text><Text style={styles.coverEmptyTitle}>{coverUploading ? 'Uploading cover…' : 'Add cover image'}</Text><Text style={styles.coverEmptyCopy}>Upload the original image. You can position and zoom it after upload.</Text></View>}
          </Pressable>
          {coverStatus ? <Text style={styles.coverStatus}>{coverStatus}</Text> : null}
          {coverUri && id ? <EventCoverPositioner adventureId={id} imageUrl={coverUri} disabled={readOnly || coverUploading} /> : null}
          {coverUri ? <Field label="Image description" value={coverAltText} onChangeText={(value) => { setCoverAltText(value); setCoverAltChanged(true); }} editable={!readOnly} placeholder="Describe the image for accessibility" /> : null}
          {coverUri && !readOnly ? <Pressable disabled={coverUploading} style={styles.removeButton} onPress={() => void removeCover()}><Text style={styles.removeText}>Remove cover</Text></Pressable> : null}
        </View>

        <Field label="Title" value={title} onChangeText={setTitle} editable={!readOnly} />
        <Field label="Short description" value={summary} onChangeText={setSummary} editable={!readOnly} />
        <Field label="Description" value={description} onChangeText={setDescription} editable={!readOnly} multiline />

        <Text style={styles.label}>Event type</Text>
        <View style={styles.chips}>{config.eventTypes.map((item) => <Chip key={item} label={item} active={category === item} disabled={readOnly} onPress={() => setCategory(item)} />)}</View>
        <EventTagPicker label={config.labels.tags} options={config.tags} selected={tags} allowCustomTags={config.allowCustomTags && !readOnly} onChange={readOnly ? () => undefined : setTags} />

        {difficultyApplies ? <><Text style={styles.label}>Difficulty</Text><View style={styles.chips}>{difficulties.map((item) => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} active={difficulty === item} disabled={readOnly} onPress={() => setDifficulty(item)} />)}</View></> : null}

        <EventDateTimeField label="Starts" value={startsAt} onChange={readOnly ? () => undefined : setStartsAt} />
        <EventDateTimeField label="Ends" value={endsAt} minimum={startsAt} fallbackOffsetMinutes={120} onChange={readOnly ? () => undefined : setEndsAt} />

        <Text style={styles.label}>Location type</Text>
        <View style={styles.chips}>{locationTypes.map((item) => <Chip key={item.value} label={item.label} active={locationType === item.value} disabled={readOnly} onPress={() => setLocationType(item.value)} />)}</View>

        {physicalNeeded ? <>{readOnly ? <Field label="Venue or location" value={venueName} editable={false} /> : <VenueSearchField organizationId={organizationId} value={venueName} city={city} state={state} eventType={category} capacity={capacityNumber} selectedVenue={selectedVenue} onChangeText={(next) => { setVenueName(next); setSelectedVenue(null); }} onSelect={(venue) => { setSelectedVenue(venue); setVenueName(venue.name); if (venue.city) setCity(venue.city); if (venue.state) setState(venue.state); }} onUseCustom={() => setSelectedVenue(null)} />}
          <View style={styles.row}><View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} editable={!readOnly} /></View><View style={styles.state}><Field label="State" value={state} onChangeText={(next) => setState(next.toUpperCase().slice(0, 2))} editable={!readOnly} autoCapitalize="characters" /></View></View>
          {selectedVenue?.placeId ? <Text style={styles.googleConnected}>✓ Connected to Google Places. Address and map identity will stay attached to this event.</Text> : null}</> : null}
        {onlineNeeded ? <Field label="Online meeting or streaming link" value={onlineUrl} onChangeText={setOnlineUrl} editable={!readOnly} autoCapitalize="none" keyboardType="url" /> : null}
        {locationType === 'tbd' ? <Text style={styles.helper}>Add the final location before publishing when your organization requires it.</Text> : null}

        <Text style={styles.label}>{config.labels.capacity}</Text>
        <View style={styles.segment}><Pressable disabled={readOnly} style={[styles.segmentButton, capacityMode === 'unlimited' && styles.segmentActive]} onPress={() => { setCapacityMode('unlimited'); setCapacity(''); }}><Text style={[styles.segmentText, capacityMode === 'unlimited' && styles.segmentTextActive]}>Unlimited</Text></Pressable><Pressable disabled={readOnly} style={[styles.segmentButton, capacityMode === 'limited' && styles.segmentActive]} onPress={() => setCapacityMode('limited')}><Text style={[styles.segmentText, capacityMode === 'limited' && styles.segmentTextActive]}>Limited</Text></Pressable></View>
        {capacityMode === 'limited' ? <Field label="Maximum attendees" value={capacity} onChangeText={setCapacity} editable={!readOnly} keyboardType="number-pad" /> : null}
        <Field label={config.labels.meetingInstructions} value={meetingInstructions} onChangeText={setMeetingInstructions} editable={!readOnly} multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!readOnly ? <Pressable disabled={saving || coverUploading} style={[styles.primary, (saving || coverUploading) && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Save Changes</Text>}</Pressable> : null}
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
  safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 76, maxWidth: 760, width: '100%', alignSelf: 'center' }, flex: { flex: 1 }, back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#A7B0AA', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 14 },
  coverSection: { borderRadius: 16, borderWidth: 1, borderColor: '#344039', backgroundColor: '#121914', padding: 12, marginBottom: 5 }, coverSectionFocused: { borderColor: '#D7B45A', borderWidth: 2 }, coverHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 }, sectionTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, sectionCopy: { color: '#7F8B83', fontSize: 8.5, lineHeight: 13, marginTop: 3 }, savedBadge: { color: '#8FD09E', fontSize: 7, fontWeight: '900', backgroundColor: '#17301F', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8 },
  coverPicker: { minHeight: 135, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#46544C', overflow: 'hidden', backgroundColor: '#0D1410' }, coverImage: { minHeight: 190, justifyContent: 'flex-end', padding: 12 }, coverImageRadius: { borderRadius: 12 }, coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,11,8,.3)' }, coverAction: { alignSelf: 'flex-start', color: '#FFF8E8', backgroundColor: 'rgba(8,13,10,.78)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, fontSize: 9, fontWeight: '900' }, coverEmpty: { minHeight: 135, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, coverPlus: { color: '#D7B45A', fontSize: 24 }, coverEmptyTitle: { color: '#E3E8E5', fontSize: 11, fontWeight: '900', marginTop: 4 }, coverEmptyCopy: { color: '#77847C', fontSize: 8.5, lineHeight: 13, marginTop: 3, textAlign: 'center' }, coverStatus: { color: '#8FD09E', fontSize: 9, fontWeight: '800', marginTop: 8 }, removeButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#603B3B', alignItems: 'center', justifyContent: 'center', marginTop: 8 }, removeText: { color: '#E7A5A0', fontSize: 8.5, fontWeight: '900' },
  field: { marginTop: 13 }, label: { color: '#D4DAD6', fontSize: 10.5, fontWeight: '900', marginTop: 13, marginBottom: 7 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', borderRadius: 13, color: '#FFF8E8', paddingHorizontal: 13, fontSize: 15 }, multiline: { minHeight: 105, paddingTop: 13 }, readOnly: { opacity: .58 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 }, chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#364139', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151B17' }, chipActive: { backgroundColor: '#443616', borderColor: '#8A6A25' }, chipText: { color: '#A9B1AC', fontSize: 10, fontWeight: '800' }, chipTextActive: { color: '#E7C464' },
  row: { flexDirection: 'row', gap: 10 }, state: { width: 95 }, helper: { color: '#718078', fontSize: 9.5, lineHeight: 14, marginTop: 8 }, googleConnected: { color: '#98C4FF', fontSize: 8.5, lineHeight: 13, marginTop: 7 }, segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginTop: 8 }, segmentButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1410' }, segmentActive: { backgroundColor: '#322A14' }, segmentText: { color: '#9FA9A3', fontWeight: '900', fontSize: 10 }, segmentTextActive: { color: '#E7C464' },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 24 }, disabled: { opacity: .68 }, primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' }, error: { color: '#FF8A80', fontSize: 11, lineHeight: 16, marginTop: 14 },
});