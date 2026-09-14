import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, type CommunityGroup } from '../../src/community/api';
import { isPeopleCommunity } from '../../src/community/communityModel';
import { createDraftOuting, getOutingHostAccess } from '../../src/hosting/api';
import { createCampaignWorkspace } from '../../src/hosting/creation';
import { getActiveHostOrganizationContext, getPrimaryHostCommunityId, listManagedHostCommunityIds, setHostOutingInterests, setPrimaryHostCommunity } from '../../src/hosting/communityIntegration';
import { addEventComponent } from '../../src/hosting/eventBuilder';
import { resolveEventBuilderConfig, type EventBuilderConfig, type EventBuilderDifficulty } from '../../src/hosting/eventBuilderConfig';
import { setOutingVisibility, type EventVisibility } from '../../src/hosting/hostProfiles';
import { addGeneralAdmissionTicket } from '../../src/hosting/tickets';
import { getActiveOrganization, type OrganizationWorkspace } from '../../src/platform/organizations';

const difficulties: EventBuilderDifficulty[] = ['easy', 'moderate', 'challenging'];

type VisibilityOption = { value: EventVisibility; label: string; copy: string };

function visibilityOptions(config: EventBuilderConfig): VisibilityOption[] {
  const options: VisibilityOption[] = [
    { value: 'public', label: 'Public', copy: 'Anyone can discover and view this event.' },
    { value: 'unlisted', label: 'Unlisted', copy: 'Only people with the direct link can open it.' },
    { value: 'private', label: 'Private', copy: 'Only invited people can view it.' },
  ];
  if (config.showCommunityVisibility) {
    options.push({ value: 'community', label: config.labels.memberAccess, copy: 'Limit access to selected communities.' });
  }
  return options;
}

export default function CreateHostOutingScreen() {
  const [builderConfig, setBuilderConfig] = useState<EventBuilderConfig>(() => resolveEventBuilderConfig(null));
  const [activeOrganization, setActiveOrganization] = useState<OrganizationWorkspace | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Social');
  const [tags, setTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<EventBuilderDifficulty>('easy');
  const [showAllTags, setShowAllTags] = useState(false);
  const [showMeetingInstructions, setShowMeetingInstructions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [managedGroups, setManagedGroups] = useState<CommunityGroup[]>([]);
  const [hostOrganizationId, setHostOrganizationId] = useState<string | null>(null);
  const [hostOrganizationName, setHostOrganizationName] = useState<string | null>(null);
  const [primaryCommunityId, setPrimaryCommunityId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [capacity, setCapacity] = useState('');
  const [meetingInstructions, setMeetingInstructions] = useState('');
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const capacityNumber = useMemo(() => {
    if (!capacity.trim()) return null;
    const value = Number.parseInt(capacity, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [capacity]);

  const difficultyApplies = builderConfig.difficultyEventTypes.includes(category);
  const availableVisibility = useMemo(() => visibilityOptions(builderConfig), [builderConfig]);
  const visibleTags = showAllTags ? builderConfig.tags : builderConfig.tags.slice(0, 6);
  const organizerName = hostOrganizationName ?? activeOrganization?.name ?? 'Current organization';
  const requiredValues = [title, summary, description, startsAt, endsAt, city, state];
  const requiredComplete = requiredValues.filter((value) => value.trim().length > 0).length;
  const requiredTotal = requiredValues.length;

  useEffect(() => {
    void (async () => {
      try {
        const [nextGroups, hostContext, organization] = await Promise.all([
          getGroups(),
          getActiveHostOrganizationContext(),
          getActiveOrganization(),
        ]);
        const peopleGroups = nextGroups.filter(isPeopleCommunity);
        setGroups(peopleGroups);
        setActiveOrganization(organization);

        const nextConfig = resolveEventBuilderConfig(organization);
        setBuilderConfig(nextConfig);
        setCategory(nextConfig.defaultEventType);
        setState(nextConfig.defaultState);
        setCapacity(nextConfig.defaultCapacity == null ? '' : String(nextConfig.defaultCapacity));
        const matchingTag = nextConfig.tags.find((item) => item.toLowerCase() === nextConfig.defaultEventType.toLowerCase());
        setTags(matchingTag ? [matchingTag] : []);

        if (!hostContext) {
          setHostOrganizationId(null);
          setHostOrganizationName(null);
          setManagedGroups([]);
          setPrimaryCommunityId(null);
          return;
        }

        const [managedIds, primaryId] = await Promise.all([
          listManagedHostCommunityIds(hostContext.id),
          getPrimaryHostCommunityId(hostContext.id),
        ]);
        const managedSet = new Set(managedIds);
        const nextManaged = peopleGroups.filter((group) => managedSet.has(group.id));
        setHostOrganizationId(hostContext.id);
        setHostOrganizationName(hostContext.name);
        setManagedGroups(nextManaged);
        const resolvedPrimary = primaryId && managedSet.has(primaryId)
          ? primaryId
          : nextManaged.length === 1
            ? nextManaged[0]?.id ?? null
            : null;
        setPrimaryCommunityId(resolvedPrimary);
      } catch {
        setGroups([]);
        setManagedGroups([]);
        setHostOrganizationId(null);
        setHostOrganizationName(null);
        setPrimaryCommunityId(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (visibility === 'community' && !builderConfig.showCommunityVisibility) {
      setVisibility('public');
      setSelectedGroupIds([]);
    }
  }, [builderConfig.showCommunityVisibility, visibility]);

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]);
  }

  function toggleTag(label: string) {
    setTags((current) => current.includes(label)
      ? current.filter((item) => item !== label)
      : [...current, label]);
  }

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    const matchingTag = builderConfig.tags.find((item) => item.toLowerCase() === nextCategory.toLowerCase());
    if (matchingTag) {
      setTags((current) => current.includes(matchingTag) ? current : [...current, matchingTag]);
    }
  }

  async function createOuting() {
    setSaving(true);
    setError('');
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Approved host access is required.');
      if (paid && !access.paidEnabled) throw new Error('Paid hosting has not been enabled for this account yet.');
      if (!title.trim()) throw new Error('Add an event title.');
      if (!summary.trim()) throw new Error('Add a short description.');
      if (!description.trim()) throw new Error('Add the event details.');
      if (!city.trim() || !state.trim()) throw new Error('Add the city and state.');
      if (capacity.trim() && capacityNumber == null) throw new Error('Capacity must be a whole number greater than zero.');
      if (visibility === 'community' && selectedGroupIds.length === 0) throw new Error(`Choose at least one ${builderConfig.labels.memberAccess.toLowerCase()} group.`);

      const start = new Date(startsAt);
      const end = new Date(endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new Error('Add valid start and end dates, with the end after the start.');
      }

      const dollars = Number.parseFloat(price || '0');
      const priceCents = paid ? Math.round(dollars * 100) : 0;
      if (paid && (!Number.isFinite(dollars) || dollars <= 0)) throw new Error('Enter a valid ticket price.');

      if (primaryCommunityId && hostOrganizationId) {
        await setPrimaryHostCommunity(hostOrganizationId, primaryCommunityId);
      }

      const outing = await createDraftOuting({
        title,
        summary,
        description,
        category,
        difficulty,
        difficultyApplicable: difficultyApplies,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        city,
        state,
        venueName,
        capacity: capacityNumber,
        meetingInstructions,
        hostOrganizationId,
      });

      await Promise.all([
        setOutingVisibility(outing.id, visibility, selectedGroupIds),
        setHostOutingInterests(outing.id, tags),
        addGeneralAdmissionTicket(outing.id, capacityNumber, priceCents),
      ]);

      const campaign = await createCampaignWorkspace({
        adventureId: outing.id,
        title: outing.title,
        location: [outing.venue_name, outing.city, outing.state].filter(Boolean).join(', '),
        startsAt: outing.starts_at,
        endsAt: outing.ends_at,
      });
      await Promise.all([
        addEventComponent(campaign.id, 'tickets', outing.starts_at),
        addEventComponent(campaign.id, 'team', outing.starts_at),
        addEventComponent(campaign.id, 'finance', outing.starts_at),
      ]);
      router.replace(`/host/build/${outing.id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>‹ Build an Event</Text></Pressable>
        <Pressable onPress={() => setShowPreview((current) => !current)} hitSlop={10}>
          <Text style={styles.previewAction}>{showPreview ? 'Hide preview' : 'Preview'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>BUILD MANUALLY</Text>
        <Text style={styles.title}>Create an event</Text>
        <Text style={styles.subtitle}>Add the essentials now. You can finish ticketing, staffing, marketing, and operations after the event workspace is created.</Text>

        {activeOrganization ? (
          <View style={styles.tenantPill}>
            <Text style={styles.tenantLabel}>WORKSPACE</Text>
            <Text style={styles.tenantName}>{activeOrganization.name}</Text>
          </View>
        ) : null}

        {showPreview ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewEyebrow}>EVENT PREVIEW</Text>
            <Text style={styles.previewTitle}>{title.trim() || 'Untitled event'}</Text>
            <Text style={styles.previewMeta}>{category}{startsAt.trim() ? ` · ${startsAt}` : ''}</Text>
            <Text style={styles.previewMeta}>{[venueName, city, state].filter(Boolean).join(', ') || 'Location not added yet'}</Text>
            <Text style={styles.previewBody}>{summary.trim() || 'Your short description will appear here.'}</Text>
          </View>
        ) : null}

        <Section number="01" title="Event details" copy="Give the event a clear identity. These are the first details people will see.">
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Customer appreciation dinner" />
          <Field label="Short description" value={summary} onChangeText={setSummary} placeholder="A one-line reason to attend." />
          <Field label="Full description" value={description} onChangeText={setDescription} placeholder="What should someone know before they decide to join?" multiline />

          <Text style={styles.label}>Event type</Text>
          <View style={styles.chips}>
            {builderConfig.eventTypes.map((item) => (
              <Chip key={item} label={item} active={category === item} onPress={() => chooseCategory(item)} />
            ))}
          </View>

          {builderConfig.tags.length ? (
            <>
              <View style={styles.inlineHeading}>
                <Text style={styles.label}>{builderConfig.labels.tags}</Text>
                {builderConfig.tags.length > 6 ? (
                  <Pressable onPress={() => setShowAllTags((current) => !current)}>
                    <Text style={styles.inlineAction}>{showAllTags ? 'Show less' : `+ Add ${builderConfig.labels.tags.toLowerCase()}`}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.chips}>
                {visibleTags.map((item) => (
                  <Chip key={item} label={item} active={tags.includes(item)} onPress={() => toggleTag(item)} />
                ))}
              </View>
            </>
          ) : null}

          {difficultyApplies ? (
            <>
              <Text style={styles.label}>Difficulty</Text>
              <View style={styles.chips}>
                {difficulties.map((item) => (
                  <Chip
                    key={item}
                    label={item.charAt(0).toUpperCase() + item.slice(1)}
                    active={difficulty === item}
                    onPress={() => setDifficulty(item)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Section>

        <Section number="02" title="When & where" copy="Add the schedule, location, and attendance details people need to plan around.">
          <View style={styles.twoCol}>
            <View style={styles.flex}><Field label="Starts" value={startsAt} onChangeText={setStartsAt} placeholder="Oct 18, 2026 6:00 PM" /></View>
            <View style={styles.flex}><Field label="Ends" value={endsAt} onChangeText={setEndsAt} placeholder="Oct 18, 2026 9:00 PM" /></View>
          </View>
          <Text style={styles.helper}>Enter a normal date and time. The app validates the schedule before creating the event.</Text>
          <Field label="Venue or location" value={venueName} onChangeText={setVenueName} placeholder="Venue, building, park, or meeting place" />
          <View style={styles.twoCol}>
            <View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} placeholder="Jacksonville" /></View>
            <View style={styles.stateCol}><Field label="State" value={state} onChangeText={setState} placeholder="FL" /></View>
          </View>
          <Field label={builderConfig.labels.capacity} value={capacity} onChangeText={setCapacity} placeholder="No limit" keyboardType="number-pad" />

          {showMeetingInstructions ? (
            <>
              <Field label={builderConfig.labels.meetingInstructions} value={meetingInstructions} onChangeText={setMeetingInstructions} placeholder="Parking, arrival window, check-in, or meeting details." multiline />
              <Pressable onPress={() => { setShowMeetingInstructions(false); setMeetingInstructions(''); }}>
                <Text style={styles.optionalAction}>Remove instructions</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.optionalButton} onPress={() => setShowMeetingInstructions(true)}>
              <Text style={styles.optionalButtonText}>+ Add {builderConfig.labels.meetingInstructions.toLowerCase()}</Text>
            </Pressable>
          )}
        </Section>

        <Section number="03" title={builderConfig.labels.organizer} copy="This is the identity attendees will associate with the event.">
          <View style={styles.organizerRow}>
            <View style={styles.organizerMark}><Text style={styles.organizerInitial}>{organizerName.charAt(0).toUpperCase()}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.organizerName}>{organizerName}</Text>
              <Text style={styles.organizerMeta}>{hostOrganizationName ? 'Public event identity' : 'Active organization'}</Text>
            </View>
          </View>
          {builderConfig.showCommunityVisibility && managedGroups.length ? (
            <>
              <Text style={styles.smallLabel}>Primary community</Text>
              <View style={styles.chips}>
                {managedGroups.map((group) => (
                  <Chip key={group.id} label={group.name} active={primaryCommunityId === group.id} onPress={() => setPrimaryCommunityId(group.id)} />
                ))}
              </View>
            </>
          ) : null}
        </Section>

        <Section number="04" title="Access" copy="Choose how people can find and open this event.">
          <View style={styles.visibilityList}>
            {availableVisibility.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.visibilityRow, visibility === option.value && styles.visibilityRowActive]}
                onPress={() => setVisibility(option.value)}
              >
                <View style={[styles.radio, visibility === option.value && styles.radioActive]}>
                  {visibility === option.value ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.visibilityTitle, visibility === option.value && styles.visibilityTitleActive]}>{option.label}</Text>
                  <Text style={styles.visibilityCopy}>{option.copy}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {visibility === 'community' ? (
            <View style={styles.communityPicker}>
              <Text style={styles.label}>Allowed communities</Text>
              {groups.length ? (
                <View style={styles.chips}>
                  {groups.map((group) => (
                    <Chip key={group.id} label={group.name} active={selectedGroupIds.includes(group.id)} onPress={() => toggleGroup(group.id)} />
                  ))}
                </View>
              ) : <Text style={styles.communityNote}>No communities are available to select.</Text>}
            </View>
          ) : null}
        </Section>

        <Section number="05" title="Admission" copy="Set the starting admission model. Ticket tiers can be expanded after the workspace is created.">
          <View style={styles.segment}>
            <Pressable style={[styles.segmentButton, !paid && styles.segmentActive]} onPress={() => { setPaid(false); setPrice('0'); }}>
              <Text style={[styles.segmentText, !paid && styles.segmentTextActive]}>Free</Text>
            </Pressable>
            <Pressable style={[styles.segmentButton, paid && styles.segmentActive]} onPress={() => setPaid(true)}>
              <Text style={[styles.segmentText, paid && styles.segmentTextActive]}>Paid</Text>
            </Pressable>
          </View>
          {paid ? <Field label="Starting ticket price" value={price} onChangeText={setPrice} placeholder="35.00" keyboardType="decimal-pad" prefix="$" /> : null}
        </Section>

        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerCopy}>
          <Text style={styles.footerCount}>{requiredComplete} of {requiredTotal} required</Text>
          <Text style={styles.footerHint}>{requiredComplete === requiredTotal ? 'Ready to create the workspace' : 'Complete the event basics'}</Text>
        </View>
        <Pressable disabled={saving} style={[styles.primary, saving && styles.primaryDisabled]} onPress={() => void createOuting()}>
          {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Event</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Section({ number, title, copy, children }: { number: string; title: string; copy: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTop}>
        <Text style={styles.sectionNumber}>{number}</Text>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCopy}>{copy}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, prefix, multiline = false, ...props }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor="#68756D"
          style={[styles.input, multiline && styles.multiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  topBar: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26322B' },
  back: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  previewAction: { color: '#B9C4BD', fontSize: 12, fontWeight: '900' },
  content: { padding: 18, paddingBottom: 116, maxWidth: 760, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#96A199', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 620 },
  tenantPill: { alignSelf: 'flex-start', marginTop: 13, borderRadius: 10, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', paddingHorizontal: 10, paddingVertical: 7 },
  tenantLabel: { color: '#68756D', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  tenantName: { color: '#DCE3DE', fontSize: 10, fontWeight: '900', marginTop: 2 },
  previewCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#5A4A22', backgroundColor: '#17170F', padding: 14 },
  previewEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  previewTitle: { color: '#FFF8E8', fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 5 },
  previewMeta: { color: '#AAB4AD', fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  previewBody: { color: '#D0D7D2', fontSize: 12, lineHeight: 18, marginTop: 10 },
  section: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#101713', overflow: 'hidden' },
  sectionTop: { flexDirection: 'row', gap: 11, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26322B' },
  sectionNumber: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingTop: 2 },
  sectionTitle: { color: '#F3F6F4', fontSize: 16, fontWeight: '900' },
  sectionCopy: { color: '#7F8B83', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  sectionBody: { padding: 14, paddingTop: 4 },
  fieldWrap: { marginTop: 12 },
  label: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '900', marginBottom: 6 },
  smallLabel: { color: '#8E9992', fontSize: 9, fontWeight: '900', marginTop: 12, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', borderRadius: 12 },
  input: { flex: 1, minHeight: 48, color: '#FFF8E8', paddingHorizontal: 12, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: 12 },
  prefix: { color: '#D7B45A', fontSize: 15, fontWeight: '900', marginLeft: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#3A473F', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121914' },
  chipActive: { backgroundColor: '#322A14', borderColor: '#8A6A25' },
  chipText: { color: '#AAB4AE', fontSize: 10.5, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  inlineHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, marginBottom: 1 },
  inlineAction: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  stateCol: { width: 94 },
  helper: { color: '#6F7C74', fontSize: 9.5, lineHeight: 14, marginTop: 6 },
  optionalButton: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  optionalButtonText: { color: '#AEB8B2', fontSize: 10.5, fontWeight: '900' },
  optionalAction: { color: '#7E8A82', fontSize: 9.5, fontWeight: '800', marginTop: 7 },
  organizerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10 },
  organizerMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#1B2B21', borderWidth: 1, borderColor: '#47604D', alignItems: 'center', justifyContent: 'center' },
  organizerInitial: { color: '#D7B45A', fontSize: 17, fontWeight: '900' },
  organizerName: { color: '#EEF2EF', fontSize: 13, fontWeight: '900' },
  organizerMeta: { color: '#78857D', fontSize: 9.5, marginTop: 3 },
  visibilityList: { gap: 7, marginTop: 9 },
  visibilityRow: { minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#344039', backgroundColor: '#0D1410', padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center' },
  visibilityRowActive: { borderColor: '#766129', backgroundColor: '#1D1B10' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#66736B', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#D7B45A' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D7B45A' },
  visibilityTitle: { color: '#D7DDD9', fontSize: 11.5, fontWeight: '900' },
  visibilityTitleActive: { color: '#E7C464' },
  visibilityCopy: { color: '#7D8981', fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  communityPicker: { marginTop: 12 },
  communityNote: { color: '#8F9A93', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginTop: 10 },
  segmentButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1410' },
  segmentActive: { backgroundColor: '#322A14' },
  segmentText: { color: '#9FA9A3', fontWeight: '900', fontSize: 11 },
  segmentTextActive: { color: '#E7C464' },
  errorCard: { marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: '#75443E', backgroundColor: '#291816', padding: 11 },
  error: { color: '#FFAAA0', fontSize: 11, lineHeight: 16 },
  footer: { minHeight: 76, borderTopWidth: 1, borderTopColor: '#334038', backgroundColor: '#0D1410', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerCopy: { flex: 1 },
  footerCount: { color: '#D9DFDB', fontSize: 10.5, fontWeight: '900' },
  footerHint: { color: '#718078', fontSize: 9.5, marginTop: 2 },
  primary: { minHeight: 48, minWidth: 132, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' },
});
