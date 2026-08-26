import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addRegistrationQuestion,
  createHostMessage,
  listHostMessages,
  listHostWaitlist,
  listRegistrationQuestions,
  setRegistrationQuestionActive,
  updateWaitlistStatus,
  type HostMessageAudience,
} from '../../../src/hosting/communications';

const audiences: { value: HostMessageAudience; label: string }[] = [
  { value: 'registered', label: 'Registered' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'waitlist', label: 'Waitlist' },
];

export default function HostEngagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [audience, setAudience] = useState<HostMessageAudience>('registered');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!id) return;
    setError('');
    try {
      const [waitlistRows, messageRows, questionRows] = await Promise.all([
        listHostWaitlist(id),
        listHostMessages(id),
        listRegistrationQuestions(id),
      ]);
      setWaitlist(waitlistRows);
      setMessages(messageRows);
      setQuestions(questionRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load host engagement tools.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [id]);

  async function sendMessage() {
    if (!id) return;
    setWorking(true);
    try {
      await createHostMessage({ adventureId: id, audience, subject, body });
      setSubject('');
      setBody('');
      await refresh();
      Alert.alert('Message saved', 'This message is recorded for the selected audience. Delivery fan-out can use this same record when push/email delivery is connected.');
    } catch (caught) {
      Alert.alert('Unable to save message', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { setWorking(false); }
  }

  async function addQuestion() {
    if (!id) return;
    setWorking(true);
    try {
      await addRegistrationQuestion({ adventureId: id, label: question });
      setQuestion('');
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to add question', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { setWorking(false); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Outing management</Text></Pressable>
        <Text style={styles.eyebrow}>HOST TOOLS</Text>
        <Text style={styles.title}>People & communication</Text>
        <Text style={styles.subtitle}>Manage the queue, prepare registration questions, and keep attendees informed.</Text>

        <Text style={styles.sectionTitle}>Message attendees</Text>
        <View style={styles.card}>
          <View style={styles.chips}>{audiences.map((item) => <Pressable key={item.value} onPress={() => setAudience(item.value)} style={[styles.chip, audience === item.value && styles.chipActive]}><Text style={[styles.chipText, audience === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
          <TextInput value={subject} onChangeText={setSubject} placeholder="Weather update" placeholderTextColor="#718078" style={styles.input} />
          <TextInput value={body} onChangeText={setBody} placeholder="Share what attendees need to know…" placeholderTextColor="#718078" multiline style={[styles.input, styles.multiline]} />
          <Pressable disabled={working || !subject.trim() || !body.trim()} onPress={() => void sendMessage()} style={[styles.primary, (working || !subject.trim() || !body.trim()) && styles.disabled]}><Text style={styles.primaryText}>Save message</Text></Pressable>
          <Text style={styles.help}>V1.2 stores the message and audience safely. Push/email fan-out is the next delivery connector, not faked here.</Text>
        </View>

        {messages.length > 0 ? <View style={styles.history}>{messages.slice(0, 5).map((message) => <View key={message.id} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{message.subject}</Text><Text style={styles.meta}>{String(message.audience).replace('_', ' ')} · {new Date(message.sent_at).toLocaleString()}</Text></View></View>)}</View> : null}

        <Text style={styles.sectionTitle}>Waitlist</Text>
        {waitlist.length === 0 ? <Text style={styles.empty}>No one is waiting for a spot.</Text> : waitlist.map((entry) => {
          const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
          return <View key={entry.id} style={styles.queueRow}><View style={styles.position}><Text style={styles.positionText}>{entry.position ?? '•'}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{profile?.display_name || profile?.username || 'Member'}</Text><Text style={styles.meta}>{entry.status === 'offered' ? `Offer expires ${entry.claim_expires_at ? new Date(entry.claim_expires_at).toLocaleString() : 'soon'}` : 'Waiting'}</Text></View>{entry.status === 'waiting' ? <Pressable onPress={() => void updateWaitlistStatus(entry.id, 'offered').then(refresh)} style={styles.smallButton}><Text style={styles.smallButtonText}>Offer spot</Text></Pressable> : null}</View>;
        })}

        <Text style={styles.sectionTitle}>Registration questions</Text>
        <View style={styles.card}>
          <TextInput value={question} onChangeText={setQuestion} placeholder="Anything we should know before the outing?" placeholderTextColor="#718078" style={styles.input} />
          <Pressable disabled={working || !question.trim()} onPress={() => void addQuestion()} style={[styles.secondary, (working || !question.trim()) && styles.disabled]}><Text style={styles.secondaryText}>Add question</Text></Pressable>
        </View>
        {questions.map((item) => <View key={item.id} style={styles.questionRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.label}</Text><Text style={styles.meta}>{item.required ? 'Required' : 'Optional'} · {item.is_active ? 'Active' : 'Off'}</Text></View><Pressable onPress={() => void setRegistrationQuestionActive(item.id, !item.is_active).then(refresh)}><Text style={styles.toggle}>{item.is_active ? 'Turn off' : 'Turn on'}</Text></Pressable></View>)}

        <Text style={styles.sectionTitle}>Credential scanning</Text>
        <View style={styles.card}><Text style={styles.rowTitle}>Scanner-ready</Text><Text style={styles.body}>Credential codes already verify against the host’s own outing. Camera scanning will plug into that same check-in function when the native camera package is added in the next binary build.</Text></View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 60 },
  back: { color: '#D7B45A', fontWeight: '800', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, lineHeight: 37, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#A6B0AA', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 24 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 23, marginBottom: 9 }, card: { borderRadius: 16, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#141B17', padding: 14, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderRadius: 99, borderWidth: 1, borderColor: '#465048', paddingHorizontal: 11, paddingVertical: 7 }, chipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, chipText: { color: '#C6CEC8', fontSize: 11, fontWeight: '800' }, chipTextActive: { color: '#17211C' },
  input: { backgroundColor: '#101612', borderWidth: 1, borderColor: '#2C3831', color: '#FFF8E8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }, multiline: { minHeight: 100, textAlignVertical: 'top' }, primary: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#17211C', fontWeight: '900' }, secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#6C5A2C', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#E7C464', fontWeight: '900' }, disabled: { opacity: 0.4 }, help: { color: '#78837C', fontSize: 10.5, lineHeight: 16 },
  history: { marginTop: 9 }, historyRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222B26' }, historyTitle: { color: '#EAEFEA', fontWeight: '800' }, queueRow: { minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#151C18', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, position: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#3B321B', alignItems: 'center', justifyContent: 'center' }, positionText: { color: '#E7C464', fontWeight: '900' }, rowTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, meta: { color: '#89948D', fontSize: 10.5, marginTop: 3 }, smallButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#D7B45A' }, smallButtonText: { color: '#17211C', fontSize: 10, fontWeight: '900' },
  questionRow: { minHeight: 58, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252E29', flexDirection: 'row', alignItems: 'center', gap: 10 }, toggle: { color: '#D7B45A', fontWeight: '800', fontSize: 11 }, empty: { color: '#758079', fontSize: 13, lineHeight: 19 }, body: { color: '#AAB4AD', fontSize: 12.5, lineHeight: 19, marginTop: 5 }, error: { color: '#FF8A80', marginTop: 18 },
});
