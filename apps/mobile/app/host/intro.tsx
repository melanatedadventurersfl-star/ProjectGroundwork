import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAiPrivacyPreferences, type AiPrivacyPreferences } from '../../src/hosting/aiPlanner';
import { AI_PRIVACY_DEFAULTS, saveAiPrivacyPreferences } from '../../src/hosting/aiPrivacy';
import { completeHostIntroduction, ensureHostCenterProfile, markHostSetupReviewed, sanitizeHostDestination, saveHostCenterProfile, type HostCenterProfile } from '../../src/hosting/hostEntry';

const WORKING_AREAS = ['Event planning', 'Operations', 'Marketing', 'Vendors', 'Finance', 'Food', 'Logistics', 'Volunteers', 'Communications', 'Guest experience'];
const TOTAL_STEPS = 6;

export default function HostIntroductionScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const returnDestination = sanitizeHostDestination(params.next);
  const [profile, setProfile] = useState<HostCenterProfile | null>(null);
  const [step, setStep] = useState(1);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [privacy, setPrivacy] = useState<AiPrivacyPreferences>(AI_PRIVACY_DEFAULTS);

  useEffect(() => {
    let active = true;
    void Promise.all([ensureHostCenterProfile(), getAiPrivacyPreferences()]).then(([nextProfile, nextPrivacy]) => {
      if (!active) return;
      setProfile(nextProfile);
      setPrivacy(nextPrivacy);
      setStep(Math.max(1, Math.min(TOTAL_STEPS, nextProfile.introLastStep || 1)));
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Unable to open Host Center introduction.');
    });
    return () => { active = false; };
  }, []);

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  async function advance() {
    if (!profile || working) return;
    setWorking(true); setError('');
    try {
      if (step === 3) {
        const nextProfile = await saveHostCenterProfile(profile);
        setProfile(nextProfile);
        await Promise.all([markHostSetupReviewed('profile'), markHostSetupReviewed('organization')]);
      }
      if (step === 4) {
        const nextProfile = await saveHostCenterProfile({ workingAreas: profile.workingAreas });
        setProfile((current) => current ? { ...current, ...nextProfile } : nextProfile);
        await markHostSetupReviewed('working_preferences');
      }
      if (step === 5) {
        await saveAiPrivacyPreferences(privacy);
        await markHostSetupReviewed('ai_privacy');
      }
      if (step === 6) {
        await markHostSetupReviewed('connections');
        await finish(returnDestination);
        return;
      }
      const nextStep = Math.min(TOTAL_STEPS, step + 1);
      await saveHostCenterProfile({ introLastStep: nextStep });
      setStep(nextStep);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this step.');
    } finally { setWorking(false); }
  }

  async function finish(destination: string) {
    setWorking(true); setError('');
    try {
      const safe = await completeHostIntroduction(destination);
      router.replace(safe as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to finish Host Center introduction.');
    } finally { setWorking(false); }
  }

  async function skipIntro() {
    await finish(returnDestination);
  }

  if (!profile && !error) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Preparing Host Center…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}><View><Text style={styles.brand}>GO MELANATED</Text><Text style={styles.context}>HOST CENTER INTRO</Text></View><Pressable disabled={working} onPress={() => void skipIntro()}><Text style={styles.skip}>Skip intro</Text></Pressable></View>
      <View style={styles.progressTop}><Text style={styles.progressLabel}>Step {step} of {TOTAL_STEPS}</Text><Text style={styles.progressLabel}>{progress}%</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
      <View style={styles.card}>{renderStep(step, profile, setProfile, privacy, setPrivacy, finish)}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {step < 6 ? <Pressable disabled={working || !profile} style={[styles.primary, (working || !profile) && styles.disabled]} onPress={() => void advance()}>{working ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Continue</Text>}</Pressable> : null}
      {step > 1 && step < 6 ? <Pressable disabled={working} onPress={() => setStep((value) => Math.max(1, value - 1))} style={styles.backButton}><Text style={styles.backText}>Back</Text></Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}

function renderStep(step: number, profile: HostCenterProfile | null, setProfile: (value: HostCenterProfile | null) => void, privacy: AiPrivacyPreferences, setPrivacy: (value: AiPrivacyPreferences) => void, finish: (destination: string) => Promise<void>) {
  if (!profile) return null;
  if (step === 1) return <><Text style={styles.eyebrow}>WELCOME TO HOST CENTER</Text><Text style={styles.title}>Your event workspace starts here.</Text><Text style={styles.body}>Plan, organize, promote and run events without moving through the member app first.</Text><View style={styles.grid}><Feature title="Events" text="Build and manage every event." /><Feature title="Work" text="Tasks, owners and deadlines." /><Feature title="Calendar" text="Operational dates in one view." /><Feature title="Vendors" text="Businesses, documents and follow-up." /><Feature title="Marketing" text="Promotions and channel performance." /><Feature title="Finances" text="Revenue, expenses and event profit." /></View></>;
  if (step === 2) return <><Text style={styles.eyebrow}>HOW IT WORKS</Text><Text style={styles.title}>One event, one operating system.</Text><Text style={styles.body}>Host Center follows the event from the first idea through post-event review.</Text><View style={styles.lifecycle}>{['Idea', 'Build Event', 'Work Plan', 'Promote', 'Run Event', 'Review'].map((label, index) => <View key={label} style={styles.lifecycleRow}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><Text style={styles.lifecycleText}>{label}</Text></View>)}</View><Text style={styles.note}>Your member profile and Host Center share one Go Melanated account. Host permissions control what operational data you can access.</Text></>;
  if (step === 3) return <><Text style={styles.eyebrow}>HOST PROFILE</Text><Text style={styles.title}>Set up how you operate.</Text><Text style={styles.body}>These details help identify your organization and prefill future Host Center work. Optional fields can be completed later.</Text><Field label="Organization or business name" value={profile.organizationName} onChangeText={(organizationName: string) => setProfile({ ...profile, organizationName })} placeholder="Melanated Adventurers" /><Field label="Host display name" value={profile.hostDisplayName} onChangeText={(hostDisplayName: string) => setProfile({ ...profile, hostDisplayName })} placeholder="Host name" /><View style={styles.twoCol}><View style={styles.flex}><Field label="City" value={profile.city} onChangeText={(city: string) => setProfile({ ...profile, city })} placeholder="Jacksonville" /></View><View style={styles.state}><Field label="State" value={profile.state} onChangeText={(state: string) => setProfile({ ...profile, state })} placeholder="FL" /></View></View><Field label="Host contact email" value={profile.contactEmail} onChangeText={(contactEmail: string) => setProfile({ ...profile, contactEmail })} placeholder="events@example.com" keyboardType="email-address" /><Field label="Website" value={profile.websiteUrl} onChangeText={(websiteUrl: string) => setProfile({ ...profile, websiteUrl })} placeholder="https://" autoCapitalize="none" /><Field label="Public description" value={profile.publicDescription} onChangeText={(publicDescription: string) => setProfile({ ...profile, publicDescription })} placeholder="What should members know about your organization?" multiline /><Toggle label="Show public host profile" value={profile.publicProfileEnabled} onValueChange={(publicProfileEnabled) => setProfile({ ...profile, publicProfileEnabled })} /></>;
  if (step === 4) return <><Text style={styles.eyebrow}>YOUR ROLE</Text><Text style={styles.title}>What do you usually handle?</Text><Text style={styles.body}>Choose the areas that fit your work. These are preferences, not permissions.</Text><View style={styles.chips}>{WORKING_AREAS.map((area) => { const active = profile.workingAreas.includes(area); return <Pressable key={area} onPress={() => setProfile({ ...profile, workingAreas: active ? profile.workingAreas.filter((item) => item !== area) : [...profile.workingAreas, area] })} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{area}</Text></Pressable>; })}</View></>;
  if (step === 5) return <><Text style={styles.eyebrow}>AI & PRIVACY</Text><Text style={styles.title}>You control what the AI remembers.</Text><Text style={styles.body}>The Event Planner and Event Assistant can work without long-term personalization. Optional settings stay off unless you enable them.</Text><Toggle label="Personal Memory" detail="Remember explicit host preferences for future planning." value={privacy.personal_memory_enabled} onValueChange={(value) => setPrivacy({ ...privacy, personal_memory_enabled: value })} /><Toggle label="Learn From Event History" detail="Use your previous events for future recommendations." value={privacy.event_history_learning_enabled} onValueChange={(value) => setPrivacy({ ...privacy, event_history_learning_enabled: value })} /><Toggle label="Shared Organization Memory" detail="Use approved organization knowledge in recommendations." value={privacy.organization_memory_enabled} onValueChange={(value) => setPrivacy({ ...privacy, organization_memory_enabled: value })} /><Toggle label="Save AI Planning Conversations" value={privacy.save_conversations_enabled} onValueChange={(value) => setPrivacy({ ...privacy, save_conversations_enabled: value })} /><Toggle label="Recommendation History" value={privacy.recommendation_history_enabled} onValueChange={(value) => setPrivacy({ ...privacy, recommendation_history_enabled: value })} /><Toggle label="Product Improvement Analytics" detail="Optional structured usage analytics. Raw planning conversations are not required for this setting." value={privacy.product_analytics_enabled} onValueChange={(value) => setPrivacy({ ...privacy, product_analytics_enabled: value })} /></>;
  return <><Text style={styles.eyebrow}>READY TO START</Text><Text style={styles.title}>Choose what you want to do first.</Text><Text style={styles.body}>Connections can be added later. Eventbrite, Facebook, Instagram, email and calendar integrations will only show as connected after the related service is configured.</Text><View style={styles.connections}>{['Eventbrite', 'Facebook', 'Instagram', 'Email', 'Calendar'].map((service) => <View key={service} style={styles.connection}><Text style={styles.connectionName}>{service}</Text><Text style={styles.connectionStatus}>NOT CONNECTED</Text></View>)}</View><Action title="Plan an event with AI" text="Start with an idea and let the planner build the operational plan." onPress={() => void finish('/host/plan-ai')} /><Action title="Build an event manually" text="Enter the event foundation yourself." onPress={() => void finish('/host/create-scratch')} /><Action title="Import an existing event" text="Use a URL, file or existing event source." onPress={() => void finish('/host/create')} /><Action title="Explore Host Center" text="Open the dashboard and look around first." onPress={() => void finish('/host')} /></>;
}

function Feature({ title, text }: { title: string; text: string }) { return <View style={styles.feature}><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureText}>{text}</Text></View>; }
function Field({ label, multiline = false, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#66736B" style={[styles.input, multiline && styles.multiline]} textAlignVertical={multiline ? 'top' : 'center'} /></View>; }
function Toggle({ label, detail, value, onValueChange }: { label: string; detail?: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.toggleRow}><View style={styles.flex}><Text style={styles.toggleLabel}>{label}</Text>{detail ? <Text style={styles.toggleDetail}>{detail}</Text> : null}</View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#303A34', true: '#796426' }} thumbColor={value ? '#E7C464' : '#87928B'} /></View>; }
function Action({ title, text, onPress }: { title: string; text: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.action}><View style={styles.flex}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionText}>{text}</Text></View><Text style={styles.arrow}>›</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', gap: 8 }, muted: { color: '#7E8A82', fontSize: 10 }, content: { padding: 20, paddingBottom: 64, maxWidth: 720, width: '100%', alignSelf: 'center' }, topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, brand: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, context: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', marginTop: 3 }, skip: { color: '#97A39B', fontSize: 10, fontWeight: '800', paddingVertical: 4 }, progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, progressLabel: { color: '#7E8A82', fontSize: 8, fontWeight: '800' }, track: { height: 4, borderRadius: 3, backgroundColor: '#27312B', overflow: 'hidden', marginTop: 6 }, fill: { height: 4, backgroundColor: '#D7B45A' }, card: { borderRadius: 20, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#131B16', padding: 17, marginTop: 18 }, eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 4 }, body: { color: '#98A49C', fontSize: 11, lineHeight: 17, marginTop: 6 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }, feature: { width: '48.5%', borderRadius: 13, borderWidth: 1, borderColor: '#2F3B34', backgroundColor: '#0E1511', padding: 11 }, featureTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, featureText: { color: '#748078', fontSize: 8.5, lineHeight: 13, marginTop: 3 }, lifecycle: { marginTop: 15, gap: 8 }, lifecycleRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: '#0E1511', paddingHorizontal: 11 }, number: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#332A14' }, numberText: { color: '#E7C464', fontSize: 9, fontWeight: '900' }, lifecycleText: { color: '#DCE3DE', fontSize: 11, fontWeight: '900' }, note: { color: '#7B887F', fontSize: 9, lineHeight: 14, marginTop: 14 }, field: { marginTop: 12 }, label: { color: '#D5DDD8', fontSize: 10, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 47, borderRadius: 12, borderWidth: 1, borderColor: '#344039', backgroundColor: '#0D1410', color: '#FFF8E8', paddingHorizontal: 12, fontSize: 12 }, multiline: { minHeight: 86, paddingTop: 11 }, twoCol: { flexDirection: 'row', gap: 9 }, flex: { flex: 1 }, state: { width: 90 }, toggleRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2C3831', paddingVertical: 8, marginTop: 3 }, toggleLabel: { color: '#E9EFEA', fontSize: 10.5, fontWeight: '900' }, toggleDetail: { color: '#76827A', fontSize: 8.5, lineHeight: 13, marginTop: 3 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }, chip: { borderRadius: 99, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0E1511', paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { borderColor: '#8A6A25', backgroundColor: '#3B3015' }, chipText: { color: '#9CA7A0', fontSize: 9.5, fontWeight: '800' }, chipTextActive: { color: '#F0D47C' }, connections: { marginTop: 14, marginBottom: 8 }, connection: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A352F' }, connectionName: { color: '#D8E0DA', fontSize: 10, fontWeight: '900' }, connectionStatus: { color: '#65736A', fontSize: 7.5, fontWeight: '900' }, action: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: '#344039', backgroundColor: '#0E1511', padding: 12, marginTop: 8 }, actionTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, actionText: { color: '#76827A', fontSize: 8.5, lineHeight: 13, marginTop: 3 }, arrow: { color: '#D7B45A', fontSize: 20 }, primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.42 }, backButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, backText: { color: '#87938B', fontSize: 10, fontWeight: '800' }, error: { color: '#FF9D92', fontSize: 10, lineHeight: 15, marginTop: 10 } });
