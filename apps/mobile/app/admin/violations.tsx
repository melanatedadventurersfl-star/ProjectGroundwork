import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'warned', label: 'Warned' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];

const STATUS_OPTIONS: { value: AccountStatus; label: string; detail: string }[] = [
  { value: 'active', label: 'Active', detail: 'Lift account-level restriction, suspension, or ban. Formal warnings remain on record.' },
  { value: 'restricted', label: 'Posting restricted', detail: 'Member can browse, but cannot create or edit community posts or replies.' },
  { value: 'suspended', label: 'Suspended', detail: 'Member is locked to Account Status until the suspension ends.' },
  { value: 'banned', label: 'Permanently banned', detail: 'Blocks account access until an administrator reverses the ban.' },
];

const DURATIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
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

function editorStatusFor(member: MemberCase): AccountStatus {
  if (member.current?.action_type === 'ban') return 'banned';
  if (member.current?.action_type === 'suspension') return 'suspended';
  if (member.current?.action_type === 'posting_restriction') return 'restricted';
  return 'active';
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberCase | null>(null);
  const [nextStatus, setNextStatus] = useState<AccountStatus>('active');
  const [durationHours, setDurationHours] = useState(168);
  const [note, setNote] = useState('');

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

  function openStatus(member: MemberCase) {
    setSelectedMember(member);
    setNextStatus(editorStatusFor(member));
    setDurationHours(168);
    setNote('');
    setError('');
  }

  async function applyStatusChange() {
    if (!selectedMember || busyId) return;
    setBusyId(selectedMember.profile.id);
    setError('');
    const timed = nextStatus === 'restricted' || nextStatus === 'suspended';
    const { error: statusError } = await supabase.rpc('set_member_moderation_status', {
      p_member_id: selectedMember.profile.id,
      p_status: nextStatus,
      p_duration_hours: timed ? durationHours : null,
      p_note: note.trim() || null,
    });

    if (statusError) {
      setError(statusError.message);
      setBusyId(null);
      return;
    }

    setSelectedMember(null);
    setBusyId(null);
    await load();
  }

  function confirmStatusChange() {
    if (!selectedMember || busyId) return;
    const currentStatus = editorStatusFor(selectedMember);
    const statusChanged = nextStatus !== currentStatus;
    if (!statusChanged) return;

    const liftingActiveEnforcement = nextStatus === 'active' && currentStatus !== 'active';
    if ((liftingActiveEnforcement || nextStatus === 'banned') && !note.trim()) {
      Alert.alert(
        'Admin note required',
        liftingActiveEnforcement
          ? 'Add a short note explaining why this active moderation action should be lifted.'
          : 'A permanent ban requires an internal moderator note explaining why the account is being banned.',
      );
      return;
    }

    if (liftingActiveEnforcement) {
      Alert.alert(
        'Restore this member to Active?',
        'This will immediately lift the current account restriction or suspension. Formal warnings remain on the moderation record.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore Active', onPress: () => { void applyStatusChange(); } },
        ],
      );
      return;
    }

    void applyStatusChange();
  }

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

  const needsDuration = nextStatus === 'restricted' || nextStatus === 'suspended';
  const currentEditorStatus = selectedMember ? editorStatusFor(selectedMember) : 'active';
  const statusChanged = Boolean(selectedMember && nextStatus !== currentEditorStatus);
  const liftingActiveEnforcement = Boolean(selectedMember && nextStatus === 'active' && currentEditorStatus !== 'active');
  const noteRequired = liftingActiveEnforcement || nextStatus === 'banned';
  const confirmDisabled = Boolean(busyId) || !statusChanged || (noteRequired && !note.trim());

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading violation history…</Text></View></SafeAreaView>;

  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        const busy = busyId === member.profile.id;
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
          <Pressable disabled={busy} onPress={() => openStatus(member)} style={[styles.changeButton, busy && styles.disabled]}>
            <Text style={styles.changeButtonText}>{busy ? 'Updating status…' : 'Change status'}</Text>
          </Pressable>
        </View>;
      })}</View>
    </ScrollView>

    <Modal visible={Boolean(selectedMember)} transparent animationType="slide" onRequestClose={() => setSelectedMember(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.eyebrow}>ACCOUNT ENFORCEMENT</Text>
                <Text style={styles.sheetTitle}>Change member status</Text>
                <Text style={styles.muted}>{selectedMember?.profile.display_name ?? selectedMember?.profile.username ?? 'Member'}</Text>
              </View>
              <Pressable onPress={() => setSelectedMember(null)}><Text style={styles.close}>Close</Text></Pressable>
            </View>

            <View style={styles.currentStateBox}>
              <Text style={styles.currentStateLabel}>CURRENT STATUS</Text>
              <Text style={styles.currentStateValue}>{STATUS_OPTIONS.find((item) => item.value === currentEditorStatus)?.label ?? 'Active'}</Text>
            </View>

            <View style={styles.optionList}>
              {STATUS_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => setNextStatus(option.value)} style={[styles.option, nextStatus === option.value && styles.optionSelected]}>
                <View style={[styles.radio, nextStatus === option.value && styles.radioSelected]} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.label}{option.value === currentEditorStatus ? ' · CURRENT' : ''}</Text>
                  <Text style={styles.optionDetail}>{option.detail}</Text>
                </View>
              </Pressable>)}
            </View>

            {needsDuration && statusChanged ? <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DURATION</Text>
              <View style={styles.durationRow}>{DURATIONS.map((item) => <Pressable key={item.hours} onPress={() => setDurationHours(item.hours)} style={[styles.durationChip, durationHours === item.hours && styles.durationSelected]}><Text style={[styles.durationText, durationHours === item.hours && styles.durationTextSelected]}>{item.label}</Text></Pressable>)}</View>
            </View> : null}

            {statusChanged ? <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ADMIN NOTE · {noteRequired ? 'REQUIRED' : 'OPTIONAL'}</Text>
              <TextInput value={note} onChangeText={setNote} multiline placeholder={liftingActiveEnforcement ? 'Explain why this suspension or restriction should be lifted…' : "Why are you changing this member's status?"} placeholderTextColor="#68766E" style={styles.noteInput} />
            </View> : <View style={styles.infoBox}><Text style={styles.infoText}>Choose a different status to make a change.</Text></View>}

            {liftingActiveEnforcement ? <View style={styles.warningBox}><Text style={styles.warningText}>Restoring Active immediately ends the current account-level enforcement. A required admin note and confirmation are used to prevent accidental lifts. Formal warnings remain in moderation history.</Text></View> : null}

            <Pressable disabled={confirmDisabled} onPress={confirmStatusChange} style={[styles.confirmButton, nextStatus === 'banned' && styles.banButton, confirmDisabled && styles.disabled]}>
              <Text style={styles.confirmText}>{busyId ? 'Saving…' : !statusChanged ? 'No status change' : nextStatus === 'banned' ? 'Confirm permanent ban' : nextStatus === 'active' ? 'Restore Active' : `Set ${STATUS_OPTIONS.find((item) => item.value === nextStatus)?.label ?? 'status'}`}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 70, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, denied: { flex: 1, padding: 20, gap: 12 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '900', marginBottom: 4 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, lineHeight: 37, fontWeight: '900' }, muted: { color: '#96A39B', fontSize: 13, lineHeight: 19 }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: 7, marginTop: 6 }, stat: { flex: 1, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#304038', borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 2 }, statNumber: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, statLabel: { color: '#8D9A92', fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  search: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#314139', borderRadius: 14, color: '#FFF8E8', fontSize: 14, paddingHorizontal: 14, paddingVertical: 13 }, filters: { gap: 8, paddingVertical: 2 }, filter: { borderRadius: 999, borderWidth: 1, borderColor: '#3B4B42', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#17211C' }, filterSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, filterText: { color: '#B3BDB7', fontSize: 11, fontWeight: '800' }, filterTextSelected: { color: '#17211C' },
  empty: { padding: 24, alignItems: 'center', gap: 5, borderRadius: 16, borderWidth: 1, borderColor: '#2C3A32', backgroundColor: '#17211C' }, emptyTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, list: { borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#17211C', overflow: 'hidden' }, member: { padding: 15, gap: 9 }, divider: { borderTopWidth: 1, borderTopColor: '#2D3B33' }, memberTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, memberCopy: { flex: 1, gap: 2 }, name: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, meta: { color: '#7F8C84', fontSize: 10, lineHeight: 15 }, statusPill: { borderRadius: 999, borderWidth: 1, borderColor: '#806D35', backgroundColor: '#2A2618', paddingHorizontal: 8, paddingVertical: 5 }, statusText: { color: '#F2D17E', fontSize: 8, fontWeight: '900', letterSpacing: .5 }, dangerPill: { borderColor: '#7A433C', backgroundColor: '#2A1D1B' }, dangerText: { color: '#FFB4A9' }, statusDetail: { color: '#A9B4AD', fontSize: 11, lineHeight: 16 }, latestBox: { borderRadius: 12, backgroundColor: '#101914', borderWidth: 1, borderColor: '#2D3B33', padding: 11, gap: 4 }, label: { color: '#8D9A92', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, reason: { color: '#E7ECE9', fontSize: 13, fontWeight: '800' }, historyMeta: { color: '#8D9A92', fontSize: 10, lineHeight: 15 },
  changeButton: { borderRadius: 11, borderWidth: 1, borderColor: '#7F6934', backgroundColor: '#241F13', paddingVertical: 10, alignItems: 'center' }, changeButtonText: { color: '#F2D17E', fontSize: 12, fontWeight: '900' }, disabled: { opacity: .45 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.66)' }, sheet: { maxHeight: '88%', backgroundColor: '#121B16', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#36463D' }, sheetContent: { padding: 20, paddingBottom: 36, gap: 16 }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, sheetHeaderCopy: { flex: 1, gap: 4 }, sheetTitle: { color: '#FFF8E8', fontSize: 25, fontWeight: '900' }, close: { color: '#D7B45A', fontSize: 13, fontWeight: '900', paddingVertical: 4 }, currentStateBox: { borderRadius: 12, borderWidth: 1, borderColor: '#3A4A41', backgroundColor: '#101914', padding: 12, gap: 3 }, currentStateLabel: { color: '#8D9A92', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, currentStateValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, optionList: { gap: 8 }, option: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#304038', backgroundColor: '#17211C' }, optionSelected: { borderColor: '#D7B45A', backgroundColor: '#211E14' }, radio: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#6E7B73', marginTop: 2 }, radioSelected: { borderColor: '#F2D17E', backgroundColor: '#D7B45A' }, optionCopy: { flex: 1, gap: 3 }, optionTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, optionDetail: { color: '#98A49D', fontSize: 11, lineHeight: 16 }, fieldGroup: { gap: 8 }, fieldLabel: { color: '#A8B3AC', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, durationChip: { borderRadius: 999, borderWidth: 1, borderColor: '#435149', paddingHorizontal: 10, paddingVertical: 7 }, durationSelected: { borderColor: '#D7B45A', backgroundColor: '#2B2516' }, durationText: { color: '#AAB5AE', fontSize: 10, fontWeight: '800' }, durationTextSelected: { color: '#F2D17E' }, noteInput: { minHeight: 88, borderRadius: 12, borderWidth: 1, borderColor: '#39483F', backgroundColor: '#0F1713', color: '#FFF8E8', padding: 12, textAlignVertical: 'top', fontSize: 13 }, infoBox: { borderRadius: 12, borderWidth: 1, borderColor: '#3C543D', backgroundColor: '#152016', padding: 11 }, infoText: { color: '#B8C7B9', fontSize: 11, lineHeight: 17 }, warningBox: { borderRadius: 12, borderWidth: 1, borderColor: '#74582D', backgroundColor: '#251F13', padding: 11 }, warningText: { color: '#E8CD8A', fontSize: 11, lineHeight: 17 }, confirmButton: { borderRadius: 13, backgroundColor: '#D7B45A', paddingVertical: 13, alignItems: 'center' }, banButton: { backgroundColor: '#D66B5D' }, confirmText: { color: '#111813', fontSize: 13, fontWeight: '900' },
});
