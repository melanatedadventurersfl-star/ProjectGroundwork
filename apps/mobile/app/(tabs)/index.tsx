import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  getActiveExperienceContext,
  type ActiveExperienceContext,
} from '../../src/platform/experience';
import CommunityHome from './community-home';
import OutdoorHome from './outdoor-home';

export default function MemberHomeScreen() {
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
        console.warn('[experience] Unable to resolve member home variant', caught);
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
      <Text style={styles.loadingText}>Loading your community…</Text>
    </View>;
  }

  if (!context) return <OutdoorHome />;

  const configuredVariant = context.experience.navigation.home_variant;
  const homeVariant = typeof configuredVariant === 'string' ? configuredVariant : 'community';

  if (homeVariant === 'outdoor_adventure') return <OutdoorHome />;
  return <CommunityHome context={context} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9AA79F', fontSize: 11.5, fontWeight: '700' },
});
