import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById } from '../../../src/hosting/api';
import { createCampaignWorkspace } from '../../../src/hosting/creation';
import { getCampaignForAdventure } from '../../../src/hosting/eventBuilder';

export default function LegacyManageEventRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!id) return;
      try {
        let campaign = await getCampaignForAdventure(id);
        if (!campaign) {
          const event = await getHostOutingById(id);
          await createCampaignWorkspace({
            adventureId: event.id,
            title: event.title,
            location: [event.venue_name, event.city, event.state].filter(Boolean).join(', ') || 'Location needed',
            startsAt: event.starts_at,
            endsAt: event.ends_at,
          });
          campaign = await getCampaignForAdventure(id);
        }
        if (!campaign) throw new Error('The event workspace is unavailable.');
        if (active) router.replace(`/host/campaigns/${campaign.slug}` as never);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to open this event.');
      }
    })();

    return () => { active = false; };
  }, [id]);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.center}>
      {!error ? <><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening Event Command Center…</Text></> : <>
        <Text style={styles.title}>Event unavailable</Text>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/host/events' as never)}><Text style={styles.buttonText}>Back to Events</Text></Pressable>
      </>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  title: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' },
  muted: { color: '#8D9891', fontSize: 11 },
  error: { color: '#F0A097', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  button: { marginTop: 8, minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#172017', fontSize: 11, fontWeight: '900' },
});
