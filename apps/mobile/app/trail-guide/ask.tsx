import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  askMemberGuide,
  type MemberGuideConversationTurn,
  type MemberGuideResult,
} from '../../src/trailGuide/assistant';
import { getAskGoThread, saveAskGoThread } from '../../src/trailGuide/askHistory';
import { cityKeyFromLocationLabel } from '../../src/trailGuide/catalog';
import { findAskGoFoodOptions, type AskGoFoodOption } from '../../src/trailGuide/foodDiscovery';
import { useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery } from '../../src/weather/api';

const QUICK_PROMPTS = ['Plan my day', 'Easy day near water', 'What should I do this weekend?', 'Surprise me nearby'] as const;
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
type FoodStage = 'kind' | 'loading' | 'results' | null;
type PlannerPhase = 'discover' | 'build' | 'refine' | 'go';

function exchangeConversation(exchanges: Exchange[]): MemberGuideConversationTurn[] {
  return exchanges.flatMap((exchange) => {
    const turns: MemberGuideConversationTurn[] = [{ role: 'user', text: exchange.query }];
    if (exchange.result?.answer) turns.push({ role: 'assistant', text: exchange.result.answer });
    return turns;
  });
}

function latestPlanFrom(exchanges: Exchange[]) {
  return [...exchanges].reverse().find((item) => (item.result?.dayPlan.length ?? 0) > 0)?.result ?? null;
}

function planHeading(result: MemberGuideResult, cityName: string) {
  const count = result.dayPlan.length;
  if (count === 1) return `Quick outing · ${cityName}`;
  return `${count} stops · ${cityName}`;
}

function isFoodFollowUp(label: string) {
  return /food|lunch|restaurant|eat/i.test(label);
}

function friendlyAnswer(exchange: Exchange) {
  const answer = exchange.result?.answer ?? '';
  if (!/updated the same adventure|instead of starting over|kept your earlier preferences/i.test(answer)) return answer;
  const lower = exchange.query.toLowerCase();
  if (lower.includes('water')) return 'Got it. I kept this simple and near the water.';
  if (lower.includes('easy') || lower.includes('beginner')) return 'Got it. I made this easier and kept the parts that still fit.';
  if (lower.includes('short')) return 'Done. I tightened the outing without rebuilding everything.';
  return 'Got it. I updated this adventure and kept the parts that still fit.';
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
  const [plannerDuration, setPlannerDuration] = useState('Half day');
  const [foodStage, setFoodStage] = useState<FoodStage>(null);
  const [foodOptions, setFoodOptions] = useState<AskGoFoodOption[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [moreActions, setMoreActions] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const nextExchangeId = useRef(0);

  const latestPlan = useMemo(() => latestPlanFrom(exchanges), [exchanges]);
  const planning = Boolean(latestPlan);
  const busy = exchanges.some((exchange) => exchange.loading) || foodStage === 'loading';
  const phase: PlannerPhase = confirmed ? 'go' : planning ? 'refine' : exchanges.length > 0 ? 'build' : 'discover';

  useEffect(() => {
    if (!params.threadId) return;
    void getAskGoThread(params.threadId).then((thread) => {
      if (!thread) return;
      setThreadId(thread.id);
      setExchanges(thread.exchanges.map((exchange) => ({ ...exchange, loading: false })));
      nextExchangeId.current = thread.exchanges.length;
      setPlannerStage(null);
      setFoodStage(null);
      setConfirmed(false);
      setMoreActions(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
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

    setPlannerStage(null);
    setConfirmed(false);
    setFoodStage(null);
    setFoodOptions([]);
    setMoreActions(false);
    nextExchangeId.current += 1;
    const id = `exchange-${nextExchangeId.current}`;
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
    if (busy || planning) return;
    setPlannerStage('duration');
    setFoodStage(null);
    scrollToBottom();
  }

  function chooseDuration(duration: string) {
    setPlannerDuration(duration);
    setPlannerStage('vibe');
  }

  function chooseVibe(vibe: string) {
    setPlannerStage(null);
    const duration = plannerDuration === '2–3 hours' ? '2 to 3 hour' : plannerDuration.toLowerCase();
    void ask(`Plan a ${duration} adventure around ${cityName} with a ${vibe.toLowerCase()} vibe. Build the day and keep it easy to change.`);
  }

  function openFoodPicker() {
    setPlannerStage(null);
    setMoreActions(false);
    setFoodOptions([]);
    setFoodStage('kind');
    scrollToBottom();
  }

  async function findFood(kind: string) {
    setFoodStage('loading');
    try {
      const options = await findAskGoFoodOptions(cityName, 'FL', kind);
      setFoodOptions(options);
      setFoodStage('results');
    } catch {
      setFoodOptions([]);
      setFoodStage('results');
    }
    scrollToBottom();
  }

  function addFood(option: AskGoFoodOption) {
    setFoodStage(null);
    setFoodOptions([]);
    const location = option.address ? ` at ${option.address}` : ` in ${option.city}`;
    void ask(`Add ${option.name}${location} as the food stop in my current adventure. Keep the other stops unless the route truly requires a change.`);
  }

  function startFresh() {
    setExchanges([]);
    setThreadId(`ask-${Date.now()}`);
    setPlannerStage(null);
    setFoodStage(null);
    setFoodOptions([]);
    setConfirmed(false);
    setMoreActions(false);
    setQuery('');
  }

  function renderPlan(result: MemberGuideResult) {
    const stopCount = result.dayPlan.filter((step) => step.kind !== 'other').length;
    const canSwap = stopCount >= 2;
    const canShorten = result.dayPlan.length >= 2;
    const canUndo = exchanges.length > 1;

    return (
      <View style={styles.planCard}>
        <View style={styles.planTop}>
          <View style={styles.planHeaderCopy}>
            <Text style={styles.eyebrow}>{confirmed ? 'READY TO GO' : 'DRAFT PLAN'}</Text>
            <Text style={styles.planHeading}>{planHeading(result, cityName)}</Text>
          </View>
          {!confirmed ? (
            <View style={styles.headerActions}>
              {canUndo ? <Pressable onPress={() => void ask('Undo that and bring back my previous plan')} style={styles.smallButton}><Text style={styles.smallButtonText}>Undo</Text></Pressable> : null}
              <Pressable onPress={startFresh} style={styles.smallButton}><Text style={styles.smallButtonText}>Start over</Text></Pressable>
            </View>
          ) : null}
        </View>

        {result.dayPlan.map((step, index) => (
          <View key={`${step.time}-${step.title}-${index}`} style={styles.planRow}>
            <View style={styles.rail}>
              <View style={styles.dot} />
              {index < result.dayPlan.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <Text style={styles.planTime}>{step.time || 'Flex'}</Text>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>{step.title}</Text>
              <Text style={styles.planNote} numberOfLines={2}>{step.note}</Text>
            </View>
          </View>
        ))}

        {!confirmed ? (
          <>
            <View style={styles.actionWrap}>
              <Pressable style={styles.actionChip} onPress={openFoodPicker}><Text style={styles.actionText}>+ Food</Text></Pressable>
              {canSwap ? <Pressable style={styles.actionChip} onPress={() => void ask('Swap the second stop in this plan')}><Text style={styles.actionText}>Swap stop</Text></Pressable> : <Pressable style={styles.actionChip} onPress={() => void ask('Add another outdoor stop that fits this plan and the time I have')}><Text style={styles.actionText}>+ Stop</Text></Pressable>}
              <Pressable style={styles.actionChip} onPress={() => void ask('Make this plan beginner friendly')}><Text style={styles.actionText}>Easier</Text></Pressable>
              <Pressable style={styles.actionChip} onPress={() => setMoreActions((value) => !value)}><Text style={styles.actionText}>More</Text></Pressable>
            </View>
            {moreActions ? (
              <View style={styles.morePanel}>
                {canShorten ? <Pressable style={styles.moreAction} onPress={() => void ask('Make this plan shorter')}><Text style={styles.moreActionText}>Make shorter</Text></Pressable> : null}
                <Pressable style={styles.moreAction} onPress={() => void ask('Find something quieter that still fits this adventure')}><Text style={styles.moreActionText}>Something quieter</Text></Pressable>
                <Pressable style={styles.moreAction} onPress={() => void ask('Show me a different version of this adventure')}><Text style={styles.moreActionText}>Different version</Text></Pressable>
              </View>
            ) : null}
            <Pressable style={styles.confirmButton} onPress={() => setConfirmed(true)}><Text style={styles.confirmText}>Looks good · Finish plan</Text></Pressable>
          </>
        ) : (
          <View style={styles.actionWrap}>
            <Pressable style={styles.actionChip}><Text style={styles.actionText}>Start outing</Text></Pressable>
            <Pressable style={styles.actionChip} onPress={() => void ask('Share this plan with my TrailMates')}><Text style={styles.actionText}>Share</Text></Pressable>
            <Pressable style={styles.actionChip} onPress={() => void ask('Invite TrailMates to this plan')}><Text style={styles.actionText}>Invite</Text></Pressable>
            <Pressable style={styles.actionChip} onPress={() => void ask('Save this plan for later')}><Text style={styles.actionText}>Save</Text></Pressable>
          </View>
        )}
      </View>
    );
  }

  function renderFoodChoices() {
    if (foodStage === 'kind') {
      return <View style={styles.inlineCard}><Text style={styles.inlineTitle}>What kind of food stop?</Text><Text style={styles.inlineText}>I’ll show choices first. Nothing gets added until you pick one.</Text><View style={styles.chipWrap}>{FOOD_KINDS.map((kind) => <Pressable key={kind} style={styles.choiceChip} onPress={() => void findFood(kind)}><Text style={styles.choiceText}>{kind}</Text></Pressable>)}</View></View>;
    }
    if (foodStage === 'loading') return <View style={styles.loadingRow}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Finding food options in {cityName}…</Text></View>;
    if (foodStage === 'results') {
      return <View style={styles.inlineCard}><Text style={styles.inlineTitle}>{foodOptions.length ? 'Pick a food stop' : 'No matching food stops loaded yet'}</Text><Text style={styles.inlineText}>{foodOptions.length ? 'Choose one and I’ll add it to the current plan.' : 'I won’t substitute parks or outdoor places for restaurants. Try another food style or keep the plan as-is.'}</Text>{foodOptions.map((option) => <Pressable key={option.id} style={styles.foodRow} onPress={() => addFood(option)}><View style={styles.foodCopy}><Text style={styles.foodName}>{option.name}</Text><Text style={styles.foodMeta}>{option.category || 'Dining'}{option.address ? ` · ${option.address}` : ''}</Text>{option.description ? <Text style={styles.foodDescription} numberOfLines={2}>{option.description}</Text> : null}{option.verified && option.ownershipTags.length > 0 ? <Text style={styles.verified}>✓ Verified community-owned</Text> : null}</View><Text style={styles.addText}>Add</Text></Pressable>)}<Pressable onPress={() => setFoodStage('kind')}><Text style={styles.tryAgain}>Try another style</Text></Pressable></View>;
    }
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><AppIcon name="chevron-back" color="#FFF8E8" size={21} /></Pressable>
        <View style={styles.headerIdentity}><View style={styles.sparkCircle}><Text style={styles.spark}>✦</Text></View><View><Text style={styles.headerTitle}>Ask Go</Text><Text style={styles.headerSubtitle}>{phase === 'go' ? 'Your day is ready' : planning ? 'Planning with you' : 'Your outdoor guide'}</Text></View></View>
        <Pressable onPress={() => router.push('/trail-guide/ask-history' as never)} style={styles.historyButton}><AppIcon name="time" color="#C5CEC8" size={15} /><Text style={styles.historyText}>History</Text></Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {exchanges.length === 0 ? <View style={styles.emptyState}><Text style={styles.greeting}>What kind of day do you want?</Text><Text style={styles.intro}>Tell me the vibe and time you have, or tap Plan my day and I’ll guide the rest.</Text><Pressable style={styles.planMyDay} onPress={startPlanMyDay}><View><Text style={styles.planMyDayTitle}>✦  Plan my day</Text><Text style={styles.planMyDayText}>A complete adventure in a few taps</Text></View><AppIcon name="chevron-forward" color="#172017" size={19} /></Pressable><View style={styles.quickStack}>{QUICK_PROMPTS.slice(1).map((prompt) => <Pressable key={prompt} style={styles.quickCard} onPress={() => void ask(prompt)}><Text style={styles.quickText}>{prompt}</Text></Pressable>)}</View></View> : null}

        {exchanges.map((exchange, index) => {
          const isLatest = index === exchanges.length - 1;
          return <View key={exchange.id} style={styles.exchange}><View style={styles.userBubble}><Text style={styles.userText}>{exchange.query}</Text></View>{exchange.loading ? <View style={styles.goLine}><ActivityIndicator color="#D7B45A" size="small" /></View> : null}{exchange.error ? <View style={styles.goLine}><Text style={styles.errorText}>{exchange.error}</Text></View> : null}{exchange.result ? <View style={styles.goLine}><Text style={styles.goText}>{friendlyAnswer(exchange)}</Text></View> : null}{isLatest && exchange.result?.dayPlan.length ? renderPlan(exchange.result) : null}{isLatest && exchange.result && !exchange.result.dayPlan.length && exchange.result.places.length ? <View style={styles.inlineCard}><Text style={styles.inlineTitle}>Good options nearby</Text><Text style={styles.inlineText}>{exchange.result.places.length} places matched. Ask me to build a day around one, make it easier, or surprise you.</Text></View> : null}{isLatest && exchange.result?.followUps.length && !planning && !confirmed ? <View style={styles.chipWrap}>{exchange.result.followUps.slice(0, 4).map((follow) => <Pressable key={follow} style={styles.choiceChip} onPress={() => isFoodFollowUp(follow) ? openFoodPicker() : void ask(follow)}><Text style={styles.choiceText}>{follow}</Text></Pressable>)}</View> : null}</View>;
        })}

        {!planning && plannerStage === 'duration' ? <View style={styles.inlineCard}><Text style={styles.inlineTitle}>How much time do you have?</Text><View style={styles.chipWrap}>{DURATION_CHOICES.map((item) => <Pressable key={item} style={styles.choiceChip} onPress={() => chooseDuration(item)}><Text style={styles.choiceText}>{item}</Text></Pressable>)}</View></View> : null}
        {!planning && plannerStage === 'vibe' ? <View style={styles.inlineCard}><Text style={styles.inlineTitle}>What sounds good?</Text><View style={styles.chipWrap}>{VIBE_CHOICES.map((item) => <Pressable key={item} style={styles.choiceChip} onPress={() => chooseVibe(item)}><Text style={styles.choiceText}>{item}</Text></Pressable>)}</View></View> : null}
        {renderFoodChoices()}
        <View style={styles.bottomClearance} />
      </ScrollView>

      <View style={styles.composerShell}><View style={styles.composer}><TextInput value={query} onChangeText={setQuery} placeholder={confirmed ? 'Ask about this outing…' : planning ? 'Change this adventure…' : 'Ask Go anything…'} placeholderTextColor="#7C8981" style={styles.input} multiline maxLength={500} onSubmitEditing={() => void ask()} /><Pressable disabled={busy || query.trim().length < 3} onPress={() => void ask()} style={[styles.sendButton, (busy || query.trim().length < 3) && styles.sendDisabled]}><AppIcon name="arrow-up" color="#152019" size={18} /></Pressable></View></View>
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
  headerTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '800' },
  headerSubtitle: { color: '#89968E', fontSize: 10.5, marginTop: 1 },
  historyButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 32, borderRadius: 16, backgroundColor: '#16221B' },
  historyText: { color: '#C5CEC8', fontSize: 11.5, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 14 },
  emptyState: { paddingTop: 18 },
  greeting: { color: '#FFF8E8', fontSize: 24, fontWeight: '800', lineHeight: 30 },
  intro: { color: '#AAB5AE', fontSize: 13.5, lineHeight: 20, marginTop: 7 },
  planMyDay: { marginTop: 18, minHeight: 70, backgroundColor: '#D7B45A', borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planMyDayTitle: { color: '#172017', fontSize: 16, fontWeight: '900' },
  planMyDayText: { color: '#354238', fontSize: 11.5, marginTop: 3 },
  quickStack: { marginTop: 10, gap: 8 },
  quickCard: { minHeight: 45, borderRadius: 13, borderWidth: 1, borderColor: '#293A30', backgroundColor: '#15221A', paddingHorizontal: 13, justifyContent: 'center' },
  quickText: { color: '#EDE4D0', fontWeight: '700', fontSize: 13 },
  exchange: { marginBottom: 16 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '84%', backgroundColor: '#26362D', borderRadius: 15, borderBottomRightRadius: 5, paddingHorizontal: 12, paddingVertical: 8 },
  userText: { color: '#F5EDD9', fontSize: 13.5, lineHeight: 19 },
  goLine: { marginTop: 8, marginLeft: 4, paddingRight: 18 },
  goText: { color: '#E6DDC9', fontSize: 13.5, lineHeight: 20 },
  errorText: { color: '#E1A6A0', fontSize: 13, lineHeight: 19 },
  planCard: { marginTop: 10, borderRadius: 15, borderWidth: 1, borderColor: '#4A5733', backgroundColor: '#17251C', padding: 12 },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  planHeaderCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  eyebrow: { color: '#B89C55', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  planHeading: { color: '#F4ECD8', fontSize: 14, fontWeight: '800', marginTop: 2 },
  smallButton: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 11, backgroundColor: '#243329' },
  smallButtonText: { color: '#C9D1CC', fontSize: 10, fontWeight: '700' },
  planRow: { minHeight: 47, flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 17, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7B45A', marginTop: 7 },
  line: { width: 1, flex: 1, backgroundColor: '#4A5733', marginVertical: 3 },
  planTime: { width: 62, color: '#B7C0BA', fontSize: 10.5, paddingTop: 3 },
  planCopy: { flex: 1, paddingBottom: 8 },
  planTitle: { color: '#F7EEDB', fontSize: 12.5, fontWeight: '800' },
  planNote: { color: '#9BA79F', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  actionChip: { borderRadius: 12, backgroundColor: '#243329', paddingHorizontal: 9, paddingVertical: 7 },
  actionText: { color: '#DDE5DF', fontSize: 10.5, fontWeight: '700' },
  morePanel: { marginTop: 7, borderRadius: 12, backgroundColor: '#132019', padding: 8, gap: 3 },
  moreAction: { paddingVertical: 7, paddingHorizontal: 4 },
  moreActionText: { color: '#C9D3CD', fontSize: 11, fontWeight: '600' },
  confirmButton: { marginTop: 9, minHeight: 34, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#172017', fontSize: 11.5, fontWeight: '900' },
  inlineCard: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#293A30', backgroundColor: '#15221A', padding: 12 },
  inlineTitle: { color: '#FFF4DE', fontSize: 14, fontWeight: '800' },
  inlineText: { color: '#9DA9A2', fontSize: 11.5, lineHeight: 16, marginTop: 4, marginBottom: 9 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  choiceChip: { borderRadius: 14, borderWidth: 1, borderColor: '#3A493F', backgroundColor: '#18271E', paddingHorizontal: 10, paddingVertical: 8 },
  choiceText: { color: '#E7DFCB', fontSize: 11, fontWeight: '700' },
  loadingRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { color: '#AEB9B2', fontSize: 12 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C3B32', paddingVertical: 10 },
  foodCopy: { flex: 1 },
  foodName: { color: '#FFF4DE', fontSize: 13, fontWeight: '800' },
  foodMeta: { color: '#A7B1AB', fontSize: 10.5, marginTop: 2 },
  foodDescription: { color: '#929F97', fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  verified: { color: '#D7B45A', fontSize: 10, fontWeight: '700', marginTop: 4 },
  addText: { color: '#D7B45A', fontSize: 11.5, fontWeight: '900' },
  tryAgain: { color: '#D7B45A', fontSize: 11.5, fontWeight: '700', marginTop: 8 },
  bottomClearance: { height: 112 },
  composerShell: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#28362E', backgroundColor: '#0D1712', paddingHorizontal: 12, paddingTop: 7, paddingBottom: 9 },
  composer: { minHeight: 48, maxHeight: 110, borderRadius: 18, borderWidth: 1, borderColor: '#34463A', backgroundColor: '#17251C', flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  input: { flex: 1, minHeight: 36, maxHeight: 96, color: '#F7EEDB', fontSize: 13.5, paddingVertical: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
});