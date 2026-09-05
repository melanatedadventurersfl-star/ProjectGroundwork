import { router, Slot, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { getOutingHostAccess } from '../../src/hosting/api';
import { ensureHostCenterProfile } from '../../src/hosting/hostEntry';

const NAV = [
  { label: 'Home', route: '/host', match: (path: string) => path === '/host' || path === '/host/' },
  { label: 'Work', route: '/host/work', match: (path: string) => path.startsWith('/host/work') },
  { label: 'Events', route: '/host/events', match: (path: string) => path.startsWith('/host/events') || path.startsWith('/host/manage') || path.startsWith('/host/build') || path.startsWith('/host/assistant') || path.startsWith('/host/analytics') },
  { label: 'Calendar', route: '/host/calendar', match: (path: string) => path.startsWith('/host/calendar') },
  { label: 'More', route: '/host/more', match: (path: string) => path.startsWith('/host/more') || path.startsWith('/host/vendors') || path.startsWith('/host/teams') || path.startsWith('/host/opportunities') || path.startsWith('/host/directories') || path.startsWith('/host/finances') || path.startsWith('/host/communications') || path.startsWith('/host/inventory') || path.startsWith('/host/library') || path.startsWith('/host/ai-privacy') || path.startsWith('/host/setup') },
];

export default function HostLayout() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const isAccessRoute = pathname.startsWith('/host/apply');
  const isIntroRoute = pathname.startsWith('/host/intro');
  const hideHostNav = isAccessRoute || isIntroRoute || pathname.startsWith('/host/plan-ai') || pathname.startsWith('/host/create');

  useEffect(() => {
    let active = true;
    if (isLoading) return () => { active = false; };
    if (!session?.user.id) {
      setChecking(false);
      setAllowed(false);
      return () => { active = false; };
    }
    if (isAccessRoute) {
      setChecking(false);
      setAllowed(true);
      return () => { active = false; };
    }

    setChecking(true);
    void (async () => {
      try {
        const access = await getOutingHostAccess();
        if (!active) return;
        if (!access.approved) {
          setAllowed(false);
          router.replace(`/host-login?next=${encodeURIComponent(pathname)}` as never);
          return;
        }
        const profile = await ensureHostCenterProfile();
        if (!active) return;
        if (!profile.introCompletedAt && !isIntroRoute) {
          setAllowed(false);
          router.replace(`/host/intro?next=${encodeURIComponent(pathname)}` as never);
          return;
        }
        setAllowed(true);
      } catch (error) {
        console.warn('[host-shell] Unable to validate Host Center access', error);
        if (active) router.replace(`/host-login?next=${encodeURIComponent(pathname)}` as never);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => { active = false; };
  }, [isAccessRoute, isIntroRoute, isLoading, pathname, session?.user.id]);

  if (isLoading || checking) return <SafeAreaView style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Opening Host Center…</Text></SafeAreaView>;
  if (!allowed) return <View style={styles.blank} />;

  return <View style={styles.shell}>
    <View style={styles.content}><Slot /></View>
    {hideHostNav ? null : <HostBottomNav pathname={pathname} />}
  </View>;
}

function HostBottomNav({ pathname }: { pathname: string }) {
  const activeLabel = useMemo(() => NAV.find((item) => item.match(pathname))?.label ?? 'Home', [pathname]);
  return <SafeAreaView edges={['bottom']} style={styles.navSafe}>
    <View style={styles.nav}>
      {NAV.map((item) => {
        const active = item.label === activeLabel;
        return <Pressable key={item.label} accessibilityRole="button" onPress={() => router.replace(item.route as never)} style={styles.navItem}>
          <View style={[styles.navDot, active && styles.navDotActive]} />
          <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#0A0F0C' },
  content: { flex: 1 },
  blank: { flex: 1, backgroundColor: '#0A0F0C' },
  loading: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', gap: 9 },
  loadingText: { color: '#87938B', fontSize: 10 },
  navSafe: { backgroundColor: '#0D1410', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C3931' },
  nav: { minHeight: 58, flexDirection: 'row', alignItems: 'stretch' },
  navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  navDotActive: { backgroundColor: '#D7B45A' },
  navText: { color: '#77847C', fontSize: 9, fontWeight: '800' },
  navTextActive: { color: '#FFF1C8' },
});
