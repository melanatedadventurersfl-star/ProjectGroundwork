import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkInAttendee, createIncident, getHeadcounts, getIncidents, getRoster, getSchedule, recordHeadcount } from '../../src/operations/api';
import type { HeadcountRecord, IncidentRecord, RosterEntry, ScheduleItem } from '../../src/operations/types';

export default function LiveAdventureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [headcounts, setHeadcounts] = useState<HeadcountRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    try {
      const [nextRoster, nextSchedule, nextHeadcounts, nextIncidents] = await Promise.all([
        getRoster(id), getSchedule(id), getHeadcounts(id), getIncidents(id),
      ]);
      setRoster(nextRoster);
      setSchedule(nextSchedule);
      setHeadcounts(nextHeadcounts);
      setIncidents(nextIncidents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load live operations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [id]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return roster;
    return roster.filter((entry) => `${entry.first_name} ${entry.last_name} ${entry.credential_code ?? ''}`.toLowerCase().includes(normalized));
  }, [query, roster]);

  const checkedIn = roster.filter((entry) => entry.checked_in_at).length;

  async function manualCheckIn(entry: RosterEntry) {
    if (!id) return;
    try {
      await checkInAttendee(id, entry.attendee_id, 'manual', entry.credential_code ?? undefined);
      await refresh();
    } catch (caught) {
      Alert.alert('Check-in failed', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  async function quickHeadcount() {
    if (!id) return;
    try {
      await recordHeadcount(id, 'Live headcount', checkedIn, roster.length, 'Recorded from current roster status.');
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to record headcount', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  async function quickIncident() {
    if (!id) return;
    try {
      await createIncident({ adventureId: id, title: 'Needs follow-up', description: 'Quick incident marker created in the field. Add details as soon as practical.', severity: 'moderate' });
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to log incident', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>LIVE ADVENTURE</Text>
        <Text style={styles.title}>Field control</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricNumber}>{checkedIn}</Text><Text style={styles.metricLabel}>Checked in</Text></View>
          <View style={styles.metric}><Text style={styles.metricNumber}>{roster.length}</Text><Text style={styles.metricLabel}>Expected</Text></View>
          <View style={styles.metric}><Text style={styles.metricNumber}>{incidents.filter((item) => item.status !== 'resolved').length}</Text><Text style={styles.metricLabel}>Open incidents</Text></View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => void quickHeadcount()}><Text style={styles.primaryText}>Record headcount</Text></Pressable>
          <Pressable style={styles.dangerButton} onPress={() => void quickIncident()}><Text style={styles.primaryText}>Log incident</Text></Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Roster</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search name or code" placeholderTextColor="#87918b" style={styles.input} />
        {filtered.map((entry) => (
          <View key={entry.attendee_id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{entry.first_name} {entry.last_name}</Text>
              <Text style={styles.cardMeta}>{entry.ticket_type_name}</Text>
              <Text style={styles.cardMeta}>{entry.checked_in_at ? `Checked in ${new Date(entry.checked_in_at).toLocaleTimeString()}` : 'Not checked in'}</Text>
            </View>
            {!entry.checked_in_at ? <Pressable style={styles.smallButton} onPress={() => void manualCheckIn(entry)}><Text style={styles.smallButtonText}>Check in</Text></Pressable> : null}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Schedule</Text>
        {schedule.map((item) => (
          <View key={item.id} style={styles.card}><View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{new Date(item.starts_at).toLocaleTimeString()} {item.location ? `• ${item.location}` : ''}</Text></View></View>
        ))}

        <Text style={styles.sectionTitle}>Recent headcounts</Text>
        {headcounts.slice(0, 5).map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.label}: {item.actual_count}{item.expected_count !== null ? ` / ${item.expected_count}` : ''}</Text></View>)}

        <Text style={styles.sectionTitle}>Incidents</Text>
        {incidents.slice(0, 5).map((item) => <View key={item.id} style={styles.card}><View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{item.severity} • {item.status}</Text></View></View>)}

        <View style={styles.offlineNote}>
          <Text style={styles.offlineTitle}>Offline field mode</Text>
          <Text style={styles.cardMeta}>Cache the roster, schedule, credential codes, assignments, emergency contacts, and meeting instructions before arrival. Offline writes should queue locally and sync with their original timestamps when service returns.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' }, center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48, gap: 12 }, eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900' }, metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: '#17211c', padding: 12, borderRadius: 14 }, metricNumber: { color: '#fff8e8', fontSize: 25, fontWeight: '900' }, metricLabel: { color: '#c9d0cb', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8 }, primaryButton: { flex: 1, backgroundColor: '#d3a94f', padding: 13, borderRadius: 12, alignItems: 'center' }, dangerButton: { flex: 1, backgroundColor: '#9f3f35', padding: 13, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#101713', fontWeight: '900' },
  sectionTitle: { color: '#fff8e8', fontSize: 22, fontWeight: '900', marginTop: 10 }, input: { backgroundColor: '#17211c', color: '#fff8e8', borderRadius: 12, padding: 13 },
  card: { backgroundColor: '#17211c', padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { color: '#fff8e8', fontWeight: '800', fontSize: 16 }, cardMeta: { color: '#c9d0cb', marginTop: 3 },
  smallButton: { backgroundColor: '#d3a94f', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }, smallButtonText: { color: '#101713', fontWeight: '900' },
  offlineNote: { borderWidth: 1, borderColor: '#d3a94f', borderRadius: 14, padding: 14, marginTop: 10 }, offlineTitle: { color: '#d3a94f', fontWeight: '900', marginBottom: 5 }, error: { color: '#ffb4a9' },
});