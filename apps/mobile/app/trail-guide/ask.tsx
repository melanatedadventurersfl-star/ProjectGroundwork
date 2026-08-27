import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  askMemberGuide,
  findTrailGuidePlace,
  type MemberGuideConversationTurn,
  type MemberGuideResult,
} from '../../src/trailGuide/assistant';
import { cityKeyFromLocationLabel } from '../../src/trailGuide/catalog';
import { useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import { CURATED_TRAIL_GUIDE_PHOTOS } from '../../src/trailGuide/placePhotos';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery } from '../../src/weather/api';

const QUICK_PROMPTS = [
  { title: 'Easy day near water', subtitle: 'Relaxed places nearby', icon: 'water' },
  { title: 'Build me an adventure', subtitle: 'Tell Go how much time you have', icon: 'trail' },
  { title: 'What should I do this weekend?', subtitle: 'Ideas based on your area', icon: 'sun' },
  { title: 'Community-owned nearby', subtitle: 'Add a local stop to your adventure', icon: 'community' },
] as const;

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

function promptIcon(icon: typeof QUICK_PROMPTS[number]['icon']) {
  if (icon === 'water') return '≈';
  if (icon === 'sun') return '☀';
  if (icon === 'community') return '◎';
  return '⌁';
}

function trustedPhotoUri(placeId: string) {
  return CURATED_TRAIL_GUIDE_PHOTOS[placeId]?.url ?? null;
}

function compactFollowUp(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes('beginner')) return 'Beginner friendly';
  if (lower.includes('half-day')) return 'Half-day plan';
  if (lower.includes('community-owned') || lower.includes('food stop') || lower.includes('add a food')) return 'Add food';
  if (lower.includes('near water')) return 'Near water';
  if (lower.includes('closer')) return 'Closer';
  if (lower.includes('shorter')) return 'Shorter';
  return label;
}

export default function AskGoScreen() {
  const { locationLabel } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : cityKey === 'tampa' ? 'Tampa' : 'Jacksonville';
  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const nextExchangeId = useRef(0);

  const busy = exchanges.some((exchange) => exchange.loading);
  const latest = exchanges[exchanges.length - 1] ?? null;
  const starterPrompts = useMemo(() => QUICK_PROMPTS, []);

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  async function ask(nextQuery = query) {
    const clean = nextQuery.trim();
    if (clean.length < 3 || busy) return;

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
      setExchanges((previous) => previous.map((exchange) => exchange.id === id ? { ...exchange, result, loading: false } : exchange));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'I could not answer that right now.';
      setExchanges((previous) => previous.map((exchange) => exchange.id === id ? { ...exchange, error: message, loading: false } : exchange));
    } finally {
      scrollToBottom();
    }
  }

  function renderPhoto(placeId: string, compact = false) {
    const uri = trustedPhotoUri(placeId);
    if (uri) {
      return <Image source={{ uri }} style={compact ? styles.compactImage : styles.heroImage} resizeMode="cover" />;
    }

    return (
      <View style={compact ? styles.compactPhotoFallback : styles.heroPhotoFallback}>
        <View style={styles.photoFallbackIcon}>
          <AppIcon name="trail" color="#D7B45A" size={compact ? 18 : 24} />
        </View>
        {!compact ? <Text style={styles.photoFallbackText}>Place photo coming soon</Text> : null}
      </View>
    );
  }

  function renderPlace(item: MemberGuideResult['places'][number], index: number) {
    const place = findTrailGuidePlace(item.id);
    if (!place) return null;
    const isBest = index === 0;

    if (isBest) {
      return (
        <Pressable key={item.id} onPress={() => router.push(`/trail-guide/${item.id}` as never)} style={styles.heroCard}>
          {renderPhoto(item.id)}
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>BEST MATCH</Text></View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{place.name}</Text>
            <Text style={styles.heroMeta}>{place.area} · {place.category}</Text>
            <View style={styles.tagRow}>
              <View style={styles.tag}><Text style={styles.tagText}>{place.category}</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Flexible</Text></View>
            </View>
            <Text style={styles.heroReason} numberOfLines={3}>{item.reason}</Text>
            <View style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>View adventure</Text>
              <AppIcon name="chevron-forward" color="#172017" size={18} />
            </View>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable key={item.id} onPress={() => router.push(`/trail-guide/${item.id}` as never)} style={styles.compactCard}>
        {renderPhoto(item.id, true)}
        <View style={styles.compactBody}>
          <Text style={styles.compactTitle} numberOfLines={2}>{place.name}</Text>
          <Text style={styles.compactMeta}>{place.area}</Text>
          <Text style={styles.compactReason} numberOfLines={3}>{item.reason}</Text>
        </View>
      </Pressable>
    );
  }

  function renderPlan(result: MemberGuideResult) {
    if (result.dayPlan.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planEyebrow}>YOUR ADVENTURE PLAN</Text>
              <Text style={styles.planHeaderText}>Half-day adventure</Text>
            </View>
            <AppIcon name="bookmark" color="#D7B45A" size={18} />
          </View>
          {result.dayPlan.map((step, index) => (
            <View key={`${step.time}-${step.title}-${index}`} style={styles.planRow}>
              <View style={styles.timeline}>
                <View style={styles.timelineDot} />
                {index < result.dayPlan.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <Text style={styles.planTime}>{step.time || 'Flexible'}</Text>
              <View style={styles.flex}>
                <Text style={styles.planTitle}>{step.title}</Text>
                <Text style={styles.planNote}>{step.note}</Text>
              </View>
            </View>
          ))}
          <View style={styles.planActions}>
            <Pressable style={styles.secondaryButton} onPress={() => void ask('Invite TrailMates to this plan')}>
              <AppIcon name="trail-family" color="#F4EBD4" size={16} />
              <Text style={styles.secondaryButtonText}>Invite TrailMates</Text>
            </Pressable>
            <Pressable style={styles.primaryPlanButton} onPress={() => void ask('Schedule this outing')}>
              <AppIcon name="calendar" color="#172017" size={16} />
              <Text style={styles.primaryPlanButtonText}>Schedule outing</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function renderResult(exchange: Exchange) {
    const result = exchange.result;
    if (!result) return null;
    const wantsMemory = MEMORY_INTENT.test(exchange.query);
    const primary = result.places[0];
    const expanded = Boolean(expandedResults[exchange.id]);
    const alternates = expanded ? result.places.slice(1) : result.places.slice(1, 3);
    const hasMore = result.places.length > 3;
    const shouldOfferWiden = result.source === 'fallback' && result.places.length === 0;

    return (
      <View style={styles.resultBlock}>
        <View style={styles.goTurn}>
          <View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View>
          <View style={styles.goBubble}>
            <Text style={styles.goAnswer}>{result.answer}</Text>
          </View>
        </View>

        {shouldOfferWiden ? (
          <Pressable onPress={() => void ask(`Widen the search around ${cityName}`)} style={styles.matchAssist}>
            <AppIcon name="search" color="#D7B45A" size={15} />
            <Text style={styles.matchAssistText}>I do not have a strong nearby match yet. Widen the search.</Text>
          </Pressable>
        ) : null}

        {renderPlan(result)}

        {primary ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>GO'S PICK FOR YOU ✦</Text>
            {renderPlace(primary, 0)}
          </View>
        ) : null}

        {alternates.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionEyebrow}>OTHER GOOD MATCHES</Text>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  if (hasMore) {
                    setExpandedResults((current) => ({ ...current, [exchange.id]: !expanded }));
                  } else {
                    void ask('Show me more nearby options');
                  }
                }}
              >
                <Text style={styles.sectionLink}>{hasMore ? (expanded ? 'Show less' : 'Show more') : 'Find more'}</Text>
              </Pressable>
            </View>
            <View style={styles.altGrid}>
              {alternates.map((item, index) => <View key={item.id} style={styles.altCell}>{renderPlace(item, index + 1)}</View>)}
            </View>
          </View>
        ) : null}

        {result.communityStops.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>COMMUNITY-OWNED STOPS</Text>
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
          </View>
        ) : null}

        {wantsMemory && result.memoryHits.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>FROM YOUR TRAIL</Text>
            <View style={styles.stackGap}>
              {result.memoryHits.map((memory) => (
                <View key={memory.adventureId} style={styles.memoryCard}>
                  <Text style={styles.placeTitle}>{memory.title}</Text>
                  <Text style={styles.placeMeta}>{new Date(memory.experiencedAt).toLocaleDateString()}</Text>
                  <Text style={styles.placeReason}>{memory.note}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {result.followUps.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>REFINE YOUR RESULTS</Text>
            <View style={styles.followWrap}>
              {result.followUps.map((follow) => (
                <Pressable key={follow} disabled={busy} onPress={() => void ask(follow)} style={styles.followChip}>
                  <Text style={styles.followText}>{compactFollowUp(follow)}</Text>
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
          <AppIcon name="chevron-back" color="#FFF8E8" size={22} />
        </Pressable>
        <View style={styles.headerIdentity}>
          <View style={styles.headerSpark}><Text style={styles.headerSparkText}>✦</Text></View>
          <View>
            <Text style={styles.headerTitle}>Ask Go</Text>
            <Text style={styles.headerSubtitle}>Your outdoor guide</Text>
          </View>
        </View>
        <View style={styles.historyPill}>
          <AppIcon name="time" color="#C3CBC5" size={16} />
          <Text style={styles.historyText}>History</Text>
        </View>
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
            <View style={styles.introRow}>
              <View style={styles.largeGoAvatar}><Text style={styles.largeGoAvatarText}>✦</Text></View>
              <View style={styles.introCopy}>
                <Text style={styles.greeting}>Hey TrailMate! 👋</Text>
                <Text style={styles.introText}>Tell me what you're in the mood for and I'll find the best fit I can.</Text>
              </View>
            </View>

            <Text style={styles.sectionEyebrow}>POPULAR STARTS</Text>
            <View style={styles.promptGrid}>
              {starterPrompts.map((prompt) => (
                <Pressable key={prompt.title} onPress={() => void ask(prompt.title)} style={styles.promptCard}>
                  <Text style={styles.promptIcon}>{promptIcon(prompt.icon)}</Text>
                  <View style={styles.promptTextWrap}>
                    <Text style={styles.promptTitle}>{prompt.title}</Text>
                    <Text style={styles.promptSubtitle}>{prompt.subtitle}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionEyebrow}>YOUR CONTEXT</Text>
            <View style={styles.contextRow}>
              <View style={styles.contextCard}>
                <AppIcon name="location" color="#83B779" size={17} />
                <View>
                  <Text style={styles.contextTitle}>{cityName}, FL</Text>
                  <Text style={styles.contextAction}>Current area</Text>
                </View>
              </View>
              <View style={styles.contextCard}>
                <AppIcon name="calendar" color="#83B779" size={17} />
                <View>
                  <Text style={styles.contextTitle}>This weekend</Text>
                  <Text style={styles.contextAction}>Flexible timing</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionEyebrow}>RECENT SEARCHES</Text>
            <Pressable onPress={() => void ask('Easy day near water')} style={styles.recentCard}>
              <View style={styles.recentIcon}><AppIcon name="trail" color="#D7B45A" size={19} /></View>
              <View style={styles.flex}>
                <Text style={styles.recentTitle}>Easy day near water</Text>
                <Text style={styles.recentMeta}>A quick starting point for nearby ideas</Text>
              </View>
              <AppIcon name="chevron-forward" color="#77827B" size={18} />
            </Pressable>
          </View>
        ) : null}

        {exchanges.map((exchange) => (
          <View key={exchange.id} style={styles.exchange}>
            <View style={styles.userRow}>
              <View style={styles.userBubble}><Text style={styles.userText}>{exchange.query}</Text></View>
            </View>

            {exchange.loading ? (
              <View style={styles.goTurn}>
                <View style={styles.goAvatar}><Text style={styles.goAvatarText}>✦</Text></View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator color="#D7B45A" size="small" />
                  <Text style={styles.typingText}>Building your best options…</Text>
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

        {latest?.result ? <Text style={styles.disclaimer}>Confirm current hours, closures, permits, accessibility, weather, and water conditions before leaving.</Text> : null}
      </ScrollView>

      <View style={styles.composerDock}>
        <View style={styles.composer}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            multiline
            maxLength={2000}
            placeholder={exchanges.length ? 'Ask Go anything…' : `Ask Go about ${cityName}…`}
            placeholderTextColor="#77827B"
            style={styles.composerInput}
          />
          <Pressable
            disabled={busy || query.trim().length < 3}
            onPress={() => void ask()}
            style={[styles.sendButton, (busy || query.trim().length < 3) && styles.sendDisabled]}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09100C' },
  header: { minHeight: 64, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#223029', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSpark: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#352C14', borderWidth: 1, borderColor: '#725F22', alignItems: 'center', justifyContent: 'center' },
  headerSparkText: { color: '#F2CA5F', fontSize: 18, fontWeight: '900' },
  headerTitle: { color: '#FFF9EA', fontSize: 17, fontWeight: '900' },
  headerSubtitle: { color: '#9BA69F', fontSize: 9.5, marginTop: 1 },
  historyPill: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#344039', paddingHorizontal: 11, flexDirection: 'row', gap: 6, alignItems: 'center' },
  historyText: { color: '#D9E0DB', fontSize: 10.5, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 190 },
  emptyState: { paddingTop: 8 },
  introRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 28 },
  largeGoAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#2D2613', borderWidth: 1, borderColor: '#705A20', alignItems: 'center', justifyContent: 'center' },
  largeGoAvatarText: { color: '#F2CA5F', fontSize: 28, fontWeight: '900' },
  introCopy: { flex: 1 },
  greeting: { color: '#FFF8E8', fontSize: 19, lineHeight: 24, fontWeight: '900' },
  introText: { color: '#D1D8D3', fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  section: { marginTop: 18 },
  sectionEyebrow: { color: '#C8B989', fontSize: 9.5, letterSpacing: 1.25, fontWeight: '900', marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLink: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', paddingVertical: 4 },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  promptCard: { width: '48.5%', minHeight: 118, borderRadius: 20, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#101914', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  promptIcon: { color: '#D7B45A', fontSize: 25, width: 28, textAlign: 'center' },
  promptTextWrap: { flex: 1 },
  promptTitle: { color: '#FFF8E8', fontSize: 13.5, lineHeight: 18, fontWeight: '900' },
  promptSubtitle: { color: '#AEB7B1', fontSize: 10.5, lineHeight: 15, marginTop: 6 },
  contextRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  contextCard: { flex: 1, minHeight: 70, borderRadius: 18, borderWidth: 1, borderColor: '#355041', backgroundColor: '#0F1914', flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 13 },
  contextTitle: { color: '#F4F1E8', fontSize: 11.5, fontWeight: '800' },
  contextAction: { color: '#8E9A93', fontSize: 9.5, marginTop: 3 },
  recentCard: { minHeight: 76, borderRadius: 18, borderWidth: 1, borderColor: '#334139', backgroundColor: '#101713', flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  recentIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#1B241E', alignItems: 'center', justifyContent: 'center' },
  recentTitle: { color: '#FFF8E8', fontSize: 12.5, fontWeight: '900' },
  recentMeta: { color: '#8F9A93', fontSize: 9.5, marginTop: 4 },
  exchange: { marginBottom: 20 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
  userBubble: { maxWidth: '78%', borderRadius: 18, borderTopRightRadius: 7, backgroundColor: '#2A312D', paddingHorizontal: 14, paddingVertical: 11 },
  userText: { color: '#F6F1E7', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  goTurn: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12 },
  goAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#352C14', borderWidth: 1, borderColor: '#705A20', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  goAvatarText: { color: '#F2CA5F', fontSize: 15, fontWeight: '900' },
  goBubble: { flex: 1, borderRadius: 17, borderTopLeftRadius: 7, backgroundColor: '#111A15', borderWidth: 1, borderColor: '#2D3832', paddingHorizontal: 13, paddingVertical: 11 },
  goAnswer: { color: '#E5EAE6', fontSize: 12.5, lineHeight: 18 },
  typingBubble: { minHeight: 42, borderRadius: 17, borderTopLeftRadius: 7, backgroundColor: '#111A15', borderWidth: 1, borderColor: '#2D3832', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  typingText: { color: '#9FAAA3', fontSize: 11, fontWeight: '700' },
  errorBubble: { flex: 1, borderRadius: 17, backgroundColor: '#301A18', borderWidth: 1, borderColor: '#5D302A', padding: 12 },
  errorText: { color: '#FFB4A9', fontSize: 11.5, lineHeight: 17 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 14, backgroundColor: '#4B2925', paddingHorizontal: 11, paddingVertical: 7 },
  retryText: { color: '#FFD3CC', fontSize: 10.5, fontWeight: '900' },
  resultBlock: { marginTop: 2 },
  matchAssist: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#4A4021', backgroundColor: '#191911', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  matchAssistText: { flex: 1, color: '#C8B982', fontSize: 10.5, lineHeight: 15 },
  heroCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#39443E', backgroundColor: '#121A16' },
  heroImage: { width: '100%', height: 134 },
  heroPhotoFallback: { width: '100%', height: 118, backgroundColor: '#17211B', alignItems: 'center', justifyContent: 'center', gap: 7 },
  photoFallbackIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#262719', borderWidth: 1, borderColor: '#5B4C22', alignItems: 'center', justifyContent: 'center' },
  photoFallbackText: { color: '#919C95', fontSize: 9.5, fontWeight: '700' },
  heroBadge: { position: 'absolute', left: 12, top: 12, borderRadius: 14, backgroundColor: 'rgba(66,52,14,0.94)', borderWidth: 1, borderColor: '#8B7025', paddingHorizontal: 9, paddingVertical: 5 },
  heroBadgeText: { color: '#F0C75F', fontSize: 8.5, letterSpacing: 0.8, fontWeight: '900' },
  heroContent: { padding: 14 },
  heroTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  heroMeta: { color: '#AEB7B1', fontSize: 10.5, marginTop: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  tag: { borderRadius: 14, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#12241A', paddingHorizontal: 9, paddingVertical: 5 },
  tagText: { color: '#A9D995', fontSize: 9.5, fontWeight: '800' },
  heroReason: { color: '#C6CEC8', fontSize: 11.5, lineHeight: 17, marginTop: 9 },
  primaryButton: { height: 42, borderRadius: 13, backgroundColor: '#D7B45A', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  primaryButtonText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  altGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  altCell: { width: '48.5%' },
  compactCard: { minHeight: 184, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#334039', backgroundColor: '#111915' },
  compactImage: { width: '100%', height: 82 },
  compactPhotoFallback: { width: '100%', height: 82, backgroundColor: '#17211B', alignItems: 'center', justifyContent: 'center' },
  compactBody: { padding: 11, minHeight: 100 },
  compactTitle: { minHeight: 30, color: '#FFF8E8', fontSize: 11.5, lineHeight: 15, fontWeight: '900' },
  compactMeta: { color: '#8F9A93', fontSize: 9, marginTop: 3 },
  compactReason: { color: '#B2BBB5', fontSize: 9.5, lineHeight: 14, marginTop: 7 },
  stackGap: { gap: 9 },
  communityCard: { borderRadius: 16, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#102119', padding: 13 },
  communityTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  communityLabel: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  verified: { color: '#79D26A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  placeTitle: { color: '#FFF8E8', fontSize: 14.5, lineHeight: 20, fontWeight: '900', marginTop: 8 },
  placeMeta: { color: '#8D9891', fontSize: 10, marginTop: 3 },
  placeReason: { color: '#AEB7B1', fontSize: 11, lineHeight: 16, marginTop: 7 },
  tags: { color: '#D7B45A', fontSize: 10, fontWeight: '800', marginTop: 4 },
  planCard: { borderRadius: 20, borderWidth: 1, borderColor: '#4A4021', backgroundColor: '#141811', padding: 14 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  planEyebrow: { color: '#C8B989', fontSize: 8.5, letterSpacing: 1.05, fontWeight: '900' },
  planHeaderText: { color: '#FFF3CE', fontSize: 16, fontWeight: '900', marginTop: 3 },
  planRow: { flexDirection: 'row', gap: 8, minHeight: 60, paddingTop: 10 },
  timeline: { width: 14, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#79B36A', borderWidth: 2, borderColor: '#254121', marginTop: 4, zIndex: 2 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#36532C', marginTop: -1 },
  flex: { flex: 1 },
  planTime: { width: 52, color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  planTitle: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '900' },
  planNote: { color: '#A9B1AB', fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  planActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#47544C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryButtonText: { color: '#F4EBD4', fontSize: 10, fontWeight: '800' },
  primaryPlanButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryPlanButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  memoryCard: { borderRadius: 16, borderWidth: 1, borderColor: '#39483F', backgroundColor: '#121A16', padding: 13 },
  followWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  followChip: { borderRadius: 18, borderWidth: 1, borderColor: '#3D4942', backgroundColor: '#121914', paddingHorizontal: 12, paddingVertical: 8 },
  followText: { color: '#D7DED9', fontSize: 10.5, fontWeight: '800' },
  disclaimer: { color: '#66726B', fontSize: 9.5, lineHeight: 14, marginHorizontal: 30, marginTop: 16, textAlign: 'center' },
  composerDock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: 'rgba(9,16,12,0.97)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#223029' },
  composer: { minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: '#354139', backgroundColor: '#101713', flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 14, paddingRight: 6, paddingVertical: 5 },
  composerInput: { flex: 1, minHeight: 40, maxHeight: 106, color: '#FFF8E8', fontSize: 13.5, lineHeight: 19, paddingTop: 9, paddingBottom: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.34 },
  sendText: { color: '#172017', fontSize: 18, lineHeight: 20, fontWeight: '900' },
});
