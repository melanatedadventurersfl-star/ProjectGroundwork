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
  const url = info?.thumburl ?? info?.url;
  const sourceUrl = info?.descriptionurl;
  if (!url || !sourceUrl) return null;
  return {
    url,
    sourceUrl,
    title,
    credit: stripHtml(info?.extmetadata?.Artist?.value ?? info?.extmetadata?.Credit?.value),
    license: stripHtml(info?.extmetadata?.LicenseShortName?.value),
  };
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

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Image metadata unavailable');
    const data = (await response.json()) as WikiImageResponse;
    const page = Object.values(data.query?.pages ?? {})[0];
    return photoFromInfo(page?.imageinfo?.[0], title) ?? { url: fallbackUrl, sourceUrl, title };
  } catch {
    return { url: fallbackUrl, sourceUrl, title };
  }
}

async function searchWikipedia(place: TrailGuidePlace, query: string) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrlimit', '8');
  url.searchParams.set('prop', 'pageimages|info');
  url.searchParams.set('piprop', 'thumbnail|name');
  url.searchParams.set('pithumbsize', '1200');
  url.searchParams.set('inprop', 'url');

  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = (await response.json()) as WikiSearchResponse;
  const pages = Object.values(data.query?.pages ?? {})
    .filter((page) => page.thumbnail?.source && page.pageimage && page.fullurl)
    .sort((a, b) => {
      const scoreDelta = titleScore(place, b.title) - titleScore(place, a.title);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.index ?? 99) - (b.index ?? 99);
    });

  const best = pages[0];
  if (!best?.thumbnail?.source || !best.pageimage || !best.fullurl || titleScore(place, best.title) === 0) return null;
  return loadImageMetadata(best.pageimage, best.thumbnail.source, best.fullurl, best.title ?? place.name);
}

async function searchCommons(place: TrailGuidePlace, query: string) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1200');

  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = (await response.json()) as WikiImageResponse;
  const pages = Object.values(data.query?.pages ?? {})
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

export async function resolveTrailGuidePlacePhoto(place: TrailGuidePlace) {
  const existing = cache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    const queries = [
      `\"${place.name}\" Florida`,
      `\"${place.name}\" ${place.area}`,
      `${place.name} ${place.area} Florida`,
      place.name,
    ];

    try {
      for (const query of queries) {
        const wikipedia = await searchWikipedia(place, query);
        if (wikipedia) return wikipedia;
      }
      for (const query of queries) {
        const commons = await searchCommons(place, query);
        if (commons) return commons;
      }
      return null;
    } catch {
      return null;
    }
  })();

  cache.set(place.id, pending);
  return pending;
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
