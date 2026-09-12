import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getActiveExperienceContext,
  saveExperienceConfiguration,
  type ActiveExperienceContext,
  type ExperienceTerminology,
} from '../../src/platform/experience';
import { hasOrganizationPermission } from '../../src/platform/organizations';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = {
  bg: '#0B100D',
  panel: '#151B17',
  raised: '#1B231E',
  line: '#2E3832',
  cream: '#FFF8E8',
  muted: '#95A29A',
  dim: '#6F7D75',
  gold: '#D7B45A',
  green: '#7CCB92',
  red: '#E8A09A',
};

type ExperienceDraft = {
  name: string;
  publicSlug: string;
  brandName: string;
  primary: string;
  accent: string;
  surface: string;
  text: string;
  home: string;
  events: string;
  community: string;
  directory: string;
  journey: string;
  member: string;
  host: string;
};

const EMPTY_DRAFT: ExperienceDraft = {
  name: '',
  publicSlug: '',
  brandName: '',
  primary: '#0B100D',
  accent: '#D7B45A',
  surface: '#151B17',
  text: '#FFF8E8',
  home: 'Home',
  events: 'Events',
  community: 'Community',
  directory: 'Directory',
  journey: 'Journey',
  member: 'Member',
  host: 'Host',
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function draftFromContext(context: ActiveExperienceContext): ExperienceDraft {
  const { experience } = context;
  return {
    name: experience.name,
    publicSlug: experience.publicSlug,
    brandName: textValue(experience.branding.brand_name, experience.name),
    primary: textValue(experience.branding.primary, EMPTY_DRAFT.primary),
    accent: textValue(experience.branding.accent, EMPTY_DRAFT.accent),
    surface: textValue(experience.branding.surface, EMPTY_DRAFT.surface),
    text: textValue(experience.branding.text, EMPTY_DRAFT.text),
    home: textValue(experience.terminology.home, EMPTY_DRAFT.home),
    events: textValue(experience.terminology.events, EMPTY_DRAFT.events),
    community: textValue(experience.terminology.community, EMPTY_DRAFT.community),
    directory: textValue(experience.terminology.directory, EMPTY_DRAFT.directory),
    journey: textValue(experience.terminology.journey, EMPTY_DRAFT.journey),
    member: textValue(experience.terminology.member, EMPTY_DRAFT.member),
    host: textValue(experience.terminology.host, EMPTY_DRAFT.host),
  };
}

function moduleLabelFromDraft(code: string, draft: ExperienceDraft, fallback: string) {
  if (code === 'home') return draft.home;
  if (code === 'events') return draft.events;
  if (code === 'community') return draft.community;
  if (code === 'directory') return draft.directory;
  if (code === 'journey') return draft.journey;
  return fallback;
}

export default function HostExperienceScreen() {
  const [context, setContext] = useState<ActiveExperienceContext | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExperienceDraft>(EMPTY_DRAFT);
  const [moduleDraft, setModuleDraft] = useState<Record<string, boolean>>({});

  function hydrate(nextContext: ActiveExperienceContext) {
    setContext(nextContext);
    setDraft(draftFromContext(nextContext));
    setModuleDraft(Object.fromEntries(nextContext.modules.map((module) => [module.code, module.enabled])));
  }

  useEffect(() => {
    let mounted = true;

    void getActiveExperienceContext()
      .then(async (nextContext) => {
        if (!mounted) return;
        if (nextContext) hydrate(nextContext);
        if (!nextContext) return;
        const allowed = await hasOrganizationPermission(
          nextContext.organization.id,
          'organization.settings.manage',
        );
        if (mounted) setCanManage(allowed);
      })
      .catch((caught) => {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Unable to load the public experience.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const enabledModules = useMemo(
    () => context?.modules.filter((module) => moduleDraft[module.code] ?? module.enabled) ?? [],
    [context, moduleDraft],
  );

  function updateDraft(key: keyof ExperienceDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSavedMessage(null);
  }

  function cancelEditing() {
    if (context) {
      setDraft(draftFromContext(context));
      setModuleDraft(Object.fromEntries(context.modules.map((module) => [module.code, module.enabled])));
    }
    setEditing(false);
    setError(null);
    setSavedMessage(null);
  }

  async function saveChanges() {
    if (!context || saving) return;
    const name = draft.name.trim();
    const publicSlug = draft.publicSlug.trim().toLowerCase();
    if (!name) {
      setError('Add a public experience name.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug)) {
      setError('Public slug can use lowercase letters, numbers and hyphens.');
      return;
    }

    setSaving(true);
    setError(null);
    setSavedMessage(null);

    const terminology: ExperienceTerminology = {
      ...context.experience.terminology,
      home: draft.home.trim() || EMPTY_DRAFT.home,
      events: draft.events.trim() || EMPTY_DRAFT.events,
      community: draft.community.trim() || EMPTY_DRAFT.community,
      directory: draft.directory.trim() || EMPTY_DRAFT.directory,
      journey: draft.journey.trim() || EMPTY_DRAFT.journey,
      member: draft.member.trim() || EMPTY_DRAFT.member,
      host: draft.host.trim() || EMPTY_DRAFT.host,
    };

    try {
      const result = await saveExperienceConfiguration(
        context.experience.id,
        {
          name,
          publicSlug,
          branding: {
            ...context.experience.branding,
            brand_name: draft.brandName.trim() || name,
            primary: draft.primary.trim() || EMPTY_DRAFT.primary,
            accent: draft.accent.trim() || EMPTY_DRAFT.accent,
            surface: draft.surface.trim() || EMPTY_DRAFT.surface,
            text: draft.text.trim() || EMPTY_DRAFT.text,
          },
          terminology,
        },
        context.modules.map((module) => ({
          code: module.code,
          enabled: moduleDraft[module.code] ?? module.enabled,
          label: moduleLabelFromDraft(module.code, draft, module.label),
        })),
      );

      const nextContext = {
        ...context,
        experience: result.experience,
        modules: result.modules,
      };
      hydrate(nextContext);
      setEditing(false);
      setSavedMessage('Public Experience settings saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the public experience.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.loadingText}>Loading public experience…</Text>
      </View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{context?.organization.name.toUpperCase() ?? 'ORGANIZATION'}</Text>
          <Text style={styles.title}>Public Experience</Text>
          <Text style={styles.subtitle}>Control the member-facing product this organization publishes into.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      </View>

      {error ? <View style={[styles.notice, styles.noticeError]}>
        <AppIcon name="alert-circle" color={COLORS.red} size={20} />
        <Text style={styles.noticeErrorText}>{error}</Text>
      </View> : null}

      {savedMessage ? <View style={[styles.notice, styles.noticeSuccess]}>
        <AppIcon name="checkmark" color={COLORS.green} size={20} />
        <Text style={styles.noticeSuccessText}>{savedMessage}</Text>
      </View> : null}

      {!context && !error ? <View style={styles.notice}>
        <AppIcon name="warning" color={COLORS.gold} size={20} />
        <Text style={styles.noticeText}>This organization does not have a public experience configured yet.</Text>
      </View> : null}

      {context ? <>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>{draft.name.slice(0, 1).toUpperCase() || context.experience.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.heroName}>{draft.name || context.experience.name}</Text>
              <Text style={styles.heroMeta}>{context.experience.blueprintCode} blueprint · {context.experience.status}</Text>
            </View>
            <View style={[styles.statusPill, context.experience.status === 'active' && styles.statusPillActive]}>
              <Text style={styles.statusText}>{context.experience.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.brandRow}>
            <BrandColor label="Primary" value={draft.primary} />
            <BrandColor label="Accent" value={draft.accent} />
            <BrandColor label="Surface" value={draft.surface} />
          </View>

          {canManage ? <View style={styles.actionRow}>
            {editing ? <>
              <Pressable style={styles.secondaryButton} disabled={saving} onPress={cancelEditing}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} disabled={saving} onPress={() => void saveChanges()}>
                {saving ? <ActivityIndicator color={COLORS.bg} size="small" /> : <AppIcon name="checkmark" color={COLORS.bg} size={17} />}
                <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </Pressable>
            </> : <Pressable style={styles.primaryButton} onPress={() => { setEditing(true); setSavedMessage(null); }}>
              <AppIcon name="edit" color={COLORS.bg} size={17} />
              <Text style={styles.primaryButtonText}>Edit Experience</Text>
            </Pressable>}
          </View> : null}
        </View>

        {editing ? <>
          <Text style={styles.sectionLabel}>IDENTITY & PUBLISHING</Text>
          <View style={styles.editPanel}>
            <Field label="Experience name" value={draft.name} onChangeText={(value) => updateDraft('name', value)} placeholder="JaxBlack" />
            <Field label="Brand name" value={draft.brandName} onChangeText={(value) => updateDraft('brandName', value)} placeholder="JaxBlack" />
            <Field label="Public slug" value={draft.publicSlug} onChangeText={(value) => updateDraft('publicSlug', value.toLowerCase())} placeholder="jaxblack" autoCapitalize="none" />
          </View>

          <Text style={styles.sectionLabel}>BRAND COLORS</Text>
          <View style={styles.editPanel}>
            <Field label="Primary" value={draft.primary} onChangeText={(value) => updateDraft('primary', value)} placeholder="#0B100D" autoCapitalize="characters" />
            <Field label="Accent" value={draft.accent} onChangeText={(value) => updateDraft('accent', value)} placeholder="#D7B45A" autoCapitalize="characters" />
            <Field label="Surface" value={draft.surface} onChangeText={(value) => updateDraft('surface', value)} placeholder="#151B17" autoCapitalize="characters" />
            <Field label="Text" value={draft.text} onChangeText={(value) => updateDraft('text', value)} placeholder="#FFF8E8" autoCapitalize="characters" />
          </View>

          <Text style={styles.sectionLabel}>PRODUCT LANGUAGE</Text>
          <View style={styles.editPanel}>
            <Field label="Home" value={draft.home} onChangeText={(value) => updateDraft('home', value)} placeholder="Home" />
            <Field label="Events" value={draft.events} onChangeText={(value) => updateDraft('events', value)} placeholder="Events" />
            <Field label="Community" value={draft.community} onChangeText={(value) => updateDraft('community', value)} placeholder="Community" />
            <Field label="Directory" value={draft.directory} onChangeText={(value) => updateDraft('directory', value)} placeholder="Directory" />
            <Field label="Journey" value={draft.journey} onChangeText={(value) => updateDraft('journey', value)} placeholder="Journey" />
            <Field label="Member" value={draft.member} onChangeText={(value) => updateDraft('member', value)} placeholder="Member" />
            <Field label="Host" value={draft.host} onChangeText={(value) => updateDraft('host', value)} placeholder="Host" />
          </View>
        </> : <>
          <Text style={styles.sectionLabel}>PRODUCT LANGUAGE</Text>
          <View style={styles.panel}>
            {Object.entries(context.experience.terminology).map(([key, value], index) => (
              typeof value === 'string' ? <View key={key} style={[styles.termRow, index > 0 && styles.divider]}>
                <Text style={styles.termKey}>{key.replaceAll('_', ' ')}</Text>
                <Text style={styles.termValue}>{value}</Text>
              </View> : null
            ))}
          </View>
        </>}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelInline}>{editing ? 'MODULE ACCESS' : 'ENABLED MODULES'}</Text>
          <Text style={styles.countText}>{enabledModules.length} enabled</Text>
        </View>
        {editing ? <View style={styles.panel}>
          {context.modules.map((module, index) => <View key={module.code} style={[styles.moduleToggleRow, index > 0 && styles.divider]}>
            <View style={styles.flex}>
              <Text style={styles.moduleLabel}>{moduleLabelFromDraft(module.code, draft, module.label)}</Text>
              <Text style={styles.moduleCode}>{module.code}{module.routeKey ? ` · ${module.routeKey}` : ''}</Text>
            </View>
            <Switch
              value={moduleDraft[module.code] ?? module.enabled}
              onValueChange={(value) => {
                setModuleDraft((current) => ({ ...current, [module.code]: value }));
                setSavedMessage(null);
              }}
              trackColor={{ false: '#344039', true: '#496E53' }}
              thumbColor={(moduleDraft[module.code] ?? module.enabled) ? COLORS.gold : COLORS.muted}
            />
          </View>)}
        </View> : <View style={styles.moduleGrid}>
          {enabledModules.map((module) => <View key={module.code} style={styles.moduleCard}>
            <View style={styles.moduleIcon}><AppIcon name="checkmark" color={COLORS.green} size={18} /></View>
            <Text style={styles.moduleLabel}>{module.label}</Text>
            <Text style={styles.moduleCode}>{module.code}</Text>
          </View>)}
        </View>}

        <Text style={styles.sectionLabel}>PUBLISHING TARGET</Text>
        <View style={styles.panel}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Public slug</Text>
            <Text style={styles.detailValue}>{editing ? draft.publicSlug : context.experience.publicSlug}</Text>
          </View>
          <View style={[styles.detailRow, styles.divider]}>
            <Text style={styles.detailLabel}>Experience key</Text>
            <Text style={styles.detailValue}>{context.experience.key}</Text>
          </View>
          <View style={[styles.detailRow, styles.divider]}>
            <Text style={styles.detailLabel}>Event relationship</Text>
            <Text style={styles.detailValue}>Organization events publish here</Text>
          </View>
        </View>

        <View style={styles.foundationCard}>
          <AppIcon name="sparkles" color={COLORS.gold} size={22} />
          <View style={styles.flex}>
            <Text style={styles.foundationTitle}>Reusable experience configuration</Text>
            <Text style={styles.foundationBody}>Branding, terminology and module access are now organization-owned settings. Changing them does not require a customer-specific app fork.</Text>
            <Text style={styles.foundationMeta}>{canManage ? 'Your role can edit this configuration.' : 'Your role can view this configuration.'}</Text>
          </View>
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.dim}
      autoCapitalize={autoCapitalize}
      style={styles.input}
    />
  </View>;
}

function BrandColor({ label, value }: { label: string; value: unknown }) {
  const color = typeof value === 'string' ? value : COLORS.raised;
  return <View style={styles.brandColor}>
    <View style={[styles.swatch, { backgroundColor: color }]} />
    <View>
      <Text style={styles.brandColorLabel}>{label}</Text>
      <Text style={styles.brandColorValue}>{typeof value === 'string' ? value : 'Not set'}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { color: COLORS.muted, fontSize: 12 },
  flex: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 },
  headerCopy: { flex: 1 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 430 },
  back: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line },
  backText: { color: COLORS.cream, fontSize: 34, lineHeight: 36 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 13, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, marginBottom: 12 },
  noticeError: { borderColor: '#6A3A37', backgroundColor: '#241817' },
  noticeSuccess: { borderColor: '#496E53', backgroundColor: '#17261C' },
  noticeText: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  noticeErrorText: { flex: 1, color: COLORS.red, fontSize: 11, lineHeight: 16 },
  noticeSuccessText: { flex: 1, color: COLORS.green, fontSize: 11, lineHeight: 16 },
  heroCard: { borderRadius: 20, padding: 16, backgroundColor: '#18221C', borderWidth: 1, borderColor: '#405044' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#2A2518', borderWidth: 1, borderColor: '#6C5A2F', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: COLORS.gold, fontSize: 18, fontWeight: '900' },
  heroName: { color: COLORS.cream, fontSize: 20, fontWeight: '900' },
  heroMeta: { color: COLORS.muted, fontSize: 10, marginTop: 3, textTransform: 'capitalize' },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.raised },
  statusPillActive: { borderColor: '#496E53', backgroundColor: '#1A2C20' },
  statusText: { color: COLORS.green, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  brandColor: { minWidth: 135, flexGrow: 1, flexBasis: 135, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, padding: 9, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line },
  swatch: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: '#526058' },
  brandColorLabel: { color: COLORS.cream, fontSize: 10, fontWeight: '800' },
  brandColorValue: { color: COLORS.dim, fontSize: 8.5, marginTop: 2 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  primaryButton: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.gold },
  primaryButtonText: { color: COLORS.bg, fontSize: 10.5, fontWeight: '900' },
  secondaryButton: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line },
  secondaryButtonText: { color: COLORS.cream, fontSize: 10.5, fontWeight: '800' },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  sectionLabelInline: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  countText: { color: COLORS.dim, fontSize: 9, fontWeight: '800' },
  panel: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  editPanel: { borderRadius: 15, padding: 13, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, gap: 12 },
  field: { gap: 5 },
  fieldLabel: { color: COLORS.muted, fontSize: 9.5, fontWeight: '800' },
  input: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#3D4942', backgroundColor: '#111713', color: COLORS.cream, paddingHorizontal: 11, fontSize: 12 },
  termRow: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  termKey: { color: COLORS.dim, fontSize: 10, textTransform: 'capitalize' },
  termValue: { color: COLORS.cream, fontSize: 11, fontWeight: '800' },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleCard: { minWidth: 145, flexGrow: 1, flexBasis: 145, borderRadius: 14, padding: 12, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line },
  moduleIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#1B2A20', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  moduleToggleRow: { minHeight: 62, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  moduleLabel: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  moduleCode: { color: COLORS.dim, fontSize: 8.5, marginTop: 3 },
  detailRow: { minHeight: 52, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  detailLabel: { color: COLORS.dim, fontSize: 10 },
  detailValue: { color: COLORS.cream, fontSize: 10.5, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  foundationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 16, padding: 14, backgroundColor: '#211E15', borderWidth: 1, borderColor: '#62552F', marginTop: 22 },
  foundationTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  foundationBody: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  foundationMeta: { color: COLORS.gold, fontSize: 9, fontWeight: '800', marginTop: 8 },
});
