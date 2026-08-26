import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

type MemberSearchRow = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url?: string | null;
  platform_role?: string | null;
};

type Insights = {
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    email: string | null;
    phone_number: string | null;
    status: string | null;
    platform_role: string | null;
    created_at: string | null;
    updated_at: string | null;
    onboarding_completed_at: string | null;
    onboarding_step: number | null;
  };
  auth: {
    last_sign_in_at: string | null;
    auth_created_at: string | null;
    email_confirmed_at: string | null;
    phone_confirmed_at: string | null;
    providers: string[];
  };
  preferences: {
    home_city: string | null;
    home_state: string | null;
    discovery_radius_miles: number | null;
    experience_level: string | null;
    interests: string[];
    communication_preferences: Record<string, unknown>;
    pronouns: string | null;
    age_range: string | null;
    occupation: string | null;
    accessibility_needs: string | null;
    dietary_needs: string | null;
    profile_is_private: boolean | null;
    is_searchable: boolean | null;
  };
  community: {
    posts_count: number;
    last_post_at: string | null;
    comments_count: number;
    last_comment_at: string | null;
    reactions_count: number;
    last_reaction_at: string | null;
    group_count: number;
    connections_count: number;
    groups: { id: string; name: string; kind: string | null; city: string | null; state: string | null; joined_at: string | null }[];
  };
  adventures: {
    saved_count: number;
    last_saved_at: string | null;
    rsvp_count: number;
    last_rsvp_at: string | null;
    paid_order_count: number;
    last_paid_at: string | null;
    recent_adventures: { id: string; title: string; starts_at: string; city: string | null; state: string | null; rsvp_status: string | null }[];
  };
  recognition: {
    badge_count: number;
    stamp_count: number;
    badges: { title: string; category: string | null; earned_at: string | null }[];
    stamps: { title: string; category: string | null; earned_at: string | null }[];
  };
  support: { request_count: number; open_request_count: number; last_request_at: string | null };
  last_activity_at: string | null;
};

function when(value: string | null | undefined) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value === null || value === undefined || value === '' ? 'Not set' : String(value)}</Text></View>;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Chips({ items, empty = 'None selected' }: { items: string[]; empty?: string }) {
  if (!items.length) return <Text style={styles.empty}>{empty}</Text>;
  return <View style={styles.chips}>{items.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View>;
}

export default function MemberInsightsScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MemberSearchRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(nextQuery = query) {
    setSearching(true);
    setError('');
    const { data, error: searchError } = await supabase.rpc('creator_search_passport_members', { p_query: nextQuery.trim(), p_limit: 20 });
    if (searchError) setError(searchError.message);
    setResults((data ?? []) as MemberSearchRow[]);
    setSearching(false);
  }

  async function openMember(profileId: string) {
    setSelectedId(profileId);
    setLoading(true);
    setError('');
    const { data, error: insightError } = await supabase.rpc('creator_get_member_insights', { p_profile_id: profileId });
    if (insightError) {
      setError(insightError.message);
      setInsights(null);
    } else {
      setInsights(data as Insights);
      setResults([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!session?.user.id) return;
    void search('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const communication = useMemo(() => {
    if (!insights) return [];
    return Object.entries(insights.preferences.communication_preferences ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => key.toUpperCase());
  }, [insights]);

  return <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Creator Console</Text></Pressable>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>MASTER ONLY</Text>
        <Text style={styles.title}>Member Insights</Text>
        <Text style={styles.subtitle}>Search a member to review account timing, selected interests, discovery area, community behavior, adventure activity, and recognition.</Text>
      </View>

      <View style={styles.searchCard}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="Name, username, or email"
          placeholderTextColor="#6F7D75"
          autoCapitalize="none"
          style={styles.input}
          returnKeyType="search"
        />
        <Pressable style={styles.searchButton} onPress={() => void search()}><Text style={styles.searchButtonText}>Search</Text></Pressable>
      </View>

      {searching ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {results.length ? <View style={styles.resultsCard}>{results.map((member, index) => <Pressable key={member.profile_id} style={[styles.resultRow, index > 0 && styles.divider]} onPress={() => void openMember(member.profile_id)}>
        <View style={styles.resultCopy}><Text style={styles.resultName}>{member.display_name || member.username || 'Member'}</Text><Text style={styles.resultMeta}>{member.username ? `@${member.username}` : member.email || 'No username'}{member.platform_role ? ` · ${member.platform_role}` : ''}</Text></View><Text style={styles.chevron}>›</Text>
      </Pressable>)}</View> : null}

      {loading ? <View style={styles.loadingCard}><ActivityIndicator color="#F5C341" /><Text style={styles.empty}>Loading member behavior…</Text></View> : null}

      {insights && selectedId ? <>
        <View style={styles.memberHero}>
          <View style={styles.memberTop}><View><Text style={styles.memberName}>{insights.profile.display_name || insights.profile.username || 'Member'}</Text><Text style={styles.memberMeta}>{insights.profile.username ? `@${insights.profile.username}` : ''}{insights.profile.platform_role ? ` · ${insights.profile.platform_role}` : ''}</Text></View><View style={styles.statusPill}><Text style={styles.statusText}>{(insights.profile.status || 'unknown').toUpperCase()}</Text></View></View>
          <View style={styles.heroStats}><Stat value={when(insights.auth.last_sign_in_at)} label="Last login" /><Stat value={when(insights.last_activity_at)} label="Last activity" /></View>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <Row label="Email" value={insights.profile.email} />
          <Row label="Phone" value={insights.profile.phone_number} />
          <Row label="Joined" value={when(insights.profile.created_at)} />
          <Row label="Last login" value={when(insights.auth.last_sign_in_at)} />
          <Row label="Auth providers" value={insights.auth.providers.join(', ') || 'Unknown'} />
          <Row label="Onboarding" value={insights.profile.onboarding_completed_at ? `Completed ${when(insights.profile.onboarding_completed_at)}` : `Step ${insights.profile.onboarding_step ?? 0}`} />
        </View>

        <Text style={styles.sectionTitle}>PREFERENCES & TAGS</Text>
        <View style={styles.cardPad}>
          <Text style={styles.cardLabel}>Selected interests</Text>
          <Chips items={insights.preferences.interests} />
          <View style={styles.spacer} />
          <Row label="Experience" value={insights.preferences.experience_level} />
          <Row label="Age range" value={insights.preferences.age_range} />
          <Row label="Occupation" value={insights.preferences.occupation} />
          <Row label="Communication" value={communication.join(', ') || 'None enabled'} />
          <Row label="Accessibility" value={insights.preferences.accessibility_needs} />
          <Row label="Dietary" value={insights.preferences.dietary_needs} />
        </View>

        <Text style={styles.sectionTitle}>LOCATION & DISCOVERY</Text>
        <View style={styles.card}>
          <Row label="Home area" value={[insights.preferences.home_city, insights.preferences.home_state].filter(Boolean).join(', ') || 'Not set'} />
          <Row label="Discovery radius" value={insights.preferences.discovery_radius_miles ? `${insights.preferences.discovery_radius_miles} miles` : 'Not set'} />
          <Row label="Searchable" value={insights.preferences.is_searchable ? 'Yes' : 'No'} />
          <Row label="Private profile" value={insights.preferences.profile_is_private ? 'Yes' : 'No'} />
        </View>

        <Text style={styles.sectionTitle}>COMMUNITY BEHAVIOR</Text>
        <View style={styles.metrics}><Stat value={insights.community.posts_count} label="Posts" /><Stat value={insights.community.comments_count} label="Comments" /><Stat value={insights.community.reactions_count} label="Reactions" /><Stat value={insights.community.group_count} label="Groups" /><Stat value={insights.community.connections_count} label="Connections" /></View>
        <View style={styles.cardPad}>
          <Row label="Last post" value={when(insights.community.last_post_at)} />
          <Row label="Last comment" value={when(insights.community.last_comment_at)} />
          <Row label="Last reaction" value={when(insights.community.last_reaction_at)} />
          <Text style={styles.cardLabel}>Groups joined</Text>
          <Chips items={insights.community.groups.map((group) => group.name)} empty="No groups joined" />
        </View>

        <Text style={styles.sectionTitle}>ADVENTURE BEHAVIOR</Text>
        <View style={styles.metrics}><Stat value={insights.adventures.saved_count} label="Saved" /><Stat value={insights.adventures.rsvp_count} label="RSVPs" /><Stat value={insights.adventures.paid_order_count} label="Paid orders" /></View>
        <View style={styles.cardPad}>
          <Row label="Last saved" value={when(insights.adventures.last_saved_at)} />
          <Row label="Last RSVP update" value={when(insights.adventures.last_rsvp_at)} />
          <Row label="Last payment" value={when(insights.adventures.last_paid_at)} />
          <Text style={styles.cardLabel}>Recent adventures</Text>
          {insights.adventures.recent_adventures.length ? insights.adventures.recent_adventures.map((adventure) => <View key={adventure.id} style={styles.activityRow}><Text style={styles.activityTitle}>{adventure.title}</Text><Text style={styles.activityMeta}>{when(adventure.starts_at)} · {[adventure.city, adventure.state].filter(Boolean).join(', ')} · {adventure.rsvp_status || 'RSVP'}</Text></View>) : <Text style={styles.empty}>No adventure activity yet.</Text>}
        </View>

        <Text style={styles.sectionTitle}>RECOGNITION & SUPPORT</Text>
        <View style={styles.metrics}><Stat value={insights.recognition.badge_count} label="Badges" /><Stat value={insights.recognition.stamp_count} label="Stamps" /><Stat value={insights.support.open_request_count} label="Open support" /></View>
        <View style={styles.card}>
          <Row label="Support requests" value={insights.support.request_count} />
          <Row label="Last support request" value={when(insights.support.last_request_at)} />
        </View>

        <Pressable style={styles.newSearch} onPress={() => { setInsights(null); setSelectedId(null); setQuery(''); void search(''); }}><Text style={styles.newSearchText}>View another member</Text></Pressable>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 64 },
  back: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  heading: { marginTop: 18, marginBottom: 18, gap: 6 },
  eyebrow: { color: '#F5C341', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: '#98A59D', fontSize: 13, lineHeight: 19 },
  searchCard: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#34463C', backgroundColor: '#17211C', color: '#FFF8E8', paddingHorizontal: 14, fontSize: 14 },
  searchButton: { minWidth: 82, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  searchButtonText: { color: '#152019', fontSize: 13, fontWeight: '900' },
  loader: { marginVertical: 18 },
  error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18, marginVertical: 8 },
  resultsCard: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#2E4036', overflow: 'hidden', marginBottom: 18 },
  resultRow: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: '#2A3A31' },
  resultCopy: { flex: 1 },
  resultName: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  resultMeta: { color: '#86938B', fontSize: 11, marginTop: 3 },
  chevron: { color: '#D7B45A', fontSize: 26, fontWeight: '700' },
  loadingCard: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  memberHero: { backgroundColor: '#17211C', borderRadius: 20, borderWidth: 1, borderColor: '#3A4C42', padding: 16, gap: 14, marginBottom: 22 },
  memberTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  memberName: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  memberMeta: { color: '#9AA69F', fontSize: 12, marginTop: 3 },
  statusPill: { borderRadius: 999, borderWidth: 1, borderColor: '#58705F', paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#B8C8BE', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  heroStats: { gap: 8 },
  sectionTitle: { color: '#89968E', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 7 },
  card: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#2D3E34', overflow: 'hidden' },
  cardPad: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#2D3E34', padding: 14 },
  cardLabel: { color: '#E9E0C9', fontSize: 11, fontWeight: '900', marginBottom: 8, marginTop: 4 },
  detailRow: { minHeight: 46, paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#304138', flexDirection: 'row', justifyContent: 'space-between', gap: 14, alignItems: 'center' },
  detailLabel: { color: '#839088', fontSize: 11, fontWeight: '800', flex: 1 },
  detailValue: { color: '#FFF8E8', fontSize: 12, fontWeight: '700', flex: 1.5, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#223229', borderWidth: 1, borderColor: '#405548' },
  chipText: { color: '#D9E1DC', fontSize: 10, fontWeight: '800' },
  spacer: { height: 8 },
  empty: { color: '#718078', fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  stat: { flexGrow: 1, minWidth: 96, minHeight: 68, borderRadius: 14, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2D3E34', padding: 11, justifyContent: 'center' },
  statValue: { color: '#F0D083', fontSize: 15, fontWeight: '900' },
  statLabel: { color: '#87948C', fontSize: 9.5, fontWeight: '800', marginTop: 4 },
  activityRow: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#304138' },
  activityTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  activityMeta: { color: '#829087', fontSize: 10, lineHeight: 15, marginTop: 3 },
  newSearch: { marginTop: 24, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#8A7135', alignItems: 'center', justifyContent: 'center' },
  newSearchText: { color: '#F0D083', fontSize: 13, fontWeight: '900' },
});
