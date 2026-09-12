import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  getActiveExperienceContext,
  type ActiveExperienceContext,
} from '../../src/platform/experience';
import CommunityExplore from './community-explore';
import OutdoorExplore from './outdoor-explore';

export default function ExploreScreen() {
  const [context, setContext] = useState<ActiveExperienceContext | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);

    void getActiveExperienceContext()
      .then((nextContext) => {
        if (active) setContext(nextContext);
      })
      .catch((caught) => {
        console.warn('[experience] Unable to resolve event discovery variant', caught);
        if (active) setContext(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []));

  if (loading) {
    return <View style={styles.loading}>
      <ActivityIndicator color="#D7B45A" size="large" />
      <Text style={styles.loadingText}>Loading events…</Text>
    </View>;
  }

  if (!context) return <OutdoorExplore />;

  const configuredEventsVariant = context.experience.navigation.events_variant;
  const configuredHomeVariant = context.experience.navigation.home_variant;
  const eventsVariant = typeof configuredEventsVariant === 'string'
    ? configuredEventsVariant
    : configuredHomeVariant === 'outdoor_adventure'
      ? 'outdoor_adventure'
      : 'community';

  if (eventsVariant === 'outdoor_adventure') return <OutdoorExplore />;
  return <CommunityExplore context={context} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9AA79F', fontSize: 11.5, fontWeight: '700' },
});
