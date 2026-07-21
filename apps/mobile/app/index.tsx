import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';

export default function IndexScreen() {
  const { session, isLoading } = useAuth();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
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

  if (isLoading || isCheckingProfile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href={hasCompletedOnboarding ? '/(tabs)' : '/onboarding'} />;
}
