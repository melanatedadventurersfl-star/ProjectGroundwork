import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  askMemberGuide,
  findTrailGuidePlace,
  type MemberGuideConversationTurn,
  type MemberGuideResult,
} from '../../src/trailGuide/assistant';
import { cityKeyFromLocationLabel } from '../../src/trailGuide/catalog';
import { useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery } from '../../src/weather/api';

const QUICK_PROMPTS = [
  'Easy day near water',
  'Build me a half-day adventure',
  'What did I do last summer?',
  'Find a verified community-owned food stop',
];

const MEMORY_INTENT = /\b(remember|history|my trail|last time|went|visited|camped|hiked|before|past|last summer)\b/i;

type Exchange = {
  id: string;
  query: string;
  result: MemberGuideResult | null;
  error: string;
  loading: boolean;
};

function exchangeConversation(exchanges: Exchange[]): MemberGuideConversationTurn[] {
  return exchanges.flatMap((exchange) => {
    const turns: MemberGuideConversationTurn[] = [{ role: 'user', text: exchange.query }];
    if (exchange.result?.answer) turns.push({ role: 'assistant', text: exchange.result.answer });
    return turns;
  });
}

export default function AskGoScreen() {
  const { locationLabel } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : cityKey === 'tampa' ? 'Tampa' : 'Jacksonville';
  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const busy = exchanges.some((exchange) => exchange.loading);
  const latest = exchanges[exchanges.length - 1] ?? null;
  const starterPrompts = useMemo(() => QUICK_PROMPTS.slice(0, 4), []);

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  async function ask(nextQuery = query) {
    const clean = nextQuery.trim();
    if (clean.length < 3 || busy) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const history = exchangeConversation(exchanges).slice(-6);
    setQuery('');
    setExchanges((previous) => [...previous, { id, query: clean, result: null, error: '', loading: true }]);
    scrollToBottom();

    try {
      const weather = await getWeatherByQuery(`${cityName}, FL`).catch(() => null);
      const result = await askMemberGuide({
        query: clean,
        cityKey,
        cityName,
        state: 'FL',
        conversation: history,
        weather: weather ? {
          temperatureF: weather.current.temp_f,
          condition: weather.current.condition.text,
          rainChance: weather.forecast.forecastday[0]?.day.daily_chance_of_rain ?? null,
          windMph: weather.current.wind_mph,
        } : null,
      });
      setExchanges((previous) => previous.map((exchange) => exchange.id === id ? { ...exchange, result, loading: false } : exchange));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'I could not answer that right now.';
      setExchanges((previous) => previous.map((exchange) => exchange.id === id ? { ...exchange, error: message, loading: false } : exchange));
    } finally {
      scrollToBottom();
    }
  }

  function renderResult(exchange: Exchange) {
    const result = exchange.result;
    if (!result) return null;
    const wantsMemory = MEMORY_INTENT.test(exchange.query);

    return (
      <View style={styles.goTurn}>
        <View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View>
        <View style={styles.goContent}>
          <View style={styles.goBubble}>
            <Text style={styles.goAnswer}>{result.answer}</Text>
          </View>

          {result.source === 'fallback' ? (
            <View style={styles.limitedCard}>
              <AppIcon name="about" color="#D7B45A" size={15} />
              <Text style={styles.limitedText}>I’m using simpler Trail Guide matching right now. You can still open a place or keep refining your request.</Text>
            </View>
          ) : null}

          {result.places.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRail}>
              {result.places.map((item, index) => {
                const place = findTrailGuidePlace(item.id);
                if (!place) return null;
                return (
                  <Pressable key={item.id} onPress={() => router.push(`/trail-guide/${item.id}` as never)} style={styles.placeCard}>
                    <View style={styles.matchRow}>
                      {index === 0 ? <Text style={styles.bestMatch}>BEST MATCH</Text> : <Text style={styles.pickLabel}>TRAIL GUIDE PICK</Text>}
                      <Text style={styles.chevron}>›</Text>
                    </View>
                    <Text style={styles.placeTitle}>{place.name}</Text>
                    <Text style={styles.placeMeta}>{place.area} · {place.category}</Text>
                    <Text style={styles.placeReason}>{item.reason}</Text>
                    <View style={styles.openRow}>
                      <AppIcon name="trail" color="#D7B45A" size={15} />
                      <Text style={styles.openText}>Open details</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {result.communityStops.length > 0 ? (
            <View style={styles.stackGap}>
              {result.communityStops.map((stop) => (
                <View key={stop.placeId} style={styles.communityCard}>
                  <View style={styles.communityTopRow}>
                    <Text style={styles.communityLabel}>COMMUNITY STOP</Text>
                    <Text style={styles.verified}>✓ VERIFIED</Text>
                  </View>
                  <Text style={styles.placeTitle}>{stop.name}</Text>
                  <Text style={styles.tags}>{stop.ownershipTags.join(' · ')}</Text>
                  <Text style={styles.placeReason}>{stop.reason}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {result.dayPlan.length > 0 ? (
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planHeaderText}>Your plan</Text>
                <AppIcon name="calendar" color="#D7B45A" size={17} />
              </View>
              {result.dayPlan.map((step, index) => (
                <View key={`${step.time}-${step.title}-${index}`} style={styles.planRow}>
                  <View style={styles.timeline}>
                    <View style={styles.timelineDot} />
                    {index < result.dayPlan.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.planTime}>{step.time || 'Flexible'}</Text>
                    <Text style={styles.planTitle}>{step.title}</Text>
                    <Text style={styles.planNote}>{step.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {wantsMemory && result.memoryHits.length > 0 ? (
            <View style={styles.stackGap}>
              {result.memoryHits.map((memory) => (
                <View key={memory.adventureId} style={styles.memoryCard}>
                  <Text style={styles.memoryLabel}>FROM YOUR TRAIL</Text>
                  <Text style={styles.placeTitle}>{memory.title}</Text>
                  <Text style={styles.placeMeta}>{new Date(memory.experiencedAt).toLocaleDateString()}</Text>
                  <Text style={styles.placeReason}>{memory.note}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {result.followUps.length > 0 ? (
            <View style={styles.followWrap}>
              {result.followUps.map((follow) => (
                <Pressable key={follow} disabled={busy} onPress={() => void ask(follow)} style={styles.followChip}>
                  <Text style={styles.followText}>{follow}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={10}>
          <AppIcon name="chevron-back" color="#FFF8E8" size={22} />
        </Pressable>
        <View style={styles.headerIdentity}>
          <View style={styles.headerSpark}><Text style={styles.headerSparkText}>✦</Text></View>
          <View>
            <Text style={styles.headerTitle}>Ask Go</Text>
            <Text style={styles.headerSubtitle}>Your outdoor guide</Text>
          </View>
        </View>
        <View style={styles.headerButton}><AppIcon name="time" color="#9BA69F" size={20} /></View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {exchanges.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.goTurn}>
              <View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View>
              <View style={styles.goContent}>
                <View style={styles.goBubble}>
                  <Text style={styles.greeting}>Hey TrailMate! 👋</Text>
                  <Text style={styles.goAnswer}>I’m Go. Tell me what kind of adventure you’re in the mood for and we can shape it together.</Text>
                </View>
              </View>
            </View>

            <Text style={styles.starterLabel}>TRY ONE OF THESE</Text>
            <View style={styles.starterWrap}>
              {starterPrompts.map((prompt) => (
                <Pressable key={prompt} onPress={() => void ask(prompt)} style={styles.starterChip}>
                  <Text style={styles.starterText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {exchanges.map((exchange) => (
          <View key={exchange.id} style={styles.exchange}>
            <View style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{exchange.query}</Text>
              </View>
            </View>

            {exchange.loading ? (
              <View style={styles.goTurn}>
                <View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator color="#D7B45A" size="small" />
                  <Text style={styles.typingText}>Thinking through your adventure…</Text>
                </View>
              </View>
            ) : null}

            {exchange.error ? (
              <View style={styles.goTurn}>
                <View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View>
                <View style={styles.errorBubble}>
                  <Text style={styles.errorText}>{exchange.error}</Text>
                  <Pressable onPress={() => void ask(exchange.query)} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
                </View>
              </View>
            ) : null}

            {renderResult(exchange)}
          </View>
        ))}

        {latest?.result ? <Text style={styles.disclaimer}>Go helps you plan, not certify conditions. Confirm current hours, closures, permits, accessibility, weather, and water conditions before leaving.</Text> : null}

        <View style={styles.composer}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            multiline
            maxLength={2000}
            placeholder={exchanges.length ? 'Message Go…' : `Ask about ${cityName}…`}
            placeholderTextColor="#77827B"
            style={styles.composerInput}
          />
          <Pressable
            disabled={busy || query.trim().length < 3}
            onPress={() => void ask()}
            style={[styles.sendButton, (busy || query.trim().length < 3) && styles.sendDisabled]}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  header: { minHeight: 66, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28332D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#2E3933', alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerSpark: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#3A3117', borderWidth: 1, borderColor: '#806723', alignItems: 'center', justifyContent: 'center' },
  headerSparkText: { color: '#F1CD6B', fontSize: 16, fontWeight: '900' },
  headerTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  headerSubtitle: { color: '#8F9A93', fontSize: 9.5, marginTop: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 170 },
  emptyState: { paddingTop: 12 },
  exchange: { marginBottom: 22 },
  goTurn: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12 },
  goAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3A3117', borderWidth: 1, borderColor: '#806723', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  goAvatarText: { color: '#F1CD6B', fontSize: 16, fontWeight: '900' },
  goContent: { flex: 1, maxWidth: '92%' },
  goBubble: { alignSelf: 'flex-start', maxWidth: '94%', borderRadius: 18, borderTopLeftRadius: 7, backgroundColor: '#142019', borderWidth: 1, borderColor: '#2A422F', paddingHorizontal: 14, paddingVertical: 12 },
  greeting: { color: '#FFF8E8', fontSize: 15, lineHeight: 20, fontWeight: '900', marginBottom: 5 },
  goAnswer: { color: '#E9EEE9', fontSize: 14, lineHeight: 20 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  userBubble: { maxWidth: '82%', borderRadius: 18, borderTopRightRadius: 7, backgroundColor: '#D7B45A', paddingHorizontal: 14, paddingVertical: 11 },
  userText: { color: '#1A211C', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  typingBubble: { minHeight: 42, borderRadius: 17, borderTopLeftRadius: 7, backgroundColor: '#142019', borderWidth: 1, borderColor: '#2A422F', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  typingText: { color: '#9FAAA3', fontSize: 11.5, fontWeight: '700' },
  errorBubble: { flex: 1, borderRadius: 17, borderTopLeftRadius: 7, backgroundColor: '#301A18', borderWidth: 1, borderColor: '#5D302A', padding: 12 },
  errorText: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 14, backgroundColor: '#4B2925', paddingHorizontal: 11, paddingVertical: 7 },
  retryText: { color: '#FFD3CC', fontSize: 10.5, fontWeight: '900' },
  starterLabel: { color: '#7E8A83', fontSize: 9.5, letterSpacing: 1.1, fontWeight: '900', marginTop: 24, marginBottom: 10, marginLeft: 41 },
  starterWrap: { marginLeft: 41, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starterChip: { maxWidth: '100%', borderRadius: 18, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#121914', paddingHorizontal: 12, paddingVertical: 9 },
  starterText: { color: '#D6DED8', fontSize: 11.5, fontWeight: '800' },
  limitedCard: { marginTop: 9, borderRadius: 13, borderWidth: 1, borderColor: '#4A4021', backgroundColor: '#1B1A11', padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  limitedText: { flex: 1, color: '#C8B982', fontSize: 10.5, lineHeight: 15 },
  placeRail: { gap: 10, paddingTop: 10, paddingRight: 24 },
  placeCard: { width: 260, minHeight: 174, borderRadius: 17, borderWidth: 1, borderColor: '#344039', backgroundColor: '#151C18', padding: 14 },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bestMatch: { color: '#96D66D', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  pickLabel: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  chevron: { color: '#D7B45A', fontSize: 21, lineHeight: 22 },
  placeTitle: { color: '#FFF8E8', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 8 },
  placeMeta: { color: '#8D9891', fontSize: 10.5, marginTop: 3 },
  placeReason: { color: '#AEB7B1', fontSize: 11.5, lineHeight: 17, marginTop: 7 },
  openRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  openText: { color: '#E3C66F', fontSize: 10.5, fontWeight: '900' },
  stackGap: { gap: 9, marginTop: 10 },
  communityCard: { borderRadius: 15, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#11241A', padding: 13 },
  communityTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  communityLabel: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  verified: { color: '#79D26A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  tags: { color: '#D7B45A', fontSize: 10.5, fontWeight: '800', marginTop: 4 },
  planCard: { borderRadius: 17, borderWidth: 1, borderColor: '#3D3A22', backgroundColor: '#171A12', padding: 14, marginTop: 10 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  planHeaderText: { color: '#FFF3CE', fontSize: 15, fontWeight: '900' },
  planRow: { flexDirection: 'row', gap: 10, minHeight: 62, paddingTop: 10 },
  timeline: { width: 16, alignItems: 'center' },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#88B957', borderWidth: 2, borderColor: '#284120', marginTop: 4, zIndex: 2 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#36532C', marginTop: -1 },
  flex: { flex: 1 },
  planTime: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  planTitle: { color: '#FFF8E8', fontSize: 12.5, fontWeight: '900', marginTop: 2 },
  planNote: { color: '#A9B1AB', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  memoryCard: { borderRadius: 15, borderWidth: 1, borderColor: '#39483F', backgroundColor: '#151C18', padding: 13 },
  memoryLabel: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  followWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  followChip: { borderRadius: 18, borderWidth: 1, borderColor: '#4A4021', backgroundColor: '#1B1A11', paddingHorizontal: 12, paddingVertical: 9, maxWidth: '100%' },
  followText: { color: '#E8D59A', fontSize: 10.5, fontWeight: '800' },
  disclaimer: { color: '#66726B', fontSize: 9.5, lineHeight: 14, marginHorizontal: 35, marginTop: 8, marginBottom: 14, textAlign: 'center' },
  composer: { minHeight: 54, borderRadius: 27, borderWidth: 1, borderColor: '#354139', backgroundColor: '#121813', flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 14, paddingRight: 6, paddingVertical: 6, marginTop: 18 },
  composerInput: { flex: 1, minHeight: 40, maxHeight: 110, color: '#FFF8E8', fontSize: 14, lineHeight: 19, paddingTop: 9, paddingBottom: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: '#172017', fontSize: 22, lineHeight: 24, fontWeight: '900', marginTop: -2 },
});
