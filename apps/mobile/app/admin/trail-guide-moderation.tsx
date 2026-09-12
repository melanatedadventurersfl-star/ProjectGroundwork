import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { getTrailGuidePlace } from '../../src/trailGuide/catalog';
import { supabase } from '../../src/lib/supabase';
import { AppIcon } from '../../src/ui/AppIcon';

type ModerationStatus = 'pending' | 'approved' | 'rejected';

type PhotoRow = {
  id: string;
  place_id: string;
  profile_id: string;
  storage_path: string;
  category: string;
  campsite_label: string | null;
  caption: string | null;
  visit_date: string | null;
  moderation_status: ModerationStatus;
  moderation_source: string | null;
  moderation_model: string | null;
  moderation_score: number | string | null;
  moderation_reason: string | null;
  submission_id: string;
  created_at: string;
  reviewed_at: string | null;
};

type ProfileRow = { id: string; display_name: string | null; username: string | null };

type ModerationPhoto = PhotoRow & {
  signedUrl: string;
  memberName: string;
  placeName: string;
};

const REJECTION_REASONS = [
  'Not This Destination',
  'Inappropriate Content',
  'Poor Image Quality',
  'Duplicate',
  'Personal or Private Information',
  'Commercial or Promotional Content',
] as const;

function memberName(profile: ProfileRow | undefined) {
  return profile?.display_name?.trim() || profile?.username?.trim() || 'Trail Guide Member';
}

function formatDate(value: string | null) {
  if (!value) return 'Visit date not provided';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US');
}

export default function TrailGuideModerationScreen() {
  const { session } = useAuth();
  const { submissionId } = useLocalSearchParams<{ submissionId?: string }>();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ModerationStatus>('pending');
  const [photos, setPhotos] = useState<ModerationPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let active = true;
    if (!session?.user.id) {
      setAuthorized(false);
      return () => { active = false; };
    }
    void supabase.rpc('is_platform_admin').then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) {
        setError(authError.message);
        setAuthorized(false);
      } else {
        setAuthorized(data === true);
      }
    });
    return () => { active = false; };
  }, [session?.user.id]);

  async function load() {
    if (!session?.user.id || authorized !== true) return;
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('trail_guide_photos')
        .select('id,place_id,profile_id,storage_path,category,campsite_label,caption,visit_date,moderation_status,moderation_source,moderation_model,moderation_score,moderation_reason,submission_id,created_at,reviewed_at')
        .eq('moderation_status', status)
        .order('created_at', { ascending: false })
        .limit(100);
      if (submissionId) query = query.eq('submission_id', submissionId);
      const { data, error: photoError } = await query;
      if (photoError) throw photoError;
      const rows = (data ?? []) as PhotoRow[];
      const profileIds = [...new Set(rows.map((row) => row.profile_id))];
      const profilesResult = profileIds.length
        ? await supabase.from('profiles').select('id,display_name,username').in('id', profileIds)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;
      const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, row]));
      const resolved: ModerationPhoto[] = [];
      for (const row of rows) {
        const { data: signed } = await supabase.storage.from('trail-guide-photos').createSignedUrl(row.storage_path, 60 * 60);
        if (!signed?.signedUrl) continue;
        resolved.push({
          ...row,
          signedUrl: signed.signedUrl,
          memberName: memberName(profiles.get(row.profile_id)),
          placeName: getTrailGuidePlace(row.place_id)?.name ?? row.place_id,
        });
      }
      setPhotos(resolved);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Trail Guide moderation.');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authorized === true) void load();
    else if (authorized === false) setLoading(false);
  }, [authorized, status, submissionId]);

  const groupedCount = useMemo(() => new Set(photos.map((photo) => photo.submission_id)).size, [photos]);

  async function approve(photo: ModerationPhoto) {
    if (!session?.user.id || busyId) return;
    setBusyId(photo.id);
    setError('');
    const { error: updateError } = await supabase
      .from('trail_guide_photos')
      .update({
        moderation_status: 'approved',
        moderation_source: 'human',
        moderation_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user.id,
        feature_eligible: true,
      })
      .eq('id', photo.id);
    if (updateError) setError(updateError.message);
    setBusyId(null);
    if (!updateError) await load();
  }

  async function reject(photo: ModerationPhoto) {
    if (!session?.user.id || busyId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Choose or enter a rejection reason.');
      return;
    }
    setBusyId(photo.id);
    setError('');
    const { error: updateError } = await supabase
      .from('trail_guide_photos')
      .update({
        moderation_status: 'rejected',
        moderation_source: 'human',
        moderation_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user.id,
        feature_eligible: false,
      })
      .eq('id', photo.id);
    if (updateError) setError(updateError.message);
    setBusyId(null);
    if (!updateError) {
      setRejectingId(null);
      setRejectReason('');
      await load();
    }
  }

  if (authorized === null || loading && authorized !== false) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.loading}>Loading Trail Guide moderation…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.denied}>Admin access required.</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go Back</Text></Pressable></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.eyebrow}>TRAIL GUIDE</Text></View>
        <Text style={styles.title}>Photo Moderation</Text>
        <Text style={styles.subtitle}>{submissionId ? 'Showing the submission opened from your moderator notification.' : 'Review camper photos before they become public or enter destination galleries.'}</Text>

        <View style={styles.tabs}>
          {(['pending', 'approved', 'rejected'] as const).map((item) => <Pressable key={item} onPress={() => setStatus(item)} style={[styles.tab, status === item && styles.tabActive]}><Text style={[styles.tabText, status === item && styles.tabTextActive]}>{item === 'pending' ? 'Pending' : item === 'approved' ? 'Approved' : 'Rejected'}</Text></Pressable>)}
        </View>

        <View style={styles.queueHeader}><Text style={styles.queueCount}>{photos.length} Photos</Text><Text style={styles.queueSubmissions}>{groupedCount} {groupedCount === 1 ? 'Submission' : 'Submissions'}</Text></View>
        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

        {photos.length ? photos.map((photo) => (
          <View key={photo.id} style={styles.card}>
            <Image source={{ uri: photo.signedUrl }} style={styles.photo} resizeMode="cover" />
            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}><View style={styles.cardTitleCopy}><Text style={styles.placeName}>{photo.placeName}</Text><Text style={styles.member}>Submitted by {photo.memberName}</Text></View><View style={styles.statusBadge}><Text style={styles.statusText}>{photo.moderation_status.toUpperCase()}</Text></View></View>
              <View style={styles.metaGrid}>
                <Text style={styles.meta}>Category: {photo.category.replace('_', ' ')}</Text>
                <Text style={styles.meta}>{photo.campsite_label ? `Campsite: ${photo.campsite_label}` : 'Campsite not provided'}</Text>
                <Text style={styles.meta}>{formatDate(photo.visit_date)}</Text>
                <Text style={styles.meta}>Submitted {new Date(photo.created_at).toLocaleString('en-US')}</Text>
              </View>
              {photo.caption ? <Text style={styles.caption}>{photo.caption}</Text> : null}
              {photo.moderation_score != null || photo.moderation_model ? <Text style={styles.automation}>Automated review: {photo.moderation_model ?? photo.moderation_source ?? 'available'}{photo.moderation_score != null ? ` · ${Number(photo.moderation_score).toFixed(2)}` : ''}</Text> : null}
              {photo.moderation_reason ? <View style={styles.reasonBox}><Text style={styles.reasonLabel}>Moderation Reason</Text><Text style={styles.reasonText}>{photo.moderation_reason}</Text></View> : null}

              {status === 'pending' ? (
                <>
                  <View style={styles.actions}>
                    <Pressable disabled={busyId === photo.id} onPress={() => void approve(photo)} style={({ pressed }) => [styles.approve, pressed && styles.pressed]}><AppIcon name="check" color="#102114" size={16} /><Text style={styles.approveText}>{busyId === photo.id ? 'Working…' : 'Approve'}</Text></Pressable>
                    <Pressable disabled={busyId === photo.id} onPress={() => { setRejectingId(photo.id); setRejectReason(''); }} style={({ pressed }) => [styles.reject, pressed && styles.pressed]}><AppIcon name="close" color="#EAC0B8" size={16} /><Text style={styles.rejectText}>Reject</Text></Pressable>
                  </View>
                  {rejectingId === photo.id ? <View style={styles.rejectPanel}><Text style={styles.rejectTitle}>Why are you rejecting this photo?</Text><View style={styles.reasonChips}>{REJECTION_REASONS.map((reason) => <Pressable key={reason} onPress={() => setRejectReason(reason)} style={[styles.reasonChip, rejectReason === reason && styles.reasonChipActive]}><Text style={[styles.reasonChipText, rejectReason === reason && styles.reasonChipTextActive]}>{reason}</Text></Pressable>)}</View><TextInput value={rejectReason} onChangeText={setRejectReason} placeholder="Other reason" placeholderTextColor="#728078" style={styles.reasonInput} maxLength={500} /><View style={styles.rejectActions}><Pressable onPress={() => { setRejectingId(null); setRejectReason(''); }}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!rejectReason.trim() || busyId === photo.id} onPress={() => void reject(photo)} style={[styles.confirmReject, !rejectReason.trim() && styles.disabled]}><Text style={styles.confirmRejectText}>Reject Photo</Text></Pressable></View></View> : null}
                </>
              ) : null}
            </View>
          </View>
        )) : <View style={styles.empty}><AppIcon name="check" color="#7B8B81" size={24} /><Text style={styles.emptyTitle}>Nothing in this queue</Text><Text style={styles.emptyBody}>{submissionId ? 'This submission may already have been handled.' : `There are no ${status} Trail Guide photos to show.`}</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 18, paddingBottom: 50 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }, loading: { color: '#98A39C', fontSize: 12 }, denied: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, link: { color: '#D7B45A', fontWeight: '900' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: '#D7B45A', fontSize: 14, fontWeight: '900' }, eyebrow: { color: '#718078', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 30, fontWeight: '900', marginTop: 16 }, subtitle: { color: '#939F97', fontSize: 12, lineHeight: 18, marginTop: 5 },
  tabs: { flexDirection: 'row', gap: 7, marginTop: 16 }, tab: { flex: 1, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#344139', alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, tabText: { color: '#BCC6C0', fontSize: 10, fontWeight: '900' }, tabTextActive: { color: '#17211C' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }, queueCount: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, queueSubmissions: { color: '#829087', fontSize: 10 }, errorBox: { borderRadius: 12, borderWidth: 1, borderColor: '#75483F', backgroundColor: '#281B17', padding: 10, marginBottom: 10 }, error: { color: '#E6B5AA', fontSize: 11 },
  card: { borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#2B3931', backgroundColor: '#111A15', marginBottom: 12 }, photo: { width: '100%', height: 230, backgroundColor: '#172019' }, cardBody: { padding: 13 }, cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, cardTitleCopy: { flex: 1 }, placeName: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, member: { color: '#D7B45A', fontSize: 10, fontWeight: '800', marginTop: 3 }, statusBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#5D512D', backgroundColor: '#252318', paddingHorizontal: 8, paddingVertical: 4 }, statusText: { color: '#E4C768', fontSize: 7, fontWeight: '900' }, metaGrid: { marginTop: 10, gap: 3 }, meta: { color: '#8F9A93', fontSize: 9, textTransform: 'capitalize' }, caption: { color: '#C9D1CC', fontSize: 11, lineHeight: 16, marginTop: 10 }, automation: { color: '#68766E', fontSize: 8.5, marginTop: 8 }, reasonBox: { marginTop: 10, borderRadius: 10, backgroundColor: '#201A17', padding: 9 }, reasonLabel: { color: '#D8A89F', fontSize: 8, fontWeight: '900' }, reasonText: { color: '#DCC8C3', fontSize: 10, lineHeight: 14, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 13 }, approve: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#8BCB7D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, approveText: { color: '#102114', fontSize: 11, fontWeight: '900' }, reject: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#754A42', backgroundColor: '#211816', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, rejectText: { color: '#EAC0B8', fontSize: 11, fontWeight: '900' },
  rejectPanel: { marginTop: 10, borderRadius: 13, borderWidth: 1, borderColor: '#59413B', backgroundColor: '#171210', padding: 11 }, rejectTitle: { color: '#FFF0EC', fontSize: 11, fontWeight: '900' }, reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }, reasonChip: { borderRadius: 999, borderWidth: 1, borderColor: '#493833', paddingHorizontal: 8, paddingVertical: 5 }, reasonChipActive: { backgroundColor: '#6B423A', borderColor: '#8A584E' }, reasonChipText: { color: '#C9AAA3', fontSize: 8, fontWeight: '800' }, reasonChipTextActive: { color: '#FFF2EF' }, reasonInput: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#4D3A35', backgroundColor: '#211916', color: '#FFF8F5', paddingHorizontal: 10, marginTop: 9 }, rejectActions: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }, cancelText: { color: '#9BA69F', fontSize: 10, fontWeight: '800' }, confirmReject: { minHeight: 36, borderRadius: 10, backgroundColor: '#9A5D51', justifyContent: 'center', paddingHorizontal: 12 }, confirmRejectText: { color: '#FFF6F3', fontSize: 10, fontWeight: '900' }, disabled: { opacity: 0.45 },
  empty: { marginTop: 20, borderRadius: 16, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#101814', alignItems: 'center', padding: 24 }, emptyTitle: { color: '#E7EDE9', fontSize: 13, fontWeight: '900', marginTop: 8 }, emptyBody: { color: '#839087', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 }, pressed: { opacity: 0.78 },
});
