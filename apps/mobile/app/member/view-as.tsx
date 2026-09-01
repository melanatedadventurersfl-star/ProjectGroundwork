import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { AppIcon } from '../../src/ui/AppIcon';

type SearchRow = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
};

type Preview = {
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    cover_url: string | null;
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
      experienced_at: string | null;
    }>;
  };
  recognition: {
    badge_count: number;
    stamp_count: number;
    badges: Array<{ title: string; category: string | null; earned_at: string | null }>;
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
      category: string | null;
    }>;
  };
};

function locationLabel(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(', ') || 'Location not set';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ViewAsMemberScreen() {
  const { session } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.user.id) {
      setAuthorized(false);
      return;
    }
    let active = true;
    void supabase.rpc('can_view_as_member').then(({ data, error: gateError }) => {
      if (!active) return;
      if (gateError) {
        setError(gateError.message);
        setAuthorized(false);
        return;
      }
      setAuthorized(data === true);
      if (data === true) void searchMembers('');
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  async function searchMembers(nextQuery = query) {
    setSearching(true);
    setError('');
    const { data, error: searchError } = await supabase.rpc('owner_search_view_as_members', {
      p_query: nextQuery.trim(),
      p_limit: 40,
    });
    if (searchError) setError(searchError.message);
    setResults((data ?? []) as SearchRow[]);
    setSearching(false);
  }

  async function openPreview(profileId: string) {
    setLoadingPreview(true);
    setError('');
    const { data, error: previewError } = await supabase.rpc('owner_get_member_preview', { p_profile_id: profileId });
    if (previewError) {
      setError(previewError.message);
      setPreview(null);
    } else {
      setPreview(data as Preview);
      setResults([]);
    }
    setLoadingPreview(false);
  }

  const displayName = useMemo(() => {
    if (!preview) return '';
    return preview.profile.display_name || preview.profile.username || 'Member';
  }, [preview]);

  if (authorized === null) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Checking owner access…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.denied}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.title}>Owner access required</Text>
      <Text style={styles.muted}>View As Member is restricted to the two owner-authorized accounts.</Text>
    </View></SafeAreaView>;
  }

  if (preview) {
    const place = locationLabel(preview.profile.home_city, preview.profile.home_state);
    return <SafeAreaView style={styles.safe}>
      <View style={styles.viewBanner}>
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>👁 Viewing as {displayName}</Text>
          <Text style={styles.bannerMeta}>{place} · Read only</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setPreview(null); setQuery(''); void searchMembers(''); }} style={styles.exitButton}>
          <Text style={styles.exitText}>Exit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trailheadHero}>
          <Text style={styles.heroEyebrow}>TRAILHEAD PREVIEW</Text>
          <Text style={styles.heroName}>{displayName}</Text>
          <View style={styles.locationLine}><AppIcon name="weather" color="#D7B45A" size={16} /><Text style={styles.locationText}>{place}</Text></View>
          <Text style={styles.heroNote}>This preview uses the member’s saved Trailhead location. It does not expose live GPS or exact coordinates.</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat value={preview.trail.adventure_count} label="Adventures" />
          <Stat value={preview.trail.unique_places} label="Places" />
          <Stat value={preview.recognition.badge_count} label="Badges" />
          <Stat value={preview.recognition.stamp_count} label="Stamps" />
        </View>

        <Text style={styles.sectionTitle}>WHAT THEIR TRAILHEAD KNOWS</Text>
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
          {preview.trail.recent.length ? preview.trail.recent.map((item, index) => <View key={item.adventure_id} style={[styles.activityRow, index > 0 && styles.divider]}>
            <Text style={styles.activityTitle}>{item.title}</Text>
            <Text style={styles.activityMeta}>{locationLabel(item.city, item.state)} · {shortDate(item.starts_at)}</Text>
          </View>) : <Text style={styles.empty}>Their first adventure will become chapter one.</Text>}
        </View>

        <Text style={styles.sectionTitle}>RECENT RECOGNITION</Text>
        <View style={styles.cardPad}>
          {preview.recognition.badges.length ? preview.recognition.badges.map((badge, index) => <View key={`${badge.title}-${badge.earned_at ?? index}`} style={[styles.activityRow, index > 0 && styles.divider]}>
            <Text style={styles.activityTitle}>{badge.title}</Text>
            <Text style={styles.activityMeta}>{badge.category || 'Recognition'}</Text>
          </View>) : <Text style={styles.empty}>No badges yet.</Text>}
        </View>

        <Text style={styles.sectionTitle}>LOCAL TRAILHEAD CONTEXT</Text>
        <View style={styles.cardPad}>
          {preview.local_context.upcoming.length ? preview.local_context.upcoming.map((item, index) => <View key={item.id} style={[styles.activityRow, index > 0 && styles.divider]}>
            <Text style={styles.activityTitle}>{item.title}</Text>
            <Text style={styles.activityMeta}>{locationLabel(item.city, item.state)} · {shortDate(item.starts_at)}</Text>
          </View>) : <Text style={styles.empty}>No upcoming adventures matched to this saved area.</Text>}
        </View>

        <View style={styles.readOnlyCard}>
          <AppIcon name="privacy" color="#D7B45A" size={20} />
          <View style={styles.readOnlyCopy}>
            <Text style={styles.readOnlyTitle}>Read-only owner preview</Text>
            <Text style={styles.readOnlyText}>Posting, comments, RSVPs, purchases, profile edits, privacy changes, messages, waivers, deletions and admin actions are unavailable here.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Profile</Text></Pressable>
      <Text style={styles.eyebrow}>OWNER ONLY</Text>
      <Text style={styles.title}>View As Member</Text>
      <Text style={styles.muted}>See the general member experience from their Trailhead context without signing into their account.</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void searchMembers()}
          placeholder="Search name or username"
          placeholderTextColor="#6F7D75"
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.input}
        />
        <Pressable style={styles.searchButton} onPress={() => void searchMembers()}><Text style={styles.searchButtonText}>Search</Text></Pressable>
      </View>

      {searching ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loadingPreview ? <View style={styles.loadingCard}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Building read-only preview…</Text></View> : null}

      {!loadingPreview && results.length ? <View style={styles.resultsCard}>
        {results.map((member, index) => <Pressable key={member.profile_id} style={[styles.resultRow, index > 0 && styles.divider]} onPress={() => void openPreview(member.profile_id)}>
          <View style={styles.resultCopy}>
            <Text style={styles.resultName}>{member.display_name || member.username || 'Member'}</Text>
            <Text style={styles.resultMeta}>{member.username ? `@${member.username} · ` : ''}{locationLabel(member.home_city, member.home_state)}</Text>
          </View>
          <View style={styles.readPill}><Text style={styles.readPillText}>VIEW</Text></View>
        </Pressable>)}
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 60 },
  previewContent: { padding: 18, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  denied: { flex: 1, padding: 20, gap: 12 },
  back: { color: '#D7B45A', fontSize: 15, fontWeight: '900', marginBottom: 14 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 37, fontWeight: '900', marginTop: 4 },
  muted: { color: '#9DA9A2', fontSize: 13, lineHeight: 19, marginTop: 5 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  input: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#34463C', backgroundColor: '#17211C', color: '#FFF8E8', paddingHorizontal: 14, fontSize: 14 },
  searchButton: { minWidth: 82, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  searchButtonText: { color: '#152019', fontSize: 13, fontWeight: '900' },
  loader: { marginVertical: 18 },
  error: { color: '#FF9D94', fontSize: 12, lineHeight: 18, marginTop: 10 },
  loadingCard: { marginTop: 18, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#34463C', backgroundColor: '#17211C', alignItems: 'center', gap: 9 },
  resultsCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#2E4036', backgroundColor: '#17211C', overflow: 'hidden' },
  resultRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  resultMeta: { color: '#8F9C94', fontSize: 11, marginTop: 3 },
  readPill: { borderRadius: 999, borderWidth: 1, borderColor: '#705920', backgroundColor: '#352B15', paddingHorizontal: 9, paddingVertical: 5 },
  readPillText: { color: '#E7C464', fontSize: 9, fontWeight: '900' },
  divider: { borderTopWidth: 1, borderTopColor: '#29372F' },
  viewBanner: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: '#806525', backgroundColor: '#3A2C12', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerTitle: { color: '#FFF3D1', fontSize: 14, fontWeight: '900' },
  bannerMeta: { color: '#D8C78F', fontSize: 10.5, marginTop: 2 },
  exitButton: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  exitText: { color: '#F5C341', fontSize: 12, fontWeight: '900' },
  trailheadHero: { borderRadius: 20, borderWidth: 1, borderColor: '#45614F', backgroundColor: '#15251D', padding: 18 },
  heroEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  heroName: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  locationText: { color: '#E5D39D', fontSize: 13, fontWeight: '800' },
  heroNote: { color: '#93A198', fontSize: 10.5, lineHeight: 15, marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  stat: { flex: 1, minHeight: 62, borderRadius: 13, borderWidth: 1, borderColor: '#304139', backgroundColor: '#171F1B', alignItems: 'center', justifyContent: 'center', padding: 5 },
  statValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#8F9C94', fontSize: 9, fontWeight: '800', marginTop: 2 },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 22, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#2E4036', backgroundColor: '#171D19', overflow: 'hidden' },
  cardPad: { borderRadius: 16, borderWidth: 1, borderColor: '#2E4036', backgroundColor: '#171D19', paddingHorizontal: 14 },
  detailRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#28372F' },
  detailLabel: { color: '#8E9B93', fontSize: 11, fontWeight: '700' },
  detailValue: { color: '#FFF8E8', fontSize: 12, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#4D5F54', backgroundColor: '#1B2821', paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: '#E0E7E2', fontSize: 10.5, fontWeight: '800' },
  activityRow: { paddingVertical: 12 },
  activityTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  activityMeta: { color: '#8E9B93', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  empty: { color: '#86948B', fontSize: 12, lineHeight: 18, paddingVertical: 14 },
  readOnlyCard: { marginTop: 22, borderRadius: 16, borderWidth: 1, borderColor: '#675424', backgroundColor: '#231D11', padding: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  readOnlyCopy: { flex: 1 },
  readOnlyTitle: { color: '#F4D77B', fontSize: 12.5, fontWeight: '900' },
  readOnlyText: { color: '#B8AA82', fontSize: 10.5, lineHeight: 16, marginTop: 3 },
});
