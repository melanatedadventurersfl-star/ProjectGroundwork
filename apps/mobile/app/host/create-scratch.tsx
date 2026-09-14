import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, type CommunityGroup } from '../../src/community/api';
import { isPeopleCommunity } from '../../src/community/communityModel';
import { createDraftOuting, getOutingHostAccess, type EventLocationType } from '../../src/hosting/api';
import { createCampaignWorkspace } from '../../src/hosting/creation';
import { getActiveHostOrganizationContext, getPrimaryHostCommunityId, listManagedHostCommunityIds, setHostOutingInterests, setPrimaryHostCommunity } from '../../src/hosting/communityIntegration';
import { EventDateTimeField } from '../../src/hosting/EventDateTimeField';
import { addEventComponent } from '../../src/hosting/eventBuilder';
import { resolveEventBuilderConfig, type EventBuilderConfig, type EventBuilderDifficulty } from '../../src/hosting/eventBuilderConfig';
import { loadLocalEventDraft, removeLocalEventDraft, saveLocalEventDraft, type LocalEventDraft } from '../../src/hosting/eventDraftStorage';
import { uploadEventCover } from '../../src/hosting/eventMedia';
import { EventTagPicker } from '../../src/hosting/EventTagPicker';
import { setOutingVisibility, type EventVisibility } from '../../src/hosting/hostProfiles';
import { addGeneralAdmissionTicket } from '../../src/hosting/tickets';
import { getActiveOrganization, type OrganizationWorkspace } from '../../src/platform/organizations';

const difficulties: EventBuilderDifficulty[] = ['easy', 'moderate', 'challenging'];
const locationTypes: Array<{ value: EventLocationType; label: string }> = [
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'tbd', label: 'TBD' },
];

type VisibilityOption = { value: EventVisibility; label: string; copy: string };
type SaveState = 'loading' | 'saving' | 'saved' | 'error';
type SectionKey = 'details' | 'schedule' | 'organizer' | 'access' | 'admission';
type MissingItem = { key: string; label: string; section: SectionKey; complete: boolean };

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

function makeCreationKey() {
  return `event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function validDate(value: string | null) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function scheduleValid(startsAt: string | null, endsAt: string | null) {
  if (!validDate(startsAt) || !validDate(endsAt)) return false;
  return new Date(endsAt as string) > new Date(startsAt as string);
}

function formatEventDate(value: string | null) {
  if (!value) return 'Date not added';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not added';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function priceLabel(paid: boolean, price: string) {
  if (!paid) return 'Free';
  const amount = Number.parseFloat(price || '0');
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : 'Paid';
}

function locationLabel(locationType: EventLocationType, venueName: string, city: string, state: string, onlineUrl: string) {
  if (locationType === 'online') return onlineUrl.trim() ? 'Online event' : 'Online link needed';
  if (locationType === 'tbd') return 'Location to be announced';
  const physical = [venueName, city, state].filter(Boolean).join(', ');
  if (locationType === 'hybrid') return physical ? `${physical} + online` : 'Hybrid location needed';
  return physical || 'Location not added';
}

export default function CreateHostOutingScreen() {
  const scrollRef = useRef<any>(null);
  const sectionOffsets = useRef<Record<SectionKey, number>>({ details: 0, schedule: 0, organizer: 0, access: 0, admission: 0 });
  const [builderConfig, setBuilderConfig] = useState<EventBuilderConfig>(() => resolveEventBuilderConfig(null));
  const [activeOrganization, setActiveOrganization] = useState<OrganizationWorkspace | null>(null);
  const [creationKey, setCreationKey] = useState(makeCreationKey());
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Social');
  const [tags, setTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<EventBuilderDifficulty>('easy');
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [managedGroups, setManagedGroups] = useState<CommunityGroup[]>([]);
  const [hostOrganizationId, setHostOrganizationId] = useState<string | null>(null);
  const [hostOrganizationName, setHostOrganizationName] = useState<string | null>(null);
  const [primaryCommunityId, setPrimaryCommunityId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<EventLocationType>('physical');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [capacityMode, setCapacityMode] = useState<'unlimited' | 'limited'>('unlimited');
  const [capacity, setCapacity] = useState('');
  const [meetingInstructions, setMeetingInstructions] = useState('');
  const [showMeetingInstructions, setShowMeetingInstructions] = useState(false);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('0');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverAltText, setCoverAltText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const capacityNumber = useMemo(() => {
    if (capacityMode === 'unlimited') return null;
    const value = Number.parseInt(capacity, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [capacity, capacityMode]);

  const priceNumber = useMemo(() => Number.parseFloat(price || '0'), [price]);
  const difficultyApplies = builderConfig.difficultyEventTypes.includes(category);
  const availableVisibility = useMemo(() => visibilityOptions(builderConfig), [builderConfig]);
  const organizerName = hostOrganizationName ?? activeOrganization?.name ?? 'Current organization';
  const physicalLocationNeeded = locationType === 'physical' || locationType === 'hybrid';
  const onlineLocationNeeded = locationType === 'online' || locationType === 'hybrid';
  const physicalComplete = !physicalLocationNeeded || Boolean(city.trim() && state.trim());
  const onlineComplete = !onlineLocationNeeded || Boolean(onlineUrl.trim());
  const detailsComplete = Boolean(title.trim() && summary.trim() && description.trim() && category.trim());
  const scheduleComplete = scheduleValid(startsAt, endsAt) && physicalComplete && onlineComplete && (capacityMode === 'unlimited' || capacityNumber != null);
  const organizerComplete = Boolean(activeOrganization);
  const accessComplete = visibility !== 'community' || selectedGroupIds.length > 0;
  const admissionComplete = !paid || (Number.isFinite(priceNumber) && priceNumber > 0);
  const locationSummary = locationLabel(locationType, venueName, city, state, onlineUrl);
  const previewCover = coverUri ?? activeOrganization?.coverImageUrl ?? null;

  const missingItems = useMemo<MissingItem[]>(() => [
    { key: 'title', label: 'Event title', section: 'details', complete: Boolean(title.trim()) },
    { key: 'summary', label: 'Short description', section: 'details', complete: Boolean(summary.trim()) },
    { key: 'description', label: 'Full description', section: 'details', complete: Boolean(description.trim()) },
    { key: 'startsAt', label: 'Start date and time', section: 'schedule', complete: validDate(startsAt) },
    { key: 'endsAt', label: 'End date and time', section: 'schedule', complete: scheduleValid(startsAt, endsAt) },
    { key: 'physical', label: 'Physical location', section: 'schedule', complete: physicalComplete },
    { key: 'online', label: 'Online link', section: 'schedule', complete: onlineComplete },
    { key: 'capacity', label: 'Capacity', section: 'schedule', complete: capacityMode === 'unlimited' || capacityNumber != null },
    { key: 'access', label: 'Access group', section: 'access', complete: accessComplete },
    { key: 'price', label: 'Ticket price', section: 'admission', complete: admissionComplete },
  ].filter((item) => {
    if (item.key === 'physical') return physicalLocationNeeded;
    if (item.key === 'online') return onlineLocationNeeded;
    if (item.key === 'capacity') return capacityMode === 'limited';
    if (item.key === 'access') return visibility === 'community';
    if (item.key === 'price') return paid;
    return true;
  }), [accessComplete, admissionComplete, capacityMode, capacityNumber, description, endsAt, onlineComplete, onlineLocationNeeded, paid, physicalComplete, physicalLocationNeeded, priceNumber, startsAt, summary, title, visibility]);

  const requiredComplete = missingItems.filter((item) => item.complete).length;
  const requiredTotal = missingItems.length;
  const allRequiredComplete = requiredComplete === requiredTotal;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [nextGroups, hostContext, organization] = await Promise.all([
          getGroups(),
          getActiveHostOrganizationContext(),
          getActiveOrganization(),
        ]);
        if (!mounted) return;
        const peopleGroups = nextGroups.filter(isPeopleCommunity);
        setGroups(peopleGroups);
        setActiveOrganization(organization);

        const nextConfig = resolveEventBuilderConfig(organization);
        setBuilderConfig(nextConfig);

        const stored = organization ? await loadLocalEventDraft(organization.id).catch(() => null) : null;
        if (!mounted) return;
        if (stored) {
          hydrateStoredDraft(stored);
        } else {
          setCategory(nextConfig.defaultEventType);
          setState(nextConfig.defaultState);
          if (nextConfig.defaultCapacity != null) {
            setCapacityMode('limited');
            setCapacity(String(nextConfig.defaultCapacity));
          }
          const matchingTag = nextConfig.tags.find((item) => item.toLowerCase() === nextConfig.defaultEventType.toLowerCase());
          setTags(matchingTag ? [matchingTag] : []);
          setCreationKey(makeCreationKey());
        }

        if (!hostContext) {
          setHostOrganizationId(null);
          setHostOrganizationName(null);
          setManagedGroups([]);
          setPrimaryCommunityId(null);
        } else {
          const [managedIds, primaryId] = await Promise.all([
            listManagedHostCommunityIds(hostContext.id),
            getPrimaryHostCommunityId(hostContext.id),
          ]);
          if (!mounted) return;
          const managedSet = new Set(managedIds);
          const nextManaged = peopleGroups.filter((group) => managedSet.has(group.id));
          setHostOrganizationId(hostContext.id);
          setHostOrganizationName(hostContext.name);
          setManagedGroups(nextManaged);
          const resolvedPrimary = stored?.primaryCommunityId && managedSet.has(stored.primaryCommunityId)
            ? stored.primaryCommunityId
            : primaryId && managedSet.has(primaryId)
              ? primaryId
              : nextManaged.length === 1
                ? nextManaged[0]?.id ?? null
                : null;
          setPrimaryCommunityId(resolvedPrimary);
        }
        setSaveState(stored ? 'saved' : 'loading');
      } catch {
        if (!mounted) return;
        setGroups([]);
        setManagedGroups([]);
        setHostOrganizationId(null);
        setHostOrganizationName(null);
        setPrimaryCommunityId(null);
      } finally {
        if (mounted) setDraftHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (visibility === 'community' && !builderConfig.showCommunityVisibility) {
      setVisibility('public');
      setSelectedGroupIds([]);
    }
  }, [builderConfig.showCommunityVisibility, visibility]);

  useEffect(() => {
    if (!draftHydrated || !activeOrganization) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      void saveLocalEventDraft(buildLocalDraft(activeOrganization.id))
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 650);
    return () => clearTimeout(timer);
  }, [activeOrganization, capacity, capacityMode, category, city, coverAltText, coverUri, creationKey, description, difficulty, draftHydrated, endsAt, locationType, meetingInstructions, onlineUrl, paid, price, primaryCommunityId, selectedGroupIds, startsAt, state, summary, tags, title, venueName, visibility]);

  function hydrateStoredDraft(draft: LocalEventDraft) {
    setCreationKey(draft.creationKey);
    setTitle(draft.title);
    setSummary(draft.summary);
    setDescription(draft.description);
    setCategory(draft.category);
    setTags(draft.tags);
    setDifficulty(draft.difficulty);
    setStartsAt(draft.startsAt);
    setEndsAt(draft.endsAt);
    setLocationType(draft.locationType);
    setVenueName(draft.venueName);
    setCity(draft.city);
    setState(draft.state);
    setOnlineUrl(draft.onlineUrl);
    setCapacityMode(draft.capacityMode);
    setCapacity(draft.capacity);
    setMeetingInstructions(draft.meetingInstructions);
    setShowMeetingInstructions(Boolean(draft.meetingInstructions));
    setVisibility(draft.visibility);
    setSelectedGroupIds(draft.selectedGroupIds);
    setPrimaryCommunityId(draft.primaryCommunityId);
    setPaid(draft.paid);
    setPrice(draft.price);
    setCoverUri(draft.coverUri);
    setCoverAltText(draft.coverAltText);
  }

  function buildLocalDraft(organizationId: string): LocalEventDraft {
    return {
      version: 2,
      organizationId,
      creationKey,
      title,
      summary,
      description,
      category,
      tags,
      difficulty,
      startsAt,
      endsAt,
      locationType,
      venueName,
      city,
      state,
      onlineUrl,
      capacityMode,
      capacity,
      meetingInstructions,
      visibility,
      selectedGroupIds,
      primaryCommunityId,
      paid,
      price,
      coverUri,
      coverAltText,
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveNow() {
    if (!activeOrganization) return;
    setSaveState('saving');
    try {
      await saveLocalEventDraft(buildLocalDraft(activeOrganization.id));
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  async function saveAndExit() {
    await saveNow();
    router.back();
  }

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]);
  }

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    const matchingTag = builderConfig.tags.find((item) => item.toLowerCase() === nextCategory.toLowerCase());
    if (matchingTag) setTags((current) => current.includes(matchingTag) ? current : [...current, matchingTag]);
  }

  function toggleSection(section: SectionKey) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function goToSection(section: SectionKey) {
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(section);
      return next;
    });
    setShowMissing(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsets.current[section] - 10), animated: true }), 50);
  }

  function setStart(value: string) {
    setStartsAt(value);
    if (!endsAt || new Date(endsAt) <= new Date(value)) {
      setEndsAt(new Date(new Date(value).getTime() + 2 * 60 * 60 * 1000).toISOString());
    }
  }

  async function pickCover() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to add an event cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.88,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setCoverUri(result.assets[0].uri);
  }

  async function createOuting() {
    if (saving) return;
    const firstMissing = missingItems.find((item) => !item.complete);
    if (firstMissing) {
      setShowMissing(true);
      goToSection(firstMissing.section);
      return;
    }

    setSaving(true);
    setError('');
    setCreatedDraftId(null);
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Event management permission is required.');
      if (paid && !access.paidEnabled) throw new Error('Paid events are not enabled for this account yet.');

      const priceCents = paid ? Math.round(priceNumber * 100) : 0;
      if (primaryCommunityId && hostOrganizationId) await setPrimaryHostCommunity(hostOrganizationId, primaryCommunityId);

      const outing = await createDraftOuting({
        title,
        summary,
        description,
        category,
        difficulty,
        difficultyApplicable: difficultyApplies,
        startsAt: startsAt as string,
        endsAt: endsAt as string,
        locationType,
        city,
        state,
        venueName,
        onlineUrl,
        capacity: capacityNumber,
        meetingInstructions,
        hostOrganizationId,
        platformOrganizationId: activeOrganization?.id ?? null,
        creationKey,
      });
      setCreatedDraftId(outing.id);

      const warnings: string[] = [];
      await setOutingVisibility(outing.id, visibility, selectedGroupIds).catch((caught) => warnings.push(`Access settings: ${caught instanceof Error ? caught.message : 'not saved'}`));
      await setHostOutingInterests(outing.id, tags).catch((caught) => warnings.push(`${builderConfig.labels.tags}: ${caught instanceof Error ? caught.message : 'not saved'}`));
      await addGeneralAdmissionTicket(outing.id, capacityNumber, priceCents).catch((caught) => warnings.push(`Admission: ${caught instanceof Error ? caught.message : 'not configured'}`));
      if (coverUri) {
        await uploadEventCover({ adventureId: outing.id, localUri: coverUri, altText: coverAltText })
          .catch((caught) => warnings.push(`Cover image: ${caught instanceof Error ? caught.message : 'not uploaded'}`));
      }

      let campaign: Awaited<ReturnType<typeof createCampaignWorkspace>> | null = null;
      try {
        campaign = await createCampaignWorkspace({
          adventureId: outing.id,
          title: outing.title,
          location: locationSummary,
          startsAt: outing.starts_at,
          endsAt: outing.ends_at,
        });
      } catch (caught) {
        warnings.push(`Workspace: ${caught instanceof Error ? caught.message : 'not created'}`);
      }
      if (campaign) {
        await Promise.allSettled([
          addEventComponent(campaign.id, 'tickets', outing.starts_at),
          addEventComponent(campaign.id, 'team', outing.starts_at),
          addEventComponent(campaign.id, 'finance', outing.starts_at),
        ]);
      }

      if (activeOrganization) await removeLocalEventDraft(activeOrganization.id).catch(() => undefined);
      const warningQuery = warnings.length ? `?warning=${encodeURIComponent(warnings.join(' '))}` : '';
      router.replace(`/host/review/${outing.id}${warningQuery}` as never);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to create this event draft.';
      setError(createdDraftId ? `Your draft was created, but setup stopped: ${message}` : message);
    } finally {
      setSaving(false);
    }
  }

  const activeVisibility = availableVisibility.find((item) => item.value === visibility) ?? availableVisibility[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => void saveAndExit()} hitSlop={10}><Text style={styles.back}>‹ Save & Exit</Text></Pressable>
        <View style={styles.topActions}>
          <Text style={[styles.saveStatus, saveState === 'error' && styles.saveStatusError]}>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved on device' : saveState === 'error' ? 'Save failed' : 'Draft'}</Text>
          <Pressable onPress={() => setShowPreview((current) => !current)} hitSlop={10}><Text style={styles.previewAction}>{showPreview ? 'Hide preview' : 'Preview'}</Text></Pressable>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>BUILD MANUALLY</Text>
        <Text style={styles.title}>Create an event</Text>
        <Text style={styles.subtitle}>Add the attendee-facing essentials. Ticketing, staffing, marketing, and operations stay in the event workspace.</Text>

        {activeOrganization ? (
          <View style={styles.tenantPill}>
            <Text style={styles.tenantLabel}>WORKSPACE</Text>
            <Text style={styles.tenantName}>{activeOrganization.name}</Text>
          </View>
        ) : null}

        {showPreview ? (
          <DraftPreview
            coverUri={previewCover}
            logoUrl={activeOrganization?.logoUrl ?? null}
            organizerName={organizerName}
            title={title}
            category={category}
            startsAt={startsAt}
            location={locationSummary}
            summary={summary}
            admission={priceLabel(paid, price)}
          />
        ) : null}

        <Section
          id="details"
          number="01"
          title="Event details"
          copy="Give the event a clear identity."
          complete={detailsComplete}
          collapsed={collapsed.has('details')}
          summary={detailsComplete ? `${title} · ${category}${tags.length ? ` · ${tags.length} ${builderConfig.labels.tags.toLowerCase()}` : ''}` : undefined}
          onToggle={() => toggleSection('details')}
          onLayout={(y) => { sectionOffsets.current.details = y; }}
        >
          <Text style={styles.label}>Cover image</Text>
          <Pressable style={styles.coverPicker} onPress={() => void pickCover()}>
            {previewCover ? (
              <ImageBackground source={{ uri: previewCover }} style={styles.coverPreview} imageStyle={styles.coverImage}>
                <View style={styles.coverShade} /><Text style={styles.coverAction}>Change cover</Text>
              </ImageBackground>
            ) : (
              <View style={styles.coverEmpty}><Text style={styles.coverPlus}>＋</Text><Text style={styles.coverTitle}>Add cover image</Text><Text style={styles.coverCopy}>Optional now. Recommended before publishing.</Text></View>
            )}
          </Pressable>
          {coverUri ? <Field label="Image description" value={coverAltText} onChangeText={setCoverAltText} placeholder="Describe the image for accessibility" /> : null}

          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Customer appreciation dinner" />
          <Field label="Short description" value={summary} onChangeText={setSummary} placeholder="A one-line reason to attend." />
          <Field label="Full description" value={description} onChangeText={setDescription} placeholder="What should someone know before they decide to join?" multiline />

          <Text style={styles.label}>Event type</Text>
          <View style={styles.chips}>
            {builderConfig.eventTypes.map((item) => <Chip key={item} label={item} active={category === item} onPress={() => chooseCategory(item)} />)}
          </View>

          <EventTagPicker label={builderConfig.labels.tags} options={builderConfig.tags} selected={tags} allowCustomTags={builderConfig.allowCustomTags} onChange={setTags} />

          {difficultyApplies ? (
            <>
              <Text style={styles.label}>Difficulty</Text>
              <View style={styles.chips}>
                {difficulties.map((item) => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} active={difficulty === item} onPress={() => setDifficulty(item)} />)}
              </View>
            </>
          ) : null}
        </Section>

        <Section
          id="schedule"
          number="02"
          title="When & where"
          copy="Set the schedule, location mode, and capacity."
          complete={scheduleComplete}
          collapsed={collapsed.has('schedule')}
          summary={scheduleComplete ? `${formatEventDate(startsAt)} · ${locationSummary} · ${capacityMode === 'limited' ? `${capacityNumber} max` : 'No capacity limit'}` : undefined}
          onToggle={() => toggleSection('schedule')}
          onLayout={(y) => { sectionOffsets.current.schedule = y; }}
        >
          <EventDateTimeField label="Starts" value={startsAt} onChange={setStart} />
          <EventDateTimeField label="Ends" value={endsAt} minimum={startsAt} fallbackOffsetMinutes={120} onChange={setEndsAt} />

          <Text style={styles.label}>Location type</Text>
          <View style={styles.chips}>{locationTypes.map((item) => <Chip key={item.value} label={item.label} active={locationType === item.value} onPress={() => setLocationType(item.value)} />)}</View>

          {physicalLocationNeeded ? (
            <>
              <Field label="Venue or location" value={venueName} onChangeText={setVenueName} placeholder="Venue, building, park, or meeting place" />
              <View style={styles.twoCol}>
                <View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} placeholder="Jacksonville" /></View>
                <View style={styles.stateCol}><Field label="State" value={state} onChangeText={setState} placeholder="FL" /></View>
              </View>
            </>
          ) : null}

          {onlineLocationNeeded ? <Field label="Online meeting or streaming link" value={onlineUrl} onChangeText={setOnlineUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" /> : null}
          {locationType === 'tbd' ? <Text style={styles.helper}>You can create the draft now and add the final location before publishing.</Text> : null}

          <Text style={styles.label}>{builderConfig.labels.capacity}</Text>
          <View style={styles.segment}>
            <Pressable style={[styles.segmentButton, capacityMode === 'unlimited' && styles.segmentActive]} onPress={() => { setCapacityMode('unlimited'); setCapacity(''); }}><Text style={[styles.segmentText, capacityMode === 'unlimited' && styles.segmentTextActive]}>Unlimited</Text></Pressable>
            <Pressable style={[styles.segmentButton, capacityMode === 'limited' && styles.segmentActive]} onPress={() => setCapacityMode('limited')}><Text style={[styles.segmentText, capacityMode === 'limited' && styles.segmentTextActive]}>Limited</Text></Pressable>
          </View>
          {capacityMode === 'limited' ? <Field label="Maximum attendees" value={capacity} onChangeText={setCapacity} placeholder="20" keyboardType="number-pad" /> : null}

          {showMeetingInstructions ? (
            <>
              <Field label={builderConfig.labels.meetingInstructions} value={meetingInstructions} onChangeText={setMeetingInstructions} placeholder="Parking, arrival window, check-in, or meeting details." multiline />
              <Pressable onPress={() => { setShowMeetingInstructions(false); setMeetingInstructions(''); }}><Text style={styles.optionalAction}>Remove instructions</Text></Pressable>
            </>
          ) : (
            <Pressable style={styles.optionalButton} onPress={() => setShowMeetingInstructions(true)}><Text style={styles.optionalButtonText}>+ Add {builderConfig.labels.meetingInstructions.toLowerCase()}</Text></Pressable>
          )}
        </Section>

        <Section
          id="organizer"
          number="03"
          title={builderConfig.labels.organizer}
          copy="This identity appears with the event."
          complete={organizerComplete}
          collapsed={collapsed.has('organizer')}
          summary={organizerName}
          onToggle={() => toggleSection('organizer')}
          onLayout={(y) => { sectionOffsets.current.organizer = y; }}
        >
          <View style={styles.organizerRow}>
            {activeOrganization?.logoUrl ? <Image source={{ uri: activeOrganization.logoUrl }} style={styles.organizerLogo} /> : <View style={styles.organizerMark}><Text style={styles.organizerInitial}>{organizerName.charAt(0).toUpperCase()}</Text></View>}
            <View style={styles.flex}><Text style={styles.organizerName}>{organizerName}</Text><Text style={styles.organizerMeta}>{hostOrganizationName ? 'Public event identity' : 'Active organization'}</Text></View>
          </View>
          {builderConfig.showCommunityVisibility && managedGroups.length ? (
            <>
              <Text style={styles.smallLabel}>Primary community</Text>
              <View style={styles.chips}>{managedGroups.map((group) => <Chip key={group.id} label={group.name} active={primaryCommunityId === group.id} onPress={() => setPrimaryCommunityId(group.id)} />)}</View>
            </>
          ) : null}
        </Section>

        <Section
          id="access"
          number="04"
          title="Access"
          copy="Choose who can discover and open this event."
          complete={accessComplete}
          collapsed={collapsed.has('access')}
          summary={activeVisibility?.label}
          onToggle={() => toggleSection('access')}
          onLayout={(y) => { sectionOffsets.current.access = y; }}
        >
          <View style={styles.chips}>{availableVisibility.map((option) => <Chip key={option.value} label={option.label} active={visibility === option.value} onPress={() => setVisibility(option.value)} />)}</View>
          <View style={styles.activeChoiceCopy}><Text style={styles.activeChoiceTitle}>{activeVisibility?.label}</Text><Text style={styles.activeChoiceText}>{activeVisibility?.copy}</Text></View>
          {visibility === 'community' ? (
            <View style={styles.communityPicker}>
              <Text style={styles.label}>Allowed communities</Text>
              {groups.length ? <View style={styles.chips}>{groups.map((group) => <Chip key={group.id} label={group.name} active={selectedGroupIds.includes(group.id)} onPress={() => toggleGroup(group.id)} />)}</View> : <Text style={styles.communityNote}>No communities are available to select.</Text>}
            </View>
          ) : null}
        </Section>

        <Section
          id="admission"
          number="05"
          title="Admission"
          copy="Set the starting admission model."
          complete={admissionComplete}
          collapsed={collapsed.has('admission')}
          summary={priceLabel(paid, price)}
          onToggle={() => toggleSection('admission')}
          onLayout={(y) => { sectionOffsets.current.admission = y; }}
        >
          <View style={styles.segment}>
            <Pressable style={[styles.segmentButton, !paid && styles.segmentActive]} onPress={() => { setPaid(false); setPrice('0'); }}><Text style={[styles.segmentText, !paid && styles.segmentTextActive]}>Free</Text></Pressable>
            <Pressable style={[styles.segmentButton, paid && styles.segmentActive]} onPress={() => setPaid(true)}><Text style={[styles.segmentText, paid && styles.segmentTextActive]}>Paid</Text></Pressable>
          </View>
          {paid ? <Field label="Starting ticket price" value={price} onChangeText={setPrice} placeholder="35.00" keyboardType="decimal-pad" prefix="$" /> : null}
          <Text style={styles.helper}>You can add more ticket types, early-bird pricing, discounts, and add-ons from the event workspace.</Text>
        </Section>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{createdDraftId ? 'Draft created with an issue' : 'Could not create draft'}</Text>
            <Text style={styles.error}>{error}</Text>
            {createdDraftId ? <Pressable style={styles.errorButton} onPress={() => router.replace(`/host/review/${createdDraftId}` as never)}><Text style={styles.errorButtonText}>Open saved draft</Text></Pressable> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.footerCopy} onPress={() => setShowMissing(true)}>
          <Text style={styles.footerCount}>{requiredComplete} of {requiredTotal} required</Text>
          <Text style={styles.footerHint}>{allRequiredComplete ? 'Ready to create the event draft' : 'Tap to see what is missing'}</Text>
        </Pressable>
        <Pressable disabled={saving} style={[styles.primary, saving && styles.primaryDisabled]} onPress={() => void createOuting()}>
          {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Draft</Text>}
        </Pressable>
      </View>

      <MissingFieldsModal visible={showMissing} items={missingItems.filter((item) => !item.complete)} onClose={() => setShowMissing(false)} onChoose={(item) => goToSection(item.section)} />
    </SafeAreaView>
  );
}

function Section({ number, title, copy, complete, collapsed, summary, onToggle, onLayout, children }: { number: string; id: SectionKey; title: string; copy: string; complete: boolean; collapsed: boolean; summary?: string; onToggle: () => void; onLayout: (y: number) => void; children: ReactNode }) {
  return (
    <View style={styles.section} onLayout={(event) => onLayout(event.nativeEvent.layout.y)}>
      <Pressable style={styles.sectionTop} onPress={onToggle}>
        <Text style={styles.sectionNumber}>{complete ? '✓' : number}</Text>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {collapsed && summary ? <Text style={styles.sectionSummary} numberOfLines={2}>{summary}</Text> : <Text style={styles.sectionCopy}>{copy}</Text>}
        </View>
        <Text style={styles.sectionToggle}>{collapsed ? 'Edit' : 'Hide'}</Text>
      </Pressable>
      {!collapsed ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function DraftPreview({ coverUri, logoUrl, organizerName, title, category, startsAt, location, summary, admission }: { coverUri: string | null; logoUrl: string | null; organizerName: string; title: string; category: string; startsAt: string | null; location: string; summary: string; admission: string }) {
  return (
    <View style={styles.previewCard}>
      <ImageBackground source={coverUri ? { uri: coverUri } : undefined} style={styles.previewHero} imageStyle={styles.previewHeroImage}>
        <View style={styles.previewShade} />
        <View style={styles.previewPill}><Text style={styles.previewPillText}>{category || 'Event'}</Text></View>
        <View><Text style={styles.previewTitle}>{title.trim() || 'Untitled event'}</Text><Text style={styles.previewMeta}>{formatEventDate(startsAt)} · {admission}</Text></View>
      </ImageBackground>
      <View style={styles.previewBodyWrap}>
        <View style={styles.previewOrganizer}>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.previewLogo} /> : <View style={styles.previewLogoFallback}><Text style={styles.previewLogoText}>{organizerName.charAt(0).toUpperCase()}</Text></View>}<Text style={styles.previewOrganizerText}>{organizerName}</Text></View>
        <Text style={styles.previewLocation}>{location}</Text>
        <Text style={styles.previewBody}>{summary.trim() || 'Your short description will appear here.'}</Text>
      </View>
    </View>
  );
}

function MissingFieldsModal({ visible, items, onClose, onChoose }: { visible: boolean; items: MissingItem[]; onClose: () => void; onChoose: (item: MissingItem) => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.missingCard}>
          <View style={styles.missingHeader}><View><Text style={styles.missingEyebrow}>REQUIRED DETAILS</Text><Text style={styles.missingTitle}>{items.length ? `${items.length} item${items.length === 1 ? '' : 's'} left` : 'Ready to create'}</Text></View><Pressable onPress={onClose}><Text style={styles.missingClose}>Close</Text></Pressable></View>
          {items.length ? items.map((item) => <Pressable key={item.key} style={styles.missingRow} onPress={() => onChoose(item)}><Text style={styles.missingRowText}>{item.label}</Text><Text style={styles.missingChevron}>›</Text></Pressable>) : <Text style={styles.missingDone}>All required event details are complete.</Text>}
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, prefix, multiline = false, ...props }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput {...props} multiline={multiline} placeholderTextColor="#68756D" style={[styles.input, multiline && styles.multiline]} textAlignVertical={multiline ? 'top' : 'center'} />
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  topBar: { minHeight: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26322B' },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  saveStatus: { color: '#748078', fontSize: 8.5, fontWeight: '800' },
  saveStatusError: { color: '#E9968D' },
  previewAction: { color: '#C7D0CA', fontSize: 11, fontWeight: '900' },
  content: { padding: 18, paddingBottom: 124, maxWidth: 760, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#96A199', fontSize: 11, lineHeight: 17, marginTop: 6, maxWidth: 620 },
  tenantPill: { alignSelf: 'flex-start', marginTop: 13, borderRadius: 10, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', paddingHorizontal: 10, paddingVertical: 7 },
  tenantLabel: { color: '#68756D', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  tenantName: { color: '#DCE3DE', fontSize: 10, fontWeight: '900', marginTop: 2 },
  previewCard: { marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#111814', overflow: 'hidden' },
  previewHero: { minHeight: 220, padding: 14, justifyContent: 'space-between', backgroundColor: '#1C2A21' },
  previewHeroImage: { resizeMode: 'cover' },
  previewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,12,8,.45)' },
  previewPill: { alignSelf: 'flex-start', borderRadius: 99, backgroundColor: 'rgba(11,16,13,.78)', paddingHorizontal: 9, paddingVertical: 6 },
  previewPillText: { color: '#E7C464', fontSize: 8, fontWeight: '900' },
  previewTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 28, fontWeight: '900' },
  previewMeta: { color: '#D0D8D2', fontSize: 9.5, marginTop: 5 },
  previewBodyWrap: { padding: 13 },
  previewOrganizer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewLogo: { width: 28, height: 28, borderRadius: 8 },
  previewLogoFallback: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#1B2B21', alignItems: 'center', justifyContent: 'center' },
  previewLogoText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  previewOrganizerText: { color: '#C9D2CC', fontSize: 10, fontWeight: '900' },
  previewLocation: { color: '#8A968E', fontSize: 9.5, marginTop: 9 },
  previewBody: { color: '#D0D7D2', fontSize: 11, lineHeight: 17, marginTop: 7 },
  section: { marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#101713', overflow: 'hidden' },
  sectionTop: { flexDirection: 'row', gap: 11, padding: 14, alignItems: 'flex-start' },
  sectionNumber: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingTop: 2, minWidth: 16 },
  sectionTitle: { color: '#F3F6F4', fontSize: 16, fontWeight: '900' },
  sectionCopy: { color: '#7F8B83', fontSize: 10, lineHeight: 15, marginTop: 3 },
  sectionSummary: { color: '#AEB8B2', fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  sectionToggle: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', paddingTop: 3 },
  sectionBody: { padding: 14, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#26322B' },
  fieldWrap: { marginTop: 12 },
  label: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '900', marginTop: 12, marginBottom: 6 },
  smallLabel: { color: '#8E9992', fontSize: 9, fontWeight: '900', marginTop: 12, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', borderRadius: 12 },
  input: { flex: 1, minHeight: 48, color: '#FFF8E8', paddingHorizontal: 12, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: 12 },
  prefix: { color: '#D7B45A', fontSize: 15, fontWeight: '900', marginLeft: 12 },
  coverPicker: { minHeight: 120, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#415048', overflow: 'hidden', backgroundColor: '#0C130F' },
  coverPreview: { minHeight: 150, justifyContent: 'flex-end', padding: 12 },
  coverImage: { borderRadius: 13 },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,12,8,.28)' },
  coverAction: { color: '#FFF8E8', fontSize: 10, fontWeight: '900', alignSelf: 'flex-start', backgroundColor: 'rgba(9,14,11,.72)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  coverEmpty: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', padding: 16 },
  coverPlus: { color: '#D7B45A', fontSize: 23 },
  coverTitle: { color: '#D7DDD9', fontSize: 11, fontWeight: '900', marginTop: 3 },
  coverCopy: { color: '#718078', fontSize: 8.5, marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#3A473F', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121914' },
  chipActive: { backgroundColor: '#322A14', borderColor: '#8A6A25' },
  chipText: { color: '#AAB4AE', fontSize: 10, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  stateCol: { width: 94 },
  helper: { color: '#6F7C74', fontSize: 9.5, lineHeight: 14, marginTop: 8 },
  optionalButton: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  optionalButtonText: { color: '#AEB8B2', fontSize: 10.5, fontWeight: '900' },
  optionalAction: { color: '#7E8A82', fontSize: 9.5, fontWeight: '800', marginTop: 7 },
  organizerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8 },
  organizerMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#1B2B21', borderWidth: 1, borderColor: '#47604D', alignItems: 'center', justifyContent: 'center' },
  organizerLogo: { width: 42, height: 42, borderRadius: 12 },
  organizerInitial: { color: '#D7B45A', fontSize: 17, fontWeight: '900' },
  organizerName: { color: '#EEF2EF', fontSize: 13, fontWeight: '900' },
  organizerMeta: { color: '#78857D', fontSize: 9.5, marginTop: 3 },
  activeChoiceCopy: { marginTop: 10, borderRadius: 11, backgroundColor: '#0D1410', padding: 10 },
  activeChoiceTitle: { color: '#E7C464', fontSize: 10.5, fontWeight: '900' },
  activeChoiceText: { color: '#7D8981', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  communityPicker: { marginTop: 8 },
  communityNote: { color: '#8F9A93', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginTop: 8 },
  segmentButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1410' },
  segmentActive: { backgroundColor: '#322A14' },
  segmentText: { color: '#9FA9A3', fontWeight: '900', fontSize: 11 },
  segmentTextActive: { color: '#E7C464' },
  errorCard: { marginTop: 14, borderRadius: 13, borderWidth: 1, borderColor: '#75443E', backgroundColor: '#291816', padding: 12 },
  errorTitle: { color: '#FFD2CC', fontSize: 11, fontWeight: '900' },
  error: { color: '#FFAAA0', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  errorButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: '#8A5A50', justifyContent: 'center', paddingHorizontal: 10, marginTop: 10 },
  errorButtonText: { color: '#FFD2CC', fontSize: 9.5, fontWeight: '900' },
  footer: { minHeight: 78, borderTopWidth: 1, borderTopColor: '#334038', backgroundColor: '#0D1410', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerCopy: { flex: 1 },
  footerCount: { color: '#D9DFDB', fontSize: 10.5, fontWeight: '900' },
  footerHint: { color: '#718078', fontSize: 9.5, marginTop: 2 },
  primary: { minHeight: 48, minWidth: 128, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' },
  missingCard: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: '#344039', backgroundColor: '#111814', padding: 16, paddingBottom: 28 },
  missingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  missingEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  missingTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 3 },
  missingClose: { color: '#AAB4AE', fontSize: 10, fontWeight: '900', paddingVertical: 4 },
  missingRow: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C3731', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missingRowText: { color: '#D0D8D2', fontSize: 10.5, fontWeight: '800' },
  missingChevron: { color: '#D7B45A', fontSize: 18 },
  missingDone: { color: '#8FD09E', fontSize: 10.5, lineHeight: 16, paddingVertical: 8 },
});
