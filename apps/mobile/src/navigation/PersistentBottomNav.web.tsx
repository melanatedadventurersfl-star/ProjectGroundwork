import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { HOST_WORKSPACE_GROUPS, HOST_WORKSPACE_ITEMS } from '../hosting/hostWorkspace';
import { supabase } from '../lib/supabase';
import { AppIcon, type AppIconName } from '../ui/AppIcon';

type NavItem = { label: string; icon: AppIconName; href: string; isActive: (pathname: string) => boolean };

const primaryItems: NavItem[] = [
  { label: 'Trailhead', icon: 'trailhead', href: '/(tabs)', isActive: (pathname) => pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/' },
  { label: 'Explore', icon: 'explore', href: '/(tabs)/explore', isActive: (pathname) => pathname.includes('/explore') || pathname.startsWith('/adventures') },
  { label: 'Outpost', icon: 'community', href: '/(tabs)/community', isActive: (pathname) => pathname.includes('/community') || pathname.startsWith('/connections') || pathname.startsWith('/local-events') },
  { label: 'Trail Guide', icon: 'guide', href: '/trail-guide', isActive: (pathname) => pathname.startsWith('/trail-guide') },
  { label: 'Profile', icon: 'profile', href: '/member/profile', isActive: (pathname) => pathname.startsWith('/member') || pathname.startsWith('/passport') },
];

function NavButton({ item, pathname, compact = false }: { item: NavItem; pathname: string; compact?: boolean }) {
  const active = item.isActive(pathname);
  return <Pressable accessibilityRole="link" accessibilityState={{ selected: active }} onPress={() => router.navigate(item.href as never)} style={({ pressed }) => [compact ? styles.compactItem : styles.sideItem, active && styles.sideItemActive, pressed && styles.pressed]}>
    <AppIcon name={item.icon} color={active ? '#D7B45A' : '#E7DFCF'} size={compact ? 22 : 19} />
    <Text style={[compact ? styles.compactLabel : styles.sideLabel, active && styles.activeLabel]}>{item.label}</Text>
  </Pressable>;
}

function HostSidebar({ pathname, isPlatformAdmin }: { pathname: string; isPlatformAdmin: boolean }) {
  return <View style={styles.sidebar}>
    <View style={styles.hostBrandBlock}>
      <Text style={styles.hostEyebrow}>GO MELANATED</Text>
      <Text style={styles.hostTitle}>Host Center</Text>
      <Text style={styles.brandTag}>Events and organization operations.</Text>
    </View>
    <ScrollView style={styles.hostScroll} contentContainerStyle={styles.hostScrollContent} showsVerticalScrollIndicator={false}>
      <NavButton pathname={pathname} item={{ label: 'Overview', icon: 'dashboard', href: '/host', isActive: (path) => path === '/host' || path === '/host/' }} />
      {HOST_WORKSPACE_GROUPS.map((group) => <View key={group}>
        <Text style={styles.sectionLabel}>{group}</Text>
        <View style={styles.navGroup}>
          {HOST_WORKSPACE_ITEMS.filter((item) => item.group === group).map((item) => <NavButton key={item.key} pathname={pathname} item={{ label: item.title, icon: item.icon, href: item.route, isActive: (path) => path.startsWith(item.route) }} />)}
        </View>
      </View>)}
      <View style={styles.divider} />
      <NavButton pathname={pathname} item={{ label: 'Back to Member App', icon: 'chevron-back', href: '/(tabs)', isActive: () => false }} />
      {isPlatformAdmin ? <NavButton pathname={pathname} item={{ label: 'Admin', icon: 'profile', href: '/admin', isActive: (path) => path.startsWith('/admin') }} /> : null}
    </ScrollView>
  </View>;
}

export function PersistentBottomNav() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const inHostCenter = pathname.startsWith('/host');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (!inHostCenter) return;
    let active = true;
    void supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (active) setIsPlatformAdmin(!error && data === true);
    });
    return () => { active = false; };
  }, [inHostCenter]);

  if (pathname === '/account-status') return null;
  if (desktop && inHostCenter) return <HostSidebar pathname={pathname} isPlatformAdmin={isPlatformAdmin} />;
  if (!desktop && inHostCenter) return null;
  if (!desktop) return <View style={styles.bottomBar}>{primaryItems.map((item) => <NavButton key={item.label} item={item} pathname={pathname} compact />)}</View>;

  return <View style={styles.sidebar}>
    <View style={styles.brandBlock}><Text style={styles.brandGo}>GO</Text><Text style={styles.brandMelanated}>MELANATED</Text><Text style={styles.brandTag}>Your outdoor life, in one place.</Text></View>
    <View style={styles.navGroup}>{primaryItems.map((item) => <NavButton key={item.label} item={item} pathname={pathname} />)}</View>
    <View style={styles.divider} />
    <Text style={styles.sectionLabel}>OPERATIONS</Text>
    <View style={styles.navGroup}><NavButton item={{ label: 'Host Center', icon: 'community', href: '/host', isActive: (path) => path.startsWith('/host') }} pathname={pathname} /></View>
    <View style={styles.desktopFooter}><Text style={styles.desktopFooterText}>Go Melanated Web</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 248, zIndex: 50, backgroundColor: '#111A15', borderRightWidth: 1, borderRightColor: '#26332B', paddingHorizontal: 14, paddingTop: 22, paddingBottom: 14 },
  brandBlock: { paddingHorizontal: 10, paddingBottom: 22 }, hostBrandBlock: { paddingHorizontal: 10, paddingBottom: 14 },
  brandGo: { color: '#D7B45A', fontSize: 28, lineHeight: 30, fontWeight: '900', letterSpacing: 1.5 }, brandMelanated: { color: '#F1E8D7', fontSize: 14, fontWeight: '900', letterSpacing: 2.1 },
  hostEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, hostTitle: { color: '#F1E8D7', fontSize: 25, fontWeight: '900', marginTop: 2 }, brandTag: { marginTop: 6, color: '#9DA99F', fontSize: 10.5, lineHeight: 15 },
  hostScroll: { flex: 1 }, hostScrollContent: { paddingBottom: 18 }, navGroup: { gap: 3 },
  sideItem: { minHeight: 40, borderRadius: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, sideItemActive: { backgroundColor: '#1D2A22' }, sideLabel: { color: '#E7DFCF', fontSize: 12.5, fontWeight: '700', flexShrink: 1 }, activeLabel: { color: '#D7B45A' }, pressed: { opacity: 0.82 },
  divider: { height: 1, backgroundColor: '#26332B', marginVertical: 14 }, sectionLabel: { color: '#78857C', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, paddingHorizontal: 10, marginTop: 15, marginBottom: 5 },
  desktopFooter: { marginTop: 'auto', paddingHorizontal: 10 }, desktopFooterText: { color: '#66736B', fontSize: 10, fontWeight: '700' },
  bottomBar: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#121B16', borderTopWidth: 1, borderTopColor: '#26332B', paddingHorizontal: 6, paddingVertical: 6 }, compactItem: { flex: 1, minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3 }, compactLabel: { color: '#E7DFCF', fontSize: 10, fontWeight: '700' },
});
