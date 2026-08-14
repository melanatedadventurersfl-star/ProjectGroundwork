import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addCircleMember,
  deleteCircle,
  getCircleMembers,
  getCircles,
  getConnections,
  removeCircleMember,
  renameCircle,
  type CircleMember,
  type CommunityCircle,
  type Connection,
} from '../../src/community/circles';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#2A3930';
const TEXT = '#FFF8E8';
const MUTED = '#9EAAA2';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function Avatar({ name }: { name: string }) {
  return <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>;
}

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [circle, setCircle] = useState<CommunityCircle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [circles, nextMembers, nextConnections] = await Promise.all([getCircles(), getCircleMembers(id), getConnections()]);
      const nextCircle = circles.find((item) => item.id === id) ?? null;
      setCircle(nextCircle);
      setMembers(nextMembers);
      setConnections(nextConnections);
      setName((current) => current || nextCircle?.name || '');
      setError(nextCircle ? null : 'Circle not found.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this circle.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.profile_id)), [members]);
  const available = useMemo(() => connections.filter((item) => item.status === 'accepted' && !memberIds.has(item.profile_id)), [connections, memberIds]);

  async function run(profileId: string, action: () => Promise<void>) {
    setBusyId(profileId);
    try {
      await action();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this circle.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveName() {
    if (!id || !circle || !name.trim() || name.trim() === circle.name) return;
    setSaving(true);
    try {
      await renameCircle(id, name);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to rename circle.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!id) return;
    Alert.alert('Delete this circle?', 'This only deletes your private circle. It will not remove any connections.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteCircle(id).then(() => router.back()).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to delete circle.')) },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={GOLD} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={TEXT} /></Pressable>
          <View style={styles.ring}><Ionicons name="people" size={24} color={GOLD} /></View>
          <View style={styles.flex}><Text style={styles.eyebrow}>PRIVATE CIRCLE</Text><Text style={styles.title}>{circle?.name ?? 'Circle'}</Text></View>
        </View>

        <Text style={styles.intro}>Only you can see who is in this circle. Use it later for faster invites, sharing, and adventure planning.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.renameCard}>
          <Text style={styles.label}>Circle name</Text>
          <View style={styles.renameRow}>
            <TextInput value={name} onChangeText={setName} maxLength={60} style={styles.nameInput} />
            <Pressable disabled={!name.trim() || name.trim() === circle?.name || saving} style={[styles.saveButton, (!name.trim() || name.trim() === circle?.name || saving) && styles.disabled]} onPress={() => void saveName()}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>In this circle</Text><Text style={styles.sectionHint}>{members.length} {members.length === 1 ? 'person' : 'people'}</Text></View></View>
        <View style={styles.listCard}>
          {members.map((member) => (
            <View key={member.profile_id} style={styles.personRow}>
              <Avatar name={member.display_name} />
              <View style={styles.flex}><Text style={styles.personName}>{member.display_name}</Text><Text style={styles.meta}>{[member.home_city, member.home_state].filter(Boolean).join(', ') || 'Connection'}</Text></View>
              <Pressable disabled={busyId === member.profile_id} onPress={() => id && void run(member.profile_id, () => removeCircleMember(id, member.profile_id))}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
          ))}
          {!members.length ? <Text style={styles.empty}>Your circle is empty. Add some of your connections below.</Text> : null}
        </View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Add connections</Text><Text style={styles.sectionHint}>People must be connected with you before they can join a circle.</Text></View></View>
        <View style={styles.listCard}>
          {available.map((connection) => (
            <View key={connection.profile_id} style={styles.personRow}>
              <Avatar name={connection.display_name} />
              <View style={styles.flex}><Text style={styles.personName}>{connection.display_name}</Text><Text style={styles.meta}>{[connection.home_city, connection.home_state].filter(Boolean).join(', ') || 'Connected'}</Text></View>
              <Pressable disabled={busyId === connection.profile_id} style={styles.addPerson} onPress={() => id && void run(connection.profile_id, () => addCircleMember(id, connection.profile_id))}><Ionicons name="add" size={18} color="#101510" /><Text style={styles.addPersonText}>Add</Text></Pressable>
            </View>
          ))}
          {!available.length ? <Text style={styles.empty}>{connections.some((item) => item.status === 'accepted') ? 'All of your connections are already in this circle.' : 'Connect with people first, then you can organize them here.'}</Text> : null}
        </View>

        <Pressable style={styles.deleteButton} onPress={confirmDelete}><Ionicons name="trash-outline" size={18} color="#FFB4A9" /><Text style={styles.deleteText}>Delete circle</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#89764A', backgroundColor: '#1B2922', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: TEXT, fontSize: 27, lineHeight: 31, fontWeight: '900' },
  intro: { color: '#C1C9C4', fontSize: 13.5, lineHeight: 20 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  renameCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12, gap: 8 },
  label: { color: MUTED, fontSize: 11.5, fontWeight: '800' },
  renameRow: { flexDirection: 'row', gap: 8 },
  nameInput: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#425148', color: TEXT, paddingHorizontal: 11 },
  saveButton: { minWidth: 72, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  saveText: { color: '#101510', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionHeader: { marginTop: 3 },
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: '#7F8B83', fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  listCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, overflow: 'hidden' },
  personRow: { minHeight: 64, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344139' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#294236', borderWidth: 1, borderColor: '#46584D', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: TEXT, fontWeight: '900', fontSize: 12 },
  personName: { color: TEXT, fontWeight: '900', fontSize: 14 },
  meta: { color: MUTED, fontSize: 11.5, marginTop: 2 },
  remove: { color: '#C1B58F', fontSize: 11.5, fontWeight: '800' },
  addPerson: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11 },
  addPersonText: { color: '#101510', fontWeight: '900', fontSize: 11.5 },
  empty: { color: MUTED, padding: 16, textAlign: 'center', lineHeight: 18 },
  deleteButton: { marginTop: 10, minHeight: 45, borderRadius: 13, borderWidth: 1, borderColor: '#55332F', backgroundColor: '#241816', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#FFB4A9', fontWeight: '900' },
});
