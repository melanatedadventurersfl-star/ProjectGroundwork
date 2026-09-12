import { supabase } from '../lib/supabase';

export type TrailGuideFactValue = boolean | number | string | string[];

export type TrailGuideDataSource = {
  id: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  sourceDate: string | null;
  priority: number;
  lastCheckedAt: string | null;
};

export type TrailGuideStructuredData = {
  placeId: string;
  displayName: string;
  operatorName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  completenessScore: number;
  lastVerifiedAt: string | null;
  facts: Record<string, TrailGuideFactValue>;
  evidence: Record<string, string>;
  factSourceIds: Record<string, string>;
  sources: TrailGuideDataSource[];
};

type ProfileRow = {
  place_id: string;
  display_name: string;
  operator_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  completeness_score: number | null;
  last_verified_at: string | null;
};

type FactRow = {
  field_key: string;
  value: TrailGuideFactValue;
  evidence_text: string | null;
  source_id: string;
};

type SourceRow = {
  id: string;
  source_type: string;
  source_name: string;
  source_url: string;
  source_date: string | null;
  priority: number | null;
  last_checked_at: string | null;
};

function isMissingTrailGuideSchema(error: { code?: string | null } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

export async function loadTrailGuideStructuredData(placeId: string): Promise<TrailGuideStructuredData | null> {
  const [profileResult, factsResult, sourcesResult] = await Promise.all([
    supabase
      .from('trail_guide_place_profiles')
      .select('place_id,display_name,operator_name,address,city,state,completeness_score,last_verified_at')
      .eq('place_id', placeId)
      .eq('is_published', true)
      .maybeSingle(),
    supabase
      .from('trail_guide_facts')
      .select('field_key,value,evidence_text,source_id')
      .eq('place_id', placeId)
      .eq('is_current', true),
    supabase
      .from('trail_guide_sources')
      .select('id,source_type,source_name,source_url,source_date,priority,last_checked_at')
      .eq('place_id', placeId)
      .eq('status', 'active')
      .order('priority', { ascending: false }),
  ]);

  if (isMissingTrailGuideSchema(profileResult.error)) return null;
  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) return null;

  if (factsResult.error && !isMissingTrailGuideSchema(factsResult.error)) throw factsResult.error;
  if (sourcesResult.error && !isMissingTrailGuideSchema(sourcesResult.error)) throw sourcesResult.error;

  const profile = profileResult.data as ProfileRow;
  const facts: Record<string, TrailGuideFactValue> = {};
  const evidence: Record<string, string> = {};
  const factSourceIds: Record<string, string> = {};

  for (const row of (factsResult.data ?? []) as FactRow[]) {
    facts[row.field_key] = row.value;
    factSourceIds[row.field_key] = row.source_id;
    if (row.evidence_text) evidence[row.field_key] = row.evidence_text;
  }

  const sources: TrailGuideDataSource[] = ((sourcesResult.data ?? []) as SourceRow[]).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceDate: row.source_date,
    priority: row.priority ?? 0,
    lastCheckedAt: row.last_checked_at,
  }));

  return {
    placeId: profile.place_id,
    displayName: profile.display_name,
    operatorName: profile.operator_name,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    completenessScore: profile.completeness_score ?? 0,
    lastVerifiedAt: profile.last_verified_at,
    facts,
    evidence,
    factSourceIds,
    sources,
  };
}

export function trailGuideBoolean(data: TrailGuideStructuredData | null, field: string) {
  const value = data?.facts[field];
  return typeof value === 'boolean' ? value : null;
}

export function trailGuideNumber(data: TrailGuideStructuredData | null, field: string) {
  const value = data?.facts[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function trailGuideString(data: TrailGuideStructuredData | null, field: string) {
  const value = data?.facts[field];
  return typeof value === 'string' ? value : null;
}

export function trailGuideStringArray(data: TrailGuideStructuredData | null, field: string) {
  const value = data?.facts[field];
  return Array.isArray(value) ? value.map(String) : null;
}

export function trailGuidePrimarySource(data: TrailGuideStructuredData | null) {
  return data?.sources[0] ?? null;
}

export function trailGuideSourceForField(data: TrailGuideStructuredData | null, field: string) {
  const sourceId = data?.factSourceIds[field];
  if (!sourceId) return null;
  return data?.sources.find((source) => source.id === sourceId) ?? null;
}
