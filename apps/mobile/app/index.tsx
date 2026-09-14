import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';

function configValue(key: string) {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function DefaultLoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <View style={styles.mark}>
        <Text style={styles.markText}>MA</Text>
      </View>
      <Text style={styles.brand}>MELANATED ADVENTURERS</Text>
      <Text style={styles.tagline}>Find your outside. Find your people.</Text>
      <ActivityIndicator color="#D7B45A" style={styles.spinner} />
    </View>
  );
}

function TenantLoadingScreen({ appName }: { appName: string }) {
  const initials = appName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'APP';
  return (
    <View style={styles.loadingScreen}>
      <View style={styles.mark}>
        <Text style={styles.markText}>{initials}</Text>
      </View>
      <Text style={styles.brand}>{appName.toUpperCase()}</Text>
      <Text style={styles.tagline}>Opening your organization app…</Text>
      <ActivityIndicator color="#D7B45A" style={styles.spinner} />
    </View>
  );
}

export default function IndexScreen() {
  const { session, isLoading } = useAuth();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const tenantPublicSlug = configValue('tenantPublicSlug');
  const tenantAppName = configValue('tenantAppName') || 'Organization';

  useEffect(() => {
    if (tenantPublicSlug) {
      setIsCheckingProfile(false);
      setHasCompletedOnboarding(false);
      return;
    }
    if (!session?.user.id) {
      setIsCheckingProfile(false);
      setHasCompletedOnboarding(false);
      return;
    }

    setIsCheckingProfile(true);
    supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.warn('Unable to check onboarding status', error.message);
        setHasCompletedOnboarding(Boolean(data?.onboarding_completed_at));
        setIsCheckingProfile(false);
      });
  }, [session?.user.id, tenantPublicSlug]);

  if (tenantPublicSlug) {
    if (isLoading) return <TenantLoadingScreen appName={tenantAppName} />;
    if (!session) return <Redirect href={`/tenant-sign-in?slug=${encodeURIComponent(tenantPublicSlug)}` as never} />;
    return <Redirect href={`/experience/${tenantPublicSlug}` as never} />;
  }

  if (isLoading || isCheckingProfile) return <DefaultLoadingScreen />;
  if (!session) return <Redirect href="/(tabs)" />;
  return <Redirect href={hasCompletedOnboarding ? '/(tabs)' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#17211B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mark: {
    minWidth: 126,
    height: 106,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: '#FFF8E8', fontSize: 46, fontWeight: '900', letterSpacing: 3 },
  brand: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.7, marginTop: 24, fontSize: 15, textAlign: 'center' },
  tagline: { color: '#C6CEC8', marginTop: 8, fontSize: 14, textAlign: 'center' },
  spinner: { marginTop: 30 },
});
