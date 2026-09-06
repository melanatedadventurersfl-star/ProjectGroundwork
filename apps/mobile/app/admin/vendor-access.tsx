import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';
import type { VendorAccessStatus } from '../../src/vendor/vendorAccess';

type VendorApplication = {
  profile_id: string;
  status: VendorAccessStatus;
  business_name: string;
  category: string;
  service_area: string;
  application_note: string;
  applied_at: string;
  approved_at: string | null;
};

type ProfileRow = { id: string; display_name: string | null; username: string | null };

const ACTIONS: { label: string; status: VendorAccessStatus }[] = [
  { label: 'Approve', status: 'approved' },
  { label: 'Needs Info', status: 'needs_info' },
  { label: 'Decline', status: 'declined' },
  { label: 'Pause', status: 'paused' },
  { label: 'Revoke', status: 'revoked' },
];

export default function VendorAccessAdminScreen() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const adminResult = await supabase.rpc('is_platform_admin');
      if (adminResult.error) throw adminResult.error;
      if (adminResult.data !== true) {
        setAuthorized(false);
        setApplications([]);
        return;
      }
      setAuthorized(true);
      const { data, error: accessError } = await supabase
        .from('vendor_center_access')
        .select('profile_id,status,business_name,category,service_area,application_note,applied_at,approved_at')
        .order('applied_at', { ascending: false });
      if (accessError) throw accessError;
      const rows = (data ?? []) as VendorApplication[];
      setApplications(rows);
      const ids = rows.map((row) => row.profile_id);
      if (ids.length) {
        const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,display_name,username').in('id', ids);
        if (!profileError) {
          const next: Record<string, string> = {};
          for (const profile of (profiles ?? []) as ProfileRow[]) next[profile.id] = profile.display_name?.trim() || profile.username?.trim() || 'Member';
          setNames(next);
        }
      } else setNames({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load vendor applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function review(profileId: string, status: VendorAccessStatus) {
    setWorkingId(profileId);
    setError('');
    try {
      const { error: reviewError } = await supabase.rpc('review_vendor_access', { p_profile_id: profileId, p_status: status });
      if (reviewError) throw reviewError;
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update vendor access.');
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading vendor applications…</Text></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.center}><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text><Pressable style={styles.secondary} onPress={() => router.back()}><Text style={styles.secondaryText}>Back</Text></Pressable></SafeAreaView>;

  const pending = applications.filter((item) => item.status === 'pending' || item.status === 'needs_info');
  const other = applications.filter((item) => item.status !== 'pending' && item.status !== 'needs_info');

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Admin</Text></Pressable>
    <Text style={styles.eyebrow}>VENDOR CENTER</Text><Text style={styles.title}>Vendor Access</Text><Text style={styles.subtitle}>Review applications and control who can enter the Vendor Center workspace.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.section}>NEEDS REVIEW · {pending.length}</Text>
    {pending.length ? pending.map((item) => <ApplicationCard key={item.profile_id} item={item} memberName={names[item.profile_id]} working={workingId === item.profile_id} onReview={review} />) : <Text style={styles.empty}>No vendor applications need review.</Text>}
    <Text style={styles.section}>ALL OTHER ACCESS · {other.length}</Text>
    {other.map((item) => <ApplicationCard key={item.profile_id} item={item} memberName={names[item.profile_id]} working={workingId === item.profile_id} onReview={review} />)}
  </ScrollView></SafeAreaView>;
}

function ApplicationCard({ item, memberName, working, onReview }: { item: VendorApplication; memberName?: string; working: boolean; onReview: (id: string, status: VendorAccessStatus) => void | Promise<void> }) {
  return <View style={styles.card}>
    <View style={styles.cardHeader}><View style={{ flex: 1 }}><Text style={styles.business}>{item.business_name || 'Unnamed business'}</Text><Text style={styles.member}>{memberName || 'Member'} · {item.category || 'Uncategorized'}</Text></View><View style={styles.status}><Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text></View></View>
    {item.service_area ? <Text style={styles.detail}>Service area: {item.service_area}</Text> : null}
    {item.application_note ? <Text style={styles.note}>{item.application_note}</Text> : null}
    <Text style={styles.date}>Applied {new Date(item.applied_at).toLocaleDateString()}</Text>
    <View style={styles.actions}>{ACTIONS.filter((action) => action.status !== item.status).map((action) => <Pressable key={action.status} disabled={working} style={[styles.action, action.status === 'approved' && styles.approve]} onPress={() => void onReview(item.profile_id, action.status)}>{working ? <ActivityIndicator size="small" color="#172017" /> : <Text style={[styles.actionText, action.status === 'approved' && styles.approveText]}>{action.label}</Text>}</Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 70, maxWidth: 860, width: '100%', alignSelf: 'center' },
  back: { color: '#D7B45A', fontSize: 14, fontWeight: '800', marginBottom: 14 }, eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 32, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#98A49D', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 580 }, muted: { color: '#8F9A93', fontSize: 11, marginTop: 8 }, error: { color: '#FF9D92', fontSize: 11, lineHeight: 16, marginTop: 12 }, section: { color: '#87948C', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 24, marginBottom: 8 }, empty: { color: '#718078', fontSize: 11, paddingVertical: 12 },
  card: { borderRadius: 17, borderWidth: 1, borderColor: '#314037', backgroundColor: '#17211C', padding: 14, marginBottom: 10 }, cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, business: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, member: { color: '#9BA69F', fontSize: 10, marginTop: 3 }, status: { borderRadius: 999, backgroundColor: '#282515', borderWidth: 1, borderColor: '#655726', paddingHorizontal: 8, paddingVertical: 4 }, statusText: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900' }, detail: { color: '#A5B0A9', fontSize: 10, marginTop: 10 }, note: { color: '#D2D8D4', fontSize: 11, lineHeight: 16, marginTop: 8 }, date: { color: '#6F7C74', fontSize: 8.5, marginTop: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 }, action: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#445149', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#CCD4CF', fontSize: 9, fontWeight: '900' }, approve: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, approveText: { color: '#172017' },
  secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, secondaryText: { color: '#D0D8D3', fontSize: 11, fontWeight: '900' },
});
