import { Image } from 'react-native';

import { supabase } from '../lib/supabase';
import type { TrailGuidePlace } from './catalog';
import type { TrailGuidePhoto } from './placePhotos';

type GooglePlacePhotoItem = {
  url?: string;
  sourceUrl?: string;
  title?: string;
  credit?: string;
  attributionUri?: string | null;
};

type GooglePlacePhotoResponse = {
  photo?: GooglePlacePhotoItem | null;
  photos?: GooglePlacePhotoItem[];
  placeId?: string | null;
  mapsUrl?: string | null;
  formattedAddress?: string | null;
  error?: string;
};

const sessionCache = new Map<string, Promise<TrailGuidePhoto | null>>();
const gallerySessionCache = new Map<string, Promise<TrailGuidePhoto[]>>();

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

export async function resolveGoogleTrailGuidePlaceGallery(place: TrailGuidePlace): Promise<TrailGuidePhoto[]> {
  const existing = gallerySessionCache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<GooglePlacePhotoResponse>('place-photo', {
        body: { name: place.name, area: place.area, state: 'FL', includeGallery: true },
      });
      if (error || data?.error) return [];

      const items = Array.isArray(data?.photos) ? data.photos : data?.photo ? [data.photo] : [];
      const candidates = items
        .map((item) => toTrailGuidePhoto(item, place, data?.mapsUrl))
        .filter((photo): photo is TrailGuidePhoto => Boolean(photo));

      const loaded = await Promise.all(candidates.map(async (photo) => await preload(photo.url) ? photo : null));
      const valid = loaded.filter((photo): photo is TrailGuidePhoto => Boolean(photo));
      return valid.filter((photo, index, all) => all.findIndex((candidate) => candidate.url === photo.url) === index);
    } catch {
      return [];
    }
  })();

  gallerySessionCache.set(place.id, pending);
  const result = await pending;
  if (result.length === 0) gallerySessionCache.delete(place.id);
  return result;
}

export async function resolveGoogleTrailGuidePlacePhoto(place: TrailGuidePlace): Promise<TrailGuidePhoto | null> {
  const existing = sessionCache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    const gallery = await resolveGoogleTrailGuidePlaceGallery(place);
    return gallery[0] ?? null;
  })();

  sessionCache.set(place.id, pending);
  const result = await pending;
  if (!result) sessionCache.delete(place.id);
  return result;
}

export function clearGoogleTrailGuidePhotoSessionCache() {
  sessionCache.clear();
  gallerySessionCache.clear();
}
