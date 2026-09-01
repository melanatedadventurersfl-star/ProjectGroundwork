import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getConnections, respondToConnectionRequest, removeConnection, type Connection } from '../../src/community/circles';
import { AppIcon } from '../../src/ui/AppIcon';

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function locationFor(row: Connection) {
  return [row.home_city, row.home_state].filter(Boolean).join(', ');
}

export default function ConnectionsScreen() {
  const [rows, setRows] = useState<Connection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getConnections();
      setRows(next);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your Trail Crew.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pendingReceived = useMemo(() => rows.filter((row) => row.status === 'pending' && row.direction === 'incoming'), [rows]);
  const pendingSent = useMemo(() => rows.filter((row) => row.status === 'pending' && row.direction === 'outgoing'), [rows]);
  const trailmates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows
      .filter((row) => row.status === 'accepted')
      .filter((row) => !term || `${row.display_name} ${row.home_city ?? ''} ${row.home_state ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [query, rows]);

  async function respond(row: Connection, response: 'accepted' | 'declined') {
    setWorkingId(row.connection_id);
    try {
      await respondToConnectionRequest(row.connection_id, response);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this request.');
    } finally {
      setWorkingId(null);
    }
  }

  async function remove(row: Connection) {
    setWorkingId(row.connection_id);
    try {
      await removeConnection(row.connection_id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove this Trailmate.');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <AppIcon name="chevron-forward" color="#D7B45A" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => router.push('/community/search' as never)}>
            <AppIcon name="connections" color="#17211C" size={18} />
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
        <Text style={styles.title}>Trail Crew</Text>
        <Text style={styles.intro}>{rows.filter((row) => row.status === 'accepted').length} Trailmate{rows.filter((row) => row.status === 'accepted').length === 1 ? '' : 's'} you are connected with across Go Melanated.</Text>

        {pendingReceived.length ? (
          <View style={styles.requestSection}>
            <Text style={styles.sectionEyebrow}>CONNECTION REQUESTS</Text>
            {pendingReceived.map((row) => (
              <View key={row.connection_id} style={styles.requestCard}>
                <Pressable style={styles.personRow} onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: row.profile_id } })}>
                  <View style={styles.avatar}>{row.avatar_url ? <Image source={{ uri: row.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(row.display_name)}</Text>}</View>
                  <View style={styles.personCopy}><Text style={styles.personName}>{row.display_name}</Text>{locationFor(row) ? <Text style={styles.personMeta}>{locationFor(row)}</Text> : null}<Text style={styles.requestCopy}>Wants to become a Trailmate</Text></View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable disabled={workingId === row.connection_id} style={styles.primary} onPress={() => void respond(row, 'accepted')}><Text style={styles.primaryText}>{workingId === row.connection_id ? 'Working…' : 'Accept'}</Text></Pressable>
                  <Pressable disabled={workingId === row.connection_id} style={styles.secondary} onPress={() => void respond(row, 'declined')}><Text style={styles.secondaryText}>Ignore</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {pendingSent.length ? <Text style={styles.pendingNote}>{pendingSent.length} outgoing Trailmate request{pendingSent.length === 1 ? '' : 's'} pending.</Text> : null}

        <View style={styles.searchBox}>
          <AppIcon name="search" color="#829088" size={17} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search Trailmates" placeholderTextColor="#829088" style={styles.searchInput} autoCorrect={false} />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterSelected}><Text style={styles.filterSelectedText}>All</Text></View>
          <View style={styles.filter}><Text style={styles.filterText}>Nearby</Text></View>
          <View style={styles.filter}><Text style={styles.filterText}>Recent</Text></View>
        </View>

        {loading ? <ActivityIndicator color="#D7B45A" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !trailmates.length ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><AppIcon name="connections" color="#D7B45A" size={24} /></View>
            <Text style={styles.emptyTitle}>{query ? 'No Trailmates match that search' : 'Your Trail Crew starts here'}</Text>
            <Text style={styles.muted}>{query ? 'Try another name or location.' : 'Connect with people you meet through communities and adventures. Accepted connections will appear here.'}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {trailmates.map((row) => (
            <Pressable key={row.connection_id} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: row.profile_id } })}>
              <View style={styles.avatar}>{row.avatar_url ? <Image source={{ uri: row.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(row.display_name)}</Text>}</View>
              <View style={styles.personCopy}>
                <Text style={styles.personName}>{row.display_name}</Text>
                {locationFor(row) ? <Text style={styles.personMeta}>{locationFor(row)}</Text> : null}
                <Text style={styles.trailmateLabel}>Trailmate</Text>
              </View>
              <Pressable hitSlop={8} disabled={workingId === row.connection_id} onPress={(event) => { event.stopPropagation(); void remove(row); }} style={styles.moreButton}>
                <AppIcon name="close" color="#78857E" size={15} />
              </Pressable>
              <AppIcon name="chevron-forward" color="#D7B45A" size={18} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#7F9D68', fontWeight: '900', letterSpacing: 1.1, fontSize: 10, marginTop: 2 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900' },
  intro: { color: '#AEB8B2', lineHeight: 20, marginBottom: 4 },
  requestSection: { gap: 9, marginTop: 4 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  requestCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#405244', gap: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { flex: 1, minHeight: 40, backgroundColor: '#D7B45A', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17211C', fontWeight: '900' },
  secondary: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: '#56645C', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '800' },
  requestCopy: { color: '#7F9D68', fontSize: 11, fontWeight: '800', marginTop: 3 },
  pendingNote: { color: '#C0C8C3', fontSize: 11.5, backgroundColor: '#15211B', borderRadius: 12, padding: 11 },
  searchBox: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#314039', backgroundColor: '#111A17', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginTop: 2 },
  searchInput: { flex: 1, color: '#FFF8E8', fontSize: 14, paddingVertical: 10 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filter: { borderRadius: 999, borderWidth: 1, borderColor: '#314039', paddingHorizontal: 13, paddingVertical: 7 },
  filterText: { color: '#AEB8B2', fontSize: 11, fontWeight: '800' },
  filterSelected: { borderRadius: 999, borderWidth: 1, borderColor: '#D7B45A', backgroundColor: '#26342A', paddingHorizontal: 13, paddingVertical: 7 },
  filterSelectedText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' },
  error: { color: '#FFB4A9' },
  empty: { backgroundColor: '#17211C', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#29372F', alignItems: 'center', gap: 6 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#223128', alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  muted: { color: '#96A39B', lineHeight: 19, textAlign: 'center' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A382F' },
  card: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A382F', paddingVertical: 10 },
  pressed: { opacity: 0.65 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  personMeta: { color: '#AEB8B2', fontSize: 11.5, marginTop: 2 },
  trailmateLabel: { color: '#7F9D68', fontSize: 10.5, fontWeight: '900', marginTop: 4 },
  moreButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
