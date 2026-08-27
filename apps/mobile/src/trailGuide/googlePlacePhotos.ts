import { Image } from 'react-native';

import { supabase } from '../lib/supabase';
import type { TrailGuidePlace } from './catalog';
import type { TrailGuidePhoto } from './placePhotos';

type GooglePlacePhotoItem = {
  url?: string;
  sourceUrl?: string | null;
  title?: string;
  credit?: string;
  attributionUri?: string | null;
};

type GooglePlacePhotoResponse = {
  place?: {
    placeId?: string | null;
    displayName?: string | null;
    formattedAddress?: string | null;
    mapsUrl?: string | null;
    websiteUrl?: string | null;
    rating?: number | null;
    userRatingCount?: number | null;
    openNow?: boolean | null;
    weekdayDescriptions?: string[] | null;
    businessStatus?: string | null;
  } | null;
  photo?: GooglePlacePhotoItem | null;
  photos?: GooglePlacePhotoItem[] | null;
  placeId?: string | null;
  mapsUrl?: string | null;
  formattedAddress?: string | null;
  error?: string;
};

export type GoogleTrailGuidePlaceDetails = {
  placeId: string | null;
  displayName: string;
  formattedAddress: string | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  rating: number | null;
  userRatingCount: number | null;
  openNow: boolean | null;
  weekdayDescriptions: string[];
  businessStatus: string | null;
  photos: TrailGuidePhoto[];
};

const detailsSessionCache = new Map<string, Promise<GoogleTrailGuidePlaceDetails | null>>();

async function preload(url: string) {
  try {
    return await Image.prefetch(url);
  } catch {
    return false;
  }
}

function toTrailGuidePhoto(item: GooglePlacePhotoItem, place: TrailGuidePlace, mapsUrl?: string | null): TrailGuidePhoto | null {
  if (!item.url) return null;
  return {
    url: item.url,
    sourceUrl: item.sourceUrl || mapsUrl || 'https://maps.google.com',
    title: item.title || place.name,
    credit: item.credit || 'Google Maps',
  };
}

export async function resolveGoogleTrailGuidePlaceDetails(place: TrailGuidePlace): Promise<GoogleTrailGuidePlaceDetails | null> {
  const existing = detailsSessionCache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<GooglePlacePhotoResponse>('place-photo', {
        body: { name: place.name, area: place.area, state: 'FL', includeGallery: true },
      });
      if (error || data?.error) return null;

      const placeData = data?.place;
      const mapsUrl = placeData?.mapsUrl ?? data?.mapsUrl ?? null;
      const items = Array.isArray(data?.photos) ? data.photos : data?.photo ? [data.photo] : [];
      const candidates = items
        .map((item) => toTrailGuidePhoto(item, place, mapsUrl))
        .filter((photo): photo is TrailGuidePhoto => Boolean(photo));
      const loaded = await Promise.all(candidates.map(async (photo) => await preload(photo.url) ? photo : null));
      const photos = loaded
        .filter((photo): photo is TrailGuidePhoto => Boolean(photo))
        .filter((photo, index, all) => all.findIndex((candidate) => candidate.url === photo.url) === index);

      return {
        placeId: placeData?.placeId ?? data?.placeId ?? null,
        displayName: placeData?.displayName || place.name,
        formattedAddress: placeData?.formattedAddress ?? data?.formattedAddress ?? null,
        mapsUrl,
        websiteUrl: placeData?.websiteUrl ?? null,
        rating: typeof placeData?.rating === 'number' ? placeData.rating : null,
        userRatingCount: typeof placeData?.userRatingCount === 'number' ? placeData.userRatingCount : null,
        openNow: typeof placeData?.openNow === 'boolean' ? placeData.openNow : null,
        weekdayDescriptions: Array.isArray(placeData?.weekdayDescriptions) ? placeData.weekdayDescriptions : [],
        businessStatus: placeData?.businessStatus ?? null,
        photos,
      };
    } catch {
      return null;
    }
  })();

  detailsSessionCache.set(place.id, pending);
  const result = await pending;
  if (!result) detailsSessionCache.delete(place.id);
  return result;
}

export async function resolveGoogleTrailGuidePlaceGallery(place: TrailGuidePlace): Promise<TrailGuidePhoto[]> {
  const details = await resolveGoogleTrailGuidePlaceDetails(place);
  return details?.photos ?? [];
}

export async function resolveGoogleTrailGuidePlacePhoto(place: TrailGuidePlace): Promise<TrailGuidePhoto | null> {
  const details = await resolveGoogleTrailGuidePlaceDetails(place);
  return details?.photos[0] ?? null;
}

export function clearGoogleTrailGuidePhotoSessionCache() {
  detailsSessionCache.clear();
}
