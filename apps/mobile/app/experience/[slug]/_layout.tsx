import { Slot, router, useLocalSearchParams, usePathname } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../src/auth/AuthProvider';
import {
  experienceLabel,
  experienceModuleEnabled,
} from '../../../src/platform/experience';
import {
  TenantExperienceProvider,
  useTenantExperience,
} from '../../../src/platform/TenantExperienceProvider';
import { AppIcon, type AppIconName } from '../../../src/ui/AppIcon';

type TenantNavItem = {
  code: string;
  label: string;
  icon: AppIconName;
  route: string;
  matches: (path: string) => boolean;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function TenantShell({ slug }: { slug: string }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { context, loading, error } = useTenantExperience();

  if (!session) {
    router.replace({ pathname: '/tenant-sign-in', params: { slug } });
    return null;
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.loadingText}>Opening app…</Text></SafeAreaView>;
  }

  if (error || !context) {
    return <SafeAreaView style={styles.center}><Text style={styles.errorTitle}>App unavailable</Text><Text style={styles.errorText}>{error ?? 'This organization app is unavailable.'}</Text></SafeAreaView>;
  }

  const { experience, modules } = context;
  const brandName = textValue(experience.branding.brand_name, experience.name);
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const primary = textValue(experience.branding.primary, '#0F1713');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const logoUrl = textValue(experience.branding.logo_url, '');

  const navItems: TenantNavItem[] = [
    {
      code: 'home',
      label: experienceLabel(experience, 'home', 'Home'),
      icon: 'trailhead',
      route: `/experience/${slug}`,
      matches: (path) => path === `/experience/${slug}` || path === `/experience/${slug}/`,
    },
    {
      code: 'events',
      label: experienceLabel(experience, 'events', 'Events'),
      icon: 'calendar',
      route: `/experience/${slug}/events`,
      matches: (path) => path.startsWith(`/experience/${slug}/events`),
    },
    {
      code: 'profiles',
      label: experienceLabel(experience, 'member', 'Profile'),
      icon: 'profile',
      route: `/experience/${slug}/profile`,
      matches: (path) => path.startsWith(`/experience/${slug}/profile`),
    },
    {
      code: 'menu',
      label: 'Menu',
      icon: 'menu',
      route: `/experience/${slug}/menu`,
      matches: (path) => path.startsWith(`/experience/${slug}/menu`),
    },
  ].filter((item) => experienceModuleEnabled(modules, item.code, false));

  return <View style={[styles.shell, { backgroundColor: primary }]}>
    <View style={[styles.header, { borderBottomColor: `${accent}35`, backgroundColor: primary, paddingTop: Math.max(insets.top, 10) }]}>
      {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" /> : <View style={[styles.logoFallback, { borderColor: `${accent}88`, backgroundColor: surface }]}><Text style={[styles.logoLetter, { color: accent }]}>{brandName.slice(0, 1).toUpperCase()}</Text></View>}
      <View style={styles.brandCopy}>
        <Text style={[styles.brandName, { color: text }]} numberOfLines={1}>{brandName}</Text>
        <Text style={styles.brandMeta}>Organization app</Text>
      </View>
    </View>

    <View style={styles.content}><Slot /></View>

    <View style={[styles.bottomNav, { borderTopColor: `${accent}35`, backgroundColor: primary, paddingBottom: Math.max(insets.bottom, 7) }]}>
      {navItems.map((item) => {
        const active = item.matches(pathname);
        return <Pressable key={item.code} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={item.label} style={styles.navItem} onPress={() => router.replace(item.route as never)}>
          <AppIcon name={item.icon} color={active ? accent : '#98A69E'} size={22} />
          <Text style={[styles.navLabel, { color: active ? accent : '#98A69E' }]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export default function TenantExperienceLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const safeSlug = typeof slug === 'string' ? slug : '';
  return <TenantExperienceProvider slug={safeSlug}><TenantShell slug={safeSlug} /></TenantExperienceProvider>;
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  loadingText: { color: '#98A69E', fontSize: 12, fontWeight: '700' },
  errorTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  errorText: { color: '#C2CCC5', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 420 },
  header: { minHeight: 70, paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1 },
  logo: { width: 42, height: 42, borderRadius: 12 },
  logoFallback: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 17, fontWeight: '900' },
  brandCopy: { flex: 1 },
  brandName: { fontSize: 16, fontWeight: '900' },
  brandMeta: { color: '#7F8D84', fontSize: 9.5, fontWeight: '700', marginTop: 2 },
  bottomNav: { minHeight: 64, flexDirection: 'row', borderTopWidth: 1, paddingTop: 6, paddingHorizontal: 6 },
  navItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { fontSize: 9.5, fontWeight: '800' },
});
