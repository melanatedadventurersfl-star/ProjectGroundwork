import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

type MemberRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  status: string | null;
  platform_role: string | null;
};

type EnforcementRow = {
  member_id: string;
  action_type: 'advisory' | 'warning' | 'posting_restriction' | 'suspension' | 'ban';
  active: boolean;
  starts_at: string;
  expires_at: string | null;
};

type ModerationState = {
  label: 'BANNED' | 'SUSPENDED' | 'POSTING RESTRICTED' | 'WARNING' | 'ACTIVE' | 'PENDING' | 'RESTRICTED' | 'UNKNOWN';
  level: 'critical' | 'danger' | 'warning' | 'normal';
  warningCount: number;
  expiresAt: string | null;
};

const assignableRoles = ['member', 'host', 'admin'] as const;
type AssignableRole = typeof assignableRoles[number];
type StatusFilter = 'all' | 'banned' | 'suspended' | 'restricted' | 'warnings' | 'active';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'banned', label: 'Banned' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'active', label: 'Active' },
];

function moderationState(member: MemberRow, enforcements: EnforcementRow[]): ModerationState {
  const now = Date.now();
  const active = enforcements.filter((item) => item.active && (!item.expires_at || new Date(item.expires_at).getTime() > now));
  const warningCount = active.filter((item) => item.action_type === 'warning').length;
  const ban = active.find((item) => item.action_type === 'ban');
  if (ban) return { label: 'BANNED', level: 'critical', warningCount, expiresAt: null };
  const suspension = active.find((item) => item.action_type === 'suspension');
  if (suspension) return { label: 'SUSPENDED', level: 'danger', warningCount, expiresAt: suspension.expires_at };
  const restriction = active.find((item) => item.action_type === 'posting_restriction');
  if (restriction) return { label: 'POSTING RESTRICTED', level: 'warning', warningCount, expiresAt: restriction.expires_at };
  if (warningCount > 0) return { label: 'WARNING', level: 'warning', warningCount, expiresAt: null };
  if (member.status === 'active') return { label: 'ACTIVE', level: 'normal', warningCount: 0, expiresAt: null };
  if (member.status === 'pending') return { label: 'PENDING', level: 'normal', warningCount: 0, expiresAt: null };
  if (member.status === 'restricted') return { label: 'RESTRICTED', level: 'warning', warningCount: 0, expiresAt: null };
  if (member.status === 'suspended') return { label: 'SUSPENDED', level: 'danger', warningCount: 0, expiresAt: null };
  return { label: 'UNKNOWN', level: 'normal', warningCount: 0, expiresAt: null };
}

export default function CreatorMembersScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [enforcements, setEnforcements] = useState<EnforcementRow[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const [adminResult, founderResult] = await Promise.all([
      supabase.rpc('is_platform_admin'),
      supabase.from('profiles').select('platform_role').eq('id', userId).single(),
    ]);
    if (adminResult.error || founderResult.error || adminResult.data !== true || founderResult.data?.platform_role !== 'founder') {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setAuthorized(true);
    const [memberResult, enforcementResult] = await Promise.all([
      supabase.from('profiles').select('id,display_name,username,email,status,platform_role').order('created_at', { ascending: false }).limit(250),
      supabase.from('community_member_enforcements').select('member_id,action_type,active,starts_at,expires_at').order('created_at', { ascending: false }),
    ]);
    if (memberResult.error) setError(memberResult.error.message);
    else setRows((memberResult.data ?? []) as MemberRow[]);
    if (enforcementResult.error) setError((current) => current || enforcementResult.error.message);
    else setEnforcements((enforcementResult.data ?? []) as EnforcementRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const enforcementByMember = useMemo(() => {
    const map = new Map<string, EnforcementRow[]>();
    for (const enforcement of enforcements) {
      const existing = map.get(enforcement.member_id) ?? [];
      existing.push(enforcement);
      map.set(enforcement.member_id, existing);
    }
    return map;
  }, [enforcements]);

  const memberStates = useMemo(() => {
    const map = new Map<string, ModerationState>();
    for (const member of rows) map.set(member.id, moderationState(member, enforcementByMember.get(member.id) ?? []));
    return map;
  }, [rows, enforcementByMember]);

  const counts = useMemo(() => {
    const values = [...memberStates.values()];
    return {
      banned: values.filter((state) => state.label === 'BANNED').length,
      suspended: values.filter((state) => state.label === 'SUSPENDED').length,
      restricted: values.filter((state) => state.label === 'POSTING RESTRICTED' || state.label === 'RESTRICTED').length,
      warnings: values.filter((state) => state.warningCount > 0).length,
    };
  }, [memberStates]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const state = memberStates.get(row.id) ?? moderationState(row, []);
      const matchesSearch = !needle || [row.display_name, row.username, row.email, row.platform_role, row.status, state.label]
        .some((value) => value?.toLowerCase().includes(needle));
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'banned') return state.label === 'BANNED';
      if (statusFilter === 'suspended') return state.label === 'SUSPENDED';
      if (statusFilter === 'restricted') return state.label === 'POSTING RESTRICTED' || state.label === 'RESTRICTED';
      if (statusFilter === 'warnings') return state.warningCount > 0;
      return state.label === 'ACTIVE';
    });
  }, [memberStates, query, rows, statusFilter]);

  async function setRole(member: MemberRow, role: AssignableRole) {
    if (member.id === userId) return;
    setBusyId(member.id);
    setError('');
    const { error: updateError } = await supabase.from('profiles').update({ platform_role: role }).eq('id', member.id);
    if (updateError) setError(updateError.message);
    else setRows((current) => current.map((row) => row.id === member.id ? { ...row, platform_role: role } : row));
    setBusyId(null);
  }

  function chooseRole(member: MemberRow) {
    if (member.id === userId) return;
    Alert.alert('Change platform role', member.display_name ?? member.username ?? member.email ?? 'Member', [
      { text: 'Cancel', style: 'cancel' },
      ...assignableRoles.map((role) => ({ text: role.charAt(0).toUpperCase() + role.slice(1), onPress: () => void setRole(member, role) })),
    ]);
  }

  async function toggleStatus(member: MemberRow) {
    if (member.id === userId) return;
    const state = memberStates.get(member.id) ?? moderationState(member, []);
    if (state.label === 'BANNED' || state.label === 'SUSPENDED' || state.label === 'POSTING RESTRICTED') {
      Alert.alert('Moderation enforcement active', `${state.label.replace('_', ' ')} is controlled by Community Safety. Reverse or expire the enforcement before manually changing this account status.`);
      return;
    }
    const next = member.status === 'active' ? 'pending' : 'active';
    setBusyId(member.id);
    setError('');
    const { error: updateError } = await supabase.from('profiles').update({ status: next }).eq('id', member.id);
    if (updateError) setError(updateError.message);
    else setRows((current) => current.map((row) => row.id === member.id ? { ...row, status: next } : row));
    setBusyId(null);
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#F5C341" /><Text style={styles.muted}>Loading member controls…</Text></View></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Creator access required</Text><Text style={styles.muted}>Member-role controls are restricted to the founder account.</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Creator Console</Text></Pressable>
    <Text style={styles.eyebrow}>FOUNDER CONTROL</Text>
    <Text style={styles.title}>Members & Status</Text>
    <Text style={styles.muted}>Account standing now reflects active moderation enforcement, not just the profile record.</Text>

    <View style={styles.summaryRow}>
      <View style={[styles.summaryCard, counts.banned > 0 && styles.summaryCritical]}><Text style={styles.summaryNumber}>{counts.banned}</Text><Text style={styles.summaryLabel}>BANNED</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{counts.suspended}</Text><Text style={styles.summaryLabel}>SUSPENDED</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{counts.restricted}</Text><Text style={styles.summaryLabel}>RESTRICTED</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{counts.warnings}</Text><Text style={styles.summaryLabel}>WARNED</Text></View>
    </View>

    <TextInput value={query} onChangeText={setQuery} autoCapitalize="none" placeholder="Search name, email, role, status…" placeholderTextColor="#66746B" style={styles.search} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {STATUS_FILTERS.map((filter) => <Pressable key={filter.value} onPress={() => setStatusFilter(filter.value)} style={[styles.filterChip, statusFilter === filter.value && styles.filterChipActive]}><Text style={[styles.filterText, statusFilter === filter.value && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}
    </ScrollView>

    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.list}>{filtered.map((member, index) => {
      const isFounder = member.id === userId;
      const busy = busyId === member.id;
      const state = memberStates.get(member.id) ?? moderationState(member, []);
      return <View key={member.id} style={[styles.member, index > 0 && styles.divider]}>
        <View style={styles.memberTop}>
          <View style={styles.memberCopy}>
            <Text style={styles.memberName}>{member.display_name ?? member.username ?? 'Member'}</Text>
            <Text style={styles.memberMeta}>{member.username ? `@${member.username} · ` : ''}{member.email ?? 'No email'}</Text>
          </View>
          {isFounder ? <View style={styles.founderPill}><Text style={styles.founderText}>FOUNDER</Text></View> : <View style={styles.rolePill}><Text style={styles.roleText}>{(member.platform_role ?? 'member').toUpperCase()}</Text></View>}
        </View>

        <View style={[styles.statusPanel, state.level === 'critical' && styles.statusCritical, state.level === 'danger' && styles.statusDanger, state.level === 'warning' && styles.statusWarning]}>
          <View style={styles.statusTop}>
            <Text style={[styles.statusLabel, state.level === 'critical' && styles.statusCriticalText]}>{state.label}</Text>
            {state.warningCount > 0 ? <Text style={styles.warningCount}>{state.warningCount} active warning{state.warningCount === 1 ? '' : 's'}</Text> : null}
          </View>
          {state.label === 'BANNED' ? <Text style={styles.statusDetail}>Permanent enforcement · account access blocked</Text> : null}
          {state.expiresAt ? <Text style={styles.statusDetail}>Until {new Date(state.expiresAt).toLocaleString()}</Text> : null}
          {state.label === 'ACTIVE' ? <Text style={styles.statusDetail}>No active moderation restrictions</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable disabled={busy || isFounder} style={[styles.action, (busy || isFounder) && styles.disabled]} onPress={() => chooseRole(member)}><Text style={styles.actionText}>{busy ? 'Updating…' : 'Change Role'}</Text></Pressable>
          <Pressable disabled={busy || isFounder} style={[styles.actionSecondary, (busy || isFounder) && styles.disabled]} onPress={() => void toggleStatus(member)}><Text style={styles.secondaryText}>{member.status === 'active' ? 'Set Pending' : 'Activate'}</Text></Pressable>
        </View>
      </View>;
    })}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 70 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, denied: { flex: 1, padding: 20, gap: 12 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '900', marginBottom: 14 }, eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 4, marginBottom: 6 }, muted: { color: '#96A39B', fontSize: 13, lineHeight: 19 },
  summaryRow: { flexDirection: 'row', gap: 7, marginTop: 18 }, summaryCard: { flex: 1, minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#314139', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center', padding: 7 }, summaryCritical: { borderColor: '#8B413A', backgroundColor: '#2A1918' }, summaryNumber: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' }, summaryLabel: { color: '#8E9C93', fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginTop: 2 },
  search: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#314139', borderRadius: 14, color: '#FFF8E8', fontSize: 14, paddingHorizontal: 14, paddingVertical: 13, marginTop: 16 }, filters: { gap: 8, paddingVertical: 12 }, filterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#152019', paddingHorizontal: 13, paddingVertical: 8 }, filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#392F19' }, filterText: { color: '#9BA79F', fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#F2D17E' },
  error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18, marginBottom: 10 }, list: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28372F', borderRadius: 18, overflow: 'hidden' }, member: { padding: 15, gap: 12 }, divider: { borderTopWidth: 1, borderTopColor: '#28372F' }, memberTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, memberCopy: { flex: 1, gap: 3 }, memberName: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, memberMeta: { color: '#829088', fontSize: 11, lineHeight: 16 },
  rolePill: { borderRadius: 999, backgroundColor: '#26372D', paddingHorizontal: 9, paddingVertical: 5 }, roleText: { color: '#D9E6DC', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, founderPill: { borderRadius: 999, backgroundColor: '#3A311B', borderWidth: 1, borderColor: '#8D7133', paddingHorizontal: 9, paddingVertical: 5 }, founderText: { color: '#F5C341', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  statusPanel: { borderRadius: 12, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#101914', padding: 10, gap: 3 }, statusCritical: { borderColor: '#A4433C', backgroundColor: '#2B1717' }, statusDanger: { borderColor: '#795046', backgroundColor: '#251A18' }, statusWarning: { borderColor: '#79642E', backgroundColor: '#241F13' }, statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, statusLabel: { color: '#DCE6DF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, statusCriticalText: { color: '#FF9F95' }, warningCount: { color: '#E5C86C', fontSize: 10, fontWeight: '800' }, statusDetail: { color: '#93A198', fontSize: 10, lineHeight: 15 },
  actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1, backgroundColor: '#F5C341', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }, actionText: { color: '#17211C', fontSize: 12, fontWeight: '900' }, actionSecondary: { flex: 1, borderWidth: 1, borderColor: '#4C5B53', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }, secondaryText: { color: '#FFF8E8', fontSize: 12, fontWeight: '800' }, disabled: { opacity: 0.45 },
});