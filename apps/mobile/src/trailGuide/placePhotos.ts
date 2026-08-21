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
  descriptionurl?: string;
  extmetadata?: {
    Artist?: { value?: string };
    Credit?: { value?: string };
    LicenseShortName?: { value?: string };
  };
};

type WikiImageResponse = {
  query?: { pages?: Record<string, { imageinfo?: WikiImageInfo[] }> };
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
    .filter((word) => word.length > 2 && !['the', 'and', 'florida', 'park', 'preserve', 'state'].includes(word));
}

function titleScore(place: TrailGuidePlace, title = '') {
  const wanted = normalizedWords(place.name);
  const candidate = new Set(normalizedWords(title));
  return wanted.reduce((score, word) => score + (candidate.has(word) ? 1 : 0), 0);
}

async function loadImageMetadata(filename: string, fallbackUrl: string, sourceUrl: string, title: string) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('titles', `File:${filename}`);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Image metadata unavailable');
    const data = (await response.json()) as WikiImageResponse;
    const page = Object.values(data.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    return {
      url: info?.url ?? fallbackUrl,
      sourceUrl: info?.descriptionurl ?? sourceUrl,
      title,
      credit: stripHtml(info?.extmetadata?.Artist?.value ?? info?.extmetadata?.Credit?.value),
      license: stripHtml(info?.extmetadata?.LicenseShortName?.value),
    } satisfies TrailGuidePhoto;
  } catch {
    return { url: fallbackUrl, sourceUrl, title } satisfies TrailGuidePhoto;
  }
}

export async function resolveTrailGuidePlacePhoto(place: TrailGuidePlace) {
  const existing = cache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', `${place.name} ${place.area} Florida`);
    url.searchParams.set('gsrlimit', '6');
    url.searchParams.set('prop', 'pageimages|info');
    url.searchParams.set('piprop', 'thumbnail|name');
    url.searchParams.set('pithumbsize', '1200');
    url.searchParams.set('inprop', 'url');

    try {
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
  }, [place?.id]);

  return photo;
}
