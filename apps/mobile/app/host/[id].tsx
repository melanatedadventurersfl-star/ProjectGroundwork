import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  countPendingFieldActions,
  getCachedHostFieldSnapshot,
  queueFieldCheckIn,
  queueFieldHeadcount,
  queueFieldIncident,
  queueHostBroadcast,
  refreshHostFieldSnapshot,
  syncFieldChanges,
} from '../../src/field/service';
import type { HostFieldSnapshot } from '../../src/field/types';
import type { HostMessageAudience } from '../../src/hosting/communications';
import { getRosterSweep, setRosterSweepStatus } from '../../src/offline/safetyStore';
import type { RosterSweepStatus } from '../../src/offline/safetyTypes';
import type { RosterEntry } from '../../src/operations/types';

const AUDIENCES: Array<{ value: HostMessageAudience; label: string }> = [
  { value: 'registered', label: 'Registered' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'waitlist', label: 'Waitlist' },
];

function statusLabel(status?: RosterSweepStatus) {
  if (!status) return null;
  return status.replaceAll('_', ' ');
}

export default function HostFieldModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<HostFieldSnapshot | null>(null);
  const [sweep, setSweep] = useState<Record<string, RosterSweepStatus>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<HostMessageAudience>('registered');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cached, sweepRows, pendingCount] = await Promise.all([
        getCachedHostFieldSnapshot(id),
        getRosterSweep(id),
        countPendingFieldActions(id),
      ]);
      if (cached) setSnapshot(cached);
      setSweep(Object.fromEntries(sweepRows.map((row) => [row.attendeeId, row.status])));
      setPending(pendingCount);

      try {
        const synced = await syncFieldChanges(id);
        if (synced.snapshot) setSnapshot(synced.snapshot);
        setPending(synced.fieldPending);
        if (synced.lastError && !cached) setError(synced.lastError);

        const fresh = await refreshHostFieldSnapshot(id);
        setSnapshot(fresh);
        setPending(await countPendingFieldActions(id));
        setError(null);
      } catch (onlineError) {
        if (!cached) {
          setError(onlineError instanceof Error ? onlineError.message : 'Field data is not available on this device yet.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const roster = snapshot?.roster ?? [];
  const checkedIn = roster.filter((entry) => entry.checked_in_at).length;
  const returned = Object.values(sweep).filter((status) => status === 'returned').length;
  const openIncidents = (snapshot?.incidents ?? []).filter((item) => item.status !== 'resolved').length;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return roster;
    return roster.filter((entry) => `${entry.first_name} ${entry.last_name} ${entry.credential_code ?? ''}`.toLowerCase().includes(normalized));
  }, [query, roster]);

  async function refreshNow() {
    if (!id) return;
    setRefreshing(true);
    try {
      const result = await syncFieldChanges(id);
      const fresh = await refreshHostFieldSnapshot(id);
      setSnapshot(fresh);
      setPending(await countPendingFieldActions(id));
      setError(result.lastError);
    } catch (caught) {
      setPending(await countPendingFieldActions(id));
      setError(caught instanceof Error ? caught.message : 'No connection. Cached field data is still available.');
    } finally {
      setRefreshing(false);
    }
  }

  async function manualCheckIn(entry: RosterEntry) {
    if (!id || entry.checked_in_at) return;
    try {
      setSnapshot(await queueFieldCheckIn(id, entry));
      setPending(await countPendingFieldActions(id));
    } catch (caught) {
      Alert.alert('Check-in not saved', caught instanceof Error ? caught.message : 'Try again.');
    }
  }

  async function quickHeadcount() {
    if (!id) return;
    try {
      setSnapshot(await queueFieldHeadcount(id, checkedIn, roster.length, 'Recorded from the field roster.'));
      setPending(await countPendingFieldActions(id));
    } catch (caught) {
      Alert.alert('Headcount not saved', caught instanceof Error ? caught.message : 'Try again.');
    }
  }

  async function quickIncident() {
    if (!id) return;
    try {
      setSnapshot(await queueFieldIncident({
        adventureId: id,
        title: 'Needs follow-up',
        description: 'Field incident marker. Add full details when practical.',
        severity: 'moderate',
      }));
      setPending(await countPendingFieldActions(id));
    } catch (caught) {
      Alert.alert('Incident not saved', caught instanceof Error ? caught.message : 'Try again.');
    }
  }

  async function postUpdate() {
    if (!id) return;
    try {
      setSnapshot(await queueHostBroadcast({ adventureId: id, audience, subject, body: messageBody }));
      setSubject('');
      setMessageBody('');
      setPending(await countPendingFieldActions(id));
    } catch (caught) {
      Alert.alert('Update not saved', caught instanceof Error ? caught.message : 'Try again.');
    }
  }

  async function markSweep(attendeeId: string, status: RosterSweepStatus) {
    if (!id) return;
    await setRosterSweepStatus(id, attendeeId, status);
    setSweep((current) => ({ ...current, [attendeeId]: status }));
  }

  if (loading && !snapshot) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D3A94F" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color="#FFF8E8" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>HOST FIELD MODE</Text>
          <Text style={styles.headerTitle}>Event control</Text>
        </View>
        <Pressable accessibilityLabel="Sync field changes" onPress={() => void refreshNow()} style={styles.iconButton}>
          {refreshing ? <ActivityIndicator color="#D3A94F" /> : <Ionicons name="sync" size={20} color="#D3A94F" />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.syncBanner, pending > 0 && styles.syncBannerPending]}>
          <Ionicons name={pending > 0 ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={21} color={pending > 0 ? '#F4C542' : '#76D1B7'} />
          <View style={styles.flex}>
            <Text style={styles.syncTitle}>{pending > 0 ? `${pending} field change${pending === 1 ? '' : 's'} waiting` : 'Field data synced'}</Text>
            <Text style={styles.syncMeta}>
              {snapshot ? `Saved on this device ${new Date(snapshot.savedAt).toLocaleString()}.` : 'No field pack saved yet.'}
              {pending > 0 ? ' Safety actions remain ahead of normal field updates.' : ''}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricNumber}>{checkedIn}</Text><Text style={styles.metricLabel}>Checked in</Text></View>
          <View style={styles.metric}><Text style={styles.metricNumber}>{returned}</Text><Text style={styles.metricLabel}>Returned</Text></View>
          <View style={styles.metric}><Text style={styles.metricNumber}>{openIncidents}</Text><Text style={styles.metricLabel}>Open incidents</Text></View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => void quickHeadcount()}><Text style={styles.primaryText}>Record headcount</Text></Pressable>
          <Pressable style={styles.dangerButton} onPress={() => void quickIncident()}><Text style={styles.primaryText}>Log incident</Text></Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>FIELD COMMUNICATION</Text>
          <Text style={styles.sectionTitle}>Post an event update</Text>
          <Text style={styles.sectionCopy}>Updates save locally first. If there is no connection, they stay queued. “Posted” means stored in Go Melanated, not confirmed read.</Text>
          <View style={styles.audienceRow}>
            {AUDIENCES.map((item) => (
              <Pressable key={item.value} onPress={() => setAudience(item.value)} style={[styles.audienceChip, audience === item.value && styles.audienceChipActive]}>
                <Text style={[styles.audienceText, audience === item.value && styles.audienceTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={subject} onChangeText={setSubject} placeholder="Update subject" placeholderTextColor="#87918B" style={styles.input} />
          <TextInput value={messageBody} onChangeText={setMessageBody} placeholder="What does the group need to know?" placeholderTextColor="#87918B" style={[styles.input, styles.messageInput]} multiline />
          <Pressable style={styles.secondaryButton} onPress={() => void postUpdate()}>
            <Ionicons name="megaphone-outline" size={18} color="#10231C" />
            <Text style={styles.secondaryText}>Save / post update</Text>
          </Pressable>

          {(snapshot?.messages ?? []).slice(0, 8).map((message) => (
            <View key={message.id} style={styles.messageCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.messageSubject}>{message.subject}</Text>
                <Text style={[styles.messageStatus, message.delivery_status === 'queued' && styles.messageQueued]}>{message.delivery_status === 'queued' ? 'QUEUED' : 'POSTED'}</Text>
              </View>
              <Text style={styles.cardMeta}>{message.body}</Text>
              <Text style={styles.micro}>{message.audience.replace('_', ' ')} · {new Date(message.sent_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Roster & sweep</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search name or credential" placeholderTextColor="#87918B" style={styles.input} />
        {filtered.map((entry) => {
          const sweepStatus = sweep[entry.attendee_id];
          return (
            <View key={entry.attendee_id} style={styles.rosterCard}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{entry.first_name} {entry.last_name}</Text>
                <Text style={styles.cardMeta}>{entry.ticket_type_name}</Text>
                <Text style={styles.cardMeta}>{sweepStatus ? statusLabel(sweepStatus) : entry.checked_in_at ? 'checked in' : 'not checked in'}</Text>
                {entry.phone ? (
                  <Pressable onPress={() => void Linking.openURL(`tel:${entry.phone}`)}><Text style={styles.phoneText}>{entry.phone}</Text></Pressable>
                ) : null}
              </View>
              <View style={styles.rosterActions}>
                {!entry.checked_in_at ? <Pressable style={styles.smallButton} onPress={() => void manualCheckIn(entry)}><Text style={styles.smallButtonText}>Check in</Text></Pressable> : null}
                <View style={styles.sweepRow}>
                  <Pressable onPress={() => void markSweep(entry.attendee_id, 'returned')} style={[styles.sweepButton, sweepStatus === 'returned' && styles.sweepButtonActive]}><Text style={styles.sweepText}>Back</Text></Pressable>
                  <Pressable onPress={() => void markSweep(entry.attendee_id, 'still_out')} style={[styles.sweepButton, sweepStatus === 'still_out' && styles.sweepButtonActive]}><Text style={styles.sweepText}>Out</Text></Pressable>
                  <Pressable onPress={() => void markSweep(entry.attendee_id, 'needs_follow_up')} style={[styles.sweepButton, sweepStatus === 'needs_follow_up' && styles.sweepButtonActive]}><Text style={styles.sweepText}>Follow</Text></Pressable>
                </View>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Schedule</Text>
        {(snapshot?.schedule ?? []).map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{new Date(item.starts_at).toLocaleTimeString()} {item.location ? `· ${item.location}` : ''}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recent headcounts</Text>
        {(snapshot?.headcounts ?? []).slice(0, 5).map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.label}: {item.actual_count}{item.expected_count !== null ? ` / ${item.expected_count}` : ''}</Text>
            <Text style={styles.cardMeta}>{new Date(item.recorded_at).toLocaleString()}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Incidents</Text>
        {(snapshot?.incidents ?? []).slice(0, 8).map((item) => (
          <View key={item.id} style={[styles.card, item.severity === 'critical' && styles.criticalCard]}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>{item.severity} · {item.status} · {new Date(item.occurred_at).toLocaleString()}</Text>
              <Text style={styles.cardMeta}>{item.description}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.footerNote}>Field Mode keeps operational work on this device until Go Melanated can sync it. A queued update is not proof that another person received it.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#28352F' },
  headerCopy: { flex: 1, marginHorizontal: 10 },
  eyebrow: { color: '#D3A94F', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  headerTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  syncBanner: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 13, backgroundColor: '#14251F', borderWidth: 1, borderColor: '#315A4C' },
  syncBannerPending: { backgroundColor: '#282313', borderColor: '#5C4F1D' },
  syncTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 13 },
  syncMeta: { color: '#ABB5B0', fontSize: 11, lineHeight: 16, marginTop: 2 },
  error: { color: '#FFB4A9', backgroundColor: '#2B1916', borderRadius: 12, padding: 12, fontSize: 12 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: '#17211C', padding: 12, borderRadius: 14 },
  metricNumber: { color: '#FFF8E8', fontSize: 25, fontWeight: '900' },
  metricLabel: { color: '#C9D0CB', fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { flex: 1, backgroundColor: '#D3A94F', padding: 13, borderRadius: 12, alignItems: 'center' },
  dangerButton: { flex: 1, backgroundColor: '#9F3F35', padding: 13, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#101713', fontWeight: '900' },
  sectionCard: { backgroundColor: '#121A18', borderRadius: 18, borderWidth: 1, borderColor: '#2C3C36', padding: 15, gap: 10 },
  sectionEyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900', marginTop: 8 },
  sectionCopy: { color: '#B6C0BA', fontSize: 12, lineHeight: 18 },
  audienceRow: { flexDirection: 'row', gap: 7 },
  audienceChip: { flex: 1, borderWidth: 1, borderColor: '#45534D', borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  audienceChipActive: { backgroundColor: '#D3A94F', borderColor: '#D3A94F' },
  audienceText: { color: '#C9D0CB', fontSize: 10, fontWeight: '800' },
  audienceTextActive: { color: '#101713' },
  input: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2F3D37', color: '#FFF8E8', borderRadius: 12, padding: 13 },
  messageInput: { minHeight: 88, textAlignVertical: 'top' },
  secondaryButton: { backgroundColor: '#76D1B7', minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { color: '#10231C', fontWeight: '900' },
  messageCard: { borderTopWidth: 1, borderTopColor: '#2A3732', paddingTop: 10, gap: 3 },
  messageSubject: { flex: 1, color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  messageStatus: { color: '#76D1B7', fontSize: 9, fontWeight: '900' },
  messageQueued: { color: '#F4C542' },
  micro: { color: '#79857E', fontSize: 9, marginTop: 3 },
  rosterCard: { backgroundColor: '#17211C', padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rosterActions: { alignItems: 'flex-end', gap: 8 },
  card: { backgroundColor: '#17211C', padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  criticalCard: { borderWidth: 1, borderColor: '#A74A40', backgroundColor: '#281715' },
  cardTitle: { color: '#FFF8E8', fontWeight: '800', fontSize: 15 },
  cardMeta: { color: '#C9D0CB', marginTop: 3, fontSize: 11, lineHeight: 16 },
  phoneText: { color: '#76D1B7', fontWeight: '800', marginTop: 5, fontSize: 11 },
  smallButton: { backgroundColor: '#D3A94F', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  smallButtonText: { color: '#101713', fontWeight: '900', fontSize: 11 },
  sweepRow: { flexDirection: 'row', gap: 4 },
  sweepButton: { borderWidth: 1, borderColor: '#48564F', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 6 },
  sweepButtonActive: { backgroundColor: '#1D3C31', borderColor: '#76D1B7' },
  sweepText: { color: '#C9D0CB', fontSize: 9, fontWeight: '800' },
  footerNote: { color: '#748079', fontSize: 10, lineHeight: 15, textAlign: 'center', padding: 12 },
});
