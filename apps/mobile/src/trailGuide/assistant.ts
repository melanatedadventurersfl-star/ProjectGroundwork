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

function buildResilientFallback(query: string, candidates: CompactPlace[], original: MemberGuideResult): MemberGuideResult {
  if (original.places.length > 0 || candidates.length === 0) return original;

  const lower = query.toLowerCase();
  const broadDiscovery = /\b(weekend|today|tonight|tomorrow|something to do|what should i do|surprise me|get outside|adventure|fun)\b/i.test(lower);
  const wantsWater = /\b(water|beach|river|lake|spring|swim|paddle|kayak|coast)\b/i.test(lower);
  const wantsEasy = /\b(easy|beginner|relax|chill|low key|low-key|family|kids?)\b/i.test(lower);
  const wantsTrail = /\b(hike|hiking|trail|walk|walking)\b/i.test(lower);

  const scored = candidates.map((place, index) => {
    const haystack = [place.name, place.category, place.area, place.type, ...(place.tags ?? []), place.summary, ...(place.details ?? []), ...(place.collections ?? [])]
      .join(' ')
      .toLowerCase();
    let score = Math.max(0, 20 - index) * 0.01;
    if (wantsWater && /water|beach|river|lake|spring|paddle|kayak|coast|marsh/.test(haystack)) score += 4;
    if (wantsEasy && /easy|beginner|family|boardwalk|short|accessible|relax/.test(haystack)) score += 3;
    if (wantsTrail && /trail|hike|walk|boardwalk/.test(haystack)) score += 3;
    if (broadDiscovery) score += 1;
    return { place, score };
  }).sort((a, b) => b.score - a.score);

  const picks = scored.slice(0, 3).map(({ place }, index) => ({
    id: place.id,
    reason: index === 0
      ? `A strong nearby option around ${place.area} for a flexible outing.`
      : `Another nearby option worth considering around ${place.area}.`,
  }));

  return {
    ...original,
    answer: broadDiscovery
      ? `I found a few good nearby options to get you started. Here is the one I would look at first.`
      : `I found a few nearby options that are a reasonable fit. You can refine from here.`,
    places: picks,
    followUps: ['Make it beginner friendly', 'Build a half-day plan', 'Near water', 'Closer to me'],
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
