import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createCircle,
  getCircles,
  getConnections,
  removeConnection,
  respondToConnectionRequest,
  searchCommunityMembers,
  sendConnectionRequest,
  type CommunityCircle,
  type CommunityPerson,
  type Connection,
} from '../../src/community/circles';

type Tab = 'circles' | 'connections';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#2A3930';
const TEXT = '#FFF8E8';
const MUTED = '#9EAAA2';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function PersonAvatar({ name }: { name: string }) {
  return <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>;
}

function CircleRow({ circle }: { circle: CommunityCircle }) {
  const preview = circle.member_names.slice(0, 3);
  return (
    <Pressable
      style={({ pressed }) => [styles.circleCard, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/circles/[id]', params: { id: circle.id } })}
    >
      <View style={styles.ring}>
        <Ionicons name="people" size={24} color={GOLD} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{circle.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {circle.member_count === 0 ? 'No one here yet' : `${circle.member_count} ${circle.member_count === 1 ? 'person' : 'people'}${preview.length ? ` · ${preview.join(', ')}` : ''}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

function ConnectionRow({ connection, busy, onAccept, onDecline, onRemove }: {
  connection: Connection;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
}) {
  const incoming = connection.status === 'pending' && connection.direction === 'incoming';
  const outgoing = connection.status === 'pending' && connection.direction === 'outgoing';
  return (
    <View style={styles.personRow}>
      <PersonAvatar name={connection.display_name} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{connection.display_name}</Text>
        <Text style={styles.rowMeta}>
          {[connection.home_city, connection.home_state].filter(Boolean).join(', ') || (outgoing ? 'Connection request sent' : incoming ? 'Wants to connect' : 'Connected')}
        </Text>
      </View>
      {incoming ? (
        <View style={styles.inlineActions}>
          <Pressable disabled={busy} style={styles.acceptButton} onPress={onAccept}><Ionicons name="checkmark" size={18} color="#101510" /></Pressable>
          <Pressable disabled={busy} style={styles.iconButton} onPress={onDecline}><Ionicons name="close" size={18} color={TEXT} /></Pressable>
        </View>
      ) : outgoing ? (
        <Pressable disabled={busy} onPress={onRemove}><Text style={styles.mutedAction}>Cancel</Text></Pressable>
      ) : (
        <Pressable disabled={busy} onPress={onRemove}><Ionicons name="ellipsis-horizontal" size={21} color={MUTED} /></Pressable>
      )}
    </View>
  );
}

function SearchResult({ person, busy, onConnect }: { person: CommunityPerson; busy: boolean; onConnect: () => void }) {
  const connected = person.connection_status === 'accepted';
  const pending = person.connection_status === 'pending';
  return (
    <View style={styles.personRow}>
      <PersonAvatar name={person.display_name} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{person.display_name}</Text>
        <Text style={styles.rowMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Member'}</Text>
      </View>
      {connected ? <Text style={styles.connectedLabel}>Connected</Text> : pending ? <Text style={styles.pendingLabel}>{person.connection_direction === 'incoming' ? 'Requested you' : 'Pending'}</Text> : (
        <Pressable disabled={busy} style={styles.connectButton} onPress={onConnect}>
          <Ionicons name="person-add-outline" size={16} color="#101510" />
          <Text style={styles.connectButtonText}>Connect</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CirclesScreen() {
  const [tab, setTab] = useState<Tab>('circles');
  const [circles, setCircles] = useState<CommunityCircle[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [results, setResults] = useState<CommunityPerson[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextCircles, nextConnections] = await Promise.all([getCircles(), getConnections()]);
      setCircles(nextCircles);
      setConnections(nextConnections);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your people.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== 'connections' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchCommunityMembers(query).then(setResults).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to search members.'));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, tab]);

  const accepted = useMemo(() => connections.filter((item) => item.status === 'accepted'), [connections]);
  const requests = useMemo(() => connections.filter((item) => item.status === 'pending' && item.direction === 'incoming'), [connections]);
  const outgoing = useMemo(() => connections.filter((item) => item.status === 'pending' && item.direction === 'outgoing'), [connections]);

  async function createNewCircle() {
    if (!circleName.trim()) return;
    setCreating(true);
    try {
      const id = await createCircle(circleName);
      setCircleName('');
      setCreateOpen(false);
      await load();
      router.push({ pathname: '/circles/[id]', params: { id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create circle.');
    } finally {
      setCreating(false);
    }
  }

  async function act(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      await load();
      if (query.trim().length >= 2) setResults(await searchCommunityMembers(query));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That action did not go through.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={GOLD} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={TEXT} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
            <Text style={styles.title}>Circles</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => setCreateOpen(true)}><Ionicons name="add" size={24} color="#101510" /></Pressable>
        </View>

        <Text style={styles.intro}>Connections are the people you know. Circles are your private way of organizing them for adventures, invites, and sharing.</Text>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'circles' && styles.tabActive]} onPress={() => setTab('circles')}><Text style={[styles.tabText, tab === 'circles' && styles.tabTextActive]}>Circles</Text></Pressable>
          <Pressable style={[styles.tab, tab === 'connections' && styles.tabActive]} onPress={() => setTab('connections')}><Text style={[styles.tabText, tab === 'connections' && styles.tabTextActive]}>Connections</Text></Pressable>
        </View>

        {loading ? <ActivityIndicator color={GOLD} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'circles' ? (
          <>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionTitle}>Your circles</Text><Text style={styles.sectionHint}>Only you can see how you organize people.</Text></View>
              <Text style={styles.count}>{circles.length}</Text>
            </View>
            <View style={styles.listCard}>
              {circles.map((circle) => <CircleRow key={circle.id} circle={circle} />)}
              {!circles.length && !loading ? (
                <Pressable style={styles.emptyState} onPress={() => setCreateOpen(true)}>
                  <View style={styles.emptyIcon}><Ionicons name="people-circle-outline" size={30} color={GOLD} /></View>
                  <Text style={styles.emptyTitle}>Make your first circle</Text>
                  <Text style={styles.emptyText}>Try Camp Crew, Paddle People, Hiking Friends, or Jacksonville Crew.</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {requests.length ? <><Text style={styles.sectionTitle}>Requests</Text><View style={styles.listCard}>{requests.map((item) => <ConnectionRow key={item.connection_id} connection={item} busy={busyId === item.connection_id} onAccept={() => void act(item.connection_id, () => respondToConnectionRequest(item.connection_id, 'accepted'))} onDecline={() => void act(item.connection_id, () => respondToConnectionRequest(item.connection_id, 'declined'))} onRemove={() => void act(item.connection_id, () => removeConnection(item.connection_id))} />)}</View></> : null}

            <Text style={styles.sectionTitle}>Find people</Text>
            <View style={styles.searchBox}><Ionicons name="search" size={18} color={MUTED} /><TextInput value={query} onChangeText={setQuery} placeholder="Search members or city" placeholderTextColor="#738078" style={styles.searchInput} /></View>
            {query.trim().length >= 2 ? <View style={styles.listCard}>{results.map((person) => <SearchResult key={person.id} person={person} busy={busyId === person.id} onConnect={() => void act(person.id, () => sendConnectionRequest(person.id))} />)}{!results.length ? <Text style={styles.emptySearch}>No members found.</Text> : null}</View> : null}

            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your connections</Text><Text style={styles.count}>{accepted.length}</Text></View>
            <View style={styles.listCard}>
              {accepted.map((item) => <ConnectionRow key={item.connection_id} connection={item} busy={busyId === item.connection_id} onAccept={() => undefined} onDecline={() => undefined} onRemove={() => void act(item.connection_id, () => removeConnection(item.connection_id))} />)}
              {!accepted.length ? <Text style={styles.emptySearch}>Connections you accept will show up here.</Text> : null}
            </View>

            {outgoing.length ? <><Text style={styles.sectionTitle}>Sent requests</Text><View style={styles.listCard}>{outgoing.map((item) => <ConnectionRow key={item.connection_id} connection={item} busy={busyId === item.connection_id} onAccept={() => undefined} onDecline={() => undefined} onRemove={() => void act(item.connection_id, () => removeConnection(item.connection_id))} />)}</View></> : null}
          </>
        )}
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>New circle</Text><Pressable onPress={() => setCreateOpen(false)}><Ionicons name="close" size={22} color={TEXT} /></Pressable></View>
            <Text style={styles.modalCopy}>Give this part of your adventure crew a name. Circle membership stays private to you.</Text>
            <TextInput autoFocus value={circleName} onChangeText={setCircleName} maxLength={60} placeholder="Camp Crew" placeholderTextColor="#718078" style={styles.nameInput} />
            <Pressable disabled={!circleName.trim() || creating} style={[styles.createButton, (!circleName.trim() || creating) && styles.disabled]} onPress={() => void createNewCircle()}><Text style={styles.createButtonText}>{creating ? 'Creating…' : 'Create circle'}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { padding: 18, paddingBottom: 46, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: TEXT, fontSize: 31, fontWeight: '900', lineHeight: 35 },
  intro: { color: '#C1C9C4', fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: 'row', backgroundColor: '#18211D', padding: 3, borderRadius: 14 },
  tab: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#2A2D28' },
  tabText: { color: MUTED, fontWeight: '800' },
  tabTextActive: { color: GOLD },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: TEXT, fontWeight: '900', fontSize: 18 },
  sectionHint: { color: '#7F8B83', fontSize: 11.5, marginTop: 2 },
  count: { color: '#9C8B5F', fontWeight: '900', fontSize: 14 },
  listCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, overflow: 'hidden' },
  circleCard: { minHeight: 72, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344139' },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: '#89764A', backgroundColor: '#1B2922', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: TEXT, fontWeight: '900', fontSize: 14.5 },
  rowMeta: { color: MUTED, fontSize: 11.5, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#294236', borderWidth: 1, borderColor: '#46584D', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: TEXT, fontWeight: '900', fontSize: 12 },
  personRow: { minHeight: 64, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344139' },
  inlineActions: { flexDirection: 'row', gap: 7 },
  acceptButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#29342E', alignItems: 'center', justifyContent: 'center' },
  mutedAction: { color: '#B2BBB5', fontWeight: '800', fontSize: 12 },
  connectedLabel: { color: '#9DB7A7', fontWeight: '800', fontSize: 11.5 },
  pendingLabel: { color: '#AFA687', fontWeight: '800', fontSize: 11.5 },
  connectButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  connectButtonText: { color: '#101510', fontWeight: '900', fontSize: 11.5 },
  searchBox: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },
  emptyState: { padding: 24, alignItems: 'center', gap: 7 },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#25332B', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: TEXT, fontWeight: '900', fontSize: 16 },
  emptyText: { color: MUTED, textAlign: 'center', lineHeight: 18, fontSize: 12.5 },
  emptySearch: { color: MUTED, padding: 16, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: '#18221D', borderRadius: 20, borderWidth: 1, borderColor: '#34443A', padding: 17, gap: 13 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: TEXT, fontSize: 22, fontWeight: '900' },
  modalCopy: { color: MUTED, lineHeight: 19, fontSize: 13 },
  nameInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#435148', color: TEXT, paddingHorizontal: 12, fontSize: 15 },
  createButton: { minHeight: 46, backgroundColor: GOLD, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#101510', fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
