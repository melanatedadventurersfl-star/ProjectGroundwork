import { Image } from 'react-native';

import { supabase } from '../lib/supabase';
import type { TrailGuidePlace } from './catalog';
import type { TrailGuidePhoto } from './placePhotos';

type GooglePlacePhotoResponse = {
  photo?: {
    url?: string;
    sourceUrl?: string;
    title?: string;
    credit?: string;
    attributionUri?: string | null;
  } | null;
  placeId?: string | null;
  mapsUrl?: string | null;
  formattedAddress?: string | null;
  error?: string;
};

const sessionCache = new Map<string, Promise<TrailGuidePhoto | null>>();

async function preload(url: string) {
  try {
    return await Image.prefetch(url);
  } catch {
    return false;
  }
}

export async function resolveGoogleTrailGuidePlacePhoto(place: TrailGuidePlace): Promise<TrailGuidePhoto | null> {
  const existing = sessionCache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<GooglePlacePhotoResponse>('place-photo', {
        body: { name: place.name, area: place.area, state: 'FL' },
      });
      if (error || data?.error || !data?.photo?.url) return null;
      const loaded = await preload(data.photo.url);
      if (!loaded) return null;
      return {
        url: data.photo.url,
        sourceUrl: data.photo.sourceUrl || data.mapsUrl || 'https://maps.google.com',
        title: data.photo.title || place.name,
        credit: data.photo.credit || 'Google Maps',
      } satisfies TrailGuidePhoto;
    } catch {
      return null;
    }
  })();

  sessionCache.set(place.id, pending);
  const result = await pending;
  if (!result) sessionCache.delete(place.id);
  return result;
}

export function clearGoogleTrailGuidePhotoSessionCache() {
  sessionCache.clear();
}
