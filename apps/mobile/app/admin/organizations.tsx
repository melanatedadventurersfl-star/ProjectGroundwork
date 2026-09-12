import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import {
  provisionOrganization,
  type OrganizationKind,
  type ProvisionOrganizationResult,
} from '../../src/platform/organizations';

const COLORS = {
  bg: '#0F1713',
  panel: '#17211C',
  raised: '#202B24',
  line: '#334239',
  cream: '#FFF8E8',
  muted: '#96A29B',
  dim: '#738079',
  gold: '#D7B45A',
  red: '#FFB4A9',
  green: '#9BE33D',
};

const KINDS: { value: OrganizationKind; label: string }[] = [
  { value: 'community', label: 'Community' },
  { value: 'company', label: 'Company' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'brand', label: 'Brand' },
  { value: 'team', label: 'Team' },
  { value: 'other', label: 'Other' },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function validHex(value: string) {
  return !value.trim() || /^#[0-9a-f]{6}$/i.test(value.trim());
}

export default function AdminOrganizationsScreen() {
  const { session } = useAuth();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [kind, setKind] = useState<OrganizationKind>('community');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [primaryColor, setPrimaryColor] = useState('#0F1713');
  const [accentColor, setAccentColor] = useState('#D7B45A');
  const [makeActive, setMakeActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ProvisionOrganizationResult | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!session?.user.id) {
        if (active) setChecking(false);
        return;
      }
      const { data, error: accessError } = await supabase.rpc('is_platform_admin');
      if (!active) return;
      if (accessError) setError(accessError.message);
      setAuthorized(data === true);
      setChecking(false);
    })();
    return () => { active = false; };
  }, [session?.user.id]);

  const canSubmit = useMemo(() => (
    name.trim().length > 1
    && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)
    && validHex(primaryColor)
    && validHex(accentColor)
    && !saving
  ), [accentColor, name, primaryColor, saving, slug]);

  function changeName(value: string) {
    setName(value);
    setCreated(null);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function createOrganization() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const result = await provisionOrganization({
        name,
        slug,
        kind,
        visibility,
        blueprintCode: 'community',
        primaryColor,
        accentColor,
        makeActive,
      });
      setCreated(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create organization.');
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.denied}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
      <View style={styles.deniedCard}>
        <Text style={styles.eyebrow}>PROTECTED AREA</Text>
        <Text style={styles.title}>Platform admin required</Text>
        <Text style={styles.help}>Organization provisioning is restricted to active platform operators.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>PLATFORM ADMIN</Text>
        <Text style={styles.title}>Create Organization</Text>
        <Text style={styles.subtitle}>Provision a complete tenant with an owner membership, Community Public Experience, branding defaults, and safe starter modules.</Text>
      </View>

      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

      {created ? <View style={styles.successCard}>
        <Text style={styles.successEyebrow}>ORGANIZATION CREATED</Text>
        <Text style={styles.successTitle}>{created.name}</Text>
        <Text style={styles.successMeta}>/{created.slug} · {created.blueprintCode} · Public Experience {created.experienceStatus}</Text>
        <Text style={styles.help}>{created.madeActive ? 'Your active workspace switched to this organization.' : 'Your current workspace was left unchanged.'}</Text>
        <View style={styles.successActions}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/host' as never)}><Text style={styles.secondaryButtonText}>Open Host Center</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => {
            setName('');
            setSlug('');
            setSlugEdited(false);
            setCreated(null);
            setMakeActive(false);
          }}><Text style={styles.secondaryButtonText}>Create Another</Text></Pressable>
        </View>
      </View> : null}

      <Text style={styles.sectionLabel}>IDENTITY</Text>
      <View style={styles.panel}>
        <Field label="Organization name">
          <TextInput
            value={name}
            onChangeText={changeName}
            editable={!saving}
            placeholder="Example Community"
            placeholderTextColor={COLORS.dim}
            style={styles.input}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Slug" help="Used for the tenant and its initial public experience. Lowercase letters, numbers, and hyphens only.">
          <TextInput
            value={slug}
            onChangeText={(value) => {
              setSlugEdited(true);
              setSlug(slugify(value));
              setCreated(null);
            }}
            editable={!saving}
            placeholder="example-community"
            placeholderTextColor={COLORS.dim}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
      </View>

      <Text style={styles.sectionLabel}>ORGANIZATION TYPE</Text>
      <View style={styles.chipGrid}>
        {KINDS.map((option) => <Pressable
          key={option.value}
          disabled={saving}
          style={[styles.chip, kind === option.value && styles.chipActive]}
          onPress={() => { setKind(option.value); setCreated(null); }}
        >
          <Text style={[styles.chipText, kind === option.value && styles.chipTextActive]}>{option.label}</Text>
        </Pressable>)}
      </View>

      <Text style={styles.sectionLabel}>BRAND STARTER</Text>
      <View style={styles.panel}>
        <View style={styles.colorRow}>
          <View style={styles.flex}>
            <Field label="Primary color" help="Six-digit hex color.">
              <TextInput value={primaryColor} onChangeText={(value) => setPrimaryColor(value)} editable={!saving} autoCapitalize="characters" autoCorrect={false} style={styles.input} />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="Accent color" help="Six-digit hex color.">
              <TextInput value={accentColor} onChangeText={(value) => setAccentColor(value)} editable={!saving} autoCapitalize="characters" autoCorrect={false} style={styles.input} />
            </Field>
          </View>
        </View>
        {(!validHex(primaryColor) || !validHex(accentColor)) ? <Text style={styles.error}>Colors must use the format #123ABC.</Text> : null}
      </View>

      <Text style={styles.sectionLabel}>LAUNCH STATE</Text>
      <View style={styles.panel}>
        <ToggleRow
          title="Public organization listing"
          body="The organization record can be visible, but its new Public Experience still starts in Draft until you activate it."
          value={visibility === 'public'}
          disabled={saving}
          onValueChange={(value) => setVisibility(value ? 'public' : 'private')}
        />
        <View style={styles.divider} />
        <ToggleRow
          title="Switch to organization after creation"
          body="Leave this off to keep Go Melanated as your active workspace while you provision the tenant."
          value={makeActive}
          disabled={saving}
          onValueChange={setMakeActive}
        />
      </View>

      <View style={styles.guardrail}>
        <Text style={styles.guardrailTitle}>Starter modules</Text>
        <Text style={styles.help}>Home, Events, Saved, and Menu start enabled. Community, Profiles, Groups, Directory, Calendar, Notifications, Memberships, and shared Search stay disabled until those surfaces are tenant-isolated.</Text>
      </View>

      <Pressable disabled={!canSubmit} style={[styles.createButton, !canSubmit && styles.createButtonDisabled]} onPress={() => void createOrganization()}>
        {saving ? <ActivityIndicator color="#111813" size="small" /> : null}
        <Text style={styles.createButtonText}>{saving ? 'Creating organization…' : 'Create Organization'}</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
    {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
  </View>;
}

function ToggleRow({ title, body, value, disabled, onValueChange }: {
  title: string;
  body: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return <View style={styles.toggleRow}>
    <View style={styles.flex}>
      <Text style={styles.toggleTitle}>{title}</Text>
      <Text style={styles.help}>{body}</Text>
    </View>
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      trackColor={{ false: '#354139', true: '#6B5A2F' }}
      thumbColor={value ? COLORS.gold : '#A0AAA4'}
    />
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { width: '100%', maxWidth: 780, alignSelf: 'center', padding: 20, paddingBottom: 70 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  denied: { flex: 1, padding: 20 },
  deniedCard: { marginTop: 30, borderRadius: 18, padding: 18, backgroundColor: '#211817', borderWidth: 1, borderColor: '#523B35', gap: 7 },
  back: { color: COLORS.gold, fontSize: 16, fontWeight: '800', paddingVertical: 8 },
  header: { marginTop: 12, marginBottom: 20, gap: 4 },
  eyebrow: { color: COLORS.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 32, lineHeight: 38, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, maxWidth: 620 },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 8 },
  panel: { borderRadius: 16, padding: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  fieldHelp: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#3B4A41', backgroundColor: COLORS.raised, color: COLORS.cream, paddingHorizontal: 12, fontSize: 12 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: COLORS.gold, backgroundColor: '#2A2518' },
  chipText: { color: COLORS.muted, fontSize: 10.5, fontWeight: '800' },
  chipTextActive: { color: COLORS.gold },
  colorRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  toggleTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900', marginBottom: 3 },
  help: { color: COLORS.muted, fontSize: 10.5, lineHeight: 15 },
  divider: { height: 1, backgroundColor: COLORS.line },
  guardrail: { marginTop: 18, borderRadius: 14, padding: 13, backgroundColor: '#161C18', borderWidth: 1, borderColor: '#485349', gap: 4 },
  guardrailTitle: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  createButton: { minHeight: 52, borderRadius: 14, backgroundColor: COLORS.gold, marginTop: 22, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  createButtonDisabled: { opacity: 0.42 },
  createButtonText: { color: '#111813', fontSize: 12, fontWeight: '900' },
  errorCard: { borderRadius: 13, padding: 12, backgroundColor: '#241817', borderWidth: 1, borderColor: '#6A3A37', marginBottom: 10 },
  error: { color: COLORS.red, fontSize: 10.5, lineHeight: 15 },
  successCard: { borderRadius: 16, padding: 14, backgroundColor: '#16241A', borderWidth: 1, borderColor: '#365F41', gap: 5, marginBottom: 5 },
  successEyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  successTitle: { color: COLORS.cream, fontSize: 20, fontWeight: '900' },
  successMeta: { color: COLORS.muted, fontSize: 10.5, lineHeight: 15 },
  successActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  secondaryButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#4D5E54', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COLORS.cream, fontSize: 10, fontWeight: '900' },
});
