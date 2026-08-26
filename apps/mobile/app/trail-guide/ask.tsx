import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { askMemberGuide, findTrailGuidePlace, type MemberGuideResult } from '../../src/trailGuide/assistant';
import { cityKeyFromLocationLabel } from '../../src/trailGuide/catalog';
import { useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery } from '../../src/weather/api';

const QUICK_PROMPTS = [
  'Easy outdoor day near water',
  'Build me a half-day adventure',
  'Something different from what I usually do',
  'Add a verified Black- or brown-owned stop',
];

export default function AskGoScreen() {
  const { locationLabel } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : cityKey === 'tampa' ? 'Tampa' : 'Jacksonville';
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<MemberGuideResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ask(nextQuery = query) {
    const clean = nextQuery.trim();
    if (clean.length < 3) return;
    setQuery(clean);
    setLoading(true);
    setError('');
    try {
      const weather = await getWeatherByQuery(`${cityName}, FL`).catch(() => null);
      const next = await askMemberGuide({
        query: clean,
        cityKey,
        cityName,
        state: 'FL',
        weather: weather ? {
          temperatureF: weather.current.temp_f,
          condition: weather.current.condition.text,
          rainChance: weather.forecast.forecastday[0]?.day.daily_chance_of_rain ?? null,
          windMph: weather.current.wind_mph,
        } : null,
      });
      setResult(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'I could not answer that right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.back}>‹ Trail Guide</Text>
        </Pressable>

        <View style={styles.heroMark}><Text style={styles.spark}>✦</Text></View>
        <Text style={styles.eyebrow}>GO MELANATED GUIDE</Text>
        <Text style={styles.title}>What do you feel like doing?</Text>
        <Text style={styles.subtitle}>Ask naturally. I can help you find a place, build a day, connect the plan to verified community-owned stops, or remember places from your outdoor history.</Text>

        <View style={styles.askCard}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            multiline
            maxLength={2000}
            placeholder={`Try “beginner-friendly water near ${cityName} with a Black-owned food stop after”`}
            placeholderTextColor="#718078"
            style={styles.input}
          />
          <Pressable disabled={loading || query.trim().length < 3} onPress={() => void ask()} style={[styles.askButton, (loading || query.trim().length < 3) && styles.disabled]}>
            {loading ? <ActivityIndicator color="#172017" /> : <><Text style={styles.askButtonText}>Ask Go</Text><Text style={styles.askArrow}>→</Text></>}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRail}>
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable key={prompt} disabled={loading} onPress={() => void ask(prompt)} style={styles.quickChip}>
              <Text style={styles.quickText}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

        {result ? (
          <View style={styles.results}>
            <Text style={styles.answer}>{result.answer}</Text>

            {result.places.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>TRAIL GUIDE PICKS</Text>
                {result.places.map((item) => {
                  const place = findTrailGuidePlace(item.id);
                  if (!place) return null;
                  return (
                    <Pressable key={item.id} onPress={() => router.push(`/trail-guide/${item.id}` as never)} style={styles.resultCard}>
                      <View style={styles.resultIcon}><AppIcon name="trail" color="#D7B45A" size={19} /></View>
                      <View style={styles.flex}>
                        <Text style={styles.resultTitle}>{place.name}</Text>
                        <Text style={styles.resultMeta}>{place.area} · {place.category}</Text>
                        <Text style={styles.resultReason}>{item.reason}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {result.dayPlan.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>YOUR DAY</Text>
                <View style={styles.planCard}>
                  {result.dayPlan.map((step, index) => (
                    <View key={`${step.time}-${step.title}-${index}`} style={styles.planRow}>
                      <Text style={styles.planTime}>{step.time || 'Flexible'}</Text>
                      <View style={styles.flex}>
                        <Text style={styles.planTitle}>{step.title}</Text>
                        <Text style={styles.planNote}>{step.note}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {result.communityStops.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>COMMUNITY-CENTERED STOPS</Text>
                {result.communityStops.map((stop) => (
                  <View key={stop.placeId} style={styles.communityCard}>
                    <Text style={styles.verified}>✓ VERIFIED</Text>
                    <Text style={styles.resultTitle}>{stop.name}</Text>
                    <Text style={styles.tags}>{stop.ownershipTags.join(' · ')}</Text>
                    <Text style={styles.resultReason}>{stop.reason}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.memoryHits.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>FROM YOUR TRAIL</Text>
                {result.memoryHits.map((memory) => (
                  <View key={memory.adventureId} style={styles.memoryCard}>
                    <Text style={styles.resultTitle}>{memory.title}</Text>
                    <Text style={styles.resultMeta}>{new Date(memory.experiencedAt).toLocaleDateString()}</Text>
                    <Text style={styles.resultReason}>{memory.note}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.followUps.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>KEEP GOING</Text>
                <View style={styles.followWrap}>
                  {result.followUps.map((follow) => <Pressable key={follow} onPress={() => void ask(follow)} style={styles.followChip}><Text style={styles.followText}>{follow}</Text></Pressable>)}
                </View>
              </View>
            ) : null}

            <Text style={styles.disclaimer}>Go helps you plan, not certify conditions. Confirm current hours, closures, permits, accessibility, weather, and water conditions before leaving.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 90 },
  backRow: { alignSelf: 'flex-start', marginBottom: 20 },
  back: { color: '#D7B45A', fontSize: 13, fontWeight: '900' },
  heroMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#443616', borderWidth: 1, borderColor: '#8A6A25', alignItems: 'center', justifyContent: 'center' },
  spark: { color: '#F2CF72', fontSize: 22, fontWeight: '900' },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 14 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#A7B0AA', fontSize: 14, lineHeight: 21, marginTop: 8 },
  askCard: { marginTop: 20, backgroundColor: '#131A16', borderWidth: 1, borderColor: '#344039', borderRadius: 18, padding: 12 },
  input: { minHeight: 112, color: '#FFF8E8', fontSize: 15, lineHeight: 21, textAlignVertical: 'top', padding: 5 },
  askButton: { minHeight: 48, backgroundColor: '#D7B45A', borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  askButtonText: { color: '#172017', fontSize: 14, fontWeight: '900' },
  askArrow: { color: '#172017', fontSize: 18, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  quickRail: { gap: 8, paddingVertical: 14, paddingRight: 20 },
  quickChip: { maxWidth: 225, minHeight: 38, borderRadius: 20, borderWidth: 1, borderColor: '#3B4941', backgroundColor: '#151C18', justifyContent: 'center', paddingHorizontal: 13 },
  quickText: { color: '#D7DFD9', fontSize: 11.5, fontWeight: '800' },
  errorCard: { backgroundColor: '#301A18', borderRadius: 12, padding: 12, marginTop: 6 },
  errorText: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  results: { marginTop: 12 },
  answer: { color: '#FFF3CE', fontSize: 18, lineHeight: 27, fontWeight: '800' },
  section: { marginTop: 25 },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9 },
  resultCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3831', backgroundColor: '#151C18', padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  resultIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#262416', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  resultTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  resultMeta: { color: '#8D9891', fontSize: 10.5, marginTop: 3 },
  resultReason: { color: '#AEB7B1', fontSize: 12, lineHeight: 18, marginTop: 7 },
  chevron: { color: '#D7B45A', fontSize: 26 },
  planCard: { borderRadius: 16, borderWidth: 1, borderColor: '#3D3A22', backgroundColor: '#1B1A11', padding: 14 },
  planRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3B3928' },
  planTime: { width: 62, color: '#E7C464', fontSize: 11, fontWeight: '900' },
  planTitle: { color: '#FFF3CE', fontSize: 13, fontWeight: '900' },
  planNote: { color: '#B3AA8F', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  communityCard: { borderRadius: 15, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#11241A', padding: 14, marginBottom: 9 },
  verified: { color: '#79D26A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  tags: { color: '#D7B45A', fontSize: 10.5, fontWeight: '800', marginTop: 4 },
  memoryCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2C3831', backgroundColor: '#151C18', padding: 14, marginBottom: 9 },
  followWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  followChip: { borderRadius: 18, borderWidth: 1, borderColor: '#4A4021', backgroundColor: '#1B1A11', paddingHorizontal: 12, paddingVertical: 9 },
  followText: { color: '#E8D59A', fontSize: 11, fontWeight: '800' },
  disclaimer: { color: '#707C75', fontSize: 10, lineHeight: 15, marginTop: 24, textAlign: 'center' },
});
