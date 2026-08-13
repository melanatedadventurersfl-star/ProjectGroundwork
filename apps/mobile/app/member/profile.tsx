import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, saveProfilePrivacy } from '../../src/member/api';
import { getJourney } from '../../src/passport/api';

const ladder = [
  { name: 'Explorer', min: 0 },
  { name: 'Pathfinder', min: 1 },
  { name: 'Trailblazer', min: 3 },
  { name: 'Wayfinder', min: 6 },
  { name: 'Summiteer', min: 10 },
  { name: 'Legacy Adventurer', min: 20 },
] as const;

function memberLevel(completed: number) {
  return [...ladder].reverse().find((level) => completed >= level.min) ?? ladder[0];
}

export default function MemberProfileScreen() {
  const [data, setData] = useState<any>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [basecamp, journey] = await Promise.all([getMemberBasecamp(), getJourney()]);
      setData(basecamp);
      setCompletedCount(journey.length);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const level = useMemo(() => memberLevel(completedCount), [completedCount]);
  const nextLevel = useMemo(() => ladder.find((item) => item.min > completedCount), [completedCount]);

  async function toggle(key: string, value: boolean) {
    setSavingKey(key);
    setData((current: any) => ({ ...current, profile: { ...current.profile, [key]: value } }));
    try {
      await saveProfilePrivacy({ [key]: value });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update privacy setting.');
      await load();
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  const profile = data?.profile ?? {};
  const cityLine = [profile.home_city, profile.home_state].filter(Boolean).join(', ');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <View style={styles.identityRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{String(profile.display_name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{profile.display_name ?? 'Your profile'}</Text>
            {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : <Text style={styles.usernameMuted}>Username not set</Text>}
            {cityLine ? <Text style={styles.location}>{cityLine}</Text> : null}
          </View>
        </View>

        <View style={styles.levelCard}>
          <Text style={styles.eyebrow}>MEMBER STATUS</Text>
          <Text style={styles.levelName}>{level.name}</Text>
          <Text style={styles.levelDetail}>{completedCount} completed official adventure{completedCount === 1 ? '' : 's'}</Text>
          {nextLevel ? <Text style={styles.nextLevel}>{nextLevel.min - completedCount} more to reach {nextLevel.name}</Text> : <Text style={styles.nextLevel}>Top of the trail.</Text>}
          {profile.platform_role && profile.platform_role !== 'member' ? <Text style={styles.role}>Role: {String(profile.platform_role).replace('_', ' ')}</Text> : null}
          {profile.event_host_level && profile.event_host_level !== 'member' ? <Text style={styles.role}>Host access: {String(profile.event_host_level).replace('_', ' ')}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.body}>{profile.bio || 'Add a short bio to tell the community what kind of outside you love.'}</Text>
          {Array.isArray(profile.interests) && profile.interests.length ? (
            <View style={styles.chips}>{profile.interests.map((interest: string) => <Text key={interest} style={styles.chip}>{interest}</Text>)}</View>
          ) : null}
          <Text style={styles.joined}>Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'recently'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile privacy</Text>
          <Text style={styles.body}>City is visible by default. Exact address, phone, email, payment details, and dependent information are never public profile fields.</Text>
          {[
            ['profile_is_private', 'Private account', 'Limit your full profile to approved connections.'],
            ['city_visible', 'Show city & state', 'Let community members see your general location.'],
            ['badges_visible', 'Show badges', 'Display milestone badges on your community profile.'],
            ['adventures_visible', 'Show completed adventures', 'Let people see your public adventure history.'],
            ['interests_visible', 'Show interests', 'Use your selected interests on your profile.'],
            ['trail_family_visible', 'Show Trail Family connection', 'Show that you are part of a Trail Family, without exposing private dependent details.'],
          ].map(([key, label, detail]) => (
            <View key={key} style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingDetail}>{detail}</Text>
              </View>
              <Switch
                value={Boolean(profile[key])}
                onValueChange={(value) => void toggle(key, value)}
                disabled={savingKey === key}
                trackColor={{ false: '#435148', true: '#8C763F' }}
                thumbColor={Boolean(profile[key]) ? '#F0D083' : '#D9DED9'}
              />
            </View>
          ))}
        </View>

        <View style={styles.linksCard}>
          <Pressable style={styles.linkRow} onPress={() => router.push('/member/trips')}><Text style={styles.linkTitle}>Trips & Payments</Text><Text style={styles.linkArrow}>›</Text></Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/member/trail-family')}><Text style={styles.linkTitle}>Trail Family</Text><Text style={styles.linkArrow}>›</Text></Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}><Text style={styles.linkTitle}>Notification Center</Text><Text style={styles.linkArrow}>›</Text></Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 50, gap: 14 }, back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 6 }, avatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#17211C', fontSize: 31, fontWeight: '900' }, identityText: { flex: 1 }, name: { color: '#FFF8E8', fontSize: 29, fontWeight: '900' }, username: { color: '#D7B45A', fontWeight: '800', marginTop: 2 }, usernameMuted: { color: '#7E8A82', marginTop: 2 }, location: { color: '#B5BEB8', marginTop: 5 },
  levelCard: { backgroundColor: '#25372D', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#3B5245' }, eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, levelName: { color: '#FFF8E8', fontSize: 27, fontWeight: '900', marginTop: 7 }, levelDetail: { color: '#C7D0CA', marginTop: 4 }, nextLevel: { color: '#F0D083', marginTop: 10, fontWeight: '800' }, role: { color: '#B8C5BD', marginTop: 5, textTransform: 'capitalize' },
  card: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 17, gap: 9 }, cardTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, body: { color: '#AEB8B2', lineHeight: 21 }, joined: { color: '#829087', fontSize: 12, marginTop: 4 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { color: '#F0D083', backgroundColor: '#26372D', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '700' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#243129' }, settingText: { flex: 1 }, settingLabel: { color: '#FFF8E8', fontWeight: '800', fontSize: 15 }, settingDetail: { color: '#89968E', fontSize: 12, lineHeight: 17, marginTop: 3 },
  linksCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', overflow: 'hidden' }, linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 17, borderBottomWidth: 1, borderBottomColor: '#26332C' }, linkTitle: { color: '#FFF8E8', fontWeight: '800', fontSize: 16 }, linkArrow: { color: '#D7B45A', fontSize: 26 }, error: { color: '#FFB4A9' },
});
