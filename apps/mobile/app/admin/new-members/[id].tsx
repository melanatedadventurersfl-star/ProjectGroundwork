import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../../src/lib/supabase';

type MemberRow = {
  profile_id: string; display_name: string | null; username: string | null; avatar_url: string | null;
  home_city: string | null; home_state: string | null; joined_at: string; status: string; platform_role: string | null;
  onboarding_completed_at: string | null; membership_name: string; membership_status: string;
  referral_source: string | null; referral_profile_id: string | null; reviewed_at: string | null; reviewed_by: string | null;
};

export default function AdminNewMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<MemberRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.rpc('admin_list_new_members');
    if (loadError) setError(loadError.message);
    else setMember(((data ?? []) as MemberRow[]).find((row) => row.profile_id === id) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const name = member?.display_name?.trim() || member?.username?.trim() || 'New member';
  const location = [member?.home_city, member?.home_state].filter(Boolean).join(', ') || 'Not added';
  const initials = useMemo(() => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM', [name]);

  async function markReviewed() {
    if (!id || busy) return;
    setBusy(true); setError('');
    const { data, error: reviewError } = await supabase.rpc('admin_review_new_member', { p_profile_id: id });
    if (reviewError) setError(reviewError.message);
    else setMember((current) => current ? { ...current, reviewed_at: String(data) } : current);
    setBusy(false);
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /></View></SafeAreaView>;
  if (!member) return <SafeAreaView style={styles.safe}><View style={styles.content}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ New Members</Text></Pressable><Text style={styles.title}>Member unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ New Members</Text></Pressable>
    <Text style={styles.eyebrow}>ADMIN-SAFE PROFILE</Text>
    <View style={styles.identity}>
      <View style={styles.avatar}>{member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}</View>
      <Text style={styles.title}>{name}</Text>
      {member.username ? <Text style={styles.handle}>@{member.username.replace(/^@/, '')}</Text> : null}
      <Text style={styles.location}>{location}</Text>
    </View>

    <View style={styles.card}>
      <Info label="Joined" value={new Date(member.joined_at).toLocaleString()} />
      <Info label="Membership" value={`${member.membership_name} · ${member.membership_status}`} />
      <Info label="Onboarding" value={member.onboarding_completed_at ? `Completed ${new Date(member.onboarding_completed_at).toLocaleDateString()}` : 'Incomplete'} />
      <Info label="Referral" value={member.referral_source ? `Invited by ${member.referral_source}` : 'No referral recorded'} />
      <Info label="Account status" value={member.status} />
      <Info label="App role" value={member.platform_role ?? 'member'} last />
    </View>

    {member.reviewed_at ? <View style={styles.reviewed}><Text style={styles.reviewedTitle}>Reviewed</Text><Text style={styles.reviewedText}>{new Date(member.reviewed_at).toLocaleString()}</Text></View> : <Pressable disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void markReviewed()}><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Mark as Reviewed'}</Text></Pressable>}
    <Pressable style={styles.profileButton} onPress={() => router.push(`/community-profile/${member.profile_id}` as never)}><Text style={styles.profileButtonText}>View Member-Facing Profile</Text></Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function Info({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.info, !last && styles.divider]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 64 }, back: { color: '#D7B45A', fontSize: 16, fontWeight: '900', paddingVertical: 8 }, eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 12, textAlign: 'center' }, identity: { alignItems: 'center', marginTop: 14, marginBottom: 22 }, avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#26342C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: '#FFF8E8', fontSize: 27, fontWeight: '900' }, title: { color: '#FFF8E8', fontSize: 28, fontWeight: '900', marginTop: 10, textAlign: 'center' }, handle: { color: '#D7B45A', fontSize: 13, fontWeight: '800', marginTop: 3 }, location: { color: '#96A39B', fontSize: 12, marginTop: 5 }, card: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#2D3A33', overflow: 'hidden' }, info: { minHeight: 61, padding: 14, gap: 4 }, divider: { borderBottomWidth: 1, borderBottomColor: '#2D3A33' }, infoLabel: { color: '#7F8D85', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }, infoValue: { color: '#E9F0EB', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }, button: { backgroundColor: '#F5C341', borderRadius: 13, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, buttonText: { color: '#142018', fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.55 }, profileButton: { borderWidth: 1, borderColor: '#53665B', borderRadius: 13, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, profileButtonText: { color: '#FFF8E8', fontSize: 13, fontWeight: '800' }, reviewed: { borderRadius: 13, backgroundColor: '#162A1E', borderWidth: 1, borderColor: '#335A40', padding: 13, marginTop: 16 }, reviewedTitle: { color: '#A8D7B0', fontSize: 12, fontWeight: '900' }, reviewedText: { color: '#789682', fontSize: 11, marginTop: 2 }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18, marginTop: 12 },
});
