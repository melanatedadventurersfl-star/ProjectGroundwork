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

const REQUEST_TIMEOUT_MS = 2200;
const PHOTO_CACHE_PREFIX = 'trail-guide-photo:v2:';
const cache = new Map<string, Promise<TrailGuidePhoto | null>>();

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

async function loadImageMetadata(filename: string, fallbackUrl: string, sourceUrl: string, title: string) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('titles', filename.startsWith('File:') ? filename : `File:${filename}`);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1200');

  const data = await fetchJson<WikiImageResponse>(url);
  const page = Object.values(data?.query?.pages ?? {})[0];
  return photoFromInfo(page?.imageinfo?.[0], title) ?? { url: fallbackUrl, sourceUrl, title };
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
    .filter((page) => page.thumbnail?.source && page.pageimage && page.fullurl)
    .sort((a, b) => {
      const scoreDelta = titleScore(place, b.title) - titleScore(place, a.title);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.index ?? 99) - (b.index ?? 99);
    });

  const best = pages[0];
  const thumbnail = best?.thumbnail?.source;
  const pageImage = best?.pageimage;
  const fullUrl = best?.fullurl;
  if (
    typeof thumbnail !== 'string' ||
    typeof pageImage !== 'string' ||
    typeof fullUrl !== 'string' ||
    titleScore(place, best?.title) === 0
  ) return null;
  return loadImageMetadata(pageImage, thumbnail, fullUrl, best?.title ?? place.name);
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
  const [photo, setPhoto] = useState<TrailGuidePhoto | null>(null);

  useEffect(() => {
    let active = true;
    setPhoto(null);
    if (!place) return () => { active = false; };

    void resolveTrailGuidePlacePhoto(place).then((next) => {
      if (active) setPhoto(next);
    });

    return () => {
      active = false;
    };
  }, [place]);

  return photo;
}
