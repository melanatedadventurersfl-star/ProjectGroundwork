import { supabase } from '../lib/supabase';
import type { TrailGuidePlace } from './catalog';
import type { TrailGuidePhoto } from './placePhotos';

export type GooglePhotoCategory =
  | 'campsite'
  | 'rv_site'
  | 'tent_site'
  | 'beach'
  | 'water'
  | 'landscape'
  | 'trail'
  | 'recreation'
  | 'building'
  | 'sign'
  | 'bathroom'
  | 'wildlife'
  | 'food'
  | 'person_heavy'
  | 'other';

export type GooglePhotoPurpose = 'card' | 'hero';

type GooglePlacePhotoAnalysis = {
  category?: GooglePhotoCategory;
  heroSuitability?: number;
  representativeness?: number;
  destinationMatch?: number;
  peopleHeavy?: boolean;
};

type GooglePlacePhotoItem = {
  url?: string;
  sourceUrl?: string | null;
  title?: string;
  credit?: string;
  attributionUri?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  order?: number;
  analysis?: GooglePlacePhotoAnalysis | null;
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

export type GoogleTrailGuidePhoto = TrailGuidePhoto & {
  attributionUri: string | null;
  widthPx: number | null;
  heightPx: number | null;
  order: number;
  category: GooglePhotoCategory | null;
  heroSuitability: number | null;
  representativeness: number | null;
  destinationMatch: number | null;
  peopleHeavy: boolean;
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
  photos: GoogleTrailGuidePhoto[];
};

type ResolveOptions = {
  purpose?: GooglePhotoPurpose;
  analyze?: boolean;
};

type PhotoRequestLane = 'hero' | 'card' | 'background';

const detailsSessionCache = new Map<string, Promise<GoogleTrailGuidePlaceDetails | null>>();
const requestQueues: Record<PhotoRequestLane, Array<() => void>> = {
  hero: [],
  card: [],
  background: [],
};
const MAX_CONCURRENT_PHOTO_REQUESTS = 2;
let activePhotoRequests = 0;

function drainPhotoRequestQueue() {
  while (activePhotoRequests < MAX_CONCURRENT_PHOTO_REQUESTS) {
    const start = requestQueues.hero.shift() ?? requestQueues.card.shift() ?? requestQueues.background.shift();
    if (!start) break;
    start();
  }
}

function queuePhotoRequest<T>(lane: PhotoRequestLane, task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    requestQueues[lane].push(() => {
      activePhotoRequests += 1;
      void task()
        .then(resolve, reject)
        .finally(() => {
          activePhotoRequests = Math.max(0, activePhotoRequests - 1);
          drainPhotoRequestQueue();
        });
    });
    drainPhotoRequestQueue();
  });
}

function numeric01(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}

function cacheKey(placeId: string, purpose: GooglePhotoPurpose, analyze: boolean) {
  return `${placeId}:${purpose}:${analyze ? 'ranked' : 'fast'}`;
}

function toTrailGuidePhoto(item: GooglePlacePhotoItem, place: TrailGuidePlace, mapsUrl?: string | null): GoogleTrailGuidePhoto | null {
  if (!item.url) return null;
  return {
    url: item.url,
    sourceUrl: item.sourceUrl || mapsUrl || 'https://maps.google.com',
    title: item.title || place.name,
    credit: item.credit || 'Google Maps',
    attributionUri: item.attributionUri ?? null,
    widthPx: Number.isFinite(Number(item.widthPx)) ? Number(item.widthPx) : null,
    heightPx: Number.isFinite(Number(item.heightPx)) ? Number(item.heightPx) : null,
    order: Number.isInteger(item.order) ? Number(item.order) : 0,
    category: item.analysis?.category ?? null,
    heroSuitability: numeric01(item.analysis?.heroSuitability),
    representativeness: numeric01(item.analysis?.representativeness),
    destinationMatch: numeric01(item.analysis?.destinationMatch),
    peopleHeavy: item.analysis?.peopleHeavy === true,
  };
}

export async function resolveGoogleTrailGuidePlaceDetails(
  place: TrailGuidePlace,
  options: ResolveOptions = {},
): Promise<GoogleTrailGuidePlaceDetails | null> {
  const purpose = options.purpose ?? 'hero';
  const analyze = options.analyze === true;
  const key = cacheKey(place.id, purpose, analyze);
  const existing = detailsSessionCache.get(key);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const lane: PhotoRequestLane = analyze ? 'background' : purpose === 'hero' ? 'hero' : 'card';
      const { data, error } = await queuePhotoRequest(lane, () => supabase.functions.invoke<GooglePlacePhotoResponse>('place-photo', {
        body: {
          name: place.name,
          area: place.area,
          state: 'FL',
          includeGallery: true,
          includeHeroAnalysis: analyze,
          photoPurpose: purpose,
          maxPhotos: purpose === 'card' || !analyze ? 3 : 8,
          analysisLimit: 3,
          trailGuideCategory: place.category,
          trailGuideType: place.type,
          trailGuideTags: place.tags,
          trailGuideSummary: place.summary,
        },
      }));
      if (error || data?.error) return null;

      const placeData = data?.place;
      const mapsUrl = placeData?.mapsUrl ?? data?.mapsUrl ?? null;
      const items = Array.isArray(data?.photos) ? data.photos : data?.photo ? [data.photo] : [];
      const photos = items
        .map((item) => toTrailGuidePhoto(item, place, mapsUrl))
        .filter((photo): photo is GoogleTrailGuidePhoto => Boolean(photo))
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

  detailsSessionCache.set(key, pending);
  const result = await pending;
  if (!result) detailsSessionCache.delete(key);
  return result;
}

export function resolveGoogleTrailGuideAnalyzedPlaceDetails(
  place: TrailGuidePlace,
  purpose: GooglePhotoPurpose = 'hero',
) {
  return resolveGoogleTrailGuidePlaceDetails(place, { purpose, analyze: true });
}

export async function resolveGoogleTrailGuidePlaceGallery(
  place: TrailGuidePlace,
  purpose: GooglePhotoPurpose = 'hero',
): Promise<GoogleTrailGuidePhoto[]> {
  const details = await resolveGoogleTrailGuidePlaceDetails(place, { purpose });
  return details?.photos ?? [];
}

export async function resolveGoogleTrailGuidePlacePhoto(place: TrailGuidePlace): Promise<GoogleTrailGuidePhoto | null> {
  const details = await resolveGoogleTrailGuidePlaceDetails(place, { purpose: 'card' });
  return details?.photos[0] ?? null;
}

export function clearGoogleTrailGuidePhotoSessionCache() {
  detailsSessionCache.clear();
}
