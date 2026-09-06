import { router, Slot, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { getOutingHostAccess } from '../../src/hosting/api';
import { ensureHostCenterProfile, getHostCenterProfile } from '../../src/hosting/hostEntry';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type HostNavItem = {
  label: string;
  icon: AppIconName;
  route: string;
  match: (path: string) => boolean;
};

const NAV: HostNavItem[] = [
  { label: 'Home', icon: 'dashboard', route: '/host', match: (path: string) => path === '/host' || path === '/host/' },
  { label: 'Work', icon: 'tasks', route: '/host/work', match: (path: string) => path.startsWith('/host/work') },
  { label: 'Events', icon: 'trips', route: '/host/events', match: (path: string) => path.startsWith('/host/events') || path.startsWith('/host/manage') || path.startsWith('/host/build') || path.startsWith('/host/assistant') || path.startsWith('/host/analytics') },
  { label: 'Calendar', icon: 'calendar', route: '/host/calendar', match: (path: string) => path.startsWith('/host/calendar') },
  { label: 'More', icon: 'more', route: '/host/more', match: (path: string) => path.startsWith('/host/more') || path.startsWith('/host/vendors') || path.startsWith('/host/teams') || path.startsWith('/host/opportunities') || path.startsWith('/host/directories') || path.startsWith('/host/finances') || path.startsWith('/host/communications') || path.startsWith('/host/inventory') || path.startsWith('/host/library') || path.startsWith('/host/ai-privacy') || path.startsWith('/host/setup') },
];

export default function HostLayout() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const validatedUserRef = useRef<string | null>(null);

  const isAccessRoute = pathname.startsWith('/host/apply');
  const isIntroRoute = pathname.startsWith('/host/intro');
  const desktopWeb = Platform.OS === 'web' && width >= 1024;
  const hideHostNav = desktopWeb || isAccessRoute || isIntroRoute || pathname.startsWith('/host/plan-ai') || pathname.startsWith('/host/create');

  useEffect(() => {
    let active = true;
    if (isLoading) return () => { active = false; };

    const userId = session?.user.id ?? null;
    if (!userId) {
      validatedUserRef.current = null;
      setValidationError('');
      setChecking(false);
      setAllowed(false);
      return () => { active = false; };
    }

    if (isAccessRoute) {
      setValidationError('');
      setChecking(false);
      setAllowed(true);
      return () => { active = false; };
    }

    if (validatedUserRef.current === userId) {
      setValidationError('');
      setChecking(false);
      setAllowed(true);
      return () => { active = false; };
    }

    setChecking(true);
    setAllowed(false);
    setValidationError('');

    void (async () => {
      try {
        const access = await getOutingHostAccess();
        if (!active) return;
        if (!access.approved) {
          router.replace(`/host-login?next=${encodeURIComponent(pathname)}` as never);
          return;
        }

        let profile = await getHostCenterProfile();
        if (!active) return;
        if (!profile) profile = await ensureHostCenterProfile();
        if (!active) return;

        validatedUserRef.current = userId;

        if (!profile.introCompletedAt && !isIntroRoute) {
          router.replace(`/host/intro?next=${encodeURIComponent(pathname)}` as never);
          return;
        }

        setAllowed(true);
      } catch (error) {
        console.warn('[host-shell] Unable to validate Host Center access', error);
        if (!active) return;
        setValidationError('Host Center could not finish checking your access.');
        setAllowed(false);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => { active = false; };
  }, [isAccessRoute, isIntroRoute, isLoading, pathname, retryNonce, session?.user.id]);

  function retryValidation() {
    validatedUserRef.current = null;
    setValidationError('');
    setRetryNonce((value) => value + 1);
  }

  if (isLoading || checking) return <SafeAreaView style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Opening Host Center…</Text></SafeAreaView>;

  if (validationError) return <SafeAreaView style={styles.errorSafe}>
    <View style={styles.errorCard}>
      <Text style={styles.errorEyebrow}>HOST CENTER</Text>
      <Text style={styles.errorTitle}>We could not open your workspace.</Text>
      <Text style={styles.errorBody}>{validationError} Try the check again. If your session expired, return to Host sign in.</Text>
      <Pressable style={styles.retryButton} onPress={retryValidation}><Text style={styles.retryButtonText}>Try Again</Text></Pressable>
      <Pressable style={styles.signInButton} onPress={() => router.replace(`/host-login?next=${encodeURIComponent(pathname)}` as never)}><Text style={styles.signInButtonText}>Host Sign In</Text></Pressable>
    </View>
  </SafeAreaView>;

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
        return <Pressable
          key={item.label}
          accessibilityRole="button"
          accessibilityLabel={`${item.label} tab`}
          accessibilityState={{ selected: active }}
          onPress={() => router.replace(item.route as never)}
          style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.navItemPressed]}
        >
          <AppIcon name={item.icon} color={active ? '#D7B45A' : '#77847C'} size={20} />
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
  errorSafe: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorCard: { width: '100%', maxWidth: 430, borderRadius: 20, borderWidth: 1, borderColor: '#334039', backgroundColor: '#131B16', padding: 18 },
  errorEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  errorTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 5 },
  errorBody: { color: '#96A198', fontSize: 11, lineHeight: 17, marginTop: 7 },
  retryButton: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  retryButtonText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  signInButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3B4840', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  signInButtonText: { color: '#D8E0DA', fontSize: 10, fontWeight: '900' },
  navSafe: { backgroundColor: '#0D1410', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C3931' },
  nav: { width: '100%', maxWidth: 620, minHeight: 66, alignSelf: 'center', flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 6, paddingTop: 5 },
  navItem: { flex: 1, minHeight: 56, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navItemActive: { backgroundColor: '#172219' },
  navItemPressed: { opacity: 0.78 },
  navText: { color: '#77847C', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  navTextActive: { color: '#FFF1C8', fontWeight: '900' },
});
