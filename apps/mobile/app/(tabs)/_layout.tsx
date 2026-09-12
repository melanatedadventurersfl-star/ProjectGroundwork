import { Redirect, Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '../../src/auth/AuthProvider';
import {
  experienceLabel,
  experienceModuleEnabled,
  getActiveExperienceContext,
  type ActiveExperienceContext,
} from '../../src/platform/experience';

export default function TabLayout() {
  const { session, isLoading } = useAuth();
  const [experienceContext, setExperienceContext] = useState<ActiveExperienceContext | null>(null);

  useFocusEffect(useCallback(() => {
    if (!session?.user.id) {
      setExperienceContext(null);
      return undefined;
    }

    let active = true;
    void getActiveExperienceContext()
      .then((context) => {
        if (active) setExperienceContext(context);
      })
      .catch((caught) => {
        console.warn('[experience] Unable to load member navigation configuration', caught);
      });

    return () => { active = false; };
  }, [session?.user.id]));

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const homeTitle = experienceContext
    ? experienceLabel(experienceContext.experience, 'home', 'Trailhead')
    : 'Trailhead';
  const eventsTitle = experienceContext
    ? experienceLabel(experienceContext.experience, 'events', 'Explore')
    : 'Explore';
  const communityTitle = experienceContext
    ? experienceLabel(experienceContext.experience, 'community', 'Outpost')
    : 'Outpost';
  const journeyTitle = experienceContext
    ? experienceLabel(experienceContext.experience, 'journey', 'Passport')
    : 'Passport';
  const eventsEnabled = experienceContext
    ? experienceModuleEnabled(experienceContext.modules, 'events')
    : true;
  const communityEnabled = experienceContext
    ? experienceModuleEnabled(experienceContext.modules, 'community')
    : true;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: homeTitle }} />
      <Tabs.Screen name="explore" options={{ title: eventsTitle, href: eventsEnabled ? undefined : null }} />
      <Tabs.Screen name="community" options={{ title: communityTitle, href: communityEnabled ? undefined : null }} />
      <Tabs.Screen name="passport" options={{ title: journeyTitle, href: null }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen name="community-home" options={{ href: null }} />
      <Tabs.Screen name="outdoor-home" options={{ href: null }} />
    </Tabs>
  );
}
