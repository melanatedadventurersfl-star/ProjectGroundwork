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
  'seaton-creek-historic-preserve': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/SeatonCreek091312-37BWA-copy.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/seaton-creek-historic-preserve/',
    title: 'Seaton Creek Historic Preserve',
    credit: 'Will Dickey / Timucuan Parks Foundation',
  },
  'betz-tiger-point-preserve': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/IMG_9152_2.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/betz-tiger-point-preserve/',
    title: 'Betz-Tiger Point Preserve',
    credit: 'Will Dickey / Timucuan Parks Foundation',
  },
  'theodore-roosevelt-area': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/2019/11/SpPnd0005.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/theodore-roosevelt-area/',
    title: 'Theodore Roosevelt Area',
    credit: 'Timucuan Parks Foundation',
  },
  'jacksonville-baldwin-rail-trail': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/IMG_2714-Rail-Trail-scaled.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/jacksonville-baldwin-rail-trail/',
    title: 'Jacksonville-Baldwin Rail Trail',
    credit: 'Will Dickey / Timucuan Parks Foundation',
  },
  'thomas-creek-conservation-area': {
    url: 'https://www.timucuanparks.org/wp-content/uploads/IMG_2763_Thomas-Creek-scaled.jpg',
    sourceUrl: 'https://www.timucuanparks.org/parks/thomas-creek-preserve/',
    title: 'Thomas Creek Conservation Area',
    credit: 'Will Dickey / Timucuan Parks Foundation',
  },
  'fort-de-soto-park': {
    url: 'https://pinellas.gov/wp-content/uploads/2021/10/6104188822_c609b5cc6c_o-e1643223841539.jpg',
    sourceUrl: 'https://pinellas.gov/parks/fort-de-soto-park/',
    title: 'Fort De Soto Park',
    credit: 'Pinellas County Parks & Conservation Resources',
  },
  'brooker-creek-preserve': {
    url: 'https://pinellas.gov/wp-content/uploads/2021/10/boardwalk-banner-825x464.jpg',
    sourceUrl: 'https://pinellas.gov/parks/brooker-creek-preserve/',
    title: 'Brooker Creek Preserve',
    credit: 'Pinellas County Parks & Conservation Resources',
  },
  'sawgrass-lake-park': {
    url: 'https://pinellas.gov/wp-content/uploads/2022/01/Sawgrass_Park_03_11-21_SF-1-scaled.jpg',
    sourceUrl: 'https://pinellas.gov/parks/sawgrass-lake-park/',
    title: 'Sawgrass Lake Park',
    credit: 'Pinellas County Parks & Conservation Resources',
  },
  'lettuce-lake-conservation-park': {
    url: 'https://res.cloudinary.com/hillsboroughcounty/image/upload/c_fit,w_1200/t_WebP/Kayak_Observation_Lettuce_Lake',
    sourceUrl: 'https://hcfl.gov/locations/lettuce-lake-conservation-park',
    title: 'Lettuce Lake Conservation Park',
    credit: 'Hillsborough County',
  },
  'lithia-springs-conservation-park': {
    url: 'https://res.cloudinary.com/hillsboroughcounty/image/upload/c_fit,w_1200/t_WebP/v1/Web/Images/Newsroom/Lithia%20springs_NR',
    sourceUrl: 'https://hcfl.gov/locations/lithia-springs-park',
    title: 'Lithia Springs Conservation Park',
    credit: 'Hillsborough County',
  },
  'picnic-island-park': {
    url: 'https://www.tampa.gov/sites/default/files/styles/large_image/public/gallery/migrated/picnic_island_beach_slideshow.jpg?itok=nkVghC5e',
    sourceUrl: 'https://www.tampa.gov/parks-and-recreation/featured-parks/picnic-island-park',
    title: 'Picnic Island Park',
    credit: 'City of Tampa',
  },
  'cypress-point-park': {
    url: 'https://www.tampa.gov/sites/default/files/styles/large_image/public/gallery/migrated/1sunset_slideshow.jpg?itok=1WpMnwhy',
    sourceUrl: 'https://www.tampa.gov/parks-and-recreation/featured-parks/cypress-point-park',
    title: 'Cypress Point Park',
    credit: 'City of Tampa',
  },
  'ballast-point-park': {
    url: 'https://www.tampa.gov/sites/default/files/styles/large_image/public/gallery/migrated/dsc00538_1600.jpg?itok=o0KCo3IZ',
    sourceUrl: 'https://www.tampa.gov/parks-and-recreation/featured-parks/ballast-point',
    title: 'Ballast Point Park',
    credit: 'City of Tampa',
  },
  'trout-creek-park': {
    url: 'https://res.cloudinary.com/hillsboroughcounty/image/upload/c_fit,w_1200/t_WebP/Bayshore_Bike_Trail_at_Trout_Creek_fthwmc',
    sourceUrl: 'https://hcfl.gov/locations/trout-creek-wilderness-park/',
    title: 'Trout Creek Conservation Park',
    credit: 'Hillsborough County',
  },
  'morris-bridge-park': {
    url: 'https://res.cloudinary.com/hillsboroughcounty/image/upload/c_fit,w_1200/t_WebP/v1/Web/Images/Locations/MorrisBridgePark',
    sourceUrl: 'https://hcfl.gov/locations/morris-bridge-conservation-park',
    title: 'Morris Bridge Conservation Park',
    credit: 'Hillsborough County',
  },
  'john-b-sargeant-park': {
    url: 'https://res.cloudinary.com/hillsboroughcounty/image/upload/c_fit,w_1200/t_WebP/Kayak_rentals_at_John_B_Sargeant_lvzch6',
    sourceUrl: 'https://hcfl.gov/locations/john-b-sargeant-conservation-park',
    title: 'John B. Sargeant Conservation Park',
    credit: 'Hillsborough County',
  },
  'upper-tampa-bay-park': {
    url: 'https://res.cloudinary.com/hillsboroughcounty/image/upload/c_fit,w_1200/t_WebP/v1/Web/Images/Newsroom/Upper%20Tampa%20Bay',
    sourceUrl: 'https://hcfl.gov/locations/upper-tampa-bay-conservation-park',
    title: 'Upper Tampa Bay Conservation Park',
    credit: 'Hillsborough County',
  },
};

type WikiSearchPage = {
  index?: number;
  title?: string;
  fullurl?: string;
  thumbnail?: { source?: string };
};

type WikiSearchResponse = { query?: { pages?: Record<string, WikiSearchPage> } };

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
  return { url: place.image, sourceUrl: place.image, title: place.name };
}

function stripHtml(value?: string) {
  return value?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
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

async function fetchJson<T>(url: URL): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    return response.ok ? (await response.json()) as T : null;
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
    return typeof parsed.url === 'string' && typeof parsed.sourceUrl === 'string' && typeof parsed.title === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function persistPhoto(placeId: string, photo: TrailGuidePhoto) {
  try {
    await Storage.setItem(`${PHOTO_CACHE_PREFIX}${placeId}`, JSON.stringify(photo));
  } catch {
    // The photo remains usable for this session even when persistence fails.
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
    .sort((a, b) => titleScore(place, b.title) - titleScore(place, a.title) || (a.index ?? 99) - (b.index ?? 99));
  const best = pages[0];
  if (!best?.thumbnail?.source || !best.fullurl || titleScore(place, best.title) === 0) return null;
  return { url: best.thumbnail.source, sourceUrl: best.fullurl, title: best.title ?? place.name } satisfies TrailGuidePhoto;
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
    .sort((a, b) => titleScore(place, b.title) - titleScore(place, a.title) || (a.index ?? 99) - (b.index ?? 99));
  const best = pages[0];
  if (!best?.title || titleScore(place, best.title) === 0) return null;
  return photoFromInfo(best.imageinfo?.[0], best.title);
}

async function resolveFreshPhoto(place: TrailGuidePlace) {
  const [wikipedia, commons] = await Promise.all([searchWikipedia(place), searchCommons(place)]);
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

    return () => { active = false; };
  }, [place]);

  return photo;
}
