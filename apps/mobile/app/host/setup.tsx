import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ensureHostCenterProfile, getHostSetupProgress, markHostSetupReviewed, restartHostIntroduction, saveHostCenterProfile, type HostCenterProfile, type HostSetupKey } from '../../src/hosting/hostEntry';

const CHECKLIST: { key: HostSetupKey; title: string; text: string }[] = [
  { key: 'profile', title: 'Host profile', text: 'Host identity, contact information and public profile.' },
  { key: 'organization', title: 'Organization details', text: 'Business or organization information used in Host Center.' },
  { key: 'working_preferences', title: 'Working preferences', text: 'The areas you normally handle when planning events.' },
  { key: 'ai_privacy', title: 'AI & Privacy', text: 'Memory, personalization, saved conversations and optional analytics.' },
  { key: 'notifications', title: 'Host notifications', text: 'Review operational alerts for tasks, vendors, registrations and event changes.' },
  { key: 'connections', title: 'Connected services', text: 'Review Eventbrite, social, email and calendar connection status.' },
  { key: 'event_defaults', title: 'Event defaults', text: 'Set common location, visibility, waiver and reminder defaults.' },
  { key: 'team', title: 'Team setup', text: 'Review whether you need additional people or event roles.' },
];

function reviewed(profile: HostCenterProfile, key: HostSetupKey) {
  const values: Record<HostSetupKey, string | null> = {
    profile: profile.profileReviewedAt,
    organization: profile.organizationReviewedAt,
    working_preferences: profile.workingPreferencesReviewedAt,
    ai_privacy: profile.aiPrivacyReviewedAt,
    notifications: profile.notificationsReviewedAt,
    connections: profile.connectionsReviewedAt,
    event_defaults: profile.eventDefaultsReviewedAt,
    team: profile.teamReviewedAt,
  };
  return Boolean(values[key]);
}

export default function HostSetupScreen() {
  const [profile, setProfile] = useState<HostCenterProfile | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try { setProfile(await ensureHostCenterProfile()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load Host Setup.'); }
  }

  useEffect(() => { void load(); }, []);
  const progress = useMemo(() => getHostSetupProgress(profile), [profile]);

  async function mark(key: HostSetupKey) {
    setWorking(true); setError('');
    try { await markHostSetupReviewed(key); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update setup.'); }
    finally { setWorking(false); }
  }

  async function saveDefaults() {
    if (!profile) return;
    setWorking(true); setError('');
    try {
      await saveHostCenterProfile({
        defaultCity: profile.defaultCity,
        defaultState: profile.defaultState,
        defaultVisibility: profile.defaultVisibility,
        defaultWaiverPreference: profile.defaultWaiverPreference,
        defaultCancellationNote: profile.defaultCancellationNote,
      });
      await markHostSetupReviewed('event_defaults');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save event defaults.'); }
    finally { setWorking(false); }
  }

  async function replay() {
    setWorking(true);
    try { await restartHostIntroduction(); router.replace('/host/intro' as never); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to restart the introduction.'); setWorking(false); }
  }

  if (!profile && !error) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading Host Setup…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.replace('/host/more' as never)}><Text style={styles.back}>‹ More</Text></Pressable>
    <Text style={styles.eyebrow}>HOST SETUP</Text><Text style={styles.title}>Finish setting up your workspace</Text>
    <Text style={styles.subtitle}>Setup does not block Host Center. Finish the pieces that make your day-to-day work easier.</Text>

    <View style={styles.progressCard}><View style={styles.progressTop}><Text style={styles.progressValue}>{progress.completed} of {progress.total} complete</Text><Text style={styles.progressPercent}>{progress.percent}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${progress.percent}%` }]} /></View></View>

    {profile ? <>
      <Text style={styles.sectionTitle}>Checklist</Text>
      <View style={styles.list}>{CHECKLIST.map((item, index) => {
        const done = reviewed(profile, item.key);
        const specialRoute = item.key === 'ai_privacy' ? '/host/ai-privacy' : null;
        return <View key={item.key} style={[styles.row, index > 0 && styles.divider]}><View style={[styles.check, done && styles.checkDone]}><Text style={styles.checkText}>{done ? '✓' : ''}</Text></View><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowText}>{item.text}</Text></View>{specialRoute ? <Pressable onPress={() => router.push(specialRoute as never)}><Text style={styles.open}>Open</Text></Pressable> : <Pressable disabled={working || done} onPress={() => void mark(item.key)}><Text style={[styles.review, done && styles.done]}>{done ? 'Done' : 'Mark reviewed'}</Text></Pressable>}</View>;
      })}</View>

      <Text style={styles.sectionTitle}>Event defaults</Text>
      <View style={styles.panel}>
        <View style={styles.twoCol}><View style={styles.flex}><Field label="Default city" value={profile.defaultCity} onChangeText={(defaultCity) => setProfile({ ...profile, defaultCity })} placeholder="Jacksonville" /></View><View style={styles.state}><Field label="State" value={profile.defaultState} onChangeText={(defaultState) => setProfile({ ...profile, defaultState })} placeholder="FL" /></View></View>
        <Text style={styles.label}>Default visibility</Text><View style={styles.segment}><Pressable style={[styles.segmentButton, profile.defaultVisibility === 'public' && styles.segmentActive]} onPress={() => setProfile({ ...profile, defaultVisibility: 'public' })}><Text style={styles.segmentText}>Public</Text></Pressable><Pressable style={[styles.segmentButton, profile.defaultVisibility === 'private' && styles.segmentActive]} onPress={() => setProfile({ ...profile, defaultVisibility: 'private' })}><Text style={styles.segmentText}>Private</Text></Pressable></View>
        <Text style={styles.label}>Waiver preference</Text><View style={styles.waivers}>{(['ask','required','not_required'] as const).map((value) => <Pressable key={value} onPress={() => setProfile({ ...profile, defaultWaiverPreference: value })} style={[styles.waiver, profile.defaultWaiverPreference === value && styles.waiverActive]}><Text style={styles.waiverText}>{value === 'ask' ? 'Ask each event' : value === 'required' ? 'Usually required' : 'Usually not required'}</Text></Pressable>)}</View>
        <Field label="Default cancellation / refund note" value={profile.defaultCancellationNote} onChangeText={(defaultCancellationNote) => setProfile({ ...profile, defaultCancellationNote })} placeholder="Optional default note" multiline />
        <Pressable disabled={working} style={styles.primary} onPress={() => void saveDefaults()}><Text style={styles.primaryText}>Save Event Defaults</Text></Pressable>
      </View>

      <Text style={styles.sectionTitle}>Host introduction</Text>
      <Pressable disabled={working} style={styles.secondary} onPress={() => void replay()}><Text style={styles.secondaryText}>Replay Host Center Introduction</Text></Pressable>
    </> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function Field({ label, multiline = false, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#657169" style={[styles.input, multiline && styles.multiline]} textAlignVertical={multiline ? 'top' : 'center'} /></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', gap: 8 }, muted: { color: '#7E8A82', fontSize: 10 }, content: { padding: 18, paddingBottom: 86, maxWidth: 760, width: '100%', alignSelf: 'center' }, back: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginBottom: 14 }, eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#8D9A91', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, progressCard: { borderRadius: 15, borderWidth: 1, borderColor: '#3D472F', backgroundColor: '#171B12', padding: 12, marginTop: 15 }, progressTop: { flexDirection: 'row', justifyContent: 'space-between' }, progressValue: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, progressPercent: { color: '#D7B45A', fontSize: 11, fontWeight: '900' }, track: { height: 4, borderRadius: 3, backgroundColor: '#2B3224', overflow: 'hidden', marginTop: 8 }, fill: { height: 4, backgroundColor: '#D7B45A' }, sectionTitle: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 }, list: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#131B16', overflow: 'hidden' }, row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352F' }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#465249', alignItems: 'center', justifyContent: 'center' }, checkDone: { borderColor: '#5F8D6A', backgroundColor: '#203626' }, checkText: { color: '#88CB97', fontSize: 11, fontWeight: '900' }, flex: { flex: 1 }, rowTitle: { color: '#EAF0EC', fontSize: 10.5, fontWeight: '900' }, rowText: { color: '#748078', fontSize: 8, lineHeight: 12, marginTop: 3 }, review: { color: '#D7B45A', fontSize: 8, fontWeight: '900' }, done: { color: '#6F7C73' }, open: { color: '#B5A0EB', fontSize: 8, fontWeight: '900' }, panel: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#131B16', padding: 13 }, twoCol: { flexDirection: 'row', gap: 9 }, state: { width: 90 }, field: { marginTop: 10 }, label: { color: '#C9D1CC', fontSize: 9, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#344039', backgroundColor: '#0D1410', color: '#FFF8E8', paddingHorizontal: 11, fontSize: 11 }, multiline: { minHeight: 78, paddingTop: 10 }, segment: { flexDirection: 'row', borderRadius: 11, borderWidth: 1, borderColor: '#344039', overflow: 'hidden' }, segmentButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: '#3B3015' }, segmentText: { color: '#B5BFB8', fontSize: 9, fontWeight: '900' }, waivers: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, waiver: { borderRadius: 99, borderWidth: 1, borderColor: '#3A473F', paddingHorizontal: 9, paddingVertical: 7 }, waiverActive: { borderColor: '#876A27', backgroundColor: '#3B3015' }, waiverText: { color: '#B6C0BA', fontSize: 8.5, fontWeight: '800' }, primary: { minHeight: 45, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 12 }, primaryText: { color: '#172017', fontSize: 10, fontWeight: '900' }, secondary: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#131B16', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#D8E0DA', fontSize: 10, fontWeight: '900' }, error: { color: '#FF9D92', fontSize: 10, marginTop: 12 },
});
