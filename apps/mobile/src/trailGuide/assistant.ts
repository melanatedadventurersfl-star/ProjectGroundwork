import Storage from 'expo-sqlite/kv-store';

import { supabase } from '../lib/supabase';
import { trailGuidePlaces, type TrailGuideCityKey, type TrailGuidePlace } from './catalog';

export type MemberGuidePlaceResult = {
  id: string;
  reason: string;
};

export type MemberGuideCommunityStop = {
  placeId: string;
  name: string;
  reason: string;
  ownershipTags: string[];
};

export type MemberGuideMemoryHit = {
  adventureId: string;
  title: string;
  experiencedAt: string;
  note: string;
};

export type MemberGuideDayStep = {
  time: string;
  title: string;
  kind: 'trail-guide' | 'community-stop' | 'other';
  referenceId: string;
  note: string;
};

export type MemberGuideResult = {
  answer: string;
  places: MemberGuidePlaceResult[];
  communityStops: MemberGuideCommunityStop[];
  memoryHits: MemberGuideMemoryHit[];
  dayPlan: MemberGuideDayStep[];
  followUps: string[];
  confidenceNotes: string[];
  responseMode?: 'answer' | 'clarify' | 'discover' | 'plan' | 'modify' | 'compare';
  clarificationQuestion?: string | null;
  clarificationOptions?: string[];
  whyThisPlan?: string;
  source?: 'ai' | 'fallback';
};

export type MemberGuideConversationTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type AskMemberGuideInput = {
  query: string;
  cityKey: TrailGuideCityKey;
  cityName: string;
  state?: string;
  conversation?: MemberGuideConversationTurn[];
  weather?: {
    temperatureF?: number | null;
    condition?: string | null;
    rainChance?: number | null;
    windMph?: number | null;
  } | null;
};

type CompactPlace = ReturnType<typeof compactPlace>;
type AdventureMode = 'discover' | 'compare' | 'plan' | 'detail';

type AdventureConstraints = {
  difficulty: 'beginner' | 'moderate' | null;
  water: boolean | null;
  trail: boolean | null;
  duration: 'short' | 'half-day' | 'full-day' | null;
  foodStop: boolean;
  quieter: boolean;
};

type AdventureSession = {
  version: 1;
  cityKey: TrailGuideCityKey;
  mode: AdventureMode;
  constraints: AdventureConstraints;
  selectedPlaceIds: string[];
  rejectedPlaceIds: string[];
  activePlan: MemberGuideDayStep[];
  previousPlan: MemberGuideDayStep[];
  lastIntent: string;
  updatedAt: string;
};

type FallbackIntent = {
  broadDiscovery: boolean;
  wantsPlan: boolean;
  wantsWater: boolean;
  avoidsWater: boolean;
  wantsEasy: boolean;
  wantsTrail: boolean;
  avoidsTrail: boolean;
  wantsFood: boolean;
  wantsQuieter: boolean;
  wantsShorter: boolean;
  wantsMore: boolean;
  swapSecond: boolean;
  rejectFirst: boolean;
  restorePrevious: boolean;
};

const SESSION_KEY_PREFIX = 'ask-go:adventure-session:v1:';
const NEW_TOPIC_INTENT = /\b(campsgiving|trip|vacation|weekend getaway|camping trip|road trip|new trip|different trip|plan a trip|plan my trip)\b/i;
const MULTIDAY_INTENT = /\b(campsgiving|weekend|overnight|multi[- ]?day|vacation|camping trip|road trip|trip)\b/i;

function compactPlace(place: TrailGuidePlace) {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    area: place.area,
    type: place.type,
    tags: place.tags,
    summary: place.summary,
    details: place.details,
    collections: place.collections,
  };
}

function emptySession(cityKey: TrailGuideCityKey): AdventureSession {
  return {
    version: 1,
    cityKey,
    mode: 'discover',
    constraints: {
      difficulty: null,
      water: null,
      trail: null,
      duration: null,
      foodStop: false,
      quieter: false,
    },
    selectedPlaceIds: [],
    rejectedPlaceIds: [],
    activePlan: [],
    previousPlan: [],
    lastIntent: '',
    updatedAt: new Date().toISOString(),
  };
}

function sessionKey(cityKey: TrailGuideCityKey) {
  return `${SESSION_KEY_PREFIX}${cityKey}`;
}

async function loadSession(cityKey: TrailGuideCityKey): Promise<AdventureSession> {
  try {
    const raw = await Storage.getItem(sessionKey(cityKey));
    if (!raw) return emptySession(cityKey);
    const parsed = JSON.parse(raw) as Partial<AdventureSession>;
    if (parsed.version !== 1 || parsed.cityKey !== cityKey) return emptySession(cityKey);
    return {
      ...emptySession(cityKey),
      ...parsed,
      constraints: { ...emptySession(cityKey).constraints, ...(parsed.constraints ?? {}) },
      selectedPlaceIds: Array.isArray(parsed.selectedPlaceIds) ? parsed.selectedPlaceIds : [],
      rejectedPlaceIds: Array.isArray(parsed.rejectedPlaceIds) ? parsed.rejectedPlaceIds : [],
      activePlan: Array.isArray(parsed.activePlan) ? parsed.activePlan : [],
      previousPlan: Array.isArray(parsed.previousPlan) ? parsed.previousPlan : [],
    };
  } catch {
    return emptySession(cityKey);
  }
}

async function saveSession(session: AdventureSession) {
  const next = { ...session, updatedAt: new Date().toISOString() };
  try {
    await Storage.setItem(sessionKey(session.cityKey), JSON.stringify(next));
  } catch {
    // Session continuity should never block a recommendation.
  }
  return next;
}

function fallbackIntent(query: string): FallbackIntent {
  const lower = query.toLowerCase();
  return {
    broadDiscovery: /\b(weekend|today|tonight|tomorrow|something to do|what should i do|surprise me|get outside|adventure|fun)\b/i.test(lower),
    wantsPlan: /\b(build|plan|itinerary|half[- ]?day|full[- ]?day|adventure for me|make me an adventure|schedule the day|trip)\b/i.test(lower),
    wantsWater: /\b(near water|water|beach|river|lake|spring|swim|paddle|kayak|coast)\b/i.test(lower),
    avoidsWater: /\b(no beach|not a beach|no water|not near water|avoid water)\b/i.test(lower),
    wantsEasy: /\b(easy|easier|beginner|beginner friendly|relax|chill|low key|low-key|family|kids?)\b/i.test(lower),
    wantsTrail: /\b(hike|hiking|trail|walk|walking)\b/i.test(lower),
    avoidsTrail: /\b(no hiking|don't want to hike|do not want to hike|no trail|avoid trails)\b/i.test(lower),
    wantsFood: /\b(lunch|dinner|breakfast|food|eat|restaurant|add a food stop)\b/i.test(lower),
    wantsQuieter: /\b(quiet|quieter|less crowded|avoid crowds|not crowded)\b/i.test(lower),
    wantsShorter: /\b(shorter|quick|under two hours|under 2 hours|short trip)\b/i.test(lower),
    wantsMore: /\b(what else|show more|more options|another option|something else|different|surprise me)\b/i.test(lower),
    swapSecond: /\b(swap|replace|change)\b.*\b(second|2nd)\b|\b(second|2nd)\b.*\b(swap|replace|change)\b/i.test(lower),
    rejectFirst: /\b(not that one|not the first one|don't like the first|do not like the first)\b/i.test(lower),
    restorePrevious: /\b(go back|restore|previous plan|first plan|undo that)\b/i.test(lower),
  };
}

function isNewTopic(query: string, session: AdventureSession) {
  if (!NEW_TOPIC_INTENT.test(query)) return false;
  if (session.activePlan.length === 0 && session.selectedPlaceIds.length === 0) return false;
  const previous = session.lastIntent.toLowerCase();
  const current = query.toLowerCase();
  if (!previous) return true;
  if (current.includes('campsgiving') && !previous.includes('campsgiving')) return true;
  if (/\b(new|different|another)\b/i.test(current)) return true;
  if (/\btrip|vacation|campsgiving\b/i.test(current) && !/\btrip|vacation|campsgiving\b/i.test(previous)) return true;
  return false;
}

function applyIntentToSession(query: string, session: AdventureSession): AdventureSession {
  const intent = fallbackIntent(query);
  const lower = query.toLowerCase();

  if (/\b(start over|new search|new adventure|clear the plan)\b/i.test(lower) || isNewTopic(query, session)) {
    return { ...emptySession(session.cityKey), lastIntent: query };
  }

  const next: AdventureSession = {
    ...session,
    constraints: { ...session.constraints },
    selectedPlaceIds: [...session.selectedPlaceIds],
    rejectedPlaceIds: [...session.rejectedPlaceIds],
    activePlan: [...session.activePlan],
    previousPlan: [...session.previousPlan],
    lastIntent: query,
  };

  if (intent.restorePrevious && next.previousPlan.length > 0) {
    const current = next.activePlan;
    next.activePlan = next.previousPlan;
    next.previousPlan = current;
    next.mode = 'plan';
  }

  if (intent.wantsPlan) next.mode = 'plan';
  if (intent.wantsMore) next.mode = 'discover';
  if (intent.wantsEasy) next.constraints.difficulty = 'beginner';
  if (intent.wantsWater) next.constraints.water = true;
  if (intent.avoidsWater) next.constraints.water = false;
  if (intent.wantsTrail) next.constraints.trail = true;
  if (intent.avoidsTrail) next.constraints.trail = false;
  if (intent.wantsFood) next.constraints.foodStop = true;
  if (intent.wantsQuieter) next.constraints.quieter = true;
  if (intent.wantsShorter) next.constraints.duration = 'short';
  if (/\bhalf[- ]?day\b/i.test(lower)) next.constraints.duration = 'half-day';
  if (/\bfull[- ]?day\b/i.test(lower)) next.constraints.duration = 'full-day';

  if (intent.rejectFirst && next.selectedPlaceIds[0]) {
    next.rejectedPlaceIds = [...new Set([...next.rejectedPlaceIds, next.selectedPlaceIds[0]])];
    next.selectedPlaceIds = next.selectedPlaceIds.slice(1);
  }

  if (intent.swapSecond && next.selectedPlaceIds[1]) {
    next.rejectedPlaceIds = [...new Set([...next.rejectedPlaceIds, next.selectedPlaceIds[1]])];
    next.selectedPlaceIds = next.selectedPlaceIds.filter((_, index) => index !== 1);
    next.mode = 'plan';
  }

  return next;
}

function sessionSummary(session: AdventureSession) {
  const constraints = [
    session.constraints.difficulty ? `difficulty=${session.constraints.difficulty}` : null,
    session.constraints.water !== null ? `water=${session.constraints.water}` : null,
    session.constraints.trail !== null ? `trail=${session.constraints.trail}` : null,
    session.constraints.duration ? `duration=${session.constraints.duration}` : null,
    session.constraints.foodStop ? 'foodStop=true' : null,
    session.constraints.quieter ? 'quieter=true' : null,
  ].filter(Boolean).join(', ');

  return [
    'CURRENT ADVENTURE SESSION',
    `mode=${session.mode}`,
    constraints ? `constraints: ${constraints}` : 'constraints: none yet',
    session.selectedPlaceIds.length ? `selectedPlaceIds: ${session.selectedPlaceIds.join(', ')}` : 'selectedPlaceIds: none',
    session.rejectedPlaceIds.length ? `rejectedPlaceIds: ${session.rejectedPlaceIds.join(', ')}` : 'rejectedPlaceIds: none',
    session.activePlan.length ? `activePlan: ${session.activePlan.map((step) => `${step.time} ${step.title}`).join(' | ')}` : 'activePlan: none',
    'Interpret follow-ups as edits to this session unless the user clearly starts a new trip, event, or planning topic.',
  ].join('\n');
}

function placeHaystack(place: CompactPlace) {
  return [
    place.name,
    place.category,
    place.area,
    place.type,
    ...(place.tags ?? []),
    place.summary,
    ...(place.details ?? []),
    ...(place.collections ?? []),
  ].join(' ').toLowerCase();
}

function placeReason(place: CompactPlace, session: AdventureSession, index: number) {
  const haystack = placeHaystack(place);
  const traits: string[] = [];
  if (/water|beach|river|lake|spring|paddle|kayak|coast|marsh/.test(haystack)) traits.push('water access');
  if (/trail|hike|walk|boardwalk/.test(haystack)) traits.push('walkable trails');
  if (/easy|beginner|family|boardwalk|short|accessible|relax/.test(haystack)) traits.push('an approachable pace');
  if (/wildlife|scenic|preserve|historic/.test(haystack)) traits.push('scenery and exploration');
  if (/camp|overnight/.test(haystack)) traits.push('room to make it a longer outing');

  if (session.constraints.water === true && traits.includes('water access')) return `A good fit for water time with ${traits[1] ?? 'a flexible outdoor pace'}.`;
  if (session.constraints.trail === true && traits.includes('walkable trails')) return `A strong pick for trail time with ${traits.find((trait) => trait !== 'walkable trails') ?? 'a flexible route'}.`;
  if (session.constraints.difficulty === 'beginner' && traits.includes('an approachable pace')) return `Easy to shape around your day, with ${traits.find((trait) => trait !== 'an approachable pace') ?? 'a flexible visit'}.`;
  if (session.constraints.quieter && /preserve|historic|scenic|wildlife/.test(haystack)) return `A calmer-feeling option with ${traits[0] ?? 'space to explore at your own pace'}.`;
  if (traits.length >= 2) return `${index === 0 ? 'A strong first pick' : 'Another good option'} for ${traits[0]} and ${traits[1]}.`;
  if (traits.length === 1) return `${index === 0 ? 'A strong first pick' : 'Another nearby option'} for ${traits[0]}.`;
  return `${index === 0 ? 'A strong first pick' : 'Another nearby option'} around ${place.area} for a flexible outing.`;
}

function scorePlace(place: CompactPlace, session: AdventureSession, index: number) {
  const haystack = placeHaystack(place);
  let score = Math.max(0, 20 - index) * 0.01;

  if (session.constraints.water === true && /water|beach|river|lake|spring|paddle|kayak|coast|marsh/.test(haystack)) score += 5;
  if (session.constraints.water === false && /water|beach|river|lake|spring|paddle|kayak|coast/.test(haystack)) score -= 5;
  if (session.constraints.difficulty === 'beginner' && /easy|beginner|family|boardwalk|short|accessible|relax|park/.test(haystack)) score += 4;
  if (session.constraints.trail === true && /trail|hike|walk|boardwalk/.test(haystack)) score += 4;
  if (session.constraints.trail === false && /trail|hike/.test(haystack)) score -= 4;
  if (session.constraints.quieter && /preserve|historic|wildlife|scenic/.test(haystack)) score += 2;
  if (session.mode === 'plan' && /park|trail|water|scenic|preserve|beach/.test(haystack)) score += 1;
  if (session.selectedPlaceIds.includes(place.id)) score -= 6;
  if (session.rejectedPlaceIds.includes(place.id)) score -= 100;

  return score;
}

function localClarification(query: string, session: AdventureSession): MemberGuideResult | null {
  const lower = query.toLowerCase();
  if (!MULTIDAY_INTENT.test(lower) || !fallbackIntent(query).wantsPlan) return null;
  const hasDateOrDuration = /\b(2\s*(?:to|-)\s*3 hours?|half[- ]?day|full[- ]?day|today|tonight|tomorrow|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(lower);
  if (hasDateOrDuration) return null;
  return {
    answer: 'Absolutely. Before I build this, what kind of trip do you want me to plan?',
    places: [],
    communityStops: [],
    memoryHits: [],
    dayPlan: [],
    followUps: ['Full weekend', 'Camping + activities', 'Activities only', 'Food + activities'],
    confidenceNotes: [],
    responseMode: 'clarify',
    clarificationQuestion: 'What kind of trip do you want me to plan?',
    clarificationOptions: ['Full weekend', 'Camping + activities', 'Activities only', 'Food + activities'],
    source: 'fallback',
  };
}

function buildFallbackPlan(picks: CompactPlace[], session: AdventureSession): MemberGuideDayStep[] {
  const first = picks[0];
  if (!first) return [];
  if (session.constraints.duration !== 'short' && session.constraints.duration !== 'half-day' && session.constraints.duration !== 'full-day') return [];

  if (session.constraints.duration === 'short') {
    return [{
      time: 'Flexible',
      title: first.name,
      kind: 'trail-guide',
      referenceId: first.id,
      note: 'Keep this one simple and leave room to adjust based on current conditions.',
    }];
  }

  const plan: MemberGuideDayStep[] = [{
    time: 'Start',
    title: first.name,
    kind: 'trail-guide',
    referenceId: first.id,
    note: 'Start here, then adjust the rest of the timing around how long you actually want to stay.',
  }];

  const second = picks.find((place) => place.id !== first.id);
  if (second) {
    plan.push({
      time: 'Next',
      title: second.name,
      kind: 'trail-guide',
      referenceId: second.id,
      note: 'Use this as the next stop if the route and current hours make sense when you go.',
    });
  }

  return plan;
}

function buildStatefulFallback(query: string, candidates: CompactPlace[], original: MemberGuideResult, session: AdventureSession): MemberGuideResult {
  const clarification = localClarification(query, session);
  if (clarification) return clarification;
  if (candidates.length === 0) return original;

  const intent = fallbackIntent(query);
  const isRefinement = intent.wantsEasy || intent.wantsWater || intent.avoidsWater || intent.wantsTrail || intent.avoidsTrail || intent.wantsFood || intent.wantsQuieter || intent.wantsShorter || intent.wantsMore || intent.swapSecond || intent.rejectFirst || intent.restorePrevious;
  const shouldEnhance = original.places.length === 0 || session.mode === 'plan' || isRefinement;
  if (!shouldEnhance) return original;

  const scored = candidates
    .map((place, index) => ({ place, score: scorePlace(place, session, index) }))
    .sort((a, b) => b.score - a.score);

  const excludeSelected = intent.wantsMore;
  const pickedPlaces = scored
    .filter(({ place }) => !session.rejectedPlaceIds.includes(place.id))
    .filter(({ place }) => !excludeSelected || !session.selectedPlaceIds.includes(place.id))
    .slice(0, 4)
    .map((row) => row.place);

  const places = pickedPlaces.map((place, index) => ({
    id: place.id,
    reason: placeReason(place, session, index),
  }));

  const dayPlan = session.mode === 'plan' ? buildFallbackPlan(pickedPlaces, session) : [];
  let answer = 'I found a few different options and avoided recently recycled picks where possible.';
  if (intent.restorePrevious && session.activePlan.length > 0) answer = 'I brought the previous plan back.';
  else if (intent.swapSecond) answer = 'I replaced the second stop and kept the rest of the plan intact.';
  else if (intent.rejectFirst) answer = 'I removed that option and moved a different match up.';
  else if (intent.wantsMore) answer = 'Here are different options from the ones we were already considering.';
  else if (session.mode === 'plan' && dayPlan.length === 0) answer = 'I need a little more detail before I turn these into a real itinerary.';
  else if (session.mode === 'plan') answer = 'I narrowed this around your current preferences without forcing it into the same canned itinerary.';

  return {
    ...original,
    answer,
    places,
    dayPlan,
    followUps: session.mode === 'plan'
      ? ['Ask me what you still need', 'Show different options', 'Make it easier', 'Add a food stop']
      : ['Build a plan from one of these', 'Near water', 'Something quieter', 'Show different options'],
  };
}

function updateSessionFromResult(session: AdventureSession, result: MemberGuideResult): AdventureSession {
  const selectedPlaceIds = result.places.map((place) => place.id).filter(Boolean);
  const next: AdventureSession = {
    ...session,
    selectedPlaceIds: selectedPlaceIds.length > 0 ? selectedPlaceIds : session.selectedPlaceIds,
    activePlan: result.dayPlan.length > 0 ? result.dayPlan : session.activePlan,
  };
  if (result.responseMode === 'clarify') return next;
  if (result.dayPlan.length > 0) next.mode = 'plan';
  return next;
}

export function findTrailGuidePlace(id: string) {
  return trailGuidePlaces.find((place) => place.id === id) ?? null;
}

export async function askMemberGuide(input: AskMemberGuideInput): Promise<MemberGuideResult> {
  const query = input.query.trim();
  if (query.length < 3) throw new Error('Ask me what you want to do, find, or remember.');

  const candidates = trailGuidePlaces
    .filter((place) => place.city === input.cityKey)
    .slice(0, 80)
    .map(compactPlace);

  let session = applyIntentToSession(query, await loadSession(input.cityKey));
  const conversation = (input.conversation ?? [])
    .slice(-6)
    .map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, 1200) }))
    .filter((turn) => turn.text.length > 0);

  const conversationWithState: MemberGuideConversationTurn[] = [
    ...conversation,
    { role: 'assistant', text: sessionSummary(session) },
  ];

  const { data, error } = await supabase.functions.invoke('member-guide', {
    body: {
      query,
      city: input.cityName,
      state: input.state ?? 'FL',
      weather: input.weather ?? null,
      candidates,
      conversation: conversationWithState,
      session,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.result) throw new Error('I could not build that recommendation right now.');

  if (data?.diagnostics?.topicChanged === true) {
    session = { ...emptySession(input.cityKey), lastIntent: query };
  }

  const serverSource = String(data.source ?? 'ai');
  const source: NonNullable<MemberGuideResult['source']> = serverSource === 'fallback' || serverSource === 'catalog_fallback' ? 'fallback' : 'ai';
  let result: MemberGuideResult = {
    ...(data.result as MemberGuideResult),
    source,
  };

  if (serverSource === 'fallback') {
    result = buildStatefulFallback(query, candidates, result, session);
  }

  session = updateSessionFromResult(session, result);
  await saveSession(session);
  return result;
}
