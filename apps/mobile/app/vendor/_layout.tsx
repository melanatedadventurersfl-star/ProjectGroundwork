import { router, Slot, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { getVendorAccess } from '../../src/vendor/vendorAccess';

export default function VendorLayout() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const validatedUserRef = useRef<string | null>(null);
  const isApplicationRoute = pathname.startsWith('/vendor/apply');

  useEffect(() => {
    let active = true;
    if (isLoading) return () => { active = false; };

    const userId = session?.user.id ?? null;
    if (!userId) {
      validatedUserRef.current = null;
      setAllowed(false);
      setChecking(false);
      return () => { active = false; };
    }

    if (isApplicationRoute) {
      setAllowed(true);
      setChecking(false);
      setError('');
      return () => { active = false; };
    }

    if (validatedUserRef.current === userId) {
      setAllowed(true);
      setChecking(false);
      return () => { active = false; };
    }

    setChecking(true);
    setAllowed(false);
    setError('');
    void getVendorAccess().then((access) => {
      if (!active) return;
      if (!access.approved) {
        router.replace(`/vendor-login?next=${encodeURIComponent(pathname)}` as never);
        return;
      }
      validatedUserRef.current = userId;
      setAllowed(true);
    }).catch((caught) => {
      if (!active) return;
      console.warn('[vendor-shell] Unable to validate Vendor Center access', caught);
      setError('Vendor Center could not finish checking your access.');
    }).finally(() => { if (active) setChecking(false); });

    return () => { active = false; };
  }, [isApplicationRoute, isLoading, pathname, session?.user.id]);

  function retry() {
    validatedUserRef.current = null;
    setChecking(true);
    setError('');
    setAllowed(false);
    void getVendorAccess().then((access) => {
      if (!access.approved) {
        router.replace(`/vendor-login?next=${encodeURIComponent(pathname)}` as never);
        return;
      }
      validatedUserRef.current = session?.user.id ?? null;
      setAllowed(true);
    }).catch(() => setError('Vendor Center could not finish checking your access.')).finally(() => setChecking(false));
  }

  if (isLoading || checking) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening Vendor Center…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.center}><View style={styles.card}><Text style={styles.eyebrow}>VENDOR CENTER</Text><Text style={styles.title}>We could not open your workspace.</Text><Text style={styles.body}>{error}</Text><Pressable style={styles.primary} onPress={retry}><Text style={styles.primaryText}>Try Again</Text></Pressable><Pressable style={styles.secondary} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.secondaryText}>Member App</Text></Pressable></View></SafeAreaView>;
  if (!allowed) return <View style={styles.blank} />;
  return <View style={styles.shell}><Slot /></View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#0B100D' }, blank: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 20 }, muted: { color: '#8E9A92', fontSize: 10, marginTop: 8 },
  card: { width: '100%', maxWidth: 430, borderRadius: 20, borderWidth: 1, borderColor: '#334039', backgroundColor: '#131B16', padding: 18 }, eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 5 }, body: { color: '#96A198', fontSize: 11, lineHeight: 17, marginTop: 7 }, primary: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 16 }, primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' }, secondary: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3B4840', alignItems: 'center', justifyContent: 'center', marginTop: 9 }, secondaryText: { color: '#D8E0DA', fontSize: 10, fontWeight: '900' },
});
