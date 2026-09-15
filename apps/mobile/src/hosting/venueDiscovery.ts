import { supabase } from '../lib/supabase';

export type VenueDiscoverySource = 'tenant_history' | 'community_directory' | 'google_places';
export type VenueDiscoveryMode = 'direct' | 'recommendation';
export type VenueProviderStatus = 'available' | 'error' | 'unconfigured';

export type VenueCandidate = {
  id: string;
  placeId: string | null;
  name: string;
  address: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryType: string | null;
  types: string[];
  rating: number | null;
  ratingCount: number | null;
  photoUrl: string | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  source: VenueDiscoverySource;
  sourceLabel: string;
  reason: string;
  fitSignals: string[];
  unknowns: string[];
  preferred: boolean;
  historyUses: number;
};

export type VenueDiscoveryRequest = {
  organizationId: string | null;
  city?: string;
  state?: string;
  mode?: VenueDiscoveryMode;
  eventType?: string;
  capacity?: number | null;
  attendanceRange?: string | null;
  venueTypes?: string[];
  refinement?: string | null;
  areaHint?: string | null;
  searchRadiusKm?: number | null;
  excludePlaceIds?: string[];
  communityDirectoryEnabled?: boolean;
  maxResults?: number;
};

export type VenueDiscoveryResponse = {
  query: string;
  candidates: VenueCandidate[];
  sourceCounts: Record<string, number>;
  warnings: string[];
  providers: {
    googlePlaces: { status: VenueProviderStatus };
  };
};

export async function discoverVenues(input: VenueDiscoveryRequest): Promise<VenueDiscoveryResponse> {
  const { data, error } = await supabase.functions.invoke('host-venue-discovery', {
    body: {
      organizationId: input.organizationId,
      city: input.city?.trim() ?? '',
      state: input.state?.trim().toUpperCase() ?? '',
      searchMode: input.mode ?? 'recommendation',
      eventType: input.eventType?.trim() || null,
      capacity: input.capacity ?? null,
      attendanceRange: input.attendanceRange?.trim() || null,
      venueTypes: (input.venueTypes ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 12),
      refinement: input.refinement?.trim() || null,
      areaHint: input.areaHint?.trim() || null,
      searchRadiusKm: input.searchRadiusKm ?? null,
      excludePlaceIds: (input.excludePlaceIds ?? []).filter(Boolean).slice(0, 40),
      communityDirectoryEnabled: input.communityDirectoryEnabled === true,
      maxResults: Math.max(1, Math.min(8, input.maxResults ?? 5)),
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  const googleStatus = data?.providers?.googlePlaces?.status;
  return {
    query: String(data?.query ?? ''),
    candidates: Array.isArray(data?.candidates) ? data.candidates as VenueCandidate[] : [],
    sourceCounts: data?.sourceCounts && typeof data.sourceCounts === 'object' ? data.sourceCounts : {},
    warnings: Array.isArray(data?.warnings) ? data.warnings.map(String) : [],
    providers: {
      googlePlaces: {
        status: googleStatus === 'available' || googleStatus === 'error' || googleStatus === 'unconfigured' ? googleStatus : 'error',
      },
    },
  };
}

export async function saveVenueToShortlist(organizationId: string, candidate: VenueCandidate, context: Record<string, unknown> = {}) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to save a venue.');
  const row = {
    organization_id: organizationId,
    profile_id: profileId,
    provider: candidate.placeId ? 'google_places' : candidate.source,
    provider_place_id: candidate.placeId,
    venue_name: candidate.name,
    address: candidate.address,
    city: candidate.city,
    state: candidate.state,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    photo_url: candidate.photoUrl,
    source: candidate.source,
    context,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('host_venue_shortlist').upsert(row, {
    onConflict: candidate.placeId
      ? 'organization_id,profile_id,provider,provider_place_id'
      : 'organization_id,profile_id,provider,venue_name',
  });
  if (error) throw error;
}

export async function setOrganizationVenuePreference(
  organizationId: string,
  candidate: VenueCandidate,
  preference: 'preferred' | 'blocked',
) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to update venue preferences.');
  const row = {
    organization_id: organizationId,
    provider: candidate.placeId ? 'google_places' : candidate.source,
    provider_place_id: candidate.placeId,
    venue_name: candidate.name,
    address: candidate.address,
    preference,
    updated_by: profileId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('organization_venue_preferences').upsert(row, {
    onConflict: candidate.placeId
      ? 'organization_id,provider,provider_place_id'
      : 'organization_id,provider,venue_name',
  });
  if (error) throw error;
}

export async function persistSelectedVenueMetadata(adventureId: string, venue: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  source?: string | null;
}) {
  const payload: Record<string, unknown> = {
    address: venue.address ?? null,
    latitude: venue.latitude ?? null,
    longitude: venue.longitude ?? null,
    venue_place_id: venue.placeId ?? null,
    venue_source: venue.source ?? null,
  };
  const { error } = await supabase.from('adventures').update(payload).eq('id', adventureId);
  if (error) throw error;
}
