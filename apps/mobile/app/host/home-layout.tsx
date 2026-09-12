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
  updateOrganizationExperience,
  type ActiveExperienceContext,
} from '../../src/platform/experience';
import { hasOrganizationPermission } from '../../src/platform/organizations';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type SectionCode = 'hero' | 'upcoming_events' | 'community_activity' | 'recommendations';

type SectionDefinition = {
  code: SectionCode;
  title: string;
  description: string;
  icon: AppIconName;
};

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

const SECTIONS: SectionDefinition[] = [
  { code: 'hero', title: 'Hero', description: 'Organization identity, tagline and primary actions.', icon: 'sparkles' },
  { code: 'upcoming_events', title: 'Upcoming Events', description: 'Events published into this public experience.', icon: 'calendar' },
  { code: 'community_activity', title: 'Community', description: 'A direct path into the organization community.', icon: 'community' },
  { code: 'recommendations', title: 'Explore Modules', description: 'Directory, groups, profiles and membership shortcuts.', icon: 'directory' },
];

function initialLayout(context: ActiveExperienceContext): SectionCode[] {
  const allowed = new Set(SECTIONS.map((item) => item.code));
  const seen = new Set<string>();
  const configured = context.experience.homeLayout
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim() as SectionCode)
    .filter((item) => {
      if (!allowed.has(item) || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  return configured.length ? configured : SECTIONS.map((item) => item.code);
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export default function HostHomeLayoutScreen() {
  const [context, setContext] = useState<ActiveExperienceContext | null>(null);
  const [layout, setLayout] = useState<SectionCode[]>([]);
  const [tagline, setTagline] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getActiveExperienceContext()
      .then(async (nextContext) => {
        if (!active) return;
        setContext(nextContext);
        if (!nextContext) return;
        setLayout(initialLayout(nextContext));
        setTagline(textValue(nextContext.experience.publicSettings.tagline));
        const allowed = await hasOrganizationPermission(nextContext.organization.id, 'organization.settings.manage');
        if (active) setCanManage(allowed);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load Home settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const enabled = useMemo(() => new Set(layout), [layout]);

  function toggle(code: SectionCode, value: boolean) {
    setSaved(null);
    setLayout((current) => {
      if (value) return current.includes(code) ? current : [...current, code];
      return current.filter((item) => item !== code);
    });
  }

  function move(code: SectionCode, direction: -1 | 1) {
    setSaved(null);
    setLayout((current) => {
      const index = current.indexOf(code);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const copy = [...current];
      const sourceValue = copy[index];
      const targetValue = copy[target];
      if (!sourceValue || !targetValue) return current;
      copy[index] = targetValue;
      copy[target] = sourceValue;
      return copy;
    });
  }

  async function save() {
    if (!context || !canManage || saving) return;
    if (!layout.length) {
      setError('Keep at least one Home section enabled.');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const experience = await updateOrganizationExperience(context.experience.id, {
        homeLayout: layout,
        publicSettings: {
          ...context.experience.publicSettings,
          tagline: tagline.trim(),
        },
      });
      setContext({ ...context, experience });
      setSaved('Home settings saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save Home settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator color={COLORS.gold} size="large" /></View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{context?.organization.name.toUpperCase() ?? 'ORGANIZATION'}</Text>
          <Text style={styles.title}>Home Layout</Text>
          <Text style={styles.subtitle}>Choose what the public Home shows and the order members see it.</Text>
        </View>
        <Pressable accessibilityLabel="Go back" style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
      </View>

      {error ? <View style={[styles.notice, styles.noticeError]}><AppIcon name="alert-circle" color={COLORS.red} size={19} /><Text style={styles.noticeErrorText}>{error}</Text></View> : null}
      {saved ? <View style={[styles.notice, styles.noticeSuccess]}><AppIcon name="checkmark" color={COLORS.green} size={19} /><Text style={styles.noticeSuccessText}>{saved}</Text></View> : null}

      {!context ? <View style={styles.notice}><Text style={styles.noticeText}>This organization does not have a Public Experience yet.</Text></View> : <>
        <Text style={styles.sectionLabel}>HOME MESSAGE</Text>
        <View style={styles.panel}>
          <Text style={styles.fieldLabel}>Tagline</Text>
          <TextInput
            value={tagline}
            editable={canManage && !saving}
            onChangeText={(value) => { setTagline(value); setSaved(null); }}
            placeholder={`Discover what is happening across ${context.experience.name}.`}
            placeholderTextColor={COLORS.dim}
            multiline
            style={styles.input}
          />
          <Text style={styles.fieldHelp}>This appears in the generic Community Home hero. Organizations can leave it blank to use the default message.</Text>
        </View>

        <Text style={styles.sectionLabel}>SECTIONS</Text>
        <View style={styles.sectionList}>
          {SECTIONS.map((definition) => {
            const isEnabled = enabled.has(definition.code);
            const position = layout.indexOf(definition.code);
            return <View key={definition.code} style={[styles.sectionCard, !isEnabled && styles.sectionCardDisabled]}>
              <View style={styles.sectionTop}>
                <View style={styles.sectionIcon}><AppIcon name={definition.icon} color={isEnabled ? COLORS.gold : COLORS.dim} size={20} /></View>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>{definition.title}</Text>
                  <Text style={styles.sectionDescription}>{definition.description}</Text>
                </View>
                <Switch
                  value={isEnabled}
                  disabled={!canManage || saving}
                  onValueChange={(value) => toggle(definition.code, value)}
                  trackColor={{ false: '#323A35', true: '#6B5A2F' }}
                  thumbColor={isEnabled ? COLORS.gold : '#A0AAA4'}
                />
              </View>

              {isEnabled ? <View style={styles.orderRow}>
                <Text style={styles.positionText}>Position {position + 1}</Text>
                <View style={styles.orderActions}>
                  <Pressable disabled={!canManage || saving || position <= 0} style={[styles.orderButton, position <= 0 && styles.orderButtonDisabled]} onPress={() => move(definition.code, -1)}><Text style={styles.orderButtonText}>↑ Up</Text></Pressable>
                  <Pressable disabled={!canManage || saving || position === layout.length - 1} style={[styles.orderButton, position === layout.length - 1 && styles.orderButtonDisabled]} onPress={() => move(definition.code, 1)}><Text style={styles.orderButtonText}>↓ Down</Text></Pressable>
                </View>
              </View> : null}
            </View>;
          })}
        </View>

        <Text style={styles.sectionLabel}>CURRENT ORDER</Text>
        <View style={styles.orderPreview}>
          {layout.map((code, index) => {
            const definition = SECTIONS.find((item) => item.code === code);
            return <View key={code} style={styles.previewRow}>
              <View style={styles.previewNumber}><Text style={styles.previewNumberText}>{index + 1}</Text></View>
              <Text style={styles.previewText}>{definition?.title ?? code}</Text>
            </View>;
          })}
        </View>

        {canManage ? <Pressable disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={() => void save()}>
          {saving ? <ActivityIndicator color="#111813" size="small" /> : <AppIcon name="checkmark" color="#111813" size={18} />}
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Home Layout'}</Text>
        </Pressable> : <View style={styles.readOnly}><AppIcon name="privacy" color={COLORS.gold} size={18} /><Text style={styles.readOnlyText}>Your role can view this layout but cannot change organization settings.</Text></View>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 18 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 470 },
  back: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: COLORS.cream, fontSize: 32, lineHeight: 34 },
  notice: { minHeight: 48, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, marginBottom: 12 },
  noticeError: { borderColor: '#6A3A37', backgroundColor: '#241817' },
  noticeSuccess: { borderColor: '#365F41', backgroundColor: '#16241A' },
  noticeText: { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  noticeErrorText: { color: COLORS.red, fontSize: 11, lineHeight: 16, flex: 1 },
  noticeSuccessText: { color: COLORS.green, fontSize: 11, lineHeight: 16, flex: 1 },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 20, marginBottom: 8 },
  panel: { borderRadius: 16, padding: 13, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line },
  fieldLabel: { color: COLORS.cream, fontSize: 11, fontWeight: '900', marginBottom: 7 },
  input: { minHeight: 78, borderRadius: 12, borderWidth: 1, borderColor: '#3B4840', backgroundColor: COLORS.raised, color: COLORS.cream, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, textAlignVertical: 'top' },
  fieldHelp: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14, marginTop: 7 },
  sectionList: { gap: 8 },
  sectionCard: { borderRadius: 15, padding: 12, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line },
  sectionCardDisabled: { opacity: 0.62 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.raised, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900' },
  sectionDescription: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  orderRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  positionText: { color: COLORS.muted, fontSize: 9.5, fontWeight: '800' },
  orderActions: { flexDirection: 'row', gap: 7 },
  orderButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#4A584F', backgroundColor: COLORS.raised, alignItems: 'center', justifyContent: 'center' },
  orderButtonDisabled: { opacity: 0.35 },
  orderButtonText: { color: COLORS.cream, fontSize: 9.5, fontWeight: '900' },
  orderPreview: { borderRadius: 15, padding: 10, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, gap: 6 },
  previewRow: { minHeight: 42, borderRadius: 11, backgroundColor: COLORS.raised, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  previewNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2A2518', alignItems: 'center', justifyContent: 'center' },
  previewNumberText: { color: COLORS.gold, fontSize: 9, fontWeight: '900' },
  previewText: { color: COLORS.cream, fontSize: 11, fontWeight: '800' },
  saveButton: { minHeight: 50, borderRadius: 14, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#111813', fontSize: 12, fontWeight: '900' },
  readOnly: { minHeight: 54, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#211E15', borderWidth: 1, borderColor: '#62552F', marginTop: 22 },
  readOnlyText: { color: COLORS.muted, fontSize: 10, lineHeight: 15, flex: 1 },
});
