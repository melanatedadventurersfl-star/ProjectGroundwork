import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createDraftOuting, getOutingHostAccess } from './api';
import { addAiTaskPacks, getAiPrivacyPreferences, type AiPrivacyPreferences } from './aiPlanner';
import { type AiPlannerV2Action } from './aiPlannerV2';
import { linkAiPlannerSessionToEvent, persistAiPlannerTurn } from './aiPlannerPersistence';
import {
  compactSectionOrder,
  getWorkspaceProgress,
  isPlanningDraftReady,
  reviewPlannerV3State,
  runAiPlannerV3Turn,
  stageLabel,
  type AiPlannerV3Turn,
  type V3PlanState,
} from './aiPlannerV3';
import {
  PLANNER_SECTION_LABELS,
  type AiPlannerSection,
  type AiPlannerSectionStatus,
  type AiPlannerTenantContext,
} from './aiPlannerTenant';
import { createCampaignWorkspace } from './creation';
import { addEventComponent, type EventComponentKey } from './eventBuilder';
import {
  loadLatestPlanningDraft,
  loadPlanningDraft,
  markPlanningDraftPromoted,
  savePlanningDraft,
  type PlanningDraftChange,
} from './planningDrafts';
import { addGeneralAdmissionTicket } from './tickets';
import {
  persistSelectedVenueMetadata,
  saveVenueToShortlist,
  setOrganizationVenuePreference,
  type VenueCandidate,
} from './venueDiscovery';

const VALID_COMPONENTS = new Set<EventComponentKey>(['tickets','food','vendors','marketing','communications','team','volunteers','finance','venue','schedule','activities','lodging','equipment','safety','sponsors','transportation','pages']);
const OFF_PREFS: AiPrivacyPreferences = { personal_memory_enabled: false, event_history_learning_enabled: false, organization_memory_enabled: false, save_conversations_enabled: false, product_analytics_enabled: false, recommendation_history_enabled: false };

type Message = { role: 'user' | 'assistant' | 'system'; text: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function statusLabel(status: AiPlannerSectionStatus) {
  if (status === 'complete') return '✓';
  if (status === 'needs_review') return '!';
  if (status === 'in_progress') return '•';
  if (status === 'not_applicable') return '–';
  return '○';
}

function statusStyle(status: AiPlannerSectionStatus) {
  if (status === 'complete') return styles.statusDone;
  if (status === 'needs_review') return styles.statusReview;
  if (status === 'in_progress') return styles.statusActive;
  return styles.statusMuted;
}

function privacyLabel(prefs: AiPrivacyPreferences) {
  const memory = prefs.personal_memory_enabled || prefs.event_history_learning_enabled ? 'Memory On' : 'Memory Off';
  return `${memory} · Privacy`;
}

function dateLabel(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function sourceSummary(plan: V3PlanState, tenant: AiPlannerTenantContext) {
  return [
    plan.city && plan.state ? `${plan.city}, ${plan.state}` : plan.virtualEvent ? 'Virtual' : '',
    plan.capacity ? `${plan.capacity} ${tenant.attendeeLabel}` : plan.attendanceRange || '',
    plan.paid === false ? 'Free' : plan.paid && plan.priceCents ? `$${(plan.priceCents / 100).toFixed(plan.priceCents % 100 ? 2 : 0)}` : plan.paid ? 'Paid' : '',
  ].filter(Boolean).join(' · ');
}

function optionAction(option: string): AiPlannerV2Action | undefined {
  const normalized = option.trim().toLowerCase();
  if (normalized === 'review plan') return 'review';
  if (normalized === 'recommend locations' || normalized === 'find venues') return 'recommend';
  if (normalized === 'search again') return 'venue_search_more';
  if (normalized === 'create event workspace') return 'create';
  return undefined;
}

function optionSection(option: string, current: AiPlannerSection | null) {
  const normalized = option.trim().toLowerCase();
  const match = Object.entries(PLANNER_SECTION_LABELS).find(([, label]) => label.toLowerCase() === normalized);
  if (match) return match[0] as AiPlannerSection;
  if (normalized === 'find venues' || normalized === 'recommend locations' || normalized === 'search again') return 'venue';
  if (normalized === 'communications') return 'communications';
  if (normalized === 'guests') return 'guests';
  return current;
}

function VenueCard({ candidate, onUse, onSave, onPrefer, onBlock }: {
  candidate: VenueCandidate;
  onUse: () => void;
  onSave: () => void;
  onPrefer: () => void;
  onBlock: () => void;
}) {
  return <View style={styles.venueCard}>
    {candidate.photoUrl ? <Image source={{ uri: candidate.photoUrl }} style={styles.venueImage} resizeMode="cover" /> : null}
    <View style={styles.venueBody}>
      <Text style={styles.venueName}>{candidate.name}</Text>
      {candidate.address ? <Text style={styles.venueMeta}>{candidate.address}</Text> : null}
      <Text style={styles.venueSource}>{candidate.sourceLabel}</Text>
      <Text style={styles.venueReason}>{candidate.reason}</Text>
      {candidate.unknowns.length ? <Text style={styles.venueUnknown}>Verify: {candidate.unknowns.join(' · ')}</Text> : null}
      <View style={styles.venueActions}>
        <Pressable style={styles.primarySmall} onPress={onUse}><Text style={styles.primarySmallText}>Use venue</Text></Pressable>
        <Pressable style={styles.secondarySmall} onPress={onSave}><Text style={styles.secondarySmallText}>Save</Text></Pressable>
        <Pressable style={styles.secondarySmall} onPress={onPrefer}><Text style={styles.secondarySmallText}>Prefer</Text></Pressable>
        <Pressable onPress={onBlock}><Text style={styles.blockText}>Do not recommend</Text></Pressable>
      </View>
    </View>
  </View>;
}

export default function AiPlannerV3Screen({ tenant }: { tenant: AiPlannerTenantContext }) {
  const params = useLocalSearchParams<{ draftId?: string }>();
  const requestedDraftId = typeof params.draftId === 'string' ? params.draftId : '';
  const scrollRef = useRef<ScrollView | null>(null);
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState<V3PlanState>({ components: [], fieldStates: {} });
  const [turn, setTurn] = useState<AiPlannerV3Turn | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Tell me what you are planning. Give me as much or as little as you know and I will pull the useful details into the event plan.' }]);
  const [privacy, setPrivacy] = useState<AiPrivacyPreferences>(OFF_PREFS);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [planningDraftId, setPlanningDraftId] = useState<string | null>(null);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [resumeTitle, setResumeTitle] = useState('');
  const [changeHistory, setChangeHistory] = useState<PlanningDraftChange[]>([]);
  const [undoStack, setUndoStack] = useState<V3PlanState[]>([]);
  const [activeSection, setActiveSection] = useState<AiPlannerSection | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [canCreate, setCanCreate] = useState<boolean | null>(null);
  const [accessMessage, setAccessMessage] = useState('');

  const currentTurn = turn ?? reviewPlannerV3State(plan, tenant);
  const workspaceProgress = getWorkspaceProgress(plan);
  const summary = sourceSummary(plan, tenant);
  const orderedSections = useMemo(() => compactSectionOrder(currentTurn.sectionStatuses, tenant), [currentTurn.sectionStatuses, tenant]);
  const openSections = orderedSections.filter((section) => ['not_started','in_progress','needs_review'].includes(currentTurn.sectionStatuses[section])).slice(0, 4);

  useEffect(() => {
    void getAiPrivacyPreferences().then(setPrivacy).catch(() => setPrivacy(OFF_PREFS));
    void getOutingHostAccess()
      .then((access) => {
        setCanCreate(access.approved);
        if (!access.approved) setAccessMessage('Your current role can plan this event, but it does not have permission to create the Event Workspace.');
      })
      .catch((caught) => {
        setCanCreate(false);
        setAccessMessage(caught instanceof Error ? caught.message : 'Unable to verify event creation permission.');
      });
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        if (requestedDraftId) {
          const draft = await loadPlanningDraft(requestedDraftId);
          if (!active || !draft) return;
          const restoredPlan = draft.plan as V3PlanState;
          const reviewed = reviewPlannerV3State(restoredPlan, tenant);
          setPlan(restoredPlan);
          setTurn(reviewed);
          setPlanningDraftId(draft.id);
          setChangeHistory(draft.changeHistory);
          setMessages([{ role: 'assistant', text: `Welcome back. ${restoredPlan.title || 'Your event'} is saved. ${reviewed.gaps.length ? `Still open: ${reviewed.gaps.slice(0, 4).join(', ')}.` : 'The core setup is in place.'}` }]);
          return;
        }
        if (tenant.organizationId) {
          const latest = await loadLatestPlanningDraft(tenant.organizationId);
          if (!active || !latest) return;
          setResumeDraftId(latest.id);
          setResumeTitle(latest.plan.title || latest.plan.category || 'Saved event');
        }
      } catch {
        // The planner still works when saved-draft recovery is unavailable.
      }
    }
    void restore();
    return () => { active = false; };
  }, [requestedDraftId, tenant]);

  async function persistStructuredDraft(nextPlan: V3PlanState, nextTurn: AiPlannerV3Turn, nextHistory: PlanningDraftChange[]) {
    if (!tenant.organizationId || !isPlanningDraftReady(nextPlan)) return planningDraftId;
    setSaveState('saving');
    try {
      const saved = await savePlanningDraft({
        draftId: planningDraftId,
        organizationId: tenant.organizationId,
        plan: nextPlan,
        sectionStatuses: nextTurn.sectionStatuses,
        readiness: nextTurn.readiness,
        stage: nextTurn.stage,
        fieldStates: nextPlan.fieldStates ?? {},
        changeHistory: nextHistory,
      });
      const wasNew = !planningDraftId;
      setPlanningDraftId(saved.id);
      setSaveState('saved');
      if (wasNew) setMessages((current) => [...current, { role: 'system', text: 'Planning draft saved' }]);
      return saved.id;
    } catch (caught) {
      setSaveState('error');
      setError(caught instanceof Error ? caught.message : 'Unable to save the planning draft.');
      return planningDraftId;
    }
  }

  async function resumeLatest() {
    if (!resumeDraftId) return;
    const draft = await loadPlanningDraft(resumeDraftId);
    if (!draft) return;
    const restoredPlan = draft.plan as V3PlanState;
    const reviewed = reviewPlannerV3State(restoredPlan, tenant);
    setPlan(restoredPlan);
    setTurn(reviewed);
    setPlanningDraftId(draft.id);
    setChangeHistory(draft.changeHistory);
    setResumeDraftId(null);
    setMessages([{ role: 'assistant', text: `Welcome back. ${restoredPlan.title || 'Your event'} is saved. ${reviewed.gaps.length ? `Still open: ${reviewed.gaps.slice(0, 4).join(', ')}.` : 'The core setup is in place.'}` }]);
  }

  async function createWorkspace(sourcePlan = plan, packs = currentTurn.taskPacks) {
    if (!getWorkspaceProgress(sourcePlan).ready || creating) return;
    if (canCreate === false) {
      setError(accessMessage || 'Your current role cannot create an Event Workspace.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Your current role does not have permission to create events for this organization.');
      if (sourcePlan.paid && !access.paidEnabled) throw new Error('Paid hosting is not enabled for this account yet.');
      const outing = await createDraftOuting({
        title: sourcePlan.title || sourcePlan.category || 'New Event',
        summary: sourcePlan.summary || sourcePlan.title || sourcePlan.category || 'New event',
        description: sourcePlan.description || sourcePlan.summary || sourcePlan.title || sourcePlan.category || 'New event',
        category: sourcePlan.category || 'Other',
        difficulty: sourcePlan.difficulty || 'easy',
        difficultyApplicable: false,
        startsAt: sourcePlan.startsAt || '',
        endsAt: sourcePlan.endsAt || '',
        city: sourcePlan.virtualEvent ? 'Virtual' : sourcePlan.city || '',
        state: sourcePlan.virtualEvent ? 'NA' : sourcePlan.state || '',
        venueName: sourcePlan.venueName || '',
        capacity: sourcePlan.capacity || null,
        meetingInstructions: sourcePlan.meetingInstructions || '',
        platformOrganizationId: tenant.organizationId,
      });
      if (sourcePlan.venueAddress || sourcePlan.venuePlaceId || sourcePlan.venueLatitude || sourcePlan.venueLongitude) {
        await persistSelectedVenueMetadata(outing.id, {
          address: sourcePlan.venueAddress,
          latitude: sourcePlan.venueLatitude,
          longitude: sourcePlan.venueLongitude,
          placeId: sourcePlan.venuePlaceId,
          source: sourcePlan.venueSource,
        }).catch(() => undefined);
      }
      if (sourcePlan.paid !== undefined || (sourcePlan.components ?? []).includes('tickets')) {
        await addGeneralAdmissionTicket(outing.id, sourcePlan.capacity || null, sourcePlan.paid ? Number(sourcePlan.priceCents || 0) : 0);
      }
      const campaign = await createCampaignWorkspace({
        adventureId: outing.id,
        title: outing.title,
        location: [sourcePlan.venueName, sourcePlan.city, sourcePlan.state].filter(Boolean).join(', '),
        startsAt: outing.starts_at,
        endsAt: outing.ends_at,
      });
      const components = [...new Set(sourcePlan.components ?? [])].filter((key): key is EventComponentKey => VALID_COMPONENTS.has(key as EventComponentKey));
      await Promise.all(components.map((key) => addEventComponent(campaign.id, key, outing.starts_at)));
      await addAiTaskPacks(campaign.id, outing.starts_at, packs).catch(() => undefined);
      await markPlanningDraftPromoted(planningDraftId, outing.id).catch(() => undefined);
      await linkAiPlannerSessionToEvent(sessionId, outing.id).catch(() => undefined);
      router.replace(`/host/manage/${outing.id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the Event Workspace.');
    } finally {
      setCreating(false);
    }
  }

  async function send(text = input, meta: { section?: AiPlannerSection | null; action?: AiPlannerV2Action; venueCandidate?: VenueCandidate | null } = {}) {
    const trimmed = text.trim();
    if (!trimmed || loading || creating) return;
    if (/^undo$/i.test(trimmed)) {
      const previous = undoStack.at(-1);
      if (!previous) return;
      const reviewed = reviewPlannerV3State(previous, tenant);
      setPlan(previous);
      setTurn(reviewed);
      setUndoStack((stack) => stack.slice(0, -1));
      setMessages((current) => [...current, { role: 'system', text: 'Last plan change undone' }]);
      await persistStructuredDraft(previous, reviewed, changeHistory);
      return;
    }

    const beforeReady = getWorkspaceProgress(plan).ready;
    const userMessage: Message = { role: 'user', text: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const next = await runAiPlannerV3Turn({
        message: trimmed,
        plan,
        history: nextMessages.filter((item): item is { role: 'user' | 'assistant'; text: string } => item.role !== 'system').slice(-16),
        tenant,
        section: meta.section ?? activeSection,
        action: meta.action,
        venueCandidate: meta.venueCandidate,
      });
      const changed = next.changedFields.length > 0 && JSON.stringify(next.plan) !== JSON.stringify(plan);
      if (changed) setUndoStack((stack) => [...stack.slice(-9), plan]);
      const changes = next.changedFields.length ? [...changeHistory, { at: new Date().toISOString(), label: `Updated ${next.changedFields.join(', ')}`, fields: next.changedFields }].slice(-30) : changeHistory;
      setChangeHistory(changes);
      setPlan(next.plan);
      setTurn(next);
      setActiveSection(next.activeSection);
      const assistantRows: Message[] = [
        ...next.systemMessages.map((value) => ({ role: 'system' as const, text: value })),
        { role: 'assistant' as const, text: next.message },
      ];
      if (!beforeReady && getWorkspaceProgress(next.plan).ready) assistantRows.unshift({ role: 'system', text: 'Core setup complete' });
      const completeMessages = [...nextMessages, ...assistantRows];
      setMessages(completeMessages);
      await persistStructuredDraft(next.plan, next, changes);
      const chatHistory = completeMessages.filter((item): item is { role: 'user' | 'assistant'; text: string } => item.role !== 'system');
      const nextSessionId = await persistAiPlannerTurn({ sessionId, plan: next.plan, turn: {
        message: next.message,
        plan: next.plan,
        readiness: next.readiness,
        stage: next.stage === 'idea' ? 'possibility' : next.stage === 'taking_shape' ? 'momentum' : next.stage === 'coming_together' ? 'confidence' : 'ready',
        gaps: next.gaps,
        options: next.options,
        recommendation: next.recommendation,
        taskPacks: next.taskPacks,
      }, history: chatHistory }).catch(() => sessionId);
      setSessionId(nextSessionId);
      setPrivacy(await getAiPrivacyPreferences().catch(() => privacy));
      if (next.command === 'create_workspace') await createWorkspace(next.plan, next.taskPacks);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That step did not finish.');
      setMessages((current) => [...current, { role: 'assistant', text: 'That step did not finish, but your structured planning draft is still here. You can keep planning or try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function openSection(section: AiPlannerSection) {
    setActiveSection(section);
    await send(PLANNER_SECTION_LABELS[section], { section, action: 'section' });
  }

  async function selectVenue(candidate: VenueCandidate) {
    await send(`Use ${candidate.name}`, { section: 'venue', action: 'venue_select', venueCandidate: candidate });
  }

  async function saveVenue(candidate: VenueCandidate) {
    if (!tenant.organizationId) return;
    try {
      await saveVenueToShortlist(tenant.organizationId, candidate, {
        eventType: plan.category || null,
        attendance: plan.capacity || plan.attendanceRange || null,
        city: plan.city || null,
        state: plan.state || null,
      });
      setMessages((current) => [...current, { role: 'system', text: `${candidate.name} saved to your venue shortlist` }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save that venue.');
    }
  }

  async function preferVenue(candidate: VenueCandidate) {
    if (!tenant.organizationId) return;
    try {
      await setOrganizationVenuePreference(tenant.organizationId, candidate, 'preferred');
      setMessages((current) => [...current, { role: 'system', text: `${candidate.name} marked as preferred for ${tenant.organizationName}` }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update that venue preference.');
    }
  }

  async function blockVenue(candidate: VenueCandidate) {
    if (!tenant.organizationId) return;
    try {
      await setOrganizationVenuePreference(tenant.organizationId, candidate, 'blocked');
      setMessages((current) => [...current, { role: 'system', text: `${candidate.name} will not be recommended for this organization` }]);
      await send('Search again', { section: 'venue', action: 'venue_search_more' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update that venue preference.');
    }
  }

  function directEdit(key: 'title' | 'city' | 'state' | 'capacity' | 'startsAt' | 'endsAt', value: string) {
    const next: V3PlanState = { ...plan, fieldStates: { ...(plan.fieldStates ?? {}) } };
    if (key === 'capacity') next.capacity = value.trim() ? Math.max(1, Number.parseInt(value, 10) || 1) : undefined;
    else if (key === 'title') next.title = value;
    else if (key === 'city') next.city = value;
    else if (key === 'state') next.state = value.toUpperCase();
    else next[key] = value;
    next.fieldStates = {
      ...(next.fieldStates ?? {}),
      [key]: { status: 'confirmed', value: key === 'capacity' ? next.capacity : next[key], updatedAt: new Date().toISOString() },
    };
    const reviewed = reviewPlannerV3State(next, tenant);
    setPlan(next);
    setTurn(reviewed);
    setMessages((current) => [...current, { role: 'system', text: `Updated ${key === 'startsAt' ? 'start time' : key === 'endsAt' ? 'end time' : key}` }]);
    const changes = [...changeHistory, { at: new Date().toISOString(), label: `Direct edit: ${key}`, fields: [key] }].slice(-30);
    setChangeHistory(changes);
    void persistStructuredDraft(next, reviewed, changes);
  }

  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Couldn’t save' : planningDraftId ? 'Saved' : 'New plan';

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Events</Text></Pressable>
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={styles.headerTitle}>{plan.title || 'Plan an event'}</Text>
          <Text numberOfLines={1} style={styles.headerMeta}>{tenant.organizationName} · {currentTurn.readiness}% planned</Text>
        </View>
        <Pressable style={styles.reviewButton} onPress={() => setReviewOpen(true)}><Text style={styles.reviewButtonText}>Review</Text></Pressable>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.stage}>{stageLabel(currentTurn.stage)}</Text>
        <Text style={[styles.save, saveState === 'error' && styles.saveError]}>{saveLabel}</Text>
        <Pressable onPress={() => router.push('/host/ai-privacy' as never)}><Text style={styles.privacy}>{privacyLabel(privacy)}</Text></Pressable>
      </View>

      {accessMessage ? <View style={styles.permissionBanner}><Text style={styles.permissionText}>{accessMessage}</Text></View> : null}
      {resumeDraftId ? <View style={styles.resumeBanner}>
        <View style={styles.flex}><Text style={styles.resumeLabel}>SAVED PLAN</Text><Text style={styles.resumeTitle}>{resumeTitle}</Text></View>
        <Pressable onPress={() => void resumeLatest()} style={styles.resumeButton}><Text style={styles.resumeButtonText}>Resume</Text></Pressable>
      </View> : null}

      <Pressable style={styles.summaryCard} onPress={() => setSummaryOpen((value) => !value)}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryTitle}>{workspaceProgress.ready ? '✓ Core setup complete' : `${workspaceProgress.complete}/${workspaceProgress.total} core details`}</Text>
          <Text style={styles.summaryReadiness}>{currentTurn.readiness}%</Text>
        </View>
        {summary ? <Text style={styles.summaryLine}>{summary}</Text> : <Text style={styles.summaryLine}>Planning draft starts as soon as you give me the event idea.</Text>}
        {summaryOpen ? <View style={styles.summaryExpanded}>
          <Text style={styles.summaryDetail}>Type: {plan.category || 'Open'}</Text>
          <Text style={styles.summaryDetail}>Schedule: {plan.startsAt ? `${dateLabel(plan.startsAt)}${plan.endsAt ? ` to ${dateLabel(plan.endsAt)}` : ''}` : 'Open'}</Text>
          <Text style={styles.summaryDetail}>Venue: {plan.venueName || (plan.virtualEvent ? 'Virtual' : plan.venueDeferred ? 'Open for later' : 'Open')}</Text>
          <Text style={styles.summaryDetail}>Still open: {openSections.length ? openSections.map((section) => PLANNER_SECTION_LABELS[section]).join(' · ') : 'No active gaps'}</Text>
        </View> : null}
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sections}>
        {orderedSections.map((section) => {
          const status = currentTurn.sectionStatuses[section];
          const selected = activeSection === section;
          return <Pressable key={section} onPress={() => void openSection(section)} style={[styles.sectionChip, selected && styles.sectionSelected]}>
            <Text style={[styles.sectionStatus, statusStyle(status)]}>{statusLabel(status)}</Text>
            <Text style={[styles.sectionText, selected && styles.sectionTextSelected]}>{PLANNER_SECTION_LABELS[section]}</Text>
          </Pressable>;
        })}
      </ScrollView>

      <ScrollView
        ref={(node) => { scrollRef.current = node; }}
        style={styles.conversation}
        contentContainerStyle={styles.conversationContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message, index) => message.role === 'system'
          ? <View key={`system-${index}`} style={styles.systemRow}><Text style={styles.systemText}>✓ {message.text}</Text></View>
          : <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.bubbleText, message.role === 'user' && styles.userText]}>{message.text}</Text></View>)}

        {currentTurn.recommendation ? <View style={styles.recommendation}><Text style={styles.recLabel}>SUGGESTED</Text><Text style={styles.recTitle}>{currentTurn.recommendation.label}</Text><Text style={styles.recBody}>{currentTurn.recommendation.reason}</Text></View> : null}

        {currentTurn.venueResults.length ? <View style={styles.venueList}>
          <Text style={styles.cardEyebrow}>VENUE OPTIONS</Text>
          {currentTurn.venueResults.map((candidate) => <VenueCard
            key={candidate.id}
            candidate={candidate}
            onUse={() => void selectVenue(candidate)}
            onSave={() => void saveVenue(candidate)}
            onPrefer={() => void preferVenue(candidate)}
            onBlock={() => void blockVenue(candidate)}
          />)}
          {currentTurn.venueWarnings.map((warning) => <Text key={warning} style={styles.warning}>{warning}</Text>)}
        </View> : null}

        {currentTurn.options.length ? <View style={styles.optionsWrap}>{currentTurn.options.map((option) => <Pressable key={option} style={styles.option} onPress={() => void send(option, { section: optionSection(option, activeSection), action: optionAction(option) })}><Text style={styles.optionText}>{option}</Text></Pressable>)}</View> : null}

        {workspaceProgress.ready ? <View style={styles.workspaceCard}>
          <Text style={styles.workspaceTitle}>Event record ready</Text>
          <Text style={styles.workspaceBody}>Optional planning sections can stay open. Creating the Event Workspace does not publish the event.</Text>
          <Pressable disabled={creating || canCreate === false} style={[styles.workspaceButton, (creating || canCreate === false) && styles.disabled]} onPress={() => void createWorkspace()}>{creating ? <ActivityIndicator color="#152018" /> : <Text style={styles.workspaceButtonText}>Create Event Workspace</Text>}</Pressable>
        </View> : null}

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => setError('')}><Text style={styles.dismiss}>Dismiss</Text></Pressable></View> : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Tell me what changed, ask a question, or keep planning…"
          placeholderTextColor="#667169"
          multiline
          style={styles.input}
        />
        <View style={styles.composerActions}>
          <Pressable disabled={!undoStack.length || loading} onPress={() => void send('Undo')} style={[styles.undoButton, (!undoStack.length || loading) && styles.disabled]}><Text style={styles.undoText}>Undo</Text></Pressable>
          <Pressable disabled={!input.trim() || loading} onPress={() => void send()} style={[styles.sendButton, (!input.trim() || loading) && styles.disabled]}>{loading ? <ActivityIndicator color="#152018" /> : <Text style={styles.sendText}>Send</Text>}</Pressable>
        </View>
      </View>

      <Modal visible={reviewOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReviewOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Review plan</Text><Pressable onPress={() => setReviewOpen(false)}><Text style={styles.modalClose}>Done</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSection}>CONFIRMED OR TENTATIVE DETAILS</Text>
            <ReviewField label="Event title" value={plan.title || ''} onChange={(value) => directEdit('title', value)} />
            <View style={styles.reviewRow}><View style={styles.flex}><ReviewField label="City" value={plan.city || ''} onChange={(value) => directEdit('city', value)} /></View><View style={styles.reviewState}><ReviewField label="State" value={plan.state || ''} onChange={(value) => directEdit('state', value)} /></View></View>
            <ReviewField label="Attendance" value={plan.capacity ? String(plan.capacity) : ''} keyboardType="number-pad" onChange={(value) => directEdit('capacity', value)} />
            <ReviewField label="Starts" value={plan.startsAt || ''} placeholder="YYYY-MM-DDTHH:MM" onChange={(value) => directEdit('startsAt', value)} />
            <ReviewField label="Ends" value={plan.endsAt || ''} placeholder="YYYY-MM-DDTHH:MM" onChange={(value) => directEdit('endsAt', value)} />

            <Text style={styles.modalSection}>PLAN STATUS</Text>
            {orderedSections.map((section) => <Pressable key={section} style={styles.reviewSectionRow} onPress={() => { setReviewOpen(false); void openSection(section); }}><Text style={styles.reviewSectionName}>{PLANNER_SECTION_LABELS[section]}</Text><Text style={[styles.reviewSectionStatus, statusStyle(currentTurn.sectionStatuses[section])]}>{currentTurn.sectionStatuses[section].replace(/_/g, ' ')}</Text></Pressable>)}

            {changeHistory.length ? <><Text style={styles.modalSection}>RECENT CHANGES</Text>{changeHistory.slice(-8).reverse().map((change) => <Text key={`${change.at}-${change.label}`} style={styles.changeItem}>{change.label}</Text>)}</> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function ReviewField({ label, value, onChange, placeholder = '', keyboardType = 'default' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'number-pad' }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return <View style={styles.reviewField}><Text style={styles.reviewFieldLabel}>{label}</Text><TextInput value={local} onChangeText={setLocal} onBlur={() => { if (local !== value) onChange(local); }} placeholder={placeholder} placeholderTextColor="#68746C" keyboardType={keyboardType} style={styles.reviewInput} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09100C' },
  flex: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E2A23', gap: 10 },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  headerMeta: { color: '#839088', fontSize: 8, marginTop: 2 },
  reviewButton: { minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: '#665522', justifyContent: 'center', paddingHorizontal: 11 },
  reviewButtonText: { color: '#E2C567', fontSize: 9, fontWeight: '900' },
  statusBar: { minHeight: 34, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 9 },
  stage: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  save: { color: '#7FA68A', fontSize: 8, fontWeight: '800' },
  saveError: { color: '#D78D83' },
  privacy: { color: '#748078', fontSize: 8, marginLeft: 'auto' },
  permissionBanner: { marginHorizontal: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#624B2B', backgroundColor: '#211A10', padding: 10 },
  permissionText: { color: '#C8A777', fontSize: 9, lineHeight: 14 },
  resumeBanner: { marginHorizontal: 14, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#3A493F', backgroundColor: '#111914', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resumeLabel: { color: '#718078', fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  resumeTitle: { color: '#F4EFD9', fontSize: 11, fontWeight: '900', marginTop: 2 },
  resumeButton: { minHeight: 34, borderRadius: 9, backgroundColor: '#D7B45A', justifyContent: 'center', paddingHorizontal: 11 },
  resumeButtonText: { color: '#152018', fontSize: 9, fontWeight: '900' },
  summaryCard: { marginHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: '#314037', backgroundColor: '#121914', padding: 11 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryTitle: { color: '#E8ECD9', fontSize: 10, fontWeight: '900' },
  summaryReadiness: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  summaryLine: { color: '#8A978E', fontSize: 9, marginTop: 4 },
  summaryExpanded: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#253129', paddingTop: 7, gap: 4 },
  summaryDetail: { color: '#9CA89F', fontSize: 9, lineHeight: 13 },
  sections: { paddingHorizontal: 14, paddingVertical: 9, gap: 7 },
  sectionChip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, borderWidth: 1, borderColor: '#303C35', backgroundColor: '#111813', paddingHorizontal: 10 },
  sectionSelected: { borderColor: '#806824', backgroundColor: '#211C0F' },
  sectionStatus: { fontSize: 10, fontWeight: '900' },
  sectionText: { color: '#AFB9B2', fontSize: 9, fontWeight: '800' },
  sectionTextSelected: { color: '#F2E4B2' },
  statusDone: { color: '#77B98A' },
  statusReview: { color: '#D99C5B' },
  statusActive: { color: '#D7B45A' },
  statusMuted: { color: '#66736B' },
  conversation: { flex: 1 },
  conversationContent: { paddingHorizontal: 14, paddingTop: 5, paddingBottom: 20, gap: 9 },
  bubble: { maxWidth: '88%', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#142019', borderWidth: 1, borderColor: '#2B3B31' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#4A3914' },
  bubbleText: { color: '#DCE4DE', fontSize: 12, lineHeight: 18 },
  userText: { color: '#FFF0C4' },
  systemRow: { alignSelf: 'center', paddingVertical: 2, paddingHorizontal: 8 },
  systemText: { color: '#789081', fontSize: 8, fontWeight: '800' },
  recommendation: { borderRadius: 13, borderWidth: 1, borderColor: '#5D4E22', backgroundColor: '#211C10', padding: 11 },
  recLabel: { color: '#D7B45A', fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  recTitle: { color: '#FFF5D8', fontSize: 12, fontWeight: '900', marginTop: 3 },
  recBody: { color: '#AAA48C', fontSize: 9, lineHeight: 14, marginTop: 4 },
  venueList: { gap: 9 },
  cardEyebrow: { color: '#7A8780', fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  venueCard: { borderRadius: 14, borderWidth: 1, borderColor: '#314037', backgroundColor: '#121914', overflow: 'hidden' },
  venueImage: { width: '100%', height: 135, backgroundColor: '#202A23' },
  venueBody: { padding: 11 },
  venueName: { color: '#FFF5D8', fontSize: 13, fontWeight: '900' },
  venueMeta: { color: '#A0AAA3', fontSize: 9, lineHeight: 13, marginTop: 4 },
  venueSource: { color: '#738078', fontSize: 8, fontWeight: '800', marginTop: 4 },
  venueReason: { color: '#C3CCC6', fontSize: 9, lineHeight: 14, marginTop: 6 },
  venueUnknown: { color: '#B59B6F', fontSize: 8, lineHeight: 12, marginTop: 6 },
  venueActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  primarySmall: { minHeight: 34, borderRadius: 9, backgroundColor: '#D7B45A', justifyContent: 'center', paddingHorizontal: 10 },
  primarySmallText: { color: '#152018', fontSize: 8, fontWeight: '900' },
  secondarySmall: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: '#3D4A42', justifyContent: 'center', paddingHorizontal: 10 },
  secondarySmallText: { color: '#BDC7C0', fontSize: 8, fontWeight: '800' },
  blockText: { color: '#BE8982', fontSize: 8, fontWeight: '800' },
  warning: { color: '#9A8B6E', fontSize: 8, lineHeight: 12 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { minHeight: 35, borderRadius: 99, borderWidth: 1, borderColor: '#3B4840', backgroundColor: '#111813', justifyContent: 'center', paddingHorizontal: 11 },
  optionText: { color: '#BAC4BD', fontSize: 9, fontWeight: '800' },
  workspaceCard: { borderRadius: 14, borderWidth: 1, borderColor: '#355C40', backgroundColor: '#102017', padding: 12 },
  workspaceTitle: { color: '#84C793', fontSize: 11, fontWeight: '900' },
  workspaceBody: { color: '#8FA696', fontSize: 9, lineHeight: 14, marginTop: 4 },
  workspaceButton: { minHeight: 42, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  workspaceButtonText: { color: '#152018', fontSize: 10, fontWeight: '900' },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#75433D', backgroundColor: '#241512', padding: 10 },
  errorText: { color: '#E8A29A', fontSize: 9, lineHeight: 14 },
  dismiss: { color: '#D7B45A', fontSize: 8, fontWeight: '900', marginTop: 6 },
  composer: { borderTopWidth: 1, borderTopColor: '#223028', backgroundColor: '#0C130F', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 9 },
  input: { minHeight: 54, maxHeight: 110, borderRadius: 13, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', color: '#FFF8E8', fontSize: 11, lineHeight: 16, paddingHorizontal: 11, paddingVertical: 9, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  undoButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 8 },
  undoText: { color: '#87948B', fontSize: 9, fontWeight: '800' },
  sendButton: { minWidth: 72, minHeight: 36, borderRadius: 10, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#152018', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: .4 },
  modalSafe: { flex: 1, backgroundColor: '#09100C' },
  modalHeader: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#26332B' },
  modalTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  modalClose: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  modalContent: { padding: 16, paddingBottom: 60 },
  modalSection: { color: '#77857C', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  reviewRow: { flexDirection: 'row', gap: 8 },
  reviewState: { width: 90 },
  reviewField: { marginBottom: 8 },
  reviewFieldLabel: { color: '#89968E', fontSize: 8, fontWeight: '800', marginBottom: 4 },
  reviewInput: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', color: '#FFF8E8', paddingHorizontal: 10, fontSize: 10 },
  reviewSectionRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#1E2A23', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewSectionName: { color: '#D6DED8', fontSize: 10, fontWeight: '800' },
  reviewSectionStatus: { fontSize: 8, fontWeight: '900', textTransform: 'capitalize' },
  changeItem: { color: '#8E9A92', fontSize: 9, lineHeight: 15, paddingVertical: 3 },
});
