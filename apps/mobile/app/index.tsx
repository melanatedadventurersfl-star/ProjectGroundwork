import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';

function BrandedLoadingScreen() {
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

export default function IndexScreen() {
  const { session, isLoading } = useAuth();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
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
  }, [session?.user.id]);

  if (isLoading || isCheckingProfile) return <BrandedLoadingScreen />;
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
    width: 126,
    height: 106,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: '#FFF8E8', fontSize: 46, fontWeight: '900', letterSpacing: 3 },
  brand: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.7, marginTop: 24, fontSize: 15 },
  tagline: { color: '#C6CEC8', marginTop: 8, fontSize: 14 },
  spinner: { marginTop: 30 },
});
