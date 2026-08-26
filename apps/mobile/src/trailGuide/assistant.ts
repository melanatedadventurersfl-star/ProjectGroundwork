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
};

export type AskMemberGuideInput = {
  query: string;
  cityKey: TrailGuideCityKey;
  cityName: string;
  state?: string;
  weather?: {
    temperatureF?: number | null;
    condition?: string | null;
    rainChance?: number | null;
    windMph?: number | null;
  } | null;
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

  const { data, error } = await supabase.functions.invoke('member-guide', {
    body: {
      query,
      city: input.cityName,
      state: input.state ?? 'FL',
      weather: input.weather ?? null,
      candidates,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.result) throw new Error('I could not build that recommendation right now.');
  return data.result as MemberGuideResult;
}
