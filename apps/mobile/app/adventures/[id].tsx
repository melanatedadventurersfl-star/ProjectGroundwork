import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAdventure, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureDetail } from '../../src/adventures/types';

export default function AdventureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [adventure, setAdventure] = useState<AdventureDetail | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) return;

    getAdventure(id)
      .then((result) => {
        if (active) setAdventure(result);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load adventure.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function toggleSaved() {
    if (!adventure) return;
    const next = !saved;
    setSaved(next);
    try {
      await setAdventureSaved(adventure.id, next);
    } catch (caught) {
      setSaved(!next);
      setError(caught instanceof Error ? caught.message : 'Unable to update saved adventure.');
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;
  }

  if (!adventure || error) {
    return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Adventure not found.'}</Text></SafeAreaView>;
  }

  const start = new Date(adventure.starts_at);
  const end = new Date(adventure.ends_at);
  const price = adventure.starting_price_cents === 0 ? 'Free' : `From $${(adventure.starting_price_cents / 100).toFixed(0)}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.category}>{adventure.category}</Text>
        <Text style={styles.title}>{adventure.title}</Text>
        <Text style={styles.summary}>{adventure.summary}</Text>

        <View style={styles.panel}>
          <Text style={styles.label}>When</Text>
          <Text style={styles.value}>{start.toLocaleString()} to {end.toLocaleString()}</Text>
          <Text style={styles.label}>Where</Text>
          <Text style={styles.value}>{adventure.venue_name ? `${adventure.venue_name}, ` : ''}{adventure.city}, {adventure.state}</Text>
          <Text style={styles.label}>Difficulty</Text>
          <Text style={styles.value}>{adventure.difficulty}</Text>
          <Text style={styles.label}>Starting price</Text>
          <Text style={styles.value}>{price}</Text>
          {adventure.spots_remaining !== null ? <Text style={styles.value}>{adventure.spots_remaining} spots remaining</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>About this adventure</Text>
        <Text style={styles.body}>{adventure.description}</Text>

        {adventure.meeting_instructions ? (
          <>
            <Text style={styles.sectionTitle}>Meeting information</Text>
            <Text style={styles.body}>{adventure.meeting_instructions}</Text>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => void toggleSaved()}>
            <Text style={styles.secondaryButtonText}>{saved ? 'Saved' : 'Save adventure'}</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, adventure.status === 'sold_out' && styles.disabledButton]}
            disabled={adventure.status === 'sold_out'}
            onPress={() => router.push(`/checkout/${adventure.id}`)}
          >
            <Text style={styles.primaryButtonText}>{adventure.status === 'sold_out' ? 'Sold out' : 'Choose tickets'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 22, paddingBottom: 48, gap: 14 },
  category: { color: '#d3a94f', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { color: '#fff8e8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  summary: { color: '#d4d8d5', fontSize: 18, lineHeight: 27 },
  panel: { backgroundColor: '#17211c', borderRadius: 18, padding: 18, gap: 5 },
  label: { color: '#d3a94f', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 8 },
  value: { color: '#fff8e8', fontSize: 16, textTransform: 'capitalize' },
  sectionTitle: { color: '#fff8e8', fontSize: 23, fontWeight: '900', marginTop: 8 },
  body: { color: '#d4d8d5', fontSize: 16, lineHeight: 25 },
  actions: { gap: 10, marginTop: 12 },
  primaryButton: { backgroundColor: '#d3a94f', borderRadius: 14, padding: 15, alignItems: 'center' },
  primaryButtonText: { color: '#17211c', fontWeight: '900', fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: '#f2ead8', borderRadius: 14, padding: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#f2ead8', fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  error: { color: '#ffb4a9', textAlign: 'center' },
});