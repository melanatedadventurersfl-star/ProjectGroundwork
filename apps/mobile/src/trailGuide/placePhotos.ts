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
    .filter((word) => word.length > 2 && !['the', 'and', 'florida', 'park', 'preserve', 'state', 'area', 'trail'].includes(word));
}

function titleScore(place: TrailGuidePlace, title = '') {
  const wanted = normalizedWords(place.name);
  const candidate = new Set(normalizedWords(title));
  return wanted.reduce((score, word) => score + (candidate.has(word) ? 1 : 0), 0);
}

function minimumMatchScore(place: TrailGuidePlace) {
  const words = normalizedWords(place.name);
  if (words.length <= 2) return 1;
  return Math.max(2, Math.ceil(words.length * 0.5));
}

function isUsablePhotoUrl(url?: string) {
  if (!url) return false;
  return /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url);
}

function photoFromImageInfo(place: TrailGuidePlace, title: string, info?: WikiImageInfo): TrailGuidePhoto | null {
  const imageUrl = info?.thumburl ?? info?.url;
  if (!isUsablePhotoUrl(imageUrl) || !info?.descriptionurl) return null;
  if (titleScore(place, title) < minimumMatchScore(place)) return null;
  return {
    url: imageUrl,
    sourceUrl: info.descriptionurl,
    title: title.replace(/^File:/i, ''),
    credit: stripHtml(info.extmetadata?.Artist?.value ?? info.extmetadata?.Credit?.value),
    license: stripHtml(info.extmetadata?.LicenseShortName?.value),
  };
}

async function loadImageMetadata(filename: string, fallbackUrl: string, sourceUrl: string, title: string) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('titles', `File:${filename}`);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1200');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Image metadata unavailable');
    const data = (await response.json()) as WikiImageResponse;
    const page = Object.values(data.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    return {
      url: info?.thumburl ?? info?.url ?? fallbackUrl,
      sourceUrl: info?.descriptionurl ?? sourceUrl,
      title,
      credit: stripHtml(info?.extmetadata?.Artist?.value ?? info?.extmetadata?.Credit?.value),
      license: stripHtml(info?.extmetadata?.LicenseShortName?.value),
    } satisfies TrailGuidePhoto;
  } catch {
    return { url: fallbackUrl, sourceUrl, title } satisfies TrailGuidePhoto;
  }
}

async function searchWikipediaLeadImage(place: TrailGuidePlace) {
  const queryVariants = [
    `\"${place.name}\"`,
    `\"${place.name}\" ${place.area} Florida`,
    `${place.name} ${place.area} Florida`,
  ];

  for (const query of queryVariants) {
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

    try {
      const response = await fetch(url.toString());
      if (!response.ok) continue;
      const data = (await response.json()) as WikiSearchResponse;
      const pages = Object.values(data.query?.pages ?? {})
        .filter((page) => page.thumbnail?.source && page.pageimage && page.fullurl)
        .sort((a, b) => {
          const scoreDelta = titleScore(place, b.title) - titleScore(place, a.title);
          if (scoreDelta !== 0) return scoreDelta;
          return (a.index ?? 99) - (b.index ?? 99);
        });

      const best = pages[0];
      if (
        best?.thumbnail?.source &&
        best.pageimage &&
        best.fullurl &&
        titleScore(place, best.title) >= minimumMatchScore(place)
      ) {
        return loadImageMetadata(best.pageimage, best.thumbnail.source, best.fullurl, best.title ?? place.name);
      }
    } catch {
      // Try the broader Commons search next.
    }
  }

  return null;
}

async function searchCommons(place: TrailGuidePlace) {
  const queryVariants = [
    `\"${place.name}\"`,
    `\"${place.name}\" Florida`,
    `${place.name} ${place.area} Florida`,
  ];

  for (const query of queryVariants) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrsearch', query);
    url.searchParams.set('gsrlimit', '15');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|extmetadata');
    url.searchParams.set('iiurlwidth', '1200');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) continue;
      const data = (await response.json()) as WikiImageResponse;
      const pages = Object.values(data.query?.pages ?? {})
        .map((page) => ({
          page,
          score: titleScore(place, page.title),
          info: page.imageinfo?.[0],
        }))
        .filter(({ page, info, score }) => Boolean(page.title && info && score >= minimumMatchScore(place)))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (a.page.index ?? 99) - (b.page.index ?? 99);
        });

      for (const candidate of pages) {
        const photo = photoFromImageInfo(place, candidate.page.title ?? '', candidate.info);
        if (photo) return photo;
      }
    } catch {
      // Continue to the next query variant.
    }
  }

  return null;
}

export async function resolveTrailGuidePlacePhoto(place: TrailGuidePlace) {
  const existing = cache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    const wikipediaPhoto = await searchWikipediaLeadImage(place);
    if (wikipediaPhoto) return wikipediaPhoto;
    return searchCommons(place);
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
