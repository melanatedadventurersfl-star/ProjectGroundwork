import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type EnforcementRow = {
  id: string;
  member_id: string;
  action_type: 'advisory' | 'warning' | 'posting_restriction' | 'suspension' | 'ban';
  reason: string;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  revoked_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  status: string | null;
};

type MemberCase = {
  profile: ProfileRow;
  history: EnforcementRow[];
  activeWarnings: number;
  current: EnforcementRow | null;
  latest: EnforcementRow;
};

type Filter = 'all' | 'warned' | 'restricted' | 'suspended' | 'banned';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'warned', label: 'Warned' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];

function isCurrent(item: EnforcementRow) {
  if (!item.active || item.action_type === 'advisory') return false;
  return !item.expires_at || new Date(item.expires_at).getTime() > Date.now();
}

function currentSeverity(item: EnforcementRow) {
  if (item.action_type === 'ban') return 4;
  if (item.action_type === 'suspension') return 3;
  if (item.action_type === 'posting_restriction') return 2;
  if (item.action_type === 'warning') return 1;
  return 0;
}

function stateFor(member: MemberCase) {
  if (member.current?.action_type === 'ban') return { key: 'banned' as const, label: 'BANNED', detail: 'Permanent account ban' };
  if (member.current?.action_type === 'suspension') return { key: 'suspended' as const, label: 'SUSPENDED', detail: member.current.expires_at ? `Until ${new Date(member.current.expires_at).toLocaleString()}` : 'Account access blocked' };
  if (member.current?.action_type === 'posting_restriction') return { key: 'restricted' as const, label: 'POSTING RESTRICTED', detail: member.current.expires_at ? `Until ${new Date(member.current.expires_at).toLocaleString()}` : 'Community posting blocked' };
  if (member.activeWarnings > 0) return { key: 'warned' as const, label: `${member.activeWarnings} ACTIVE WARNING${member.activeWarnings === 1 ? '' : 'S'}`, detail: 'Formal moderation warning' };
  return { key: 'warned' as const, label: 'HISTORY', detail: 'No active enforcement' };
}

export default function MemberViolationsScreen() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [cases, setCases] = useState<MemberCase[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const admin = await supabase.rpc('is_platform_admin');
    if (admin.error || admin.data !== true) {
      setAuthorized(false);
      if (admin.error) setError(admin.error.message);
      setLoading(false);
      return;
    }
    setAuthorized(true);

    const { data: enforcementData, error: enforcementError } = await supabase
      .from('community_member_enforcements')
      .select('id,member_id,action_type,reason,starts_at,expires_at,active,revoked_at')
      .order('starts_at', { ascending: false });

    if (enforcementError) {
      setError(enforcementError.message);
      setLoading(false);
      return;
    }

    const history = (enforcementData ?? []) as EnforcementRow[];
    const memberIds = [...new Set(history.map((item) => item.member_id))];
    if (memberIds.length === 0) {
      setCases([]);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,display_name,username,email,status')
      .in('id', memberIds);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const profileMap = new Map(((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
    const grouped = new Map<string, EnforcementRow[]>();
    history.forEach((item) => grouped.set(item.member_id, [...(grouped.get(item.member_id) ?? []), item]));

    const nextCases: MemberCase[] = [];
    grouped.forEach((items, memberId) => {
      const profile = profileMap.get(memberId);
      if (!profile || items.length === 0) return;
      const current = [...items].filter(isCurrent).sort((a, b) => currentSeverity(b) - currentSeverity(a) || new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0] ?? null;
      const activeWarnings = items.filter((item) => item.action_type === 'warning' && isCurrent(item)).length;
      const latest = items[0];
      if (!latest) return;
      nextCases.push({ profile, history: items, activeWarnings, current, latest });
    });

    nextCases.sort((a, b) => {
      const severity = currentSeverity(b.current ?? b.latest) - currentSeverity(a.current ?? a.latest);
      return severity || new Date(b.latest.starts_at).getTime() - new Date(a.latest.starts_at).getTime();
    });
    setCases(nextCases);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    banned: cases.filter((item) => stateFor(item).key === 'banned').length,
    suspended: cases.filter((item) => stateFor(item).key === 'suspended').length,
    restricted: cases.filter((item) => stateFor(item).key === 'restricted').length,
    warned: cases.filter((item) => item.activeWarnings > 0).length,
  }), [cases]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cases.filter((item) => {
      const state = stateFor(item);
      const filterMatch = filter === 'all' || state.key === filter || (filter === 'warned' && item.activeWarnings > 0);
      if (!filterMatch) return false;
      if (!needle) return true;
      return [item.profile.display_name, item.profile.username, item.profile.email, state.label, item.latest.reason]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [cases, filter, query]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading violation history…</Text></View></SafeAreaView>;

  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Admin</Text></Pressable>
    <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
    <Text style={styles.title}>Members with Violations</Text>
    <Text style={styles.muted}>A searchable moderation roster showing active account standing and enforcement history.</Text>

    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.statNumber}>{counts.banned}</Text><Text style={styles.statLabel}>BANNED</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{counts.suspended}</Text><Text style={styles.statLabel}>SUSPENDED</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{counts.restricted}</Text><Text style={styles.statLabel}>RESTRICTED</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{counts.warned}</Text><Text style={styles.statLabel}>WARNED</Text></View>
    </View>

    <TextInput value={query} onChangeText={setQuery} placeholder="Search member, status, or violation…" placeholderTextColor="#68766E" style={styles.search} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {FILTERS.map((item) => <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[styles.filter, filter === item.value && styles.filterSelected]}><Text style={[styles.filterText, filter === item.value && styles.filterTextSelected]}>{item.label}</Text></Pressable>)}
    </ScrollView>

    {error ? <Text style={styles.error}>{error}</Text> : null}
    {visible.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No members found</Text><Text style={styles.muted}>No moderation records match this view.</Text></View> : null}

    <View style={styles.list}>{visible.map((member, index) => {
      const state = stateFor(member);
      return <View key={member.profile.id} style={[styles.member, index > 0 && styles.divider]}>
        <View style={styles.memberTop}>
          <View style={styles.memberCopy}>
            <Text style={styles.name}>{member.profile.display_name ?? member.profile.username ?? 'Member'}</Text>
            <Text style={styles.meta}>{member.profile.username ? `@${member.profile.username} · ` : ''}{member.profile.email ?? 'No email'}</Text>
          </View>
          <View style={[styles.statusPill, state.key === 'banned' && styles.dangerPill, state.key === 'suspended' && styles.dangerPill]}><Text style={[styles.statusText, (state.key === 'banned' || state.key === 'suspended') && styles.dangerText]}>{state.label}</Text></View>
        </View>
        <Text style={styles.statusDetail}>{state.detail}</Text>
        <View style={styles.latestBox}>
          <Text style={styles.label}>LATEST VIOLATION</Text>
          <Text style={styles.reason}>{member.latest.reason}</Text>
          <Text style={styles.meta}>{member.latest.action_type.replace('_', ' ').toUpperCase()} · {new Date(member.latest.starts_at).toLocaleString()}</Text>
        </View>
        <Text style={styles.historyMeta}>{member.history.length} moderation action{member.history.length === 1 ? '' : 's'} on record · {member.activeWarnings} active warning{member.activeWarnings === 1 ? '' : 's'}</Text>
      </View>;
    })}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 70, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, denied: { flex: 1, padding: 20, gap: 12 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '900', marginBottom: 4 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, lineHeight: 37, fontWeight: '900' }, muted: { color: '#96A39B', fontSize: 13, lineHeight: 19 }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: 7, marginTop: 6 }, stat: { flex: 1, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#304038', borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 2 }, statNumber: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, statLabel: { color: '#8D9A92', fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  search: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#314139', borderRadius: 14, color: '#FFF8E8', fontSize: 14, paddingHorizontal: 14, paddingVertical: 13 }, filters: { gap: 8, paddingVertical: 2 }, filter: { borderRadius: 999, borderWidth: 1, borderColor: '#3B4B42', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#17211C' }, filterSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, filterText: { color: '#B3BDB7', fontSize: 11, fontWeight: '800' }, filterTextSelected: { color: '#17211C' },
  empty: { padding: 24, alignItems: 'center', gap: 5, borderRadius: 16, borderWidth: 1, borderColor: '#2C3A32', backgroundColor: '#17211C' }, emptyTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, list: { borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#17211C', overflow: 'hidden' }, member: { padding: 15, gap: 9 }, divider: { borderTopWidth: 1, borderTopColor: '#2D3B33' }, memberTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, memberCopy: { flex: 1, gap: 2 }, name: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, meta: { color: '#7F8C84', fontSize: 10, lineHeight: 15 }, statusPill: { borderRadius: 999, borderWidth: 1, borderColor: '#806D35', backgroundColor: '#2A2618', paddingHorizontal: 8, paddingVertical: 5 }, statusText: { color: '#F2D17E', fontSize: 8, fontWeight: '900', letterSpacing: .5 }, dangerPill: { borderColor: '#7A433C', backgroundColor: '#2A1D1B' }, dangerText: { color: '#FFB4A9' }, statusDetail: { color: '#A9B4AD', fontSize: 11, lineHeight: 16 }, latestBox: { borderRadius: 12, backgroundColor: '#101914', borderWidth: 1, borderColor: '#2D3B33', padding: 11, gap: 4 }, label: { color: '#8D9A92', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, reason: { color: '#E7ECE9', fontSize: 13, fontWeight: '800' }, historyMeta: { color: '#8D9A92', fontSize: 10, lineHeight: 15 },
});
