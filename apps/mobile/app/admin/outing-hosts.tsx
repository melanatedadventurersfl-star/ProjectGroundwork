import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

type HostRow = {
  profile_id: string;
  status: 'pending' | 'approved' | 'paused' | 'revoked';
  host_type: 'community' | 'organization' | 'official';
  can_create_paid_outings: boolean;
  payout_status: 'not_started' | 'pending' | 'verified' | 'restricted';
  application_note: string | null;
  approved_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
};

export default function OutingHostAdminScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    if (!session?.user.id) return;
    setLoading(true);
    setError('');
    try {
      const admin = await supabase.rpc('is_platform_admin');
      if (admin.error) throw admin.error;
      if (admin.data !== true) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      const hostResult = await supabase.from('outing_hosts').select('profile_id,status,host_type,can_create_paid_outings,payout_status,application_note,approved_at').order('created_at', { ascending: false });
      if (hostResult.error) throw hostResult.error;
      const nextHosts = (hostResult.data ?? []) as HostRow[];
      setHosts(nextHosts);
      if (nextHosts.length) {
        const profileResult = await supabase.from('profiles').select('id,display_name,username,email').in('id', nextHosts.map((item) => item.profile_id));
        if (profileResult.error) throw profileResult.error;
        setProfiles((profileResult.data ?? []) as ProfileRow[]);
      } else {
        setProfiles([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load outing hosts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [session?.user.id]);

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  async function updateHost(profileId: string, patch: Partial<HostRow>) {
    setBusy(profileId);
    try {
      const payload: Record<string, unknown> = { ...patch };
      if (patch.status === 'approved') {
        payload.approved_by = session?.user.id;
        payload.approved_at = new Date().toISOString();
      }
      const { error: updateError } = await supabase.from('outing_hosts').update(payload).eq('profile_id', profileId);
      if (updateError) throw updateError;
      await load();
    } catch (caught) {
      Alert.alert('Unable to update host', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.center}><Text style={styles.error}>Admin access required.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ADMINISTRATION</Text>
        <Text style={styles.title}>Outing Hosts</Text>
        <Text style={styles.subtitle}>Approve community hosts and separately control paid-outing privileges.</Text>

        {hosts.length === 0 ? <Text style={styles.empty}>No host applications yet.</Text> : hosts.map((host) => {
          const profile = profileMap.get(host.profile_id);
          const isBusy = busy === host.profile_id;
          return (
            <View key={host.profile_id} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{profile?.display_name || profile?.username || profile?.email || 'Member'}</Text>
                  <Text style={styles.meta}>{host.status.toUpperCase()} · {host.host_type.toUpperCase()}</Text>
                </View>
                <View style={[styles.statusPill, host.status === 'approved' && styles.statusApproved]}><Text style={styles.statusText}>{host.status}</Text></View>
              </View>
              {host.application_note ? <Text style={styles.note}>{host.application_note}</Text> : null}
              <Text style={styles.permission}>Paid outings: {host.can_create_paid_outings ? 'Enabled' : 'Not enabled'} · Payout: {host.payout_status}</Text>

              <View style={styles.actions}>
                {host.status !== 'approved' ? <Action label="Approve" disabled={isBusy} primary onPress={() => void updateHost(host.profile_id, { status: 'approved' })} /> : null}
                {host.status === 'approved' ? <Action label="Pause" disabled={isBusy} onPress={() => void updateHost(host.profile_id, { status: 'paused' })} /> : null}
                {host.status === 'paused' ? <Action label="Restore" disabled={isBusy} primary onPress={() => void updateHost(host.profile_id, { status: 'approved' })} /> : null}
                {host.status !== 'revoked' ? <Action label="Revoke" disabled={isBusy} danger onPress={() => void updateHost(host.profile_id, { status: 'revoked', can_create_paid_outings: false })} /> : null}
              </View>

              {host.status === 'approved' ? (
                <Pressable disabled={isBusy} style={styles.paidToggle} onPress={() => void updateHost(host.profile_id, { can_create_paid_outings: !host.can_create_paid_outings })}>
                  <Text style={styles.paidToggleText}>{host.can_create_paid_outings ? 'Disable paid outings' : 'Enable paid outings'}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, onPress, primary, danger, disabled }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} style={[styles.action, primary && styles.actionPrimary, danger && styles.actionDanger, disabled && { opacity: .45 }]} onPress={onPress}><Text style={[styles.actionText, primary && styles.actionPrimaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 60 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A6B0AA', fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 },
  empty: { color: '#7C8880', fontSize: 13, marginTop: 15 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#171D19', padding: 15, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  meta: { color: '#8D9891', fontSize: 9, fontWeight: '900', letterSpacing: .8, marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, backgroundColor: '#2B312D' },
  statusApproved: { backgroundColor: '#1D4A32' },
  statusText: { color: '#D6DDD8', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  note: { color: '#C5CEC8', fontSize: 12, lineHeight: 18, marginTop: 12 },
  permission: { color: '#A68E4D', fontSize: 10, fontWeight: '800', marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  action: { minHeight: 37, borderRadius: 10, borderWidth: 1, borderColor: '#48534C', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  actionDanger: { borderColor: '#8B413A', backgroundColor: '#321A18' },
  actionText: { color: '#E7ECE8', fontSize: 11, fontWeight: '900' },
  actionPrimaryText: { color: '#172017' },
  paidToggle: { marginTop: 9, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#735B22', backgroundColor: '#2E2818', alignItems: 'center', justifyContent: 'center' },
  paidToggleText: { color: '#E7C464', fontSize: 11, fontWeight: '900' },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 14 },
});
