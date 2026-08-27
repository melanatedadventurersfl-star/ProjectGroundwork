import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  askMemberGuide,
  findTrailGuidePlace,
  type MemberGuideConversationTurn,
  type MemberGuideResult,
} from '../../src/trailGuide/assistant';
import { getAskGoThread, saveAskGoThread } from '../../src/trailGuide/askHistory';
import { cityKeyFromLocationLabel } from '../../src/trailGuide/catalog';
import { useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import { CURATED_TRAIL_GUIDE_PHOTOS } from '../../src/trailGuide/placePhotos';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery } from '../../src/weather/api';

const QUICK_PROMPTS = [
  'Plan my day',
  'Easy day near water',
  'What should I do this weekend?',
  'Surprise me nearby',
] as const;

const FOOD_KINDS = ['Quick bite', 'Sit-down', 'Coffee/dessert', 'Surprise me'] as const;
const DURATION_CHOICES = ['2–3 hours', 'Half day', 'Full day'] as const;
const VIBE_CHOICES = ['Water', 'Trails', 'Relaxed', 'Surprise me'] as const;

type Exchange = {
  id: string;
  query: string;
  result: MemberGuideResult | null;
  error: string;
  loading: boolean;
};

type PlannerStage = 'duration' | 'vibe' | null;
type FoodStage = 'kind' | 'results' | 'loading' | null;

function exchangeConversation(exchanges: Exchange[]): MemberGuideConversationTurn[] {
  return exchanges.flatMap((exchange) => {
    const turns: MemberGuideConversationTurn[] = [{ role: 'user', text: exchange.query }];
    if (exchange.result?.answer) turns.push({ role: 'assistant', text: exchange.result.answer });
    return turns;
  });
}

function compactFollowUp(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes('beginner') || lower.includes('easier')) return 'Make easier';
  if (lower.includes('half-day')) return 'Half-day plan';
  if (lower.includes('food') || lower.includes('lunch')) return 'Add food';
  if (lower.includes('near water')) return 'Near water';
  if (lower.includes('quieter')) return 'Quieter';
  if (lower.includes('shorter')) return 'Shorter';
  if (lower.includes('second')) return 'Swap second';
  return label;
}

function isFoodFollowUp(label: string) {
  return /food|lunch|restaurant|eat/i.test(label);
}

function planLabel(result: MemberGuideResult | null) {
  const count = result?.dayPlan.length ?? 0;
  if (count === 0) return null;
  return `${count} stop${count === 1 ? '' : 's'}`;
}

export default function AskGoScreen() {
  const params = useLocalSearchParams<{ threadId?: string }>();
  const { locationLabel } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : cityKey === 'tampa' ? 'Tampa' : 'Jacksonville';
  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [threadId, setThreadId] = useState(() => params.threadId ?? `ask-${Date.now()}`);
  const [plannerStage, setPlannerStage] = useState<PlannerStage>(null);
  const [plannerDuration, setPlannerDuration] = useState<string>('Half day');
  const [foodStage, setFoodStage] = useState<FoodStage>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const nextExchangeId = useRef(0);

  const busy = exchanges.some((exchange) => exchange.loading) || foodStage === 'loading';
  const latest = exchanges[exchanges.length - 1] ?? null;
  const latestPlan = useMemo(() => [...exchanges].reverse().find((item) => (item.result?.dayPlan.length ?? 0) > 0)?.result ?? null, [exchanges]);
  const planning = Boolean(latestPlan);

  useEffect(() => {
    if (!params.threadId) return;
    void getAskGoThread(params.threadId).then((thread) => {
      if (!thread) return;
      setThreadId(thread.id);
      setExchanges(thread.exchanges.map((exchange) => ({ ...exchange, loading: false })));
      nextExchangeId.current = thread.exchanges.length;
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    });
  }, [params.threadId]);

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90);
  }

  function persist(next: Exchange[]) {
    const completed = next.filter((exchange) => !exchange.loading).map((exchange) => ({ ...exchange, loading: false as const }));
    if (completed.length === 0) return;
    void saveAskGoThread({
      id: threadId,
      cityKey,
      cityName,
      title: completed[0]?.query ?? 'Ask Go conversation',
      updatedAt: new Date().toISOString(),
      exchanges: completed,
    });
  }

  async function ask(nextQuery = query): Promise<MemberGuideResult | null> {
    const clean = nextQuery.trim();
    if (clean.length < 3 || busy) return null;

    nextExchangeId.current += 1;
    const id = `exchange-${nextExchangeId.current}`;
    const history = exchangeConversation(exchanges).slice(-6);
    const pending: Exchange = { id, query: clean, result: null, error: '', loading: true };
    setQuery('');
    setExchanges((previous) => [...previous, pending]);
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
      setExchanges((previous) => {
        const next = previous.map((exchange) => exchange.id === id ? { ...exchange, result, loading: false } : exchange);
        persist(next);
        return next;
      });
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'I could not answer that right now.';
      setExchanges((previous) => {
        const next = previous.map((exchange) => exchange.id === id ? { ...exchange, error: message, loading: false } : exchange);
        persist(next);
        return next;
      });
      return null;
    } finally {
      scrollToBottom();
    }
  }

  function startPlanMyDay() {
    if (busy) return;
    setPlannerStage('duration');
    setFoodStage(null);
    scrollToBottom();
  }

  function chooseDuration(duration: string) {
    setPlannerDuration(duration);
    setPlannerStage('vibe');
    scrollToBottom();
  }

  function chooseVibe(vibe: string) {
    setPlannerStage(null);
    const durationPhrase = plannerDuration === '2–3 hours' ? '2 to 3 hour' : plannerDuration.toLowerCase();
    void ask(`Plan a ${durationPhrase} adventure for me around ${cityName}. I want a ${vibe.toLowerCase()} vibe. Build the day for me and keep it easy to change.`);
  }

  async function findFood(kind: string) {
    setFoodStage('loading');
    const result = await ask(`Show me 3 ${kind.toLowerCase()} dining choices near my current adventure route. Recommend choices first and do not change the plan yet.`);
    setFoodStage(result ? 'results' : 'kind');
    scrollToBottom();
  }

  function handleFollowUp(follow: string) {
    if (isFoodFollowUp(follow)) {
      setFoodStage('kind');
      setPlannerStage(null);
      scrollToBottom();
      return;
    }
    void ask(follow);
  }

  function addFoodStop(name: string) {
    setFoodStage(null);
    void ask(`Add ${name} as the food stop in my current adventure. Keep the other stops unless the route truly requires a change.`);
  }

  function startFresh() {
    setExchanges([]);
    setThreadId(`ask-${Date.now()}`);
    setPlannerStage(null);
    setFoodStage(null);
    setQuery('');
  }

  function renderPlace(item: MemberGuideResult['places'][number]) {
    const place = findTrailGuidePlace(item.id);
    if (!place) return null;
    const photo = CURATED_TRAIL_GUIDE_PHOTOS[item.id]?.url ?? null;
    return (
      <Pressable key={item.id} style={styles.placeRow} onPress={() => router.push(`/trail-guide/${item.id}` as never)}>
        {photo ? <Image source={{ uri: photo }} style={styles.placeImage} resizeMode="cover" /> : (
          <View style={styles.placeFallback}><AppIcon name="trail" color="#D7B45A" size={19} /></View>
        )}
        <View style={styles.placeCopy}>
          <Text style={styles.placeTitle} numberOfLines={1}>{place.name}</Text>
          <Text style={styles.placeMeta} numberOfLines={1}>{place.area} · {place.category}</Text>
          <Text style={styles.placeReason} numberOfLines={2}>{item.reason}</Text>
        </View>
        <AppIcon name="chevron-forward" color="#8F9D95" size={17} />
      </Pressable>
    );
  }

  function renderPlan(result: MemberGuideResult) {
    if (result.dayPlan.length === 0) return null;
    return (
      <View style={styles.planCard}>
        <View style={styles.planTop}>
          <View>
            <Text style={styles.eyebrow}>YOUR PLAN</Text>
            <Text style={styles.planHeading}>{planLabel(result)} · {cityName}</Text>
          </View>
          <Pressable onPress={() => void ask('Undo that and bring back my previous plan')} style={styles.tinyAction}>
            <Text style={styles.tinyActionText}>Undo</Text>
          </Pressable>
        </View>
        {result.dayPlan.map((step, index) => (
          <View key={`${step.time}-${step.title}-${index}`} style={styles.planRow}>
            <View style={styles.planRail}>
              <View style={styles.planDot} />
              {index < result.dayPlan.length - 1 ? <View style={styles.planLine} /> : null}
            </View>
            <Text style={styles.planTime}>{step.time || 'Flex'}</Text>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>{step.title}</Text>
              <Text style={styles.planNote} numberOfLines={2}>{step.note}</Text>
            </View>
          </View>
        ))}
        <View style={styles.planActions}>
          <Pressable style={styles.actionChip} onPress={() => setFoodStage('kind')}><Text style={styles.actionChipText}>+ Food</Text></Pressable>
          <Pressable style={styles.actionChip} onPress={() => void ask('Swap the second stop in this plan')}><Text style={styles.actionChipText}>Swap stop</Text></Pressable>
          <Pressable style={styles.actionChip} onPress={() => void ask('Make this plan shorter')}><Text style={styles.actionChipText}>Shorter</Text></Pressable>
          <Pressable style={styles.actionChip} onPress={() => void ask('Make this plan beginner friendly')}><Text style={styles.actionChipText}>Easier</Text></Pressable>
        </View>
      </View>
    );
  }

  function renderRichResult(exchange: Exchange) {
    const result = exchange.result;
    if (!result) return null;
    return (
      <View style={styles.richResult}>
        {renderPlan(result)}
        {foodStage === 'results' ? (
          <View style={styles.choiceCard}>
            <Text style={styles.choiceTitle}>Pick a food stop</Text>
            <Text style={styles.choiceText}>I’ll add it only after you choose.</Text>
            {result.communityStops.length > 0 ? result.communityStops.slice(0, 4).map((stop) => (
              <Pressable key={stop.placeId} style={styles.foodOption} onPress={() => addFoodStop(stop.name)}>
                <View style={styles.foodCopy}>
                  <Text style={styles.foodName}>{stop.name}</Text>
                  <Text style={styles.foodReason} numberOfLines={2}>{stop.reason}</Text>
                </View>
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            )) : (
              <View style={styles.noFoodBox}>
                <Text style={styles.noFoodText}>I don’t have a verified dining option loaded for this route yet. Try another style or ask me for a different nearby area.</Text>
              </View>
            )}
          </View>
        ) : null}
        {result.places.length > 0 && foodStage !== 'results' ? (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>{result.dayPlan.length > 0 ? 'STOPS & ALTERNATIVES' : 'BEST MATCHES'}</Text>
            <View style={styles.stack}>{result.places.slice(0, 3).map(renderPlace)}</View>
          </View>
        ) : null}
        {result.followUps.length > 0 && foodStage !== 'results' ? (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>{planning ? 'CHANGE THIS PLAN' : 'KEEP GOING'}</Text>
            <View style={styles.chipWrap}>
              {result.followUps.slice(0, 5).map((follow) => (
                <Pressable key={follow} disabled={busy} onPress={() => handleFollowUp(follow)} style={styles.replyChip}>
                  <Text style={styles.replyChipText}>{compactFollowUp(follow)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={10}>
          <AppIcon name="chevron-back" color="#FFF8E8" size={21} />
        </Pressable>
        <View style={styles.headerIdentity}>
          <View style={styles.sparkCircle}><Text style={styles.spark}>✦</Text></View>
          <View>
            <Text style={styles.headerTitle}>Ask Go</Text>
            <Text style={styles.headerSubtitle}>{planning ? 'Planning with you' : 'Your outdoor guide'}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/trail-guide/ask-history' as never)} style={styles.historyButton} hitSlop={8}>
          <AppIcon name="time" color="#C5CEC8" size={15} />
          <Text style={styles.historyText}>History</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {exchanges.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.greeting}>What kind of day do you want?</Text>
            <Text style={styles.intro}>Give me a vibe, a time limit, or nothing at all. I can build the day from there.</Text>
            <Pressable style={styles.planMyDay} onPress={startPlanMyDay}>
              <View style={styles.planIcon}><Text style={styles.planIconText}>✦</Text></View>
              <View style={styles.planMyDayCopy}>
                <Text style={styles.planMyDayTitle}>Plan my day</Text>
                <Text style={styles.planMyDayText}>A complete adventure in a few taps</Text>
              </View>
              <AppIcon name="chevron-forward" color="#172017" size={19} />
            </Pressable>
            <View style={styles.quickGrid}>
              {QUICK_PROMPTS.slice(1).map((prompt) => (
                <Pressable key={prompt} style={styles.quickCard} onPress={() => void ask(prompt)}>
                  <Text style={styles.quickText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {exchanges.map((exchange, index) => {
          const isLatest = index === exchanges.length - 1;
          return (
            <View key={exchange.id} style={styles.exchange}>
              <View style={styles.userBubble}><Text style={styles.userText}>{exchange.query}</Text></View>
              {exchange.loading ? (
                <View style={styles.goLine}><View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View><ActivityIndicator color="#D7B45A" size="small" /></View>
              ) : exchange.error ? (
                <View style={styles.goLine}><View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View><Text style={styles.errorText}>{exchange.error}</Text></View>
              ) : exchange.result ? (
                <>
                  <View style={styles.goLine}><View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View><Text style={styles.goText}>{exchange.result.answer}</Text></View>
                  {isLatest ? renderRichResult(exchange) : null}
                </>
              ) : null}
            </View>
          );
        })}

        {plannerStage === 'duration' ? (
          <View style={styles.inlinePrompt}>
            <Text style={styles.inlineTitle}>How much time do you have?</Text>
            <View style={styles.chipWrap}>{DURATION_CHOICES.map((item) => <Pressable key={item} style={styles.choiceChip} onPress={() => chooseDuration(item)}><Text style={styles.choiceChipText}>{item}</Text></Pressable>)}</View>
          </View>
        ) : null}

        {plannerStage === 'vibe' ? (
          <View style={styles.inlinePrompt}>
            <Text style={styles.inlineTitle}>What sounds good?</Text>
            <View style={styles.chipWrap}>{VIBE_CHOICES.map((item) => <Pressable key={item} style={styles.choiceChip} onPress={() => chooseVibe(item)}><Text style={styles.choiceChipText}>{item}</Text></Pressable>)}</View>
          </View>
        ) : null}

        {foodStage === 'kind' ? (
          <View style={styles.inlinePrompt}>
            <Text style={styles.inlineTitle}>Sure. What kind of food stop fits?</Text>
            <View style={styles.chipWrap}>{FOOD_KINDS.map((item) => <Pressable key={item} style={styles.choiceChip} onPress={() => void findFood(item)}><Text style={styles.choiceChipText}>{item}</Text></Pressable>)}</View>
          </View>
        ) : null}

        {foodStage === 'loading' ? <View style={styles.inlineLoading}><ActivityIndicator color="#D7B45A" /><Text style={styles.inlineLoadingText}>Finding food options along your route…</Text></View> : null}
        <View style={styles.bottomClearance} />
      </ScrollView>

      <View style={styles.composerShell}>
        {exchanges.length > 0 ? <Pressable onPress={startFresh} style={styles.freshButton}><Text style={styles.freshText}>Start fresh</Text></Pressable> : null}
        <View style={styles.composer}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={planning ? 'Change this plan…' : 'Ask Go anything…'}
            placeholderTextColor="#7C8981"
            style={styles.input}
            multiline
            maxLength={500}
            onSubmitEditing={() => void ask()}
          />
          <Pressable disabled={busy || query.trim().length < 3} onPress={() => void ask()} style={[styles.sendButton, (busy || query.trim().length < 3) && styles.sendDisabled]}>
            <AppIcon name="arrow-up" color="#152019" size={18} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1712' },
  header: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28362E' },
  headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sparkCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#203329', alignItems: 'center', justifyContent: 'center' },
  spark: { color: '#D7B45A', fontSize: 15 },
  headerTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '850' },
  headerSubtitle: { color: '#89968E', fontSize: 10.5, marginTop: 1 },
  historyButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 32, borderRadius: 16, backgroundColor: '#16221B' },
  historyText: { color: '#C5CEC8', fontSize: 11.5, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 8 },
  emptyState: { paddingTop: 18 },
  greeting: { color: '#FFF8E8', fontSize: 24, fontWeight: '850', lineHeight: 30 },
  intro: { color: '#AAB5AE', fontSize: 13.5, lineHeight: 20, marginTop: 7, maxWidth: 330 },
  planMyDay: { marginTop: 18, minHeight: 72, backgroundColor: '#D7B45A', borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(23,32,23,0.13)', alignItems: 'center', justifyContent: 'center' },
  planIconText: { color: '#172017', fontSize: 17 },
  planMyDayCopy: { flex: 1 },
  planMyDayTitle: { color: '#172017', fontSize: 16, fontWeight: '900' },
  planMyDayText: { color: '#354238', fontSize: 11.5, marginTop: 3 },
  quickGrid: { marginTop: 10, gap: 8 },
  quickCard: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#293A30', backgroundColor: '#15221A', paddingHorizontal: 13, justifyContent: 'center' },
  quickText: { color: '#EDE4D0', fontWeight: '700', fontSize: 13 },
  exchange: { marginBottom: 18 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '84%', backgroundColor: '#26362D', borderRadius: 16, borderBottomRightRadius: 5, paddingHorizontal: 12, paddingVertical: 9 },
  userText: { color: '#F5EDD9', fontSize: 13.5, lineHeight: 19 },
  goLine: { marginTop: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 18 },
  goAvatar: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#203329', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  goAvatarText: { color: '#D7B45A', fontSize: 12 },
  goText: { flex: 1, color: '#E6DDC9', fontSize: 13.5, lineHeight: 20 },
  errorText: { flex: 1, color: '#E1A6A0', fontSize: 13, lineHeight: 19 },
  richResult: { marginTop: 9, marginLeft: 33, gap: 12 },
  section: { gap: 7 },
  eyebrow: { color: '#B89C55', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  stack: { gap: 7 },
  placeRow: { minHeight: 82, borderRadius: 13, borderWidth: 1, borderColor: '#293A30', backgroundColor: '#15221A', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  placeImage: { width: 68, height: 64, borderRadius: 10 },
  placeFallback: { width: 68, height: 64, borderRadius: 10, backgroundColor: '#203027', alignItems: 'center', justifyContent: 'center' },
  placeCopy: { flex: 1 },
  placeTitle: { color: '#FFF5DF', fontSize: 13.5, fontWeight: '800' },
  placeMeta: { color: '#8E9A93', fontSize: 10.5, marginTop: 2 },
  placeReason: { color: '#B8C1BB', fontSize: 11, lineHeight: 15, marginTop: 4 },
  planCard: { borderRadius: 15, borderWidth: 1, borderColor: '#4A5733', backgroundColor: '#17251C', padding: 12 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  planHeading: { color: '#F4ECD8', fontSize: 14, fontWeight: '850', marginTop: 2 },
  tinyAction: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, backgroundColor: '#243329' },
  tinyActionText: { color: '#C9D1CC', fontSize: 10.5, fontWeight: '750' },
  planRow: { minHeight: 48, flexDirection: 'row', alignItems: 'stretch' },
  planRail: { width: 17, alignItems: 'center' },
  planDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7B45A', marginTop: 7 },
  planLine: { width: 1, flex: 1, backgroundColor: '#4A5733', marginVertical: 3 },
  planTime: { width: 62, color: '#B7C0BA', fontSize: 10.5, paddingTop: 3 },
  planCopy: { flex: 1, paddingBottom: 8 },
  planTitle: { color: '#F7EEDB', fontSize: 12.5, fontWeight: '800' },
  planNote: { color: '#9BA79F', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  planActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  actionChip: { borderRadius: 12, backgroundColor: '#243329', paddingHorizontal: 9, paddingVertical: 7 },
  actionChipText: { color: '#DDE5DF', fontSize: 10.5, fontWeight: '750' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  replyChip: { borderRadius: 14, borderWidth: 1, borderColor: '#3A493F', backgroundColor: '#18271E', paddingHorizontal: 10, paddingVertical: 8 },
  replyChipText: { color: '#E7DFCB', fontSize: 11, fontWeight: '700' },
  inlinePrompt: { marginLeft: 33, marginBottom: 16, borderRadius: 14, backgroundColor: '#15221A', borderWidth: 1, borderColor: '#314238', padding: 12 },
  inlineTitle: { color: '#F5EDD9', fontSize: 13.5, fontWeight: '800', marginBottom: 9 },
  choiceChip: { borderRadius: 14, backgroundColor: '#24372B', paddingHorizontal: 11, paddingVertical: 8 },
  choiceChipText: { color: '#F1E9D7', fontSize: 11, fontWeight: '750' },
  inlineLoading: { marginLeft: 33, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 9 },
  inlineLoadingText: { color: '#A9B5AE', fontSize: 11.5 },
  choiceCard: { borderRadius: 14, borderWidth: 1, borderColor: '#3C4A3F', backgroundColor: '#15221A', padding: 11 },
  choiceTitle: { color: '#FFF4DE', fontSize: 14, fontWeight: '850' },
  choiceText: { color: '#94A199', fontSize: 10.5, marginTop: 3, marginBottom: 8 },
  foodOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#314036', paddingVertical: 8 },
  foodCopy: { flex: 1, paddingRight: 10 },
  foodName: { color: '#F3EAD7', fontSize: 12.5, fontWeight: '800' },
  foodReason: { color: '#9DA9A2', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  addText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  noFoodBox: { borderRadius: 10, backgroundColor: '#1B2A20', padding: 10 },
  noFoodText: { color: '#A9B4AD', fontSize: 11, lineHeight: 16 },
  composerShell: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A382F', backgroundColor: '#0D1712', paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7 },
  freshButton: { alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 3, marginBottom: 4 },
  freshText: { color: '#89968E', fontSize: 10.5, fontWeight: '700' },
  composer: { minHeight: 48, maxHeight: 112, borderRadius: 17, borderWidth: 1, borderColor: '#34443A', backgroundColor: '#16231B', flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 12, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, color: '#F6EEDB', fontSize: 13.5, lineHeight: 19, paddingVertical: 8, paddingRight: 8, maxHeight: 96 },
  sendButton: { width: 37, height: 37, borderRadius: 19, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.38 },
  bottomClearance: { height: 10 },
});
