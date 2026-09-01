import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../src/lib/supabase';
import { AppIcon } from '../../../src/ui/AppIcon';

type Preview = {
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    home_city: string | null;
    home_state: string | null;
    discovery_radius_miles: number | null;
    experience_level: string | null;
    interests: string[];
  };
  trail: {
    adventure_count: number;
    unique_places: number;
    recent: Array<{
      adventure_id: string;
      title: string;
      city: string | null;
      state: string | null;
      starts_at: string;
    }>;
  };
  recognition: {
    badge_count: number;
    stamp_count: number;
    badges: Array<{ title: string; category: string | null }>;
  };
  community: {
    group_count: number;
    connection_count: number;
  };
  local_context: {
    upcoming: Array<{
      id: string;
      title: string;
      city: string | null;
      state: string | null;
      starts_at: string;
    }>;
  };
};

function locationLabel(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(', ') || 'Location not set';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

export default function ViewAsProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Member profile is missing.');
      return;
    }
    let active = true;
    void supabase.rpc('owner_get_member_preview', { p_profile_id: id }).then(({ data, error: previewError }) => {
      if (!active) return;
      if (previewError) {
        setError(previewError.message);
        setPreview(null);
      } else {
        setPreview(data as Preview);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  const displayName = useMemo(() => preview?.profile.display_name || preview?.profile.username || 'Member', [preview]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening read-only preview…</Text></View></SafeAreaView>;
  if (!preview) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.error}>{error || 'Unable to open this member preview.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable></View></SafeAreaView>;

  const place = locationLabel(preview.profile.home_city, preview.profile.home_state);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.banner}>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>👁 Viewing as {displayName}</Text>
        <Text style={styles.bannerMeta}>{place} · Read only</Text>
      </View>
      <Pressable onPress={() => router.back()} style={styles.exitButton}><Text style={styles.exitText}>Exit</Text></Pressable>
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TRAILHEAD PREVIEW</Text>
        <Text style={styles.title}>{displayName}</Text>
        <View style={styles.locationLine}><AppIcon name="location" color="#D7B45A" size={16} /><Text style={styles.location}>{place}</Text></View>
        <Text style={styles.note}>This uses the member’s saved Trailhead location only. Live GPS and exact coordinates are not exposed.</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat value={preview.trail.adventure_count} label="Adventures" />
        <Stat value={preview.trail.unique_places} label="Places" />
        <Stat value={preview.recognition.badge_count} label="Badges" />
        <Stat value={preview.recognition.stamp_count} label="Stamps" />
      </View>

      <Text style={styles.sectionTitle}>TRAILHEAD CONTEXT</Text>
      <View style={styles.card}>
        <Detail label="Home area" value={place} />
        <Detail label="Discovery radius" value={preview.profile.discovery_radius_miles ? `${preview.profile.discovery_radius_miles} miles` : 'Not set'} />
        <Detail label="Experience" value={preview.profile.experience_level || 'Not set'} />
        <Detail label="Groups" value={String(preview.community.group_count)} />
        <Detail label="Trailmates" value={String(preview.community.connection_count)} />
      </View>

      {preview.profile.interests.length ? <>
        <Text style={styles.sectionTitle}>INTERESTS</Text>
        <View style={styles.chips}>{preview.profile.interests.map((interest) => <View key={interest} style={styles.chip}><Text style={styles.chipText}>{interest}</Text></View>)}</View>
      </> : null}

      <Text style={styles.sectionTitle}>YOUR TRAIL</Text>
      <View style={styles.cardPad}>
        {preview.trail.recent.length ? preview.trail.recent.map((item, index) => <View key={item.adventure_id} style={[styles.activityRow, index > 0 && styles.divider]}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{locationLabel(item.city, item.state)} · {shortDate(item.starts_at)}</Text></View>) : <Text style={styles.muted}>Their first adventure will become chapter one.</Text>}
      </View>

      <Text style={styles.sectionTitle}>RECENT RECOGNITION</Text>
      <View style={styles.cardPad}>
        {preview.recognition.badges.length ? preview.recognition.badges.map((badge, index) => <View key={`${badge.title}-${index}`} style={[styles.activityRow, index > 0 && styles.divider]}><Text style={styles.activityTitle}>{badge.title}</Text><Text style={styles.activityMeta}>{badge.category || 'Recognition'}</Text></View>) : <Text style={styles.muted}>No badges yet.</Text>}
      </View>

      <Text style={styles.sectionTitle}>LOCAL TRAILHEAD CONTEXT</Text>
      <View style={styles.cardPad}>
        {preview.local_context.upcoming.length ? preview.local_context.upcoming.map((item, index) => <View key={item.id} style={[styles.activityRow, index > 0 && styles.divider]}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{locationLabel(item.city, item.state)} · {shortDate(item.starts_at)}</Text></View>) : <Text style={styles.muted}>No upcoming adventures matched to this saved area.</Text>}
      </View>

      <View style={styles.readOnlyCard}>
        <AppIcon name="privacy" color="#D7B45A" size={20} />
        <View style={{ flex: 1 }}><Text style={styles.readOnlyTitle}>Read-only owner preview</Text><Text style={styles.readOnlyText}>Posting, comments, RSVPs, purchases, profile edits, privacy changes, messages, waivers, deletions and admin actions are unavailable here.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  banner: { minHeight: 70, backgroundColor: '#2A2110', borderBottomWidth: 1, borderBottomColor: '#806525', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bannerCopy: { flex: 1 },
  bannerTitle: { color: '#FFF3D1', fontSize: 16, fontWeight: '900' },
  bannerMeta: { color: '#C6B98E', fontSize: 11.5, marginTop: 2 },
  exitButton: { borderWidth: 1, borderColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  exitText: { color: '#F5C341', fontSize: 12, fontWeight: '900' },
  content: { padding: 18, paddingBottom: 72, gap: 14 },
  hero: { borderRadius: 18, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#11241A', padding: 17 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 29, fontWeight: '900', marginTop: 4 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  location: { color: '#D8DFDA', fontSize: 13, fontWeight: '700' },
  note: { color: '#98A59D', fontSize: 11.5, lineHeight: 17, marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 7 },
  stat: { flex: 1, minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: '#2E4036', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#F5C341', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#9DA8A2', fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  sectionTitle: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', letterSpacing: .9, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#2B332E', backgroundColor: '#171D19', overflow: 'hidden' },
  cardPad: { borderRadius: 16, borderWidth: 1, borderColor: '#2B332E', backgroundColor: '#171D19', paddingHorizontal: 14 },
  detailRow: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#27322C' },
  detailLabel: { color: '#8F9A93', fontSize: 11.5, fontWeight: '700' },
  detailValue: { color: '#F1F4F2', fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#4A5D51', backgroundColor: '#1B2B23', paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: '#DCE3DE', fontSize: 11, fontWeight: '800' },
  activityRow: { paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: '#2A352F' },
  activityTitle: { color: '#F2F4F3', fontSize: 13, fontWeight: '900' },
  activityMeta: { color: '#95A199', fontSize: 11, marginTop: 3 },
  readOnlyCard: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#705920', backgroundColor: '#251F12', padding: 14 },
  readOnlyTitle: { color: '#FFF0C1', fontSize: 13, fontWeight: '900' },
  readOnlyText: { color: '#BFAF80', fontSize: 11, lineHeight: 16, marginTop: 3 },
  muted: { color: '#98A59D', fontSize: 12, lineHeight: 18 },
  error: { color: '#F0A39A', textAlign: 'center' },
  back: { color: '#D7B45A', fontWeight: '900' },
});
