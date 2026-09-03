import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign } from '../../../src/hosting/campaigns';
import { getCampaignForAdventure, getEventOperationsSummary, listEventComponents } from '../../../src/hosting/eventBuilder';
import { getEventAnalyticsSummary } from '../../../src/hosting/eventAnalytics';
import { askEventAssistant, type EventAssistantResponse, type EventAssistantSnapshot } from '../../../src/hosting/eventAssistant';

type ChatMessage = { role: 'user' | 'assistant'; text: string };

export default function EventAssistantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<EventAssistantSnapshot | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: 'Ask me what still needs attention, what changes if something moves, or which part of this event to handle next.' }]);
  const [result, setResult] = useState<EventAssistantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const raw = await getCampaignForAdventure(id);
        if (!raw) throw new Error('Event workspace not found.');
        const [campaign, operations, components, analytics] = await Promise.all([
          getHostCampaign(raw.id),
          getEventOperationsSummary(raw.id),
          listEventComponents(raw.id),
          getEventAnalyticsSummary(raw.id).catch(() => ({ impressions: 0, reach: 0, views: 0, clicks: 0, pageViews: 0, checkoutStarts: 0, orders: 0, tickets: 0, refunds: 0, checkIns: 0, grossRevenueCents: 0, refundedCents: 0, capacity: 0, sold: 0, bySource: [] })),
        ]);
        if (!campaign) throw new Error('Event workspace not found.');
        setSnapshot({
          event: { title: campaign.title, location: campaign.location, startsAt: campaign.startsAt, endsAt: campaign.endsAt, status: campaign.status },
          readiness: operations.progress,
          tasks: campaign.tasks.map((task) => ({ title: task.title, category: task.category, status: task.status, priority: task.priority, dueAt: task.dueAt, blockedBy: task.blockedBy })),
          components: components.filter((item: any) => item.status !== 'disabled').map((item: any) => item.component_key),
          operations,
          analytics,
        });
      } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load Event Assistant.'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const quickQuestions = useMemo(() => ['What needs attention?', 'What am I forgetting?', 'What changes if attendance increases?', 'Check promotion and ticket pace'], []);

  async function ask(question = input) {
    const trimmed = question.trim();
    if (!trimmed || !snapshot || working) return;
    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory); setInput(''); setWorking(true); setError('');
    try {
      const next = await askEventAssistant({ question: trimmed, snapshot, history: nextHistory.slice(-12) });
      setResult(next);
      setMessages((current) => [...current, { role: 'assistant', text: next.message }]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to analyze this event.'); }
    finally { setWorking(false); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.loading}>Reading the event…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.topRow}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable><Pressable onPress={() => router.push('/host/ai-privacy' as never)}><Text style={styles.privacy}>AI & Privacy</Text></Pressable></View>
    <Text style={styles.eyebrow}>EVENT ASSISTANT</Text><Text style={styles.title}>{snapshot?.event.title || 'Event Assistant'}</Text><Text style={styles.subtitle}>{snapshot?.readiness ?? 0}% ready · {snapshot?.event.location}</Text>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>{quickQuestions.map((question) => <Pressable key={question} style={styles.quick} onPress={() => void ask(question)}><Text style={styles.quickText}>{question}</Text></Pressable>)}</ScrollView>

    <View style={styles.chat}>{messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.bubbleText, message.role === 'user' && styles.userText]}>{message.text}</Text></View>)}</View>

    {result?.alerts?.length ? <View style={styles.alerts}><Text style={styles.sectionLabel}>NEEDS ATTENTION</Text>{result.alerts.map((alert, index) => <View key={`${alert.title}-${index}`} style={[styles.alert, alert.severity === 'critical' && styles.critical]}><Text style={styles.alertTitle}>{alert.title}</Text><Text style={styles.alertDetail}>{alert.detail}</Text></View>)}</View> : null}

    {result?.recommendedActions?.length ? <View style={styles.actions}><Text style={styles.sectionLabel}>RECOMMENDED NEXT ACTIONS</Text>{result.recommendedActions.map((action, index) => <View key={`${action.label}-${index}`} style={styles.action}><Text style={styles.actionTitle}>{action.label}</Text><Text style={styles.actionReason}>{action.reason}</Text><Text style={styles.actionImpact}>{action.impactAreas.join(' · ')}</Text></View>)}</View> : null}

    <View style={styles.composer}><TextInput value={input} onChangeText={setInput} multiline placeholder="Ask about tasks, sales, vendors, communications, schedule changes…" placeholderTextColor="#69756E" style={styles.input} textAlignVertical="top" /><Pressable disabled={working || !input.trim()} style={[styles.send, (working || !input.trim()) && styles.disabled]} onPress={() => void ask()}>{working ? <ActivityIndicator color="#172017" /> : <Text style={styles.sendText}>Ask</Text>}</Pressable></View>
    <Text style={styles.disclaimer}>The Event Assistant analyzes the current event record. It does not change event data or contact anyone from this screen.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', gap: 8 }, loading: { color: '#8A968E', fontSize: 10 }, content: { padding: 18, paddingBottom: 70 }, topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, back: { color: '#D7B45A', fontSize: 12, fontWeight: '900' }, privacy: { color: '#8F9B93', fontSize: 9, fontWeight: '800' }, eyebrow: { color: '#BDA7F2', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 20 }, title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#8F9B93', fontSize: 10, marginTop: 4 }, quickRow: { gap: 8, paddingTop: 14, paddingRight: 10 }, quick: { borderRadius: 99, borderWidth: 1, borderColor: '#48405D', backgroundColor: '#191720', paddingHorizontal: 11, paddingVertical: 8 }, quickText: { color: '#C9B9EA', fontSize: 9, fontWeight: '800' }, chat: { gap: 8, marginTop: 15 }, bubble: { maxWidth: '88%', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10 }, aiBubble: { alignSelf: 'flex-start', backgroundColor: '#172019', borderWidth: 1, borderColor: '#2E3A32' }, userBubble: { alignSelf: 'flex-end', backgroundColor: '#3B2F54' }, bubbleText: { color: '#D7DED9', fontSize: 11, lineHeight: 17 }, userText: { color: '#F1E8FF' }, alerts: { marginTop: 16, gap: 8 }, actions: { marginTop: 16, gap: 8 }, sectionLabel: { color: '#8D9991', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, alert: { borderRadius: 13, borderWidth: 1, borderColor: '#705A30', backgroundColor: '#211B10', padding: 11 }, critical: { borderColor: '#71443D', backgroundColor: '#241614' }, alertTitle: { color: '#FFF0C7', fontSize: 11, fontWeight: '900' }, alertDetail: { color: '#AFA284', fontSize: 9, lineHeight: 14, marginTop: 3 }, action: { borderRadius: 13, borderWidth: 1, borderColor: '#344138', backgroundColor: '#151B17', padding: 11 }, actionTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, actionReason: { color: '#8E9A92', fontSize: 9, lineHeight: 14, marginTop: 3 }, actionImpact: { color: '#D7B45A', fontSize: 8, fontWeight: '800', marginTop: 5 }, composer: { marginTop: 16, borderRadius: 15, borderWidth: 1, borderColor: '#354139', backgroundColor: '#131A16', padding: 9 }, input: { minHeight: 76, color: '#FFF8E8', fontSize: 11, lineHeight: 17, paddingHorizontal: 4 }, send: { alignSelf: 'flex-end', minHeight: 38, minWidth: 76, borderRadius: 10, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 6 }, sendText: { color: '#172017', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .4 }, disclaimer: { color: '#68756D', fontSize: 8.5, lineHeight: 13, textAlign: 'center', marginTop: 8 }, error: { color: '#FF9D92', fontSize: 10, marginTop: 10 } });
