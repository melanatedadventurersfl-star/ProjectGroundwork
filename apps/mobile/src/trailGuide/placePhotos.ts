import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import type { TrailGuidePlace } from './catalog';

export type TrailGuidePhoto = {
  url: string;
  sourceUrl: string;
  title: string;
  credit?: string;
  license?: string;
};

export const CURATED_TRAIL_GUIDE_PHOTOS: Record<string, TrailGuidePhoto> = {
  'reddie-point-preserve': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/reddiepoint-e1445948531617.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/reddie-point-preserve/',
    title: 'Reddie Point Preserve',
    credit: 'Will Dickey / Timucuan Parks Foundation',
  },
  'blue-cypress-park': {
    url: 'https://www.jacksonville.gov/getContentAsset/aaff1dad-ead7-4990-b68f-96ffb1e4db91/bd714d09-ccf8-4e86-a041-57e2011ebfe4/BlueCypress.png?language=en',
    sourceUrl: 'https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/community-centers/blue-cypress-center-and-park',
    title: 'Blue Cypress Park',
    credit: 'City of Jacksonville',
  },
  'tree-hill-nature-center': {
    url: 'https://www.treehill.org/Portals/0/adam/Content/mb_5RJtktkyAQZpuXVoIhg/Text/DSC_1076.jpg',
    sourceUrl: 'https://www.treehill.org/visit',
    title: 'Tree Hill Nature Center',
    credit: 'Tree Hill Nature Center',
  },
  'bulls-bay-preserve': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/Bulls_Bay_waterfall-IMG_3914.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/bulls-bay-preserve/',
    title: 'Bulls Bay Preserve',
    credit: 'Timucuan Parks Foundation',
  },
};

type WikiSearchPage = {
  index?: number;
  pageid?: number;
  title?: string;
  fullurl?: string;
  pageimage?: string;
  thumbnail?: { source?: string };
};

type WikiSearchResponse = {
  query?: { pages?: Record<string, WikiSearchPage> };
};

type WikiImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: {
    Artist?: { value?: string };
    Credit?: { value?: string };
    LicenseShortName?: { value?: string };
  };
};

type WikiImageResponse = {
  query?: { pages?: Record<string, { title?: string; index?: number; imageinfo?: WikiImageInfo[] }> };
};

const REQUEST_TIMEOUT_MS = 3500;
const PHOTO_CACHE_PREFIX = 'trail-guide-photo:v2:';
const cache = new Map<string, Promise<TrailGuidePhoto | null>>();

function fallbackPhotoForPlace(place: TrailGuidePlace): TrailGuidePhoto {
  return {
    url: place.image,
    sourceUrl: place.image,
    title: place.name,
  };
}

function stripHtml(value?: string) {
  if (!value) return undefined;
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['the', 'and', 'florida', 'park', 'preserve', 'state', 'area'].includes(word));
}

function titleScore(place: TrailGuidePlace, title = '') {
  const wanted = normalizedWords(place.name);
  const candidate = new Set(normalizedWords(title));
  return wanted.reduce((score, word) => score + (candidate.has(word) ? 1 : 0), 0);
}

function photoFromInfo(info: WikiImageInfo | undefined, title: string): TrailGuidePhoto | null {
  const resolvedUrl = info?.thumburl ?? info?.url;
  const resolvedSourceUrl = info?.descriptionurl;
  if (typeof resolvedUrl !== 'string' || typeof resolvedSourceUrl !== 'string') return null;
  return {
    url: resolvedUrl,
    sourceUrl: resolvedSourceUrl,
    title,
    credit: stripHtml(info?.extmetadata?.Artist?.value ?? info?.extmetadata?.Credit?.value),
    license: stripHtml(info?.extmetadata?.LicenseShortName?.value),
  };
}

async function fetchJson<T>(url: URL): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readPersistedPhoto(placeId: string) {
  try {
    const raw = await Storage.getItem(`${PHOTO_CACHE_PREFIX}${placeId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrailGuidePhoto;
    if (typeof parsed.url !== 'string' || typeof parsed.sourceUrl !== 'string' || typeof parsed.title !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function persistPhoto(placeId: string, photo: TrailGuidePhoto) {
  try {
    await Storage.setItem(`${PHOTO_CACHE_PREFIX}${placeId}`, JSON.stringify(photo));
  } catch {
    // A photo is still usable for this session even if local persistence fails.
  }
}

async function searchWikipedia(place: TrailGuidePlace) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `\"${place.name}\" ${place.area} Florida`);
  url.searchParams.set('gsrlimit', '6');
  url.searchParams.set('prop', 'pageimages|info');
  url.searchParams.set('piprop', 'thumbnail|name');
  url.searchParams.set('pithumbsize', '1200');
  url.searchParams.set('inprop', 'url');

  const data = await fetchJson<WikiSearchResponse>(url);
  const pages = Object.values(data?.query?.pages ?? {})
    .filter((page) => page.thumbnail?.source && page.fullurl)
    .sort((a, b) => {
      const scoreDelta = titleScore(place, b.title) - titleScore(place, a.title);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.index ?? 99) - (b.index ?? 99);
    });

  const best = pages[0];
  const thumbnail = best?.thumbnail?.source;
  const fullUrl = best?.fullurl;
  if (
    typeof thumbnail !== 'string' ||
    typeof fullUrl !== 'string' ||
    titleScore(place, best?.title) === 0
  ) return null;
  return { url: thumbnail, sourceUrl: fullUrl, title: best?.title ?? place.name } satisfies TrailGuidePhoto;
}

async function searchCommons(place: TrailGuidePlace) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', `\"${place.name}\" ${place.area} Florida`);
  url.searchParams.set('gsrlimit', '8');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1200');

  const data = await fetchJson<WikiImageResponse>(url);
  const pages = Object.values(data?.query?.pages ?? {})
    .filter((page) => page.imageinfo?.[0]?.url || page.imageinfo?.[0]?.thumburl)
    .sort((a, b) => {
      const scoreDelta = titleScore(place, b.title) - titleScore(place, a.title);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.index ?? 99) - (b.index ?? 99);
    });

  const best = pages[0];
  if (!best?.title || titleScore(place, best.title) === 0) return null;
  return photoFromInfo(best.imageinfo?.[0], best.title);
}

async function resolveFreshPhoto(place: TrailGuidePlace) {
  const [wikipedia, commons] = await Promise.all([
    searchWikipedia(place),
    searchCommons(place),
  ]);
  return wikipedia ?? commons;
}

export async function resolveTrailGuidePlacePhoto(place: TrailGuidePlace) {
  const curated = CURATED_TRAIL_GUIDE_PHOTOS[place.id];
  if (curated) return curated;

  const existing = cache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    const persisted = await readPersistedPhoto(place.id);
    if (persisted) return persisted;

    const photo = await resolveFreshPhoto(place);
    if (photo) await persistPhoto(place.id, photo);
    return photo;
  })();

  cache.set(place.id, pending);
  const result = await pending;
  if (!result) cache.delete(place.id);
  return result;
}

export function useTrailGuidePlacePhoto(place?: TrailGuidePlace) {
  const [photo, setPhoto] = useState<TrailGuidePhoto | null>(
    place ? CURATED_TRAIL_GUIDE_PHOTOS[place.id] ?? fallbackPhotoForPlace(place) : null,
  );

  useEffect(() => {
    let active = true;
    setPhoto(place ? CURATED_TRAIL_GUIDE_PHOTOS[place.id] ?? fallbackPhotoForPlace(place) : null);
    if (!place) return () => { active = false; };

    void resolveTrailGuidePlacePhoto(place).then((next) => {
      if (active && next) setPhoto(next);
    });

    return () => {
      active = false;
    };
  }, [place]);

  return photo;
}
