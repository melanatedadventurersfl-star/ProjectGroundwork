import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { TrailGuidePlace } from './catalog';
import { resolveGoogleTrailGuidePlaceDetails } from './googlePlacePhotos';
import { CURATED_TRAIL_GUIDE_PHOTOS, type TrailGuidePhoto } from './placePhotos';

const PHOTO_BUCKET = 'trail-guide-photos';
const MAX_GALLERY_PHOTOS = 12;

export type TrailGuideHeroSource = 'official' | 'admin' | 'camper' | 'google' | 'curated' | 'wikimedia' | 'generic';

export type TrailGuideHeroPhoto = TrailGuidePhoto & {
  candidateId?: string;
  sourceType: TrailGuideHeroSource;
  sourceLabel: string;
  score: number;
  confidence: number;
  preferred: boolean;
  representative: boolean;
  representativeness: number;
  category: string;
  heroEligible: boolean;
  galleryEligible: boolean;
  tags: string[];
};

type CandidateRow = {
  id: string;
  source_type: TrailGuideHeroSource;
  source_name: string | null;
  image_url: string | null;
  storage_path: string | null;
  source_url: string | null;
  credit: string | null;
  license: string | null;
  tags: string[] | null;
  category: string | null;
  hero_score: number | string | null;
  representativeness_score: number | string | null;
  is_preferred: boolean;
  is_generic: boolean;
  hero_eligible: boolean;
  gallery_eligible: boolean;
};

const sessionCache = new Map<string, Promise<TrailGuideHeroPhoto[]>>();

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function numeric(value: number | string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sourceLabel(type: TrailGuideHeroSource, sourceName?: string | null) {
  if (type === 'official') return sourceName || 'Official destination photo';
  if (type === 'admin') return sourceName || 'Selected destination photo';
  if (type === 'camper') return 'Camper photo';
  if (type === 'google') return 'Google Maps';
  if (type === 'wikimedia') return 'Wikimedia';
  if (type === 'generic') return 'Representative image';
  return sourceName || 'Destination photo';
}

function staticSourceType(photo: TrailGuidePhoto): TrailGuideHeroSource {
  const evidence = `${photo.sourceUrl} ${photo.credit ?? ''}`.toLowerCase();
  if (/\.gov\b|city of |county |department of |national park service|florida state parks|floridastateparks\.org/.test(evidence)) return 'official';
  if (/wikimedia|wikipedia/.test(evidence)) return 'wikimedia';
  return 'curated';
}

function categoryTags(place: TrailGuidePlace) {
  const raw = [place.category, place.type, ...place.tags, ...place.collections, place.summary].join(' ').toLowerCase();
  const tags = new Set<string>();
  if (/beach|shore|ocean|coast/.test(raw)) tags.add('beach');
  if (/water|river|spring|lake|marsh|paddl|kayak/.test(raw)) tags.add('water');
  if (/camp|rv|overnight/.test(raw)) tags.add('campsite');
  if (/trail|hik|walk/.test(raw)) tags.add('trail');
  if (/wildlife|bird/.test(raw)) tags.add('wildlife');
  if (/scenic|view|landscape/.test(raw)) tags.add('landscape');
  return [...tags];
}

function primaryCategory(place: TrailGuidePlace) {
  const tags = categoryTags(place);
  if (place.category === 'Camping') return tags.includes('beach') ? 'campsite' : 'campsite';
  if (place.category === 'Water') return tags.includes('beach') ? 'beach' : 'water';
  if (place.category === 'Hiking') return 'trail';
  if (place.category === 'Scenic') return 'landscape';
  return tags[0] ?? place.category.toLowerCase();
}

function curatedCandidate(place: TrailGuidePlace): TrailGuideHeroPhoto | null {
  const photo = CURATED_TRAIL_GUIDE_PHOTOS[place.id];
  if (!photo) return null;
  const sourceType = staticSourceType(photo);
  const huguenotBirds = place.id === 'huguenot-memorial-park' && /Shorebirds_at_Huguenot_Park/i.test(photo.url);
  const score = huguenotBirds ? 0.58 : sourceType === 'official' ? 0.92 : sourceType === 'wikimedia' ? 0.825 : 0.84;
  const category = huguenotBirds ? 'wildlife' : primaryCategory(place);
  return {
    ...photo,
    sourceType,
    sourceLabel: sourceLabel(sourceType, photo.credit),
    score,
    confidence: score,
    preferred: false,
    representative: false,
    representativeness: huguenotBirds ? 0.28 : 0.78,
    category,
    heroEligible: !huguenotBirds,
    galleryEligible: true,
    tags: huguenotBirds ? ['beach', 'shoreline', 'wildlife'] : categoryTags(place),
  };
}

function genericCandidate(place: TrailGuidePlace): TrailGuideHeroPhoto {
  return {
    url: place.image,
    sourceUrl: place.image,
    title: place.name,
    sourceType: 'generic',
    sourceLabel: 'Representative image',
    score: 0.10,
    confidence: 0.15,
    preferred: false,
    representative: true,
    representativeness: 0.2,
    category: place.category.toLowerCase(),
    heroEligible: true,
    galleryEligible: true,
    tags: [place.category.toLowerCase()],
  };
}

async function databaseCandidates(place: TrailGuidePlace): Promise<TrailGuideHeroPhoto[]> {
  const { data, error } = await supabase
    .from('trail_guide_hero_candidates')
    .select('id,source_type,source_name,image_url,storage_path,source_url,credit,license,tags,category,hero_score,representativeness_score,is_preferred,is_generic,hero_eligible,gallery_eligible')
    .eq('place_id', place.id)
    .eq('status', 'approved')
    .eq('gallery_eligible', true)
    .order('is_preferred', { ascending: false })
    .order('is_generic', { ascending: true })
    .order('hero_score', { ascending: false })
    .limit(24);

  if (error) return [];
  const rows = (data ?? []) as CandidateRow[];
  const photos: TrailGuideHeroPhoto[] = [];

  for (const row of rows) {
    let url = row.image_url?.trim() || '';
    if (!url && row.storage_path) {
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, 60 * 60);
      url = signed?.signedUrl ?? '';
    }
    if (!url) continue;
    const score = clamp(numeric(row.hero_score, 0.5));
    photos.push({
      candidateId: row.id,
      url,
      sourceUrl: row.source_url ?? '',
      title: place.name,
      credit: row.credit ?? row.source_name ?? undefined,
      license: row.license ?? undefined,
      sourceType: row.source_type,
      sourceLabel: sourceLabel(row.source_type, row.source_name),
      score,
      confidence: score,
      preferred: row.is_preferred,
      representative: row.is_generic,
      representativeness: clamp(numeric(row.representativeness_score, 0.5)),
      category: row.category ?? row.tags?.[0] ?? primaryCategory(place),
      heroEligible: row.hero_eligible !== false,
      galleryEligible: row.gallery_eligible !== false,
      tags: row.tags ?? [],
    });
  }

  return photos;
}

async function googleCandidates(place: TrailGuidePlace): Promise<TrailGuideHeroPhoto[]> {
  const details = await resolveGoogleTrailGuidePlaceDetails(place);
  if (!details?.photos.length) return [];
  const tags = categoryTags(place);
  const category = primaryCategory(place);
  return details.photos.slice(0, 10).map((photo, index) => {
    const score = Math.max(0.70, 0.86 - (index * 0.018));
    return {
      ...photo,
      sourceType: 'google' as const,
      sourceLabel: 'Google Maps',
      score,
      confidence: score,
      preferred: false,
      representative: false,
      representativeness: Math.max(0.62, 0.86 - (index * 0.025)),
      category,
      heroEligible: true,
      galleryEligible: true,
      tags,
    };
  });
}

function dedupeCandidates(candidates: TrailGuideHeroPhoto[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.url.split('?')[0]?.toLowerCase() ?? candidate.url.toLowerCase();
    if (!candidate.url || seen.has(key)) return false;
    seen.add(key);
    return candidate.galleryEligible;
  });
}

function rankedRealCandidates(candidates: TrailGuideHeroPhoto[]) {
  const unique = dedupeCandidates(candidates);
  const real = unique.filter((candidate) => !candidate.representative);
  const pool = real.length ? real : unique;
  return pool.sort((a, b) => {
    if (a.preferred !== b.preferred) return Number(b.preferred) - Number(a.preferred);
    if (a.heroEligible !== b.heroEligible) return Number(b.heroEligible) - Number(a.heroEligible);
    if (a.representative !== b.representative) return Number(a.representative) - Number(b.representative);
    if (a.score !== b.score) return b.score - a.score;
    return b.representativeness - a.representativeness;
  });
}

function buildDiverseGallery(candidates: TrailGuideHeroPhoto[]) {
  const ranked = rankedRealCandidates(candidates);
  if (!ranked.length) return [];

  const result: TrailGuideHeroPhoto[] = [];
  const categoryCounts = new Map<string, number>();
  const quotaFor = (category: string) => ['campsite', 'beach', 'landscape', 'water', 'trail'].includes(category) ? 2 : 1;

  const cover = ranked.find((candidate) => candidate.heroEligible) ?? ranked[0];
  if (cover) {
    result.push(cover);
    categoryCounts.set(cover.category, 1);
  }

  for (const candidate of ranked) {
    if (result.some((photo) => photo.url === candidate.url)) continue;
    const count = categoryCounts.get(candidate.category) ?? 0;
    if (count >= quotaFor(candidate.category) && ranked.length > 5) continue;
    result.push(candidate);
    categoryCounts.set(candidate.category, count + 1);
    if (result.length >= MAX_GALLERY_PHOTOS) break;
  }

  if (result.length < Math.min(5, ranked.length)) {
    for (const candidate of ranked) {
      if (result.some((photo) => photo.url === candidate.url)) continue;
      result.push(candidate);
      if (result.length >= Math.min(MAX_GALLERY_PHOTOS, ranked.length)) break;
    }
  }

  return result;
}

export async function resolveTrailGuideHeroCandidates(place: TrailGuidePlace) {
  const existing = sessionCache.get(place.id);
  if (existing) return existing;

  const pending = (async () => {
    const [stored, google] = await Promise.all([
      databaseCandidates(place),
      googleCandidates(place),
    ]);
    const curated = curatedCandidate(place);
    const destinationSpecific = [
      ...stored,
      ...(curated ? [curated] : []),
      ...google,
    ];
    return buildDiverseGallery(destinationSpecific.length ? destinationSpecific : [genericCandidate(place)]);
  })();

  sessionCache.set(place.id, pending);
  return pending;
}

export async function resolveTrailGuidePrimaryPhoto(place: TrailGuidePlace) {
  const gallery = await resolveTrailGuideHeroCandidates(place);
  return gallery.find((photo) => photo.heroEligible) ?? gallery[0] ?? genericCandidate(place);
}

export function useTrailGuideHeroCandidates(place?: TrailGuidePlace) {
  const initialCurated = place ? curatedCandidate(place) : null;
  const [photos, setPhotos] = useState<TrailGuideHeroPhoto[]>(initialCurated ? buildDiverseGallery([initialCurated]) : []);

  useEffect(() => {
    let active = true;
    if (!place) {
      setPhotos([]);
      return () => { active = false; };
    }
    const curated = curatedCandidate(place);
    setPhotos(curated ? buildDiverseGallery([curated]) : []);
    void resolveTrailGuideHeroCandidates(place).then((next) => {
      if (active) setPhotos(next.length ? next : [genericCandidate(place)]);
    });
    return () => { active = false; };
  }, [place]);

  return photos;
}

export function useTrailGuidePrimaryPhoto(place?: TrailGuidePlace) {
  const [photo, setPhoto] = useState<TrailGuideHeroPhoto | null>(null);

  useEffect(() => {
    let active = true;
    if (!place) {
      setPhoto(null);
      return () => { active = false; };
    }
    setPhoto(null);
    void resolveTrailGuidePrimaryPhoto(place).then((next) => {
      if (active) setPhoto(next);
    });
    return () => { active = false; };
  }, [place]);

  return photo;
}

export function clearTrailGuideHeroSelectionCache(placeId?: string) {
  if (placeId) sessionCache.delete(placeId);
  else sessionCache.clear();
}
