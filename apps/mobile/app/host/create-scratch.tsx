import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, type CommunityGroup } from '../../src/community/api';
import { isPeopleCommunity } from '../../src/community/communityModel';
import { createDraftOuting, getOutingHostAccess, type EventLocationType } from '../../src/hosting/api';
import { createCampaignWorkspace } from '../../src/hosting/creation';
import { getActiveHostOrganizationContext, getPrimaryHostCommunityId, listManagedHostCommunityIds, setHostOutingInterests, setPrimaryHostCommunity } from '../../src/hosting/communityIntegration';
import { EventDateTimeField } from '../../src/hosting/EventDateTimeField';
import { addEventComponent } from '../../src/hosting/eventBuilder';
import { resolveEventBuilderConfig, type EventBuilderConfig, type EventBuilderDifficulty } from '../../src/hosting/eventBuilderConfig';
import { loadEventBuilderServerDraft, removeEventBuilderServerDraft, saveEventBuilderServerDraft } from '../../src/hosting/eventBuilderDrafts';
import { recommendedEventComponents, resolveEventBuilderTemplate } from '../../src/hosting/eventBuilderTemplates';
import { loadLocalEventDraft, removeLocalEventDraft, saveLocalEventDraft, type LocalEventDraft } from '../../src/hosting/eventDraftStorage';
import { uploadEventCover } from '../../src/hosting/eventMedia';
import { EventTagPicker } from '../../src/hosting/EventTagPicker';
import { setOutingVisibility, type EventVisibility } from '../../src/hosting/hostProfiles';
import { addGeneralAdmissionTicket } from '../../src/hosting/tickets';
import { persistSelectedVenueMetadata } from '../../src/hosting/venueDiscovery';
import { VenueSearchField, type SelectedVenueSnapshot } from '../../src/hosting/VenueSearchField';
import { getActiveOrganization, type OrganizationWorkspace } from '../../src/platform/organizations';

const difficulties: EventBuilderDifficulty[] = ['easy', 'moderate', 'challenging'];
const locationTypes: { value: EventLocationType; label: string }[] = [
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'tbd', label: 'TBD' },
];

const durationOptions = [
  { label: '+1 hr', minutes: 60 },
  { label: '+2 hrs', minutes: 120 },
  { label: '+4 hrs', minutes: 240 },
  { label: 'Next day', minutes: 1440 },
];

type VisibilityOption = { value: EventVisibility; label: string; copy: string };
type SaveState = 'loading' | 'saving' | 'cloud' | 'device' | 'error';
type StepKey = 'basics' | 'schedule' | 'access';

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

function newerDraft(local: LocalEventDraft | null, server: LocalEventDraft | null) {
  if (!local) return server;
  if (!server) return local;
  const localTime = new Date(local.updatedAt).getTime();
  const serverTime = new Date(server.updatedAt).getTime();
  return Number.isFinite(serverTime) && serverTime > localTime ? server : local;
}

export default function CreateHostOutingScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const stepOffsets = useRef<Record<StepKey, number>>({ basics: 0, schedule: 0, access: 0 });
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
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenueSnapshot | null>(null);
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
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>('basics');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [stepError, setStepError] = useState('');

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
  const physicalComplete = !physicalLocationNeeded || Boolean(venueName.trim() && city.trim() && state.trim());
  const onlineComplete = !onlineLocationNeeded || Boolean(onlineUrl.trim());
  const basicsComplete = Boolean(title.trim() && summary.trim() && category.trim());
  const scheduleComplete = scheduleValid(startsAt, endsAt) && physicalComplete && onlineComplete && (capacityMode === 'unlimited' || capacityNumber != null);
  const accessComplete = (visibility !== 'community' || selectedGroupIds.length > 0) && (!paid || (Number.isFinite(priceNumber) && priceNumber > 0));
  const completeSteps = [basicsComplete, scheduleComplete, accessComplete].filter(Boolean).length;
  const allCoreComplete = completeSteps === 3;
  const locationSummary = locationLabel(locationType, venueName, city, state, onlineUrl);
  const previewCover = coverUri ?? activeOrganization?.coverImageUrl ?? null;
  const activeVisibility = availableVisibility.find((item) => item.value === visibility) ?? availableVisibility[0];
  const template = useMemo(() => resolveEventBuilderTemplate(category), [category]);

  function hydrateStoredDraft(draft: LocalEventDraft) {
    setCreationKey(draft.creationKey);
    setTitle(draft.title);
    setSummary(draft.summary);
    setDescription(draft.description);
    setCategory(draft.category);
    setTags(draft.tags ?? []);
    setDifficulty(draft.difficulty);
    setStartsAt(draft.startsAt);
    setEndsAt(draft.endsAt);
    setLocationType(draft.locationType);
    setVenueName(draft.venueName);
    setSelectedVenue((draft.selectedVenue ?? null) as SelectedVenueSnapshot | null);
    setCity(draft.city);
    setState(draft.state);
    setOnlineUrl(draft.onlineUrl);
    setCapacityMode(draft.capacityMode);
    setCapacity(draft.capacity);
    setMeetingInstructions(draft.meetingInstructions);
    setShowMeetingInstructions(Boolean(draft.meetingInstructions));
    setVisibility(draft.visibility);
    setSelectedGroupIds(draft.selectedGroupIds ?? []);
    setPrimaryCommunityId(draft.primaryCommunityId);
    setPaid(draft.paid);
    setPrice(draft.price);
    setCoverUri(draft.coverUri);
    setCoverAltText(draft.coverAltText);
    setShowMoreDetails(draft.showMoreDetails === true);
    setActiveStep(draft.activeStep ?? 'basics');
  }

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

        const [localStored, serverStored] = organization
          ? await Promise.all([
              loadLocalEventDraft(organization.id).catch(() => null),
              loadEventBuilderServerDraft(organization.id).catch(() => null),
            ])
          : [null, null];
        if (!mounted) return;
        const serverPayload = serverStored?.payload && typeof serverStored.payload === 'object'
          ? serverStored.payload as unknown as LocalEventDraft
          : null;
        const stored = newerDraft(localStored, serverPayload);
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
        setSaveState(serverStored ? 'cloud' : stored ? 'device' : 'loading');
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

  const localDraft = useMemo<LocalEventDraft | null>(() => activeOrganization ? {
    version: 2,
    organizationId: activeOrganization.id,
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
    selectedVenue,
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
    activeStep,
    showMoreDetails,
    updatedAt: new Date().toISOString(),
  } : null, [activeOrganization, activeStep, capacity, capacityMode, category, city, coverAltText, coverUri, creationKey, description, difficulty, endsAt, locationType, meetingInstructions, onlineUrl, paid, price, primaryCommunityId, selectedGroupIds, selectedVenue, showMoreDetails, startsAt, state, summary, tags, title, venueName, visibility]);

  useEffect(() => {
    if (!draftHydrated || !localDraft) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      void saveDraftEverywhere(localDraft);
    }, 700);
    return () => clearTimeout(timer);
  }, [draftHydrated, localDraft]);

  async function saveDraftEverywhere(draft: LocalEventDraft) {
    try {
      await saveLocalEventDraft(draft);
    } catch {
      setSaveState('error');
      return false;
    }
    if (!activeOrganization) {
      setSaveState('device');
      return true;
    }
    try {
      await saveEventBuilderServerDraft({
        organizationId: activeOrganization.id,
        creationKey: draft.creationKey,
        payload: draft as unknown as Record<string, unknown>,
      });
      setSaveState('cloud');
    } catch {
      setSaveState('device');
    }
    return true;
  }

  async function saveNow() {
    if (!localDraft) return false;
    setSaveState('saving');
    return saveDraftEverywhere(localDraft);
  }

  async function saveAndExit() {
    const saved = await saveNow();
    if (saved) router.back();
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

  function goToStep(step: StepKey) {
    setActiveStep(step);
    setStepError('');
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, stepOffsets.current[step] - 8), animated: true }), 60);
  }

  function setStart(value: string) {
    setStartsAt(value);
    if (!endsAt || new Date(endsAt) <= new Date(value)) {
      setEndsAt(new Date(new Date(value).getTime() + 2 * 60 * 60 * 1000).toISOString());
    }
  }

  function setDuration(minutes: number) {
    if (!startsAt) {
      setStepError('Choose a start time first.');
      return;
    }
    setEndsAt(new Date(new Date(startsAt).getTime() + minutes * 60 * 1000).toISOString());
    setStepError('');
  }

  function selectVenue(venue: SelectedVenueSnapshot) {
    setSelectedVenue(venue);
    setVenueName(venue.name);
    if (venue.city) setCity(venue.city);
    if (venue.state) setState(venue.state);
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

  function continueFromCurrentStep() {
    if (activeStep === 'basics') {
      if (!basicsComplete) {
        setStepError('Add an event name, event type, and short description.');
        return;
      }
      goToStep('schedule');
      return;
    }
    if (activeStep === 'schedule') {
      if (!scheduleValid(startsAt, endsAt)) {
        setStepError('Add a valid start and end time.');
        return;
      }
      if (!physicalComplete) {
        setStepError('Add the venue or location, city, and state.');
        return;
      }
      if (!onlineComplete) {
        setStepError('Add the online meeting or streaming link.');
        return;
      }
      if (capacityMode === 'limited' && capacityNumber == null) {
        setStepError('Enter a valid maximum attendance.');
        return;
      }
      goToStep('access');
      return;
    }
    if (!accessComplete) {
      setStepError(visibility === 'community' && selectedGroupIds.length === 0
        ? 'Choose at least one allowed community.'
        : 'Enter a valid ticket price for this paid event.');
      return;
    }
    void createOuting();
  }

  async function createOuting() {
    if (saving || !allCoreComplete) return;
    setSaving(true);
    setError('');
    setStepError('');
    setCreatedDraftId(null);
    let createdId: string | null = null;
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Event management permission is required.');
      if (paid && !access.paidEnabled) throw new Error('Paid events are not enabled for this account yet.');
      const priceCents = paid ? Math.round(priceNumber * 100) : 0;
      if (primaryCommunityId && hostOrganizationId) await setPrimaryHostCommunity(hostOrganizationId, primaryCommunityId);

      const outing = await createDraftOuting({
        title,
        summary,
        description: description.trim() || summary.trim(),
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
      createdId = outing.id;
      setCreatedDraftId(outing.id);

      const warnings: string[] = [];
      await setOutingVisibility(outing.id, visibility, selectedGroupIds).catch((caught) => warnings.push(`Access settings: ${caught instanceof Error ? caught.message : 'not saved'}`));
      await setHostOutingInterests(outing.id, tags).catch((caught) => warnings.push(`${builderConfig.labels.tags}: ${caught instanceof Error ? caught.message : 'not saved'}`));
      await addGeneralAdmissionTicket(outing.id, capacityNumber, priceCents).catch((caught) => warnings.push(`Admission: ${caught instanceof Error ? caught.message : 'not configured'}`));
      if (selectedVenue) {
        await persistSelectedVenueMetadata(outing.id, {
          address: selectedVenue.address,
          latitude: selectedVenue.latitude,
          longitude: selectedVenue.longitude,
          placeId: selectedVenue.placeId,
          source: selectedVenue.source,
        }).catch((caught) => warnings.push(`Venue details: ${caught instanceof Error ? caught.message : 'not saved'}`));
      }
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
        const components = recommendedEventComponents(category, locationType, paid);
        const componentResults = await Promise.allSettled(components.map((component) => addEventComponent(campaign!.id, component, outing.starts_at)));
        const failedComponents = componentResults.filter((result) => result.status === 'rejected').length;
        if (failedComponents) warnings.push(`${failedComponents} recommended workspace module${failedComponents === 1 ? '' : 's'} need setup.`);
      }

      if (activeOrganization) {
        await Promise.allSettled([
          removeLocalEventDraft(activeOrganization.id),
          removeEventBuilderServerDraft(activeOrganization.id),
        ]);
      }
      const warningQuery = warnings.length ? `?warning=${encodeURIComponent(warnings.join(' '))}` : '';
      router.replace(`/host/review/${outing.id}${warningQuery}` as never);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to create this event draft.';
      setError(createdId ? `Your event draft was created, but setup stopped: ${message}` : message);
    } finally {
      setSaving(false);
    }
  }

  const footerAction = activeStep === 'access' ? 'Continue to setup' : 'Continue';
  const saveLabel = saveState === 'saving'
    ? 'Saving…'
    : saveState === 'cloud'
      ? 'Saved'
      : saveState === 'device'
        ? 'Saved on device'
        : saveState === 'error'
          ? 'Save failed'
          : 'Draft';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => void saveAndExit()} hitSlop={10}><Text style={styles.back}>‹ Save & Exit</Text></Pressable>
        <View style={styles.topActions}>
          <Text style={[styles.saveStatus, saveState === 'error' && styles.saveStatusError]}>{saveLabel}</Text>
          <Pressable onPress={() => setShowPreview(true)} hitSlop={10}><Text style={styles.previewAction}>Preview</Text></Pressable>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>BUILD EVENT</Text>
        <Text style={styles.title}>Start with the essentials</Text>
        <Text style={styles.subtitle}>Build the event in three steps. The workspace handles tickets, staffing, communications, finance, and operations after this.</Text>

        <View style={styles.contextRow}>
          <View style={styles.workspacePill}>
            <Text style={styles.contextLabel}>WORKSPACE</Text>
            <Text style={styles.contextValue}>{activeOrganization?.name ?? 'Loading organization…'}</Text>
          </View>
          <View style={styles.organizerCompact}>
            {activeOrganization?.logoUrl ? <Image source={{ uri: activeOrganization.logoUrl }} style={styles.organizerLogo} /> : <View style={styles.organizerMark}><Text style={styles.organizerInitial}>{organizerName.charAt(0).toUpperCase()}</Text></View>}
            <View style={styles.flex}><Text style={styles.contextLabel}>ORGANIZER</Text><Text style={styles.organizerName} numberOfLines={1}>{organizerName}</Text></View>
          </View>
        </View>

        <View style={styles.progressRow}>
          <ProgressStep label="Basics" active={activeStep === 'basics'} complete={basicsComplete} onPress={() => goToStep('basics')} />
          <View style={styles.progressLine} />
          <ProgressStep label="Schedule" active={activeStep === 'schedule'} complete={scheduleComplete} onPress={() => goToStep('schedule')} />
          <View style={styles.progressLine} />
          <ProgressStep label="Access" active={activeStep === 'access'} complete={accessComplete} onPress={() => goToStep('access')} />
        </View>

        <StepCard
          title="Event basics"
          copy="Give people a clear reason to care."
          number="01"
          complete={basicsComplete}
          open={activeStep === 'basics'}
          summary={basicsComplete ? `${title} · ${category}` : 'Name, type, and short description'}
          onOpen={() => goToStep('basics')}
          onLayout={(y) => { stepOffsets.current.basics = y; }}
        >
          <Field label="Event name" value={title} onChangeText={setTitle} placeholder="Customer appreciation dinner" returnKeyType="next" />
          <Text style={styles.label}>Event type</Text>
          <View style={styles.chips}>{builderConfig.eventTypes.map((item) => <Chip key={item} label={item} active={category === item} onPress={() => chooseCategory(item)} />)}</View>
          <Field label="Short description" value={summary} onChangeText={setSummary} placeholder="A one-line reason to attend." returnKeyType="done" />

          <View style={styles.templateNote}>
            <Text style={styles.templateEyebrow}>SMART SETUP</Text>
            <Text style={styles.templateTitle}>{template.label}</Text>
            <Text style={styles.templateCopy}>{template.description}</Text>
          </View>

          <Pressable style={styles.optionalButton} onPress={() => setShowMoreDetails((current) => !current)}>
            <Text style={styles.optionalButtonText}>{showMoreDetails ? '− Hide optional details' : '+ Add more details'}</Text>
          </Pressable>

          {showMoreDetails ? (
            <View style={styles.optionalDetails}>
              <Text style={styles.label}>Cover image</Text>
              <Pressable style={styles.coverPicker} onPress={() => void pickCover()}>
                {previewCover ? (
                  <ImageBackground source={{ uri: previewCover }} style={styles.coverPreview} imageStyle={styles.coverImage}>
                    <View style={styles.coverShade} /><Text style={styles.coverAction}>Change cover</Text>
                  </ImageBackground>
                ) : (
                  <View style={styles.coverEmpty}><Text style={styles.coverPlus}>＋</Text><Text style={styles.coverTitle}>Add cover image</Text><Text style={styles.coverCopy}>Recommended before publishing.</Text></View>
                )}
              </Pressable>
              {coverUri ? <Field label="Image description" value={coverAltText} onChangeText={setCoverAltText} placeholder="Describe the image for accessibility" /> : null}
              <Field label="Full description" value={description} onChangeText={setDescription} placeholder="Add the details someone should know before registering." multiline />
              <EventTagPicker label={builderConfig.labels.tags} options={builderConfig.tags} selected={tags} allowCustomTags={builderConfig.allowCustomTags} onChange={setTags} />
              {difficultyApplies ? (
                <>
                  <Text style={styles.label}>Difficulty</Text>
                  <View style={styles.chips}>{difficulties.map((item) => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} active={difficulty === item} onPress={() => setDifficulty(item)} />)}</View>
                </>
              ) : null}
            </View>
          ) : null}

          <StepContinue label="Continue to schedule" disabled={!basicsComplete} onPress={continueFromCurrentStep} />
        </StepCard>

        <StepCard
          title="Schedule & location"
          copy="Set when it happens and where people should go."
          number="02"
          complete={scheduleComplete}
          open={activeStep === 'schedule'}
          summary={scheduleComplete ? `${formatEventDate(startsAt)} · ${locationSummary}` : 'Date, venue, and capacity'}
          onOpen={() => goToStep('schedule')}
          onLayout={(y) => { stepOffsets.current.schedule = y; }}
        >
          <EventDateTimeField label="Starts" value={startsAt} onChange={setStart} />
          {startsAt ? (
            <View style={styles.durationWrap}>
              <Text style={styles.smallLabel}>Quick duration</Text>
              <View style={styles.chips}>{durationOptions.map((option) => <Chip key={option.label} label={option.label} active={false} onPress={() => setDuration(option.minutes)} />)}</View>
            </View>
          ) : null}
          <EventDateTimeField label="Ends" value={endsAt} minimum={startsAt} fallbackOffsetMinutes={120} onChange={setEndsAt} />

          <Text style={styles.label}>Location type</Text>
          <View style={styles.chips}>{locationTypes.map((item) => <Chip key={item.value} label={item.label} active={locationType === item.value} onPress={() => setLocationType(item.value)} />)}</View>

          {physicalLocationNeeded ? (
            <>
              <View style={styles.twoCol}>
                <View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} placeholder="Jacksonville" /></View>
                <View style={styles.stateCol}><Field label="State" value={state} onChangeText={(next) => setState(next.toUpperCase().slice(0, 2))} placeholder="FL" autoCapitalize="characters" /></View>
              </View>
              <VenueSearchField
                organizationId={activeOrganization?.id ?? null}
                value={venueName}
                city={city}
                state={state}
                eventType={category}
                capacity={capacityNumber}
                selectedVenue={selectedVenue}
                onChangeText={(next) => { setVenueName(next); setSelectedVenue(null); }}
                onSelect={selectVenue}
                onUseCustom={() => setSelectedVenue(null)}
              />
            </>
          ) : null}

          {onlineLocationNeeded ? <Field label="Online meeting or streaming link" value={onlineUrl} onChangeText={setOnlineUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" /> : null}
          {locationType === 'tbd' ? <Text style={styles.helper}>You can finish the draft now and add the final location before publishing.</Text> : null}

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

          <StepContinue label="Continue to access" disabled={!scheduleComplete} onPress={continueFromCurrentStep} />
        </StepCard>

        <StepCard
          title="Access & admission"
          copy="Choose who can join and whether admission is free or paid."
          number="03"
          complete={accessComplete}
          open={activeStep === 'access'}
          summary={accessComplete ? `${activeVisibility?.label} · ${priceLabel(paid, price)}` : 'Visibility and admission'}
          onOpen={() => goToStep('access')}
          onLayout={(y) => { stepOffsets.current.access = y; }}
        >
          <Text style={styles.label}>Who can see it?</Text>
          <View style={styles.chips}>{availableVisibility.map((option) => <Chip key={option.value} label={option.label} active={visibility === option.value} onPress={() => setVisibility(option.value)} />)}</View>
          <Text style={styles.helper}>{activeVisibility?.copy}</Text>
          {visibility === 'community' ? (
            <View style={styles.communityPicker}>
              <Text style={styles.label}>Allowed communities</Text>
              {groups.length ? <View style={styles.chips}>{groups.map((group) => <Chip key={group.id} label={group.name} active={selectedGroupIds.includes(group.id)} onPress={() => toggleGroup(group.id)} />)}</View> : <Text style={styles.helper}>No communities are available to select.</Text>}
            </View>
          ) : null}

          <Text style={styles.label}>Admission</Text>
          <View style={styles.segment}>
            <Pressable style={[styles.segmentButton, !paid && styles.segmentActive]} onPress={() => { setPaid(false); setPrice('0'); }}><Text style={[styles.segmentText, !paid && styles.segmentTextActive]}>Free</Text></Pressable>
            <Pressable style={[styles.segmentButton, paid && styles.segmentActive]} onPress={() => setPaid(true)}><Text style={[styles.segmentText, paid && styles.segmentTextActive]}>Paid</Text></Pressable>
          </View>
          {paid ? <Field label="Starting ticket price" value={price} onChangeText={setPrice} placeholder="35.00" keyboardType="decimal-pad" prefix="$" /> : null}

          {builderConfig.showCommunityVisibility && managedGroups.length ? (
            <View style={styles.secondarySettings}>
              <Text style={styles.smallLabel}>Primary community</Text>
              <View style={styles.chips}>{managedGroups.map((group) => <Chip key={group.id} label={group.name} active={primaryCommunityId === group.id} onPress={() => setPrimaryCommunityId(group.id)} />)}</View>
            </View>
          ) : null}

          <View style={styles.nextSetupCard}>
            <Text style={styles.templateEyebrow}>AFTER THIS</Text>
            <Text style={styles.templateTitle}>Your workspace will be prepared automatically</Text>
            <Text style={styles.templateCopy}>{template.setupPrompts.join(' · ')}</Text>
          </View>

          <StepContinue label="Continue to event setup" disabled={!accessComplete || saving} onPress={continueFromCurrentStep} loading={saving} />
        </StepCard>

        {stepError ? <View style={styles.stepError}><Text style={styles.stepErrorText}>{stepError}</Text></View> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{createdDraftId ? 'Draft created with an issue' : 'Could not create event'}</Text>
            <Text style={styles.error}>{error}</Text>
            {createdDraftId ? <Pressable style={styles.errorButton} onPress={() => router.replace(`/host/review/${createdDraftId}` as never)}><Text style={styles.errorButtonText}>Open saved event</Text></Pressable> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.footerCopy} onPress={() => goToStep(!basicsComplete ? 'basics' : !scheduleComplete ? 'schedule' : 'access')}>
          <Text style={styles.footerCount}>Core details {completeSteps}/3</Text>
          <Text style={styles.footerHint}>{allCoreComplete ? 'Ready to continue to setup' : `Working on ${activeStep === 'basics' ? 'event basics' : activeStep === 'schedule' ? 'schedule & location' : 'access & admission'}`}</Text>
        </Pressable>
        <Pressable disabled={saving} style={[styles.primary, saving && styles.primaryDisabled]} onPress={continueFromCurrentStep}>
          {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>{footerAction}</Text>}
        </Pressable>
      </View>

      <PreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
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
    </SafeAreaView>
  );
}

function StepCard({ title, copy, number, complete, open, summary, onOpen, onLayout, children }: { title: string; copy: string; number: string; complete: boolean; open: boolean; summary: string; onOpen: () => void; onLayout: (y: number) => void; children: ReactNode }) {
  return (
    <View style={[styles.stepCard, open && styles.stepCardOpen]} onLayout={(event) => onLayout(event.nativeEvent.layout.y)}>
      <Pressable style={styles.stepHeader} onPress={onOpen}>
        <Text style={styles.stepNumber}>{complete ? '✓' : number}</Text>
        <View style={styles.flex}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={open ? styles.stepCopy : styles.stepSummary} numberOfLines={open ? undefined : 2}>{open ? copy : summary}</Text>
        </View>
        <Text style={styles.stepAction}>{open ? 'Open' : 'Edit'}</Text>
      </Pressable>
      {open ? <View style={styles.stepBody}>{children}</View> : null}
    </View>
  );
}

function ProgressStep({ label, active, complete, onPress }: { label: string; active: boolean; complete: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.progressStep} onPress={onPress}>
      <View style={[styles.progressDot, active && styles.progressDotActive, complete && styles.progressDotComplete]}><Text style={styles.progressDotText}>{complete ? '✓' : ''}</Text></View>
      <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function StepContinue({ label, disabled, onPress, loading = false }: { label: string; disabled: boolean; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable style={[styles.stepContinue, disabled && styles.stepContinueDisabled]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#172017" /> : <Text style={styles.stepContinueText}>{label}</Text>}
    </Pressable>
  );
}

function PreviewModal({ visible, onClose, coverUri, logoUrl, organizerName, title, category, startsAt, location, summary, admission }: { visible: boolean; onClose: () => void; coverUri: string | null; logoUrl: string | null; organizerName: string; title: string; category: string; startsAt: string | null; location: string; summary: string; admission: string }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.previewSafe}>
        <View style={styles.previewTop}><Text style={styles.previewTopTitle}>Attendee preview</Text><Pressable onPress={onClose}><Text style={styles.previewClose}>Done</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.previewContent}>
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, prefix, multiline = false, ...props }: TextInputProps & { label: string; prefix?: string; multiline?: boolean }) {
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
  content: { padding: 18, paddingBottom: 112, maxWidth: 760, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#96A199', fontSize: 10.5, lineHeight: 16, marginTop: 6, maxWidth: 620 },
  contextRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  workspacePill: { flex: 1, borderRadius: 11, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', paddingHorizontal: 10, paddingVertical: 8 },
  organizerCompact: { flex: 1.25, borderRadius: 11, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextLabel: { color: '#68756D', fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  contextValue: { color: '#DCE3DE', fontSize: 9.5, fontWeight: '900', marginTop: 2 },
  organizerLogo: { width: 30, height: 30, borderRadius: 8 },
  organizerMark: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1B2B21', alignItems: 'center', justifyContent: 'center' },
  organizerInitial: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  organizerName: { color: '#DCE3DE', fontSize: 9.5, fontWeight: '900', marginTop: 2 },
  progressRow: { marginTop: 17, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 5 },
  progressStep: { width: 66, alignItems: 'center' },
  progressDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#425048', backgroundColor: '#111814', alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { borderColor: '#D7B45A', backgroundColor: '#2A2414' },
  progressDotComplete: { borderColor: '#58705E', backgroundColor: '#18261D' },
  progressDotText: { color: '#9DD1A8', fontSize: 9, fontWeight: '900' },
  progressLabel: { color: '#66736B', fontSize: 7.5, fontWeight: '800', marginTop: 4 },
  progressLabelActive: { color: '#D8C47B' },
  progressLine: { flex: 1, height: 1, backgroundColor: '#334038', marginTop: 11 },
  stepCard: { marginTop: 13, borderRadius: 17, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#101713', overflow: 'hidden' },
  stepCardOpen: { borderColor: '#3C4B42' },
  stepHeader: { flexDirection: 'row', gap: 10, padding: 13, alignItems: 'flex-start' },
  stepNumber: { color: '#D7B45A', fontSize: 9, fontWeight: '900', minWidth: 18, paddingTop: 2 },
  stepTitle: { color: '#F3F6F4', fontSize: 15, fontWeight: '900' },
  stepCopy: { color: '#7F8B83', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  stepSummary: { color: '#AEB8B2', fontSize: 9, lineHeight: 13, marginTop: 3 },
  stepAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900', paddingTop: 3 },
  stepBody: { padding: 13, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#26322B' },
  fieldWrap: { marginTop: 11 },
  label: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '900', marginTop: 11, marginBottom: 6 },
  smallLabel: { color: '#8E9992', fontSize: 8.5, fontWeight: '900', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', borderRadius: 12 },
  input: { flex: 1, minHeight: 48, color: '#FFF8E8', paddingHorizontal: 12, fontSize: 16 },
  multiline: { minHeight: 92, paddingTop: 12 },
  prefix: { color: '#D7B45A', fontSize: 15, fontWeight: '900', marginLeft: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 2 },
  chip: { minHeight: 37, borderRadius: 19, borderWidth: 1, borderColor: '#3A473F', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121914' },
  chipActive: { backgroundColor: '#322A14', borderColor: '#8A6A25' },
  chipText: { color: '#AAB4AE', fontSize: 9.5, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  templateNote: { marginTop: 12, borderRadius: 11, backgroundColor: '#121A14', borderWidth: 1, borderColor: '#2F3E34', padding: 10 },
  templateEyebrow: { color: '#D7B45A', fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  templateTitle: { color: '#DDE4DF', fontSize: 10.5, fontWeight: '900', marginTop: 3 },
  templateCopy: { color: '#7D8981', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  optionalButton: { minHeight: 41, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  optionalButtonText: { color: '#AEB8B2', fontSize: 10, fontWeight: '900' },
  optionalDetails: { marginTop: 2 },
  optionalAction: { color: '#7E8A82', fontSize: 9, fontWeight: '800', marginTop: 7 },
  coverPicker: { minHeight: 116, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#415048', overflow: 'hidden', backgroundColor: '#0C130F' },
  coverPreview: { minHeight: 145, justifyContent: 'flex-end', padding: 12 },
  coverImage: { borderRadius: 12 },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,12,8,.28)' },
  coverAction: { color: '#FFF8E8', fontSize: 9.5, fontWeight: '900', alignSelf: 'flex-start', backgroundColor: 'rgba(9,14,11,.72)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  coverEmpty: { minHeight: 116, alignItems: 'center', justifyContent: 'center', padding: 15 },
  coverPlus: { color: '#D7B45A', fontSize: 22 },
  coverTitle: { color: '#D7DDD9', fontSize: 10.5, fontWeight: '900', marginTop: 3 },
  coverCopy: { color: '#718078', fontSize: 8, marginTop: 3 },
  durationWrap: { marginTop: 9 },
  twoCol: { flexDirection: 'row', gap: 9 },
  flex: { flex: 1 },
  stateCol: { width: 92 },
  helper: { color: '#6F7C74', fontSize: 9, lineHeight: 13, marginTop: 7 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginTop: 7 },
  segmentButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1410' },
  segmentActive: { backgroundColor: '#322A14' },
  segmentText: { color: '#9FA9A3', fontWeight: '900', fontSize: 10.5 },
  segmentTextActive: { color: '#E7C464' },
  communityPicker: { marginTop: 6 },
  secondarySettings: { marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2B3730', paddingTop: 8 },
  nextSetupCard: { marginTop: 13, borderRadius: 11, backgroundColor: '#161A11', borderWidth: 1, borderColor: '#45452C', padding: 10 },
  stepContinue: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  stepContinueDisabled: { opacity: .45 },
  stepContinueText: { color: '#172017', fontSize: 10.5, fontWeight: '900' },
  stepError: { marginTop: 12, borderRadius: 11, backgroundColor: '#2A2115', borderWidth: 1, borderColor: '#6A532B', padding: 10 },
  stepErrorText: { color: '#E5C879', fontSize: 9.5, lineHeight: 14, fontWeight: '800' },
  errorCard: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#75443E', backgroundColor: '#291816', padding: 11 },
  errorTitle: { color: '#FFD2CC', fontSize: 10.5, fontWeight: '900' },
  error: { color: '#FFAAA0', fontSize: 10, lineHeight: 15, marginTop: 4 },
  errorButton: { alignSelf: 'flex-start', minHeight: 37, borderRadius: 9, borderWidth: 1, borderColor: '#8A5A50', justifyContent: 'center', paddingHorizontal: 10, marginTop: 9 },
  errorButtonText: { color: '#FFD2CC', fontSize: 9, fontWeight: '900' },
  footer: { minHeight: 72, borderTopWidth: 1, borderTopColor: '#334038', backgroundColor: '#0D1410', paddingHorizontal: 15, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  footerCopy: { flex: 1 },
  footerCount: { color: '#D9DFDB', fontSize: 10, fontWeight: '900' },
  footerHint: { color: '#718078', fontSize: 8.8, marginTop: 2 },
  primary: { minHeight: 46, minWidth: 118, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryDisabled: { opacity: .65 },
  primaryText: { color: '#172017', fontSize: 10.5, fontWeight: '900' },
  previewSafe: { flex: 1, backgroundColor: '#0A0F0C' },
  previewTop: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2D3932', paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTopTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  previewClose: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
  previewContent: { padding: 17, maxWidth: 720, width: '100%', alignSelf: 'center' },
  previewHero: { minHeight: 245, borderRadius: 20, overflow: 'hidden', padding: 14, justifyContent: 'space-between', backgroundColor: '#1C2A21' },
  previewHeroImage: { borderRadius: 20, resizeMode: 'cover' },
  previewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,12,8,.45)' },
  previewPill: { alignSelf: 'flex-start', borderRadius: 99, backgroundColor: 'rgba(11,16,13,.78)', paddingHorizontal: 9, paddingVertical: 6 },
  previewPillText: { color: '#E7C464', fontSize: 8, fontWeight: '900' },
  previewTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  previewMeta: { color: '#D0D8D2', fontSize: 9.5, marginTop: 5 },
  previewBodyWrap: { padding: 13, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111814', marginTop: 10 },
  previewOrganizer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewLogo: { width: 30, height: 30, borderRadius: 8 },
  previewLogoFallback: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1B2B21', alignItems: 'center', justifyContent: 'center' },
  previewLogoText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  previewOrganizerText: { color: '#C9D2CC', fontSize: 10, fontWeight: '900' },
  previewLocation: { color: '#8A968E', fontSize: 9.5, marginTop: 10 },
  previewBody: { color: '#D0D7D2', fontSize: 11, lineHeight: 17, marginTop: 7 },
});
