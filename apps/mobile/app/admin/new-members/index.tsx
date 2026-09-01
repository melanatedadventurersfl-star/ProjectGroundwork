import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../src/lib/supabase';
import { AppIcon } from '../../../src/ui/AppIcon';

type MemberRow = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  joined_at: string;
  status: string;
  platform_role: string | null;
  onboarding_completed_at: string | null;
  membership_name: string;
  membership_status: string;
  referral_source: string | null;
  referral_profile_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type Filter = 'unreviewed' | 'today' | '7-days' | '30-days' | 'all';

const filters: { key: Filter; label: string }[] = [
  { key: 'unreviewed', label: 'Unreviewed' },
  { key: 'today', label: 'Today' },
  { key: '7-days', label: '7 days' },
  { key: '30-days', label: '30 days' },
  { key: 'all', label: 'All' },
];

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM';
}

export default function AdminNewMembersScreen() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('unreviewed');
  const [query, setQuery] = useState('');
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('admin_list_new_members');
    if (loadError) {
      setAuthorized(loadError.code !== '42501');
      setError(loadError.message);
      setRows([]);
    } else {
      setAuthorized(true);
      setRows((data ?? []) as MemberRow[]);
      setLoadedAt(Date.now());
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => {
    const weekAgo = loadedAt - 7 * 24 * 60 * 60 * 1000;
    return {
      week: rows.filter((row) => new Date(row.joined_at).getTime() >= weekAgo).length,
      unreviewed: rows.filter((row) => !row.reviewed_at).length,
    };
  }, [loadedAt, rows]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const joined = new Date(row.joined_at).getTime();
      if (filter === 'unreviewed' && row.reviewed_at) return false;
      if (filter === 'today' && joined < startOfDay(loadedAt)) return false;
      if (filter === '7-days' && joined < loadedAt - 7 * 24 * 60 * 60 * 1000) return false;
      if (filter === '30-days' && joined < loadedAt - 30 * 24 * 60 * 60 * 1000) return false;
      if (!needle) return true;
      return [row.display_name, row.username, row.home_city, row.home_state, row.membership_name]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [filter, loadedAt, query, rows]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading new members…</Text></View></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Admin access required</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹ Admin</Text></Pressable>
      <Text style={styles.eyebrow}>MEMBER MANAGEMENT</Text>
      <Text style={styles.title}>New Members</Text>
      <Text style={styles.subtitle}>App signups and onboarding review. Host activity stays in Host Center.</Text>

      <View style={styles.summaryCard}>
        <View><Text style={styles.summaryNumber}>{counts.week}</Text><Text style={styles.summaryLabel}>JOINED THIS WEEK</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={[styles.summaryNumber, counts.unreviewed > 0 && styles.gold]}>{counts.unreviewed}</Text><Text style={styles.summaryLabel}>NEED REVIEW</Text></View>
      </View>

      <TextInput value={query} onChangeText={setQuery} placeholder="Search name, city or membership…" placeholderTextColor="#66746B" style={styles.search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && styles.filterActive]}><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.list}>
        {visibleRows.length ? visibleRows.map((member, index) => {
          const name = member.display_name?.trim() || member.username?.trim() || 'New member';
          const location = [member.home_city, member.home_state].filter(Boolean).join(', ') || 'Location not added';
          return <Pressable key={member.profile_id} style={[styles.member, index > 0 && styles.divider]} onPress={() => router.push(`/admin/new-members/${member.profile_id}` as never)}>
            <View style={styles.avatar}>{member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(name)}</Text>}</View>
            <View style={styles.memberCopy}>
              <View style={styles.nameLine}><Text style={styles.memberName} numberOfLines={1}>{name}</Text>{!member.reviewed_at ? <View style={styles.newPill}><Text style={styles.newPillText}>NEW</Text></View> : null}</View>
              <Text style={styles.memberMeta}>{location}</Text>
              <Text style={styles.memberDetail}>{member.membership_name} · {member.onboarding_completed_at ? 'Onboarding complete' : 'Onboarding incomplete'}</Text>
              <Text style={styles.joined}>Joined {new Date(member.joined_at).toLocaleString()}</Text>
            </View>
            <AppIcon name="chevron-forward" color="#D7B45A" size={18} />
          </Pressable>;
        }) : <View style={styles.empty}><AppIcon name="checkmark" color="#78A982" size={28} /><Text style={styles.emptyTitle}>No members in this view</Text><Text style={styles.emptyBody}>Try another date range or search.</Text></View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 64 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, denied: { flex: 1, padding: 20 }, backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 }, back: { color: '#D7B45A', fontSize: 16, fontWeight: '900' }, eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 8 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#96A39B', fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 370 }, muted: { color: '#96A39B', fontSize: 13 },
  summaryCard: { minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: '#3B4E43', backgroundColor: '#17211C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 20, paddingHorizontal: 18 }, summaryNumber: { color: '#FFF8E8', fontSize: 27, fontWeight: '900', textAlign: 'center' }, gold: { color: '#F5C341' }, summaryLabel: { color: '#839188', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 3 }, summaryDivider: { width: 1, height: 46, backgroundColor: '#34443B' },
  search: { marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#17211C', color: '#FFF8E8', fontSize: 14, paddingHorizontal: 14, paddingVertical: 13 }, filters: { gap: 8, paddingVertical: 12 }, filter: { borderRadius: 999, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#152019', paddingHorizontal: 13, paddingVertical: 8 }, filterActive: { borderColor: '#D7B45A', backgroundColor: '#392F19' }, filterText: { color: '#9BA79F', fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#F2D17E' }, error: { color: '#FFB4A9', fontSize: 12, marginBottom: 10 },
  list: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28372F', overflow: 'hidden' }, member: { minHeight: 100, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, divider: { borderTopWidth: 1, borderTopColor: '#28372F' }, avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: '#8C7132', backgroundColor: '#26342C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, memberCopy: { flex: 1, minWidth: 0 }, nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 }, memberName: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', flexShrink: 1 }, newPill: { borderRadius: 999, backgroundColor: '#3A311B', paddingHorizontal: 7, paddingVertical: 3 }, newPillText: { color: '#F5C341', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, memberMeta: { color: '#A8B3AC', fontSize: 12, fontWeight: '700', marginTop: 3 }, memberDetail: { color: '#839188', fontSize: 10.5, marginTop: 3 }, joined: { color: '#66756C', fontSize: 9.5, marginTop: 3 }, empty: { alignItems: 'center', padding: 34, gap: 5 }, emptyTitle: { color: '#E8F0EA', fontSize: 15, fontWeight: '900' }, emptyBody: { color: '#7F8D85', fontSize: 12 },
});
