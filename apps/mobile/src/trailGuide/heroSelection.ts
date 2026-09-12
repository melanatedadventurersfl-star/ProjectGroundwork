import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { TrailGuidePlace } from './catalog';
import { resolveGoogleTrailGuidePlaceDetails } from './googlePlacePhotos';
import { CURATED_TRAIL_GUIDE_PHOTOS, type TrailGuidePhoto } from './placePhotos';

const PHOTO_BUCKET = 'trail-guide-photos';

export type TrailGuideHeroSource = 'official' | 'admin' | 'camper' | 'google' | 'curated' | 'wikimedia' | 'generic';

export type TrailGuideHeroPhoto = TrailGuidePhoto & {
  candidateId?: string;
  sourceType: TrailGuideHeroSource;
  sourceLabel: string;
  score: number;
  confidence: number;
  preferred: boolean;
  representative: boolean;
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
  hero_score: number | string | null;
  is_preferred: boolean;
  is_generic: boolean;
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
  if (/scenic|view|landscape/.test(raw)) tags.add('scenic');
  return [...tags];
}

function curatedCandidate(place: TrailGuidePlace): TrailGuideHeroPhoto | null {
  const photo = CURATED_TRAIL_GUIDE_PHOTOS[place.id];
  if (!photo) return null;
  const sourceType = staticSourceType(photo);
  const score = sourceType === 'official' ? 0.92 : sourceType === 'wikimedia' ? 0.825 : 0.84;
  return {
    ...photo,
    sourceType,
    sourceLabel: sourceLabel(sourceType, photo.credit),
    score,
    confidence: score,
    preferred: false,
    representative: false,
    tags: categoryTags(place),
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
    tags: [place.category.toLowerCase()],
  };
}

async function databaseCandidates(place: TrailGuidePlace): Promise<TrailGuideHeroPhoto[]> {
  const { data, error } = await supabase
    .from('trail_guide_hero_candidates')
    .select('id,source_type,source_name,image_url,storage_path,source_url,credit,license,tags,hero_score,is_preferred,is_generic')
    .eq('place_id', place.id)
    .eq('status', 'approved')
    .order('is_preferred', { ascending: false })
    .order('is_generic', { ascending: true })
    .order('hero_score', { ascending: false })
    .limit(16);

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
      tags: row.tags ?? [],
    });
  }

  return photos;
}

async function googleCandidates(place: TrailGuidePlace): Promise<TrailGuideHeroPhoto[]> {
  const details = await resolveGoogleTrailGuidePlaceDetails(place);
  if (!details?.photos.length) return [];
  return details.photos.slice(0, 6).map((photo, index) => {
    const score = Math.max(0.72, 0.82 - (index * 0.015));
    return {
      ...photo,
      sourceType: 'google' as const,
      sourceLabel: 'Google Maps',
      score,
      confidence: score,
      preferred: false,
      representative: false,
      tags: categoryTags(place),
    };
  });
}

function rankCandidates(candidates: TrailGuideHeroPhoto[]) {
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (!candidate.url || seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    })
    .sort((a, b) => {
      if (a.preferred !== b.preferred) return Number(b.preferred) - Number(a.preferred);
      if (a.representative !== b.representative) return Number(a.representative) - Number(b.representative);
      return b.score - a.score;
    });
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
    return rankCandidates([
      ...stored,
      ...(curated ? [curated] : []),
      ...google,
      genericCandidate(place),
    ]);
  })();

  sessionCache.set(place.id, pending);
  return pending;
}

export function useTrailGuideHeroCandidates(place?: TrailGuidePlace) {
  const initial = place ? rankCandidates([curatedCandidate(place), genericCandidate(place)].filter((item): item is TrailGuideHeroPhoto => Boolean(item))) : [];
  const [photos, setPhotos] = useState<TrailGuideHeroPhoto[]>(initial);

  useEffect(() => {
    let active = true;
    if (!place) {
      setPhotos([]);
      return () => { active = false; };
    }
    setPhotos(rankCandidates([curatedCandidate(place), genericCandidate(place)].filter((item): item is TrailGuideHeroPhoto => Boolean(item))));
    void resolveTrailGuideHeroCandidates(place).then((next) => {
      if (active) setPhotos(next);
    });
    return () => { active = false; };
  }, [place]);

  return photos;
}

export function clearTrailGuideHeroSelectionCache(placeId?: string) {
  if (placeId) sessionCache.delete(placeId);
  else sessionCache.clear();
}
