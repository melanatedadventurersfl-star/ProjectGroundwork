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

type FallbackIntent = {
  broadDiscovery: boolean;
  wantsPlan: boolean;
  wantsWater: boolean;
  wantsEasy: boolean;
  wantsTrail: boolean;
};

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

function fallbackIntent(query: string): FallbackIntent {
  const lower = query.toLowerCase();
  return {
    broadDiscovery: /\b(weekend|today|tonight|tomorrow|something to do|what should i do|surprise me|get outside|adventure|fun)\b/i.test(lower),
    wantsPlan: /\b(build|plan|itinerary|half[- ]?day|full[- ]?day|adventure for me|make me an adventure)\b/i.test(lower),
    wantsWater: /\b(water|beach|river|lake|spring|swim|paddle|kayak|coast)\b/i.test(lower),
    wantsEasy: /\b(easy|beginner|relax|chill|low key|low-key|family|kids?)\b/i.test(lower),
    wantsTrail: /\b(hike|hiking|trail|walk|walking)\b/i.test(lower),
  };
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

function placeReason(place: CompactPlace, intent: FallbackIntent, index: number) {
  const haystack = placeHaystack(place);
  const traits: string[] = [];
  if (/water|beach|river|lake|spring|paddle|kayak|coast|marsh/.test(haystack)) traits.push('water access');
  if (/trail|hike|walk|boardwalk/.test(haystack)) traits.push('walkable trails');
  if (/easy|beginner|family|boardwalk|short|accessible|relax/.test(haystack)) traits.push('an approachable pace');
  if (/wildlife|scenic|preserve|historic/.test(haystack)) traits.push('scenery and exploration');
  if (/camp|overnight/.test(haystack)) traits.push('room to make it a longer outing');

  if (intent.wantsWater && traits.includes('water access')) return `A good fit for water time with ${traits[1] ?? 'a flexible outdoor pace'}.`;
  if (intent.wantsTrail && traits.includes('walkable trails')) return `A strong pick for trail time with ${traits.find((trait) => trait !== 'walkable trails') ?? 'a flexible route'}.`;
  if (intent.wantsEasy && traits.includes('an approachable pace')) return `Easy to shape around your day, with ${traits.find((trait) => trait !== 'an approachable pace') ?? 'a flexible visit'}.`;
  if (traits.length >= 2) return `${index === 0 ? 'A strong first pick' : 'Another good option'} for ${traits[0]} and ${traits[1]}.`;
  if (traits.length === 1) return `${index === 0 ? 'A strong first pick' : 'Another nearby option'} for ${traits[0]}.`;
  return `${index === 0 ? 'A strong first pick' : 'Another nearby option'} around ${place.area} for a flexible outing.`;
}

function buildFallbackPlan(picks: CompactPlace[]): MemberGuideDayStep[] {
  if (picks.length === 0) return [];
  const first = picks[0];
  const second = picks[1] ?? picks[0];
  return [
    {
      time: '10:00 AM',
      title: first.name,
      kind: 'trail-guide',
      referenceId: first.id,
      note: `Start here and give yourself about 90 minutes to explore at an easy pace.`,
    },
    {
      time: '12:00 PM',
      title: 'Break + lunch',
      kind: 'other',
      referenceId: '',
      note: 'Take a reset before the second stop. Ask Go to add a verified community-owned food option.',
    },
    {
      time: '1:30 PM',
      title: second.name,
      kind: 'trail-guide',
      referenceId: second.id,
      note: `Finish with a different kind of outdoor stop so the day feels varied without being packed.`,
    },
  ];
}

function buildResilientFallback(query: string, candidates: CompactPlace[], original: MemberGuideResult): MemberGuideResult {
  if (candidates.length === 0) return original;

  const intent = fallbackIntent(query);
  const shouldEnhance = original.places.length === 0 || intent.wantsPlan;
  if (!shouldEnhance) return original;

  const scored = candidates.map((place, index) => {
    const haystack = placeHaystack(place);
    let score = Math.max(0, 20 - index) * 0.01;
    if (intent.wantsWater && /water|beach|river|lake|spring|paddle|kayak|coast|marsh/.test(haystack)) score += 4;
    if (intent.wantsEasy && /easy|beginner|family|boardwalk|short|accessible|relax/.test(haystack)) score += 3;
    if (intent.wantsTrail && /trail|hike|walk|boardwalk/.test(haystack)) score += 3;
    if (intent.broadDiscovery) score += 1;
    if (intent.wantsPlan && /park|trail|water|scenic|preserve|beach/.test(haystack)) score += 1;
    return { place, score };
  }).sort((a, b) => b.score - a.score);

  const pickedPlaces = scored.slice(0, 3).map((row) => row.place);
  const places = pickedPlaces.map((place, index) => ({
    id: place.id,
    reason: placeReason(place, intent, index),
  }));

  const dayPlan = intent.wantsPlan ? buildFallbackPlan(pickedPlaces) : original.dayPlan;
  const answer = intent.wantsPlan
    ? `I built you a simple half-day adventure. Start with ${pickedPlaces[0]?.name ?? 'the first stop'}, take a break, then finish with a second nearby option.`
    : intent.broadDiscovery
      ? `I would start with ${pickedPlaces[0]?.name ?? 'this first option'}. Here are a few nearby choices you can shape around your day.`
      : `I found a few nearby options that fit the direction of your request.`;

  return {
    ...original,
    answer,
    places,
    dayPlan,
    followUps: intent.wantsPlan
      ? ['Make it beginner friendly', 'Add a food stop', 'Near water', 'Make it shorter']
      : ['Make it beginner friendly', 'Build a half-day plan', 'Near water', 'Closer to me'],
  };
}

export function findTrailGuidePlace(id: string) {
  return trailGuidePlaces.find((place) => place.id === id) ?? null;
}

export async function askMemberGuide(input: AskMemberGuideInput): Promise<MemberGuideResult> {
  const query = input.query.trim();
  if (query.length < 3) throw new Error('Ask me what you want to do, find, or remember.');

  const candidates = trailGuidePlaces
    .filter((place) => place.city === input.cityKey)
    .slice(0, 60)
    .map(compactPlace);

  const conversation = (input.conversation ?? [])
    .slice(-6)
    .map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, 1200) }))
    .filter((turn) => turn.text.length > 0);

  const { data, error } = await supabase.functions.invoke('member-guide', {
    body: {
      query,
      city: input.cityName,
      state: input.state ?? 'FL',
      weather: input.weather ?? null,
      candidates,
      conversation,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.result) throw new Error('I could not build that recommendation right now.');

  const source: NonNullable<MemberGuideResult['source']> = data.source === 'fallback' ? 'fallback' : 'ai';
  const result: MemberGuideResult = {
    ...(data.result as MemberGuideResult),
    source,
  };

  return source === 'fallback' ? buildResilientFallback(query, candidates, result) : result;
}
