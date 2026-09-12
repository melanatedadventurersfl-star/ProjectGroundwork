import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getActiveExperienceContext, type ActiveExperienceContext } from '../../src/platform/experience';
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

export default function HostExperienceScreen() {
  const [context, setContext] = useState<ActiveExperienceContext | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void getActiveExperienceContext()
      .then(async (nextContext) => {
        if (!mounted) return;
        setContext(nextContext);
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
    () => context?.modules.filter((module) => module.enabled) ?? [],
    [context],
  );

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
          <Text style={styles.subtitle}>The reusable member-facing product this organization publishes into.</Text>
        </View>
        <Text accessibilityRole="button" accessibilityLabel="Go back" style={styles.back} onPress={() => router.back()}>‹</Text>
      </View>

      {error ? <View style={[styles.notice, styles.noticeError]}>
        <AppIcon name="alert-circle" color={COLORS.red} size={20} />
        <Text style={styles.noticeErrorText}>{error}</Text>
      </View> : null}

      {!context && !error ? <View style={styles.notice}>
        <AppIcon name="warning" color={COLORS.gold} size={20} />
        <Text style={styles.noticeText}>This organization does not have a public experience configured yet.</Text>
      </View> : null}

      {context ? <>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>{context.experience.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.heroName}>{context.experience.name}</Text>
              <Text style={styles.heroMeta}>{context.experience.blueprintCode} blueprint · {context.experience.status}</Text>
            </View>
            <View style={[styles.statusPill, context.experience.status === 'active' && styles.statusPillActive]}>
              <Text style={styles.statusText}>{context.experience.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.brandRow}>
            <BrandColor label="Primary" value={context.experience.branding.primary} />
            <BrandColor label="Accent" value={context.experience.branding.accent} />
            <BrandColor label="Surface" value={context.experience.branding.surface} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>PRODUCT LANGUAGE</Text>
        <View style={styles.panel}>
          {Object.entries(context.experience.terminology).map(([key, value], index) => (
            typeof value === 'string' ? <View key={key} style={[styles.termRow, index > 0 && styles.divider]}>
              <Text style={styles.termKey}>{key.replaceAll('_', ' ')}</Text>
              <Text style={styles.termValue}>{value}</Text>
            </View> : null
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelInline}>ENABLED MODULES</Text>
          <Text style={styles.countText}>{enabledModules.length}</Text>
        </View>
        <View style={styles.moduleGrid}>
          {enabledModules.map((module) => <View key={module.code} style={styles.moduleCard}>
            <View style={styles.moduleIcon}><AppIcon name="checkmark" color={COLORS.green} size={18} /></View>
            <Text style={styles.moduleLabel}>{module.label}</Text>
            <Text style={styles.moduleCode}>{module.code}</Text>
          </View>)}
        </View>

        <Text style={styles.sectionLabel}>PUBLISHING TARGET</Text>
        <View style={styles.panel}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Public slug</Text>
            <Text style={styles.detailValue}>{context.experience.publicSlug}</Text>
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
            <Text style={styles.foundationTitle}>Reusable experience foundation active</Text>
            <Text style={styles.foundationBody}>Branding, terminology, navigation, modules and event publishing now have organization-owned configuration instead of relying on Go Melanated as the platform default.</Text>
            <Text style={styles.foundationMeta}>{canManage ? 'Your role can manage this configuration.' : 'Your role can view this configuration.'}</Text>
          </View>
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
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
  back: { width: 44, height: 44, lineHeight: 38, borderRadius: 13, textAlign: 'center', color: COLORS.cream, fontSize: 34, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 13, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line },
  noticeError: { borderColor: '#6A3A37', backgroundColor: '#241817' },
  noticeText: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  noticeErrorText: { flex: 1, color: COLORS.red, fontSize: 11, lineHeight: 16 },
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
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  sectionLabelInline: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  countText: { color: COLORS.dim, fontSize: 9, fontWeight: '800' },
  panel: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  termRow: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  termKey: { color: COLORS.dim, fontSize: 10, textTransform: 'capitalize' },
  termValue: { color: COLORS.cream, fontSize: 11, fontWeight: '800' },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleCard: { minWidth: 145, flexGrow: 1, flexBasis: 145, borderRadius: 14, padding: 12, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line },
  moduleIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#1B2A20', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
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
