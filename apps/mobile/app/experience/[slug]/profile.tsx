import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../../src/auth/AuthProvider';
import { supabase } from '../../../src/lib/supabase';
import { experienceLabel } from '../../../src/platform/experience';
import { useTenantExperience } from '../../../src/platform/TenantExperienceProvider';
import { AppIcon } from '../../../src/ui/AppIcon';

type TenantProfile = {
  organization_id: string;
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  home_city: string | null;
  home_state: string | null;
  visibility: 'private' | 'members' | 'public';
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function TenantProfileScreen() {
  const { session } = useAuth();
  const { context, moduleEnabled } = useTenantExperience();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!context || !session?.user.id || !moduleEnabled('profiles')) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    void supabase
      .from('organization_member_profiles')
      .select('organization_id,profile_id,display_name,username,avatar_url,cover_url,bio,home_city,home_state,visibility')
      .eq('organization_id', context.organization.id)
      .eq('profile_id', session.user.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) throw queryError;
        const row = (data as TenantProfile | null) ?? {
          organization_id: context.organization.id,
          profile_id: session.user.id,
          display_name: null,
          username: null,
          avatar_url: null,
          cover_url: null,
          bio: null,
          home_city: null,
          home_state: null,
          visibility: 'members' as const,
        };
        setProfile(row);
        setDisplayName(row.display_name ?? '');
        setUsername(row.username ?? '');
        setBio(row.bio ?? '');
        setCity(row.home_city ?? '');
        setState(row.home_state ?? '');
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load your profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [context, moduleEnabled, session?.user.id]);

  if (!context) return null;

  const { experience, organization } = context;
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const memberLabel = experienceLabel(experience, 'member', 'Member');

  async function save() {
    if (!session?.user.id || !moduleEnabled('profiles') || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    const payload = {
      organization_id: organization.id,
      profile_id: session.user.id,
      display_name: displayName.trim() || null,
      username: username.trim().replace(/^@/, '') || null,
      bio: bio.trim() || null,
      home_city: city.trim() || null,
      home_state: state.trim() || null,
      visibility: profile?.visibility ?? 'members',
    };
    try {
      const { data, error: saveError } = await supabase
        .from('organization_member_profiles')
        .upsert(payload, { onConflict: 'organization_id,profile_id' })
        .select('organization_id,profile_id,display_name,username,avatar_url,cover_url,bio,home_city,home_state,visibility')
        .single();
      if (saveError) throw saveError;
      setProfile(data as TenantProfile);
      setMessage('Profile saved for this organization only.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (!moduleEnabled('profiles')) {
    return <View style={styles.center}><Text style={[styles.unavailableTitle, { color: text }]}>{memberLabel} profiles are not enabled for this app.</Text><Text style={styles.unavailableText}>This organization has not turned on member profiles.</Text></View>;
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>;

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={[styles.eyebrow, { color: accent }]}>{organization.name.toUpperCase()}</Text>
    <Text style={[styles.title, { color: text }]}>Your {memberLabel} Profile</Text>
    <Text style={styles.subtitle}>This identity exists only inside {organization.name}. Changes here do not change your Go Melanated profile.</Text>

    <View style={[styles.identityCard, { backgroundColor: surface }]}>
      <View style={[styles.avatar, { borderColor: `${accent}88` }]}><AppIcon name="profile" color={accent} size={28} /></View>
      <View style={styles.flex}>
        <Text style={[styles.identityName, { color: text }]}>{displayName.trim() || memberLabel}</Text>
        {username.trim() ? <Text style={styles.handle}>@{username.trim().replace(/^@/, '')}</Text> : <Text style={styles.handle}>No organization username yet</Text>}
      </View>
    </View>

    <View style={[styles.form, { backgroundColor: surface }]}>
      <Field label="DISPLAY NAME"><TextInput value={displayName} onChangeText={setDisplayName} placeholder="Name shown in this app" placeholderTextColor="#6E7A72" style={[styles.input, { color: text }]} /></Field>
      <Field label="USERNAME"><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Organization username" placeholderTextColor="#6E7A72" style={[styles.input, { color: text }]} /></Field>
      <Field label="BIO"><TextInput value={bio} onChangeText={setBio} multiline placeholder={`Tell ${organization.name} members about yourself`} placeholderTextColor="#6E7A72" style={[styles.input, styles.bioInput, { color: text }]} /></Field>
      <View style={styles.locationRow}>
        <View style={styles.flex}><Field label="CITY"><TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#6E7A72" style={[styles.input, { color: text }]} /></Field></View>
        <View style={styles.stateField}><Field label="STATE"><TextInput value={state} onChangeText={setState} autoCapitalize="characters" maxLength={24} placeholder="State" placeholderTextColor="#6E7A72" style={[styles.input, { color: text }]} /></Field></View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={[styles.message, { color: accent }]}>{message}</Text> : null}
      <Pressable disabled={saving} style={[styles.saveButton, { backgroundColor: accent }, saving && styles.disabled]} onPress={() => void save()}>
        {saving ? <ActivityIndicator color="#101510" /> : <Text style={styles.saveText}>Save profile</Text>}
      </Pressable>
    </View>
  </ScrollView>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 30, maxWidth: 720, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 7 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#8F9D94', fontSize: 11, lineHeight: 17, marginTop: 6, maxWidth: 560 },
  identityCard: { borderRadius: 18, padding: 15, marginTop: 19, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, backgroundColor: '#101713', alignItems: 'center', justifyContent: 'center' },
  identityName: { fontSize: 17, fontWeight: '900' },
  handle: { color: '#849087', fontSize: 10, marginTop: 3 },
  form: { borderRadius: 18, padding: 15, marginTop: 12, gap: 13 },
  field: { gap: 6 },
  label: { color: '#7F8D84', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#35433A', backgroundColor: '#0D1410', paddingHorizontal: 12, fontSize: 12.5 },
  bioInput: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', gap: 10 },
  stateField: { width: 150 },
  error: { color: '#F0A199', fontSize: 10, lineHeight: 15 },
  message: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
  saveButton: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  saveText: { color: '#101510', fontSize: 12, fontWeight: '900' },
  unavailableTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  unavailableText: { color: '#8F9D94', fontSize: 11, textAlign: 'center' },
});
