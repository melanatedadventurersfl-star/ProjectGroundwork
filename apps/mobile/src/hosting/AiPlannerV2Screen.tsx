import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createDraftOuting, getOutingHostAccess } from './api';
import { getAiPrivacyPreferences, type AiPlanState, type AiPrivacyPreferences } from './aiPlanner';
import {
  getPlannerSectionStatuses,
  isPlannerUndoCommand,
  reviewPlannerState,
  runAiPlannerV2Turn,
  type AiPlannerV2Action,
  type AiPlannerV2Turn,
} from './aiPlannerV2';
import { linkAiPlannerSessionToEvent, persistAiPlannerTurn } from './aiPlannerPersistence';
import {
  DEFAULT_PLANNER_SECTIONS,
  PLANNER_SECTION_LABELS,
  getAiPlannerTenantContext,
  type AiPlannerSection,
  type AiPlannerSectionStatus,
  type AiPlannerTenantContext,
} from './aiPlannerTenant';
import { createCampaignWorkspace } from './creation';
import { addEventComponent, type EventComponentKey } from './eventBuilder';
import { addGeneralAdmissionTicket } from './tickets';

const VALID_COMPONENTS = new Set<EventComponentKey>(['tickets','food','vendors','marketing','communications','team','volunteers','finance','venue','schedule','activities','lodging','equipment','safety','sponsors','transportation','pages']);
const OFF_PREFS: AiPrivacyPreferences = { personal_memory_enabled: false, event_history_learning_enabled: false, organization_memory_enabled: false, save_conversations_enabled: false, product_analytics_enabled: false, recommendation_history_enabled: false };
const RECOVERY_OPTIONS = ['Basics', 'Date & schedule', 'Venue', 'Registration', 'Communications'];

type Message = { role: 'user' | 'assistant'; text: string };

type SendMeta = {
  section?: AiPlannerSection | null;
  action?: AiPlannerV2Action;
};

function stageLabel(turn: AiPlannerV2Turn | null) {
  if (!turn) return 'Start with an idea';
  if (turn.stage === 'ready') return 'Ready for review';
  if (turn.stage === 'confidence') return 'Plan is well underway';
  if (turn.stage === 'momentum') return 'The essentials are coming together';
  return 'The idea is taking shape';
}

function privacyLabel(prefs: AiPrivacyPreferences) {
  const memory = prefs.personal_memory_enabled || prefs.event_history_learning_enabled ? 'Memory On' : 'Memory Off';
  const analytics = prefs.product_analytics_enabled ? 'Analytics On' : 'Analytics Off';
  return `${memory} · ${analytics} · Privacy ›`;
}

function statusLabel(status: AiPlannerSectionStatus) {
  if (status === 'complete') return 'Done';
  if (status === 'in_progress') return 'In progress';
  if (status === 'needs_review') return 'Review';
  if (status === 'not_applicable') return 'N/A';
  return 'Not started';
}

function sectionFromLabel(label: string): AiPlannerSection | null {
  const normalized = label.trim().toLowerCase();
  return DEFAULT_PLANNER_SECTIONS.find((section) => PLANNER_SECTION_LABELS[section].toLowerCase() === normalized) ?? null;
}

function actionForOption(label: string): AiPlannerV2Action | undefined {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'create draft') return 'create';
  if (normalized === 'review plan') return 'review';
  if (normalized.startsWith('recommend')) return 'recommend';
  if (sectionFromLabel(label)) return 'section';
  return undefined;
}

export default function AiPlannerV2Screen() {
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState<AiPlanState>({ components: [] });
  const [turn, setTurn] = useState<AiPlannerV2Turn | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Tell me what you want to host. I’ll use your organization settings, keep confirmed details intact, and ask one useful question at a time.' }]);
  const [privacy, setPrivacy] = useState<AiPrivacyPreferences>(OFF_PREFS);
  const [tenant, setTenant] = useState<AiPlannerTenantContext | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<AiPlannerSection | null>(null);
  const [undoStack, setUndoStack] = useState<AiPlanState[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [updateCount, setUpdateCount] = useState(1);

  useEffect(() => {
    void Promise.all([
      getAiPrivacyPreferences().catch(() => OFF_PREFS),
      getAiPlannerTenantContext().catch(() => null),
    ]).then(([nextPrivacy, nextTenant]) => {
      setPrivacy(nextPrivacy);
      setTenant(nextTenant);
    });
  }, []);

  const readiness = turn?.readiness ?? 0;
  const sectionStatuses = turn?.sectionStatuses ?? getPlannerSectionStatuses(plan);
  const draftReady = Boolean(plan.title && plan.startsAt && plan.endsAt && plan.city && plan.state);
  const publishReady = readiness >= 85 && Boolean(
    plan.title && plan.category && plan.startsAt && plan.endsAt && plan.city && plan.state &&
    (plan.capacity || plan.attendanceRange) && (plan.venueName || plan.venueDeferred) &&
    plan.paid !== undefined && (!plan.paid || Number(plan.priceCents || 0) > 0),
  );
  const location = useMemo(() => [plan.venueName, plan.city, plan.state].filter(Boolean).join(', '), [plan]);
  const sections = tenant?.sections?.length ? tenant.sections : DEFAULT_PLANNER_SECTIONS;

  async function createEvent(sourcePlan = plan, taskPacks = turn?.taskPacks ?? ['communications','event_day']) {
    const ready = Boolean(sourcePlan.title && sourcePlan.startsAt && sourcePlan.endsAt && sourcePlan.city && sourcePlan.state);
    if (!ready || creating) return;
    setCreating(true);
    setError('');
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Approved host access is required.');
      if (sourcePlan.paid && !access.paidEnabled) throw new Error('Paid hosting is not enabled for this account yet.');
      const outing = await createDraftOuting({
        title: sourcePlan.title || 'New Event',
        summary: sourcePlan.summary || sourcePlan.title || 'New event',
        description: sourcePlan.description || sourcePlan.summary || sourcePlan.title || 'New event',
        category: sourcePlan.category || 'Other',
        difficulty: sourcePlan.difficulty || 'easy',
        startsAt: sourcePlan.startsAt || '',
        endsAt: sourcePlan.endsAt || '',
        city: sourcePlan.city || '',
        state: sourcePlan.state || '',
        venueName: sourcePlan.venueName || '',
        capacity: sourcePlan.capacity || null,
        meetingInstructions: sourcePlan.meetingInstructions || '',
        hostOrganizationId: tenant?.organizationId ?? null,
      });
      if (sourcePlan.paid !== undefined || (sourcePlan.components ?? []).includes('tickets')) {
        await addGeneralAdmissionTicket(outing.id, sourcePlan.capacity || null, sourcePlan.paid ? Number(sourcePlan.priceCents || 0) : 0);
      }
      const workspaceLocation = [sourcePlan.venueName, sourcePlan.city, sourcePlan.state].filter(Boolean).join(', ');
      const campaign = await createCampaignWorkspace({ adventureId: outing.id, title: outing.title, location: workspaceLocation, startsAt: outing.starts_at, endsAt: outing.ends_at });
      const requested = [...new Set(sourcePlan.components ?? [])].filter((key): key is EventComponentKey => VALID_COMPONENTS.has(key as EventComponentKey));
      await Promise.all(requested.map((key) => addEventComponent(campaign.id, key, outing.starts_at)));
      await linkAiPlannerSessionToEvent(sessionId, outing.id).catch(() => undefined);
      const packs = encodeURIComponent(taskPacks.join(','));
      router.replace(`/host/work-plan/${outing.id}?packs=${packs}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this event.');
    } finally {
      setCreating(false);
    }
  }

  async function undoLastChange() {
    if (loading || !undoStack.length) {
      setMessages((current) => [...current, { role: 'assistant', text: 'There is no earlier plan change to undo.' }]);
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    const nextTenant = tenant ?? await getAiPlannerTenantContext();
    const reviewed = reviewPlannerState(previous, nextTenant);
    setUndoStack((stack) => stack.slice(0, -1));
    setPlan(previous);
    setTurn(reviewed);
    setActiveSection(null);
    setMessages((current) => [...current, { role: 'user', text: 'Undo' }, { role: 'assistant', text: `Undid the last plan change. ${reviewed.message}` }]);
    setUpdateCount((value) => value + 1);
  }

  async function send(text = input, meta: SendMeta = {}) {
    const trimmed = text.trim();
    if (!trimmed || loading || creating) return;
    if (isPlannerUndoCommand(trimmed)) {
      setInput('');
      await undoLastChange();
      return;
    }

    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError('');
    setRecovering(false);
    try {
      const nextTenant = tenant ?? await getAiPlannerTenantContext();
      if (!tenant) setTenant(nextTenant);
      const next = await runAiPlannerV2Turn({
        message: trimmed,
        plan,
        history: nextHistory.slice(-16),
        tenant: nextTenant,
        section: meta.section ?? activeSection,
        action: meta.action,
      });
      const completeHistory = [...nextHistory, { role: 'assistant' as const, text: next.message }];
      if (JSON.stringify(next.plan) !== JSON.stringify(plan)) setUndoStack((stack) => [...stack.slice(-9), plan]);
      setPlan(next.plan);
      setTurn(next);
      setActiveSection(next.activeSection);
      setMessages(completeHistory);
      setUpdateCount((value) => value + 1);
      const nextSessionId = await persistAiPlannerTurn({ sessionId, plan: next.plan, turn: next, history: completeHistory }).catch(() => sessionId);
      setSessionId(nextSessionId);
      setPrivacy(await getAiPrivacyPreferences().catch(() => privacy));
      if (next.command === 'create_draft') await createEvent(next.plan, next.taskPacks);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : '';
      setError(detail);
      setRecovering(true);
      setMessages([...nextHistory, {
        role: 'assistant',
        text: 'That step did not finish, but your structured event plan is still here. Choose a section below or keep typing.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function openSection(section: AiPlannerSection) {
    setActiveSection(section);
    await send(PLANNER_SECTION_LABELS[section], { section, action: 'section' });
  }

  const optionList = recovering ? RECOVERY_OPTIONS : turn?.options ?? [];

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Build an Event</Text></Pressable>
        <View style={styles.topActions}>
          <View style={styles.updateBadge}><Text style={styles.updateText}>Update {updateCount}</Text></View>
          <Pressable style={styles.privacy} onPress={() => router.push('/host/ai-privacy' as never)}><Text style={styles.privacyText}>{privacyLabel(privacy)}</Text></Pressable>
        </View>
      </View>

      <Text style={styles.eyebrow}>PLAN WITH AI</Text>
      <Text style={styles.title}>{stageLabel(turn)}</Text>
      <Text style={styles.tenantLine}>Planning for {tenant?.organizationName || 'your organization'}</Text>
      <Text style={styles.subtitle}>The planner follows the active organization instead of assuming an outdoor event. Confirmed details stay in the structured plan even if AI recommendations are unavailable.</Text>

      <View style={styles.progressCard}>
        <View style={styles.progressTop}><Text style={styles.progressValue}>{readiness}% planned</Text><Text style={styles.progressMeta}>{turn?.gaps?.length ?? 0} core items open</Text></View>
        <View style={styles.track}><View style={[styles.fill, { width: `${readiness}%` }]} /></View>
        {plan.title ? <Text style={styles.planTitle}>{plan.title}</Text> : null}
        {plan.category ? <Text style={styles.planMeta}>{plan.category}</Text> : null}
        {location ? <Text style={styles.planMeta}>{location}</Text> : null}
        {plan.attendanceRange && !plan.capacity ? <Text style={styles.planMeta}>Expected attendance: {plan.attendanceRange}</Text> : null}
        {plan.datePreference && !plan.startsAt ? <Text style={styles.planMeta}>Timing: {plan.datePreference}, exact date open</Text> : null}
        {turn?.gaps?.length ? <Text style={styles.gaps}>Event record still needs: {turn.gaps.slice(0, 5).join(' · ')}</Text> : <Text style={styles.ready}>Core event record is ready.</Text>}
        {draftReady ? <Pressable disabled={creating} onPress={() => void createEvent()} style={styles.quickCreate}>{creating ? <ActivityIndicator color="#172017" /> : <Text style={styles.quickCreateText}>Create Draft</Text>}</Pressable> : null}
      </View>

      <Text style={styles.sectionHeading}>PLANNING SECTIONS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sections}>
        {sections.map((section) => {
          const status = sectionStatuses[section];
          const selected = activeSection === section;
          return <Pressable key={section} onPress={() => void openSection(section)} style={[styles.sectionChip, selected && styles.sectionChipSelected]}>
            <Text style={[styles.sectionName, selected && styles.sectionNameSelected]}>{PLANNER_SECTION_LABELS[section]}</Text>
            <Text style={[styles.sectionStatus, status === 'complete' && styles.sectionDone, status === 'not_applicable' && styles.sectionMuted]}>{statusLabel(status)}</Text>
          </Pressable>;
        })}
      </ScrollView>

      <View style={styles.chat}>
        {messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.bubbleText, message.role === 'user' && styles.userText]}>{message.text}</Text></View>)}
        {turn?.recommendation ? <View style={styles.recommendation}><Text style={styles.recLabel}>SUGGESTED</Text><Text style={styles.recTitle}>{turn.recommendation.label}</Text><Text style={styles.recReason}>{turn.recommendation.reason}</Text>{turn.recommendation.needsVerification ? <Text style={styles.verify}>Confirm changing or venue-specific details before publishing</Text> : null}</View> : null}
      </View>

      {optionList.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>{optionList.map((option) => {
        const section = sectionFromLabel(option) ?? activeSection;
        const action = actionForOption(option);
        return <Pressable key={option} style={styles.option} onPress={() => void send(option, { section, action })}><Text style={styles.optionText}>{option}</Text></Pressable>;
      })}</ScrollView> : null}

      <View style={styles.composer}>
        <TextInput value={input} onChangeText={setInput} multiline placeholder="Answer, change something, ask for a recommendation, type ‘review plan’ or ‘create draft’…" placeholderTextColor="#657169" style={styles.input} textAlignVertical="top" />
        <View style={styles.composerActions}>
          <Pressable disabled={!undoStack.length || loading} onPress={() => void undoLastChange()} style={[styles.undo, (!undoStack.length || loading) && styles.disabled]}><Text style={styles.undoText}>Undo</Text></Pressable>
          <Pressable disabled={loading || input.trim().length === 0} style={[styles.send, (loading || input.trim().length === 0) && styles.disabled]} onPress={() => void send()}>{loading ? <ActivityIndicator color="#172017" /> : <Text style={styles.sendText}>Send</Text>}</Pressable>
        </View>
      </View>

      {error && !recovering ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>{publishReady ? 'The plan is strong enough for a publish review.' : draftReady ? 'The event record is ready to create as a draft.' : 'Keep planning the event record.'}</Text>
        <Text style={styles.footerBody}>{draftReady ? 'Optional planning sections can stay open. Creating the draft does not publish the event.' : 'The current event record requires a title, city, state, start date/time and end time. Other sections can remain incomplete or be marked not required.'}</Text>
        <Pressable disabled={!draftReady || creating} onPress={() => void createEvent()} style={[styles.create, (!draftReady || creating) && styles.disabled]}>{creating ? <ActivityIndicator color="#172017" /> : <Text style={styles.createText}>Create Draft</Text>}</Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 90 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  updateBadge: { borderRadius: 99, borderWidth: 1, borderColor: '#6F5B24', backgroundColor: '#2B2412', paddingHorizontal: 8, paddingVertical: 6 },
  updateText: { color: '#E3C564', fontSize: 8, fontWeight: '900' },
  back: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  privacy: { borderRadius: 99, borderWidth: 1, borderColor: '#344039', backgroundColor: '#151B17', paddingHorizontal: 9, paddingVertical: 6 },
  privacyText: { color: '#95A198', fontSize: 8, fontWeight: '800' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  tenantLine: { color: '#D7B45A', fontSize: 10, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#9AA59E', fontSize: 11, lineHeight: 17, marginTop: 6 },
  progressCard: { marginTop: 16, borderRadius: 17, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', padding: 13 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between' },
  progressValue: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  progressMeta: { color: '#89958D', fontSize: 9 },
  track: { height: 5, borderRadius: 5, backgroundColor: '#2A332D', marginTop: 8, overflow: 'hidden' },
  fill: { height: 5, backgroundColor: '#D7B45A' },
  planTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 12 },
  planMeta: { color: '#9DA7A0', fontSize: 10, marginTop: 3 },
  gaps: { color: '#B9AA7D', fontSize: 9, lineHeight: 14, marginTop: 8 },
  ready: { color: '#83BC93', fontSize: 10, fontWeight: '800', marginTop: 8 },
  quickCreate: { alignSelf: 'flex-start', minHeight: 36, borderRadius: 10, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 11 },
  quickCreateText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  sectionHeading: { color: '#87938B', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
  sections: { gap: 8, paddingTop: 8, paddingRight: 12 },
  sectionChip: { minWidth: 112, borderRadius: 13, borderWidth: 1, borderColor: '#354139', backgroundColor: '#141A16', paddingHorizontal: 11, paddingVertical: 9 },
  sectionChipSelected: { borderColor: '#8B7130', backgroundColor: '#211C10' },
  sectionName: { color: '#D8E0DA', fontSize: 10, fontWeight: '900' },
  sectionNameSelected: { color: '#FFF3CF' },
  sectionStatus: { color: '#8F9A92', fontSize: 8, marginTop: 3 },
  sectionDone: { color: '#83BC93' },
  sectionMuted: { color: '#6C766F' },
  chat: { gap: 9, marginTop: 16 },
  bubble: { maxWidth: '88%', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#172019', borderWidth: 1, borderColor: '#2E3B32' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#4A3B18' },
  bubbleText: { color: '#D8E0DA', fontSize: 12, lineHeight: 18 },
  userText: { color: '#FFF3CF' },
  recommendation: { borderRadius: 14, borderWidth: 1, borderColor: '#62501E', backgroundColor: '#221D10', padding: 12 },
  recLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  recTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', marginTop: 3 },
  recReason: { color: '#AAA58F', fontSize: 10, lineHeight: 15, marginTop: 4 },
  verify: { color: '#E7C464', fontSize: 9, fontWeight: '800', marginTop: 7 },
  options: { gap: 8, paddingTop: 12, paddingRight: 10 },
  option: { borderRadius: 99, borderWidth: 1, borderColor: '#455148', backgroundColor: '#161C18', paddingHorizontal: 12, paddingVertical: 8 },
  optionText: { color: '#C3CCC6', fontSize: 10, fontWeight: '800' },
  composer: { marginTop: 13, borderRadius: 16, borderWidth: 1, borderColor: '#364239', backgroundColor: '#121814', padding: 9 },
  input: { minHeight: 76, color: '#FFF8E8', fontSize: 12, lineHeight: 18, paddingHorizontal: 4, paddingVertical: 3 },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  undo: { minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: '#465249', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  undoText: { color: '#AEB8B1', fontSize: 10, fontWeight: '800' },
  send: { minWidth: 80, minHeight: 38, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#172017', fontWeight: '900', fontSize: 11 },
  disabled: { opacity: 0.4 },
  error: { color: '#FF9D92', fontSize: 11, lineHeight: 16, marginTop: 10 },
  footerCard: { marginTop: 18, borderRadius: 17, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', padding: 14 },
  footerTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  footerBody: { color: '#8E9A92', fontSize: 10, lineHeight: 16, marginTop: 4 },
  create: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  createText: { color: '#172017', fontSize: 13, fontWeight: '900' },
});
