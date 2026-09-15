import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { createCampaignWorkspace } from '../../../src/hosting/creation';
import { addDefaultCommunicationSchedule, addEventComponent, getCampaignForAdventure, listEventComponents } from '../../../src/hosting/eventBuilder';
import { supabase } from '../../../src/lib/supabase';

type CommunicationRow = {
  id: string;
  communication_key: string;
  name: string;
  audience_type: string;
  channel: string;
  trigger_type: string;
  days_offset: number | null;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'paused' | 'sent' | 'cancelled';
  subject_override: string | null;
  body_override: string | null;
};

function timingLabel(row: CommunicationRow) {
  if (row.trigger_type === 'immediate') return 'Immediately after registration';
  if (row.trigger_type === 'scheduled' && row.scheduled_at) return new Date(row.scheduled_at).toLocaleString();
  if (row.trigger_type === 'relative') {
    if (row.days_offset === 0) return 'Event day';
    if (row.days_offset === 1) return '1 day after event';
    if (row.days_offset != null && row.days_offset > 0) return `${row.days_offset} days after event`;
    if (row.days_offset === -1) return '1 day before event';
    if (row.days_offset != null) return `${Math.abs(row.days_offset)} days before event`;
  }
  return 'Timing needs review';
}

function statusLabel(status: CommunicationRow['status']) {
  if (status === 'scheduled') return 'Ready';
  if (status === 'sent') return 'Sent';
  if (status === 'paused') return 'Paused';
  if (status === 'cancelled') return 'Cancelled';
  return 'Draft';
}

export default function EventCommunicationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const nextEvent = await getHostOutingById(id);
      let campaign = await getCampaignForAdventure(id);
      if (!campaign) {
        await createCampaignWorkspace({ adventureId: nextEvent.id, title: nextEvent.title, location: [nextEvent.venue_name, nextEvent.city, nextEvent.state].filter(Boolean).join(', '), startsAt: nextEvent.starts_at, endsAt: nextEvent.ends_at });
        campaign = await getCampaignForAdventure(id);
      }
      if (!campaign) throw new Error('The event workspace could not be prepared.');

      const components = await listEventComponents(campaign.id);
      if (!components.some((item) => item.component_key === 'communications' && item.status !== 'disabled')) {
        await addEventComponent(campaign.id, 'communications', nextEvent.starts_at);
      }
      let { data, error: communicationError } = await supabase.from('host_event_communications').select('id,communication_key,name,audience_type,channel,trigger_type,days_offset,scheduled_at,status,subject_override,body_override').eq('campaign_id', campaign.id).order('days_offset', { ascending: true, nullsFirst: false });
      if (communicationError) throw communicationError;
      if (!data?.length) {
        await addDefaultCommunicationSchedule(campaign.id);
        const result = await supabase.from('host_event_communications').select('id,communication_key,name,audience_type,channel,trigger_type,days_offset,scheduled_at,status,subject_override,body_override').eq('campaign_id', campaign.id).order('days_offset', { ascending: true, nullsFirst: false });
        if (result.error) throw result.error;
        data = result.data;
      }
      setEvent(nextEvent);
      setCampaignId(campaign.id);
      setRows((data ?? []) as CommunicationRow[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load attendee communications.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const readyCount = useMemo(() => rows.filter((row) => row.status === 'scheduled' || row.status === 'sent').length, [rows]);

  function startEditing(row: CommunicationRow) {
    setEditingId(row.id);
    setSubject(row.subject_override ?? '');
    setBody(row.body_override ?? '');
    setError('');
  }

  async function saveMessage(row: CommunicationRow) {
    setWorkingId(row.id);
    setError('');
    try {
      const { error: updateError } = await supabase.from('host_event_communications').update({ subject_override: subject.trim() || null, body_override: body.trim() || null, updated_at: new Date().toISOString() }).eq('id', row.id);
      if (updateError) throw updateError;
      setEditingId(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this message.');
    } finally {
      setWorkingId(null);
    }
  }

  async function toggleReady(row: CommunicationRow) {
    if (row.status !== 'scheduled' && row.status !== 'sent' && (!row.subject_override?.trim() || !row.body_override?.trim())) {
      startEditing(row);
      setError('Add a subject and message before marking this communication ready.');
      return;
    }
    if (row.status === 'sent') return;
    setWorkingId(row.id);
    setError('');
    try {
      const nextStatus = row.status === 'scheduled' ? 'draft' : 'scheduled';
      const { error: updateError } = await supabase.from('host_event_communications').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', row.id);
      if (updateError) throw updateError;
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this message.');
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Preparing communications…</Text></SafeAreaView>;
  if (!event || !campaignId) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Communications are unavailable.'}</Text><Pressable onPress={() => router.replace(`/host/review/${id}` as never)}><Text style={styles.back}>Back to event review</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.replace(`/host/review/${id}` as never)}><Text style={styles.back}>‹ Event review</Text></Pressable>
      <Text style={styles.eyebrow}>ATTENDEE COMMUNICATIONS</Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.subtitle}>These messages belong to this event. Add the subject and message, then mark each one ready when you want it in the event communication schedule.</Text>

      <View style={styles.summaryCard}><Text style={styles.summaryValue}>{readyCount}/{rows.length}</Text><View style={styles.flex}><Text style={styles.summaryTitle}>messages ready</Text><Text style={styles.summaryCopy}>{rows.length - readyCount} still need content or scheduling.</Text></View></View>

      {rows.map((row) => {
        const editing = editingId === row.id;
        const ready = row.status === 'scheduled' || row.status === 'sent';
        return <View key={row.id} style={[styles.card, ready && styles.cardReady]}>
          <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.cardTitle}>{row.name}</Text><Text style={styles.meta}>{timingLabel(row)} · {row.channel.toUpperCase()}</Text></View><View style={[styles.status, ready && styles.statusReady]}><Text style={[styles.statusText, ready && styles.statusTextReady]}>{statusLabel(row.status)}</Text></View></View>
          <Text style={styles.audience}>Audience: {row.audience_type.replace(/_/g, ' ')}</Text>
          {!editing ? <>
            <View style={styles.messagePreview}><Text style={styles.previewLabel}>SUBJECT</Text><Text style={styles.previewText}>{row.subject_override?.trim() || 'No subject yet'}</Text><Text style={styles.previewLabel}>MESSAGE</Text><Text style={styles.previewBody}>{row.body_override?.trim() || 'No message content yet'}</Text></View>
            <View style={styles.actions}><Pressable style={styles.secondary} onPress={() => startEditing(row)}><Text style={styles.secondaryText}>Edit message</Text></Pressable><Pressable disabled={workingId != null || row.status === 'sent'} style={[styles.primary, row.status === 'sent' && styles.disabled]} onPress={() => void toggleReady(row)}><Text style={styles.primaryText}>{workingId === row.id ? 'Saving…' : ready ? 'Move to draft' : 'Mark ready'}</Text></Pressable></View>
          </> : <View style={styles.editor}>
            <Text style={styles.label}>Subject</Text><TextInput value={subject} onChangeText={setSubject} placeholder="Attendee message subject" placeholderTextColor="#66736B" style={styles.input} />
            <Text style={styles.label}>Message</Text><TextInput value={body} onChangeText={setBody} placeholder="Write the attendee message" placeholderTextColor="#66736B" multiline textAlignVertical="top" style={[styles.input, styles.multiline]} />
            <View style={styles.actions}><Pressable style={styles.secondary} onPress={() => setEditingId(null)}><Text style={styles.secondaryText}>Cancel</Text></Pressable><Pressable disabled={workingId != null} style={styles.primary} onPress={() => void saveMessage(row)}><Text style={styles.primaryText}>{workingId === row.id ? 'Saving…' : 'Save message'}</Text></Pressable></View>
          </View>}
        </View>;
      })}

      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
      <Pressable style={styles.done} onPress={() => router.replace(`/host/review/${id}` as never)}><Text style={styles.doneText}>Return to Event Review</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 9 }, content: { padding: 18, paddingBottom: 80, maxWidth: 760, width: '100%', alignSelf: 'center' }, flex: { flex: 1 },
  back: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', marginBottom: 15 }, muted: { color: '#819087', fontSize: 10 }, eyebrow: { color: '#A990ED', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#8D9A91', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  summaryCard: { marginTop: 15, borderRadius: 15, borderWidth: 1, borderColor: '#4D4266', backgroundColor: '#191622', padding: 13, flexDirection: 'row', gap: 12, alignItems: 'center' }, summaryValue: { color: '#C8B2FF', fontSize: 24, fontWeight: '900' }, summaryTitle: { color: '#F1EBFF', fontSize: 11, fontWeight: '900' }, summaryCopy: { color: '#8F879D', fontSize: 8.5, marginTop: 2 },
  card: { marginTop: 10, borderRadius: 15, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', padding: 12 }, cardReady: { borderColor: '#42604B' }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, cardTitle: { color: '#F0F4F1', fontSize: 12, fontWeight: '900' }, meta: { color: '#79867E', fontSize: 8.5, marginTop: 3 }, audience: { color: '#8C9890', fontSize: 8.5, marginTop: 7, textTransform: 'capitalize' },
  status: { borderRadius: 8, backgroundColor: '#302817', paddingHorizontal: 7, paddingVertical: 5 }, statusReady: { backgroundColor: '#17301F' }, statusText: { color: '#D7B45A', fontSize: 7, fontWeight: '900' }, statusTextReady: { color: '#8FD09E' },
  messagePreview: { marginTop: 10, borderRadius: 11, backgroundColor: '#0D1410', borderWidth: 1, borderColor: '#28332D', padding: 10 }, previewLabel: { color: '#67756D', fontSize: 7, fontWeight: '900', letterSpacing: .7, marginTop: 4 }, previewText: { color: '#DDE4DF', fontSize: 9.5, fontWeight: '800', marginTop: 3 }, previewBody: { color: '#AEB8B2', fontSize: 9, lineHeight: 14, marginTop: 3 },
  editor: { marginTop: 8 }, label: { color: '#CBD3CE', fontSize: 9.5, fontWeight: '900', marginTop: 9, marginBottom: 5 }, input: { minHeight: 44, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0D1410', borderRadius: 11, color: '#FFF8E8', paddingHorizontal: 11, fontSize: 13 }, multiline: { minHeight: 110, paddingTop: 10 }, actions: { flexDirection: 'row', gap: 8, marginTop: 10 }, secondary: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#C4CCC7', fontSize: 8.5, fontWeight: '900' }, primary: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: '#7652D7', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFF', fontSize: 8.5, fontWeight: '900' }, disabled: { opacity: .55 },
  errorCard: { marginTop: 12, borderRadius: 11, borderWidth: 1, borderColor: '#71483F', backgroundColor: '#261815', padding: 10 }, error: { color: '#FFAAA0', fontSize: 9.5, lineHeight: 14 }, done: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 16 }, doneText: { color: '#172017', fontSize: 10, fontWeight: '900' },
});