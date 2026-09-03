import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createDraftOuting, getOutingHostAccess } from '../../src/hosting/api';
import { addAiTaskPacks, runAiPlannerTurn, type AiPlanState, type AiPlannerTurn } from '../../src/hosting/aiPlanner';
import { createCampaignWorkspace } from '../../src/hosting/creation';
import { addEventComponent, type EventComponentKey } from '../../src/hosting/eventBuilder';
import { addGeneralAdmissionTicket } from '../../src/hosting/tickets';

const VALID_COMPONENTS = new Set<EventComponentKey>(['tickets','food','vendors','marketing','communications','team','volunteers','finance','venue','schedule','activities','lodging','equipment','safety','sponsors','transportation','pages']);

type Message = { role: 'user' | 'assistant'; text: string };

function stageLabel(turn: AiPlannerTurn | null) {
  if (!turn) return 'Start with an idea';
  if (turn.stage === 'ready') return 'Ready to host';
  if (turn.stage === 'confidence') return 'Almost ready to host';
  if (turn.stage === 'momentum') return 'The essentials are coming together';
  return 'The idea is taking shape';
}

export default function AiEventPlannerScreen() {
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState<AiPlanState>({ state: 'FL', components: [] });
  const [turn, setTurn] = useState<AiPlannerTurn | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Tell me what you want to host. I’ll ask one useful question at a time and build the event as we go.' }]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const readiness = turn?.readiness ?? 0;
  const canCreate = readiness >= 95 && Boolean(plan.title && plan.startsAt && plan.endsAt && plan.city && plan.state && plan.capacity);
  const location = useMemo(() => [plan.venueName, plan.city, plan.state].filter(Boolean).join(', '), [plan]);

  async function send(text = input) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const next = await runAiPlannerTurn({ message: trimmed, plan, history: nextHistory.slice(-12) });
      setPlan(next.plan);
      setTurn(next);
      setMessages((current) => [...current, { role: 'assistant', text: next.message }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue planning.');
    } finally {
      setLoading(false);
    }
  }

  async function createEvent() {
    if (!canCreate) return;
    setCreating(true);
    setError('');
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Approved host access is required.');
      if (plan.paid && !access.paidEnabled) throw new Error('Paid hosting is not enabled for this account yet.');
      const outing = await createDraftOuting({
        title: plan.title || 'New Event',
        summary: plan.summary || plan.title || 'New event',
        description: plan.description || plan.summary || plan.title || 'New event',
        category: plan.category || 'Other',
        difficulty: plan.difficulty || 'easy',
        startsAt: plan.startsAt || '',
        endsAt: plan.endsAt || '',
        city: plan.city || '',
        state: plan.state || 'FL',
        venueName: plan.venueName || '',
        capacity: plan.capacity || null,
        meetingInstructions: plan.meetingInstructions || '',
      });
      await addGeneralAdmissionTicket(outing.id, plan.capacity || null, plan.paid ? Number(plan.priceCents || 0) : 0);
      const campaign = await createCampaignWorkspace({ adventureId: outing.id, title: outing.title, location, startsAt: outing.starts_at, endsAt: outing.ends_at });
      const requested = [...new Set(['tickets','team','finance',...(plan.components ?? [])])].filter((key): key is EventComponentKey => VALID_COMPONENTS.has(key as EventComponentKey));
      await Promise.all(requested.map((key) => addEventComponent(campaign.id, key, outing.starts_at)));
      await addAiTaskPacks(campaign.id, outing.starts_at, turn?.taskPacks ?? ['communications','event_day']);
      router.replace(`/host/build/${outing.id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this event.');
    } finally {
      setCreating(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Build an Event</Text></Pressable>
        <View style={styles.privacy}><Text style={styles.privacyText}>Memory Off · Analytics Off</Text></View>
      </View>

      <Text style={styles.eyebrow}>PLAN WITH AI</Text>
      <Text style={styles.title}>{stageLabel(turn)}</Text>
      <Text style={styles.subtitle}>Your plan updates as you answer. Recommendations may rely on AI and available information. Verify changing details such as access, rules, prices, permits, weather and availability before publishing.</Text>

      <View style={styles.progressCard}>
        <View style={styles.progressTop}><Text style={styles.progressValue}>{readiness}% ready</Text><Text style={styles.progressMeta}>{turn?.gaps?.length ?? 0} open items</Text></View>
        <View style={styles.track}><View style={[styles.fill, { width: `${readiness}%` }]} /></View>
        {plan.title ? <Text style={styles.planTitle}>{plan.title}</Text> : null}
        {location ? <Text style={styles.planMeta}>{location}</Text> : null}
        {turn?.gaps?.length ? <Text style={styles.gaps}>Still needed: {turn.gaps.slice(0, 4).join(' · ')}</Text> : readiness >= 95 ? <Text style={styles.ready}>Core event plan is ready.</Text> : null}
      </View>

      <View style={styles.chat}>
        {messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.bubbleText, message.role === 'user' && styles.userText]}>{message.text}</Text></View>)}
        {turn?.recommendation ? <View style={styles.recommendation}><Text style={styles.recLabel}>RECOMMENDED</Text><Text style={styles.recTitle}>{turn.recommendation.label}</Text><Text style={styles.recReason}>{turn.recommendation.reason}</Text>{turn.recommendation.needsVerification ? <Text style={styles.verify}>Needs confirmation before publishing</Text> : null}</View> : null}
      </View>

      {turn?.options?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>{turn.options.map((option) => <Pressable key={option} style={styles.option} onPress={() => void send(option)}><Text style={styles.optionText}>{option}</Text></Pressable>)}</ScrollView> : null}

      <View style={styles.composer}><TextInput value={input} onChangeText={setInput} multiline placeholder="Answer, ask for a recommendation, or change part of the plan…" placeholderTextColor="#657169" style={styles.input} textAlignVertical="top" /><Pressable disabled={loading || input.trim().length === 0} style={[styles.send, (loading || input.trim().length === 0) && styles.disabled]} onPress={() => void send()}>{loading ? <ActivityIndicator color="#172017" /> : <Text style={styles.sendText}>Send</Text>}</Pressable></View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>{canCreate ? 'Your event is ready to create.' : 'AI keeps planning until the core event reaches 95%.'}</Text>
        <Text style={styles.footerBody}>After creation, Host Center adds the selected event components and recommended work packs so Food, Waivers, Safety, Vendors, Communications and other needs become actionable tasks.</Text>
        <Pressable disabled={!canCreate || creating} onPress={() => void createEvent()} style={[styles.create, (!canCreate || creating) && styles.disabled]}>{creating ? <ActivityIndicator color="#172017" /> : <Text style={styles.createText}>Create Event</Text>}</Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 18, paddingBottom: 70 }, topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, back: { color: '#D7B45A', fontSize: 12, fontWeight: '900' }, privacy: { borderRadius: 99, borderWidth: 1, borderColor: '#344039', backgroundColor: '#151B17', paddingHorizontal: 9, paddingVertical: 6 }, privacyText: { color: '#95A198', fontSize: 8, fontWeight: '800' }, eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22 }, title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9AA59E', fontSize: 11, lineHeight: 17, marginTop: 6 }, progressCard: { marginTop: 16, borderRadius: 17, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', padding: 13 }, progressTop: { flexDirection: 'row', justifyContent: 'space-between' }, progressValue: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, progressMeta: { color: '#89958D', fontSize: 9 }, track: { height: 5, borderRadius: 5, backgroundColor: '#2A332D', marginTop: 8, overflow: 'hidden' }, fill: { height: 5, backgroundColor: '#D7B45A' }, planTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 12 }, planMeta: { color: '#9DA7A0', fontSize: 10, marginTop: 3 }, gaps: { color: '#B9AA7D', fontSize: 9, lineHeight: 14, marginTop: 8 }, ready: { color: '#83BC93', fontSize: 10, fontWeight: '800', marginTop: 8 }, chat: { gap: 9, marginTop: 16 }, bubble: { maxWidth: '88%', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10 }, aiBubble: { alignSelf: 'flex-start', backgroundColor: '#172019', borderWidth: 1, borderColor: '#2E3B32' }, userBubble: { alignSelf: 'flex-end', backgroundColor: '#4A3B18' }, bubbleText: { color: '#D8E0DA', fontSize: 12, lineHeight: 18 }, userText: { color: '#FFF3CF' }, recommendation: { borderRadius: 14, borderWidth: 1, borderColor: '#62501E', backgroundColor: '#221D10', padding: 12 }, recLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, recTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', marginTop: 3 }, recReason: { color: '#AAA58F', fontSize: 10, lineHeight: 15, marginTop: 4 }, verify: { color: '#E7C464', fontSize: 9, fontWeight: '800', marginTop: 7 }, options: { gap: 8, paddingTop: 12, paddingRight: 10 }, option: { borderRadius: 99, borderWidth: 1, borderColor: '#455148', backgroundColor: '#161C18', paddingHorizontal: 12, paddingVertical: 8 }, optionText: { color: '#C3CCC6', fontSize: 10, fontWeight: '800' }, composer: { marginTop: 13, borderRadius: 16, borderWidth: 1, borderColor: '#364239', backgroundColor: '#121814', padding: 9 }, input: { minHeight: 76, color: '#FFF8E8', fontSize: 12, lineHeight: 18, paddingHorizontal: 4, paddingVertical: 3 }, send: { alignSelf: 'flex-end', minWidth: 80, minHeight: 38, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 6 }, sendText: { color: '#172017', fontWeight: '900', fontSize: 11 }, disabled: { opacity: 0.4 }, error: { color: '#FF9D92', fontSize: 11, lineHeight: 16, marginTop: 10 }, footerCard: { marginTop: 18, borderRadius: 17, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', padding: 14 }, footerTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, footerBody: { color: '#8E9A92', fontSize: 10, lineHeight: 16, marginTop: 4 }, create: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 12 }, createText: { color: '#172017', fontSize: 13, fontWeight: '900' } });
