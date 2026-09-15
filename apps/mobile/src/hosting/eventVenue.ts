import { supabase } from '../lib/supabase';
import type { VenueCandidate } from './venueDiscovery';

export type EventVenue = {
  id: string;
  adventureId: string;
  organizationId: string;
  provider: 'google_places' | 'manual' | 'community_directory' | 'tenant_history';
  providerPlaceId: string | null;
  venueName: string;
  address: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  primaryType: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bookingStatus: string;
  contractStatus: string;
  contractDocumentUrl: string;
  depositAmountCents: number | null;
  depositDueAt: string | null;
  depositPaidAt: string | null;
  balanceAmountCents: number | null;
  balanceDueAt: string | null;
  parkingNotes: string;
  powerNotes: string;
  accessibilityNotes: string;
  loadInNotes: string;
  restroomNotes: string;
  wifiNotes: string;
  arrivalNotes: string;
};

type EventVenueRow = {
  id: string;
  adventure_id: string;
  organization_id: string;
  provider: EventVenue['provider'];
  provider_place_id: string | null;
  venue_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  website_url: string | null;
  photo_url: string | null;
  rating: number | null;
  rating_count: number | null;
  primary_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  booking_status: string;
  contract_status: string;
  contract_document_url: string | null;
  deposit_amount_cents: number | null;
  deposit_due_at: string | null;
  deposit_paid_at: string | null;
  balance_amount_cents: number | null;
  balance_due_at: string | null;
  parking_notes: string | null;
  power_notes: string | null;
  accessibility_notes: string | null;
  load_in_notes: string | null;
  restroom_notes: string | null;
  wifi_notes: string | null;
  arrival_notes: string | null;
};

const SELECT = 'id,adventure_id,organization_id,provider,provider_place_id,venue_name,address,city,state,postal_code,latitude,longitude,google_maps_url,website_url,photo_url,rating,rating_count,primary_type,contact_name,contact_email,contact_phone,booking_status,contract_status,contract_document_url,deposit_amount_cents,deposit_due_at,deposit_paid_at,balance_amount_cents,balance_due_at,parking_notes,power_notes,accessibility_notes,load_in_notes,restroom_notes,wifi_notes,arrival_notes';

function map(row: EventVenueRow): EventVenue {
  return {
    id: row.id,
    adventureId: row.adventure_id,
    organizationId: row.organization_id,
    provider: row.provider,
    providerPlaceId: row.provider_place_id,
    venueName: row.venue_name,
    address: row.address,
    city: row.city ?? '',
    state: row.state ?? '',
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    googleMapsUrl: row.google_maps_url,
    websiteUrl: row.website_url,
    photoUrl: row.photo_url,
    rating: row.rating,
    ratingCount: row.rating_count,
    primaryType: row.primary_type,
    contactName: row.contact_name ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    bookingStatus: row.booking_status,
    contractStatus: row.contract_status,
    contractDocumentUrl: row.contract_document_url ?? '',
    depositAmountCents: row.deposit_amount_cents,
    depositDueAt: row.deposit_due_at,
    depositPaidAt: row.deposit_paid_at,
    balanceAmountCents: row.balance_amount_cents,
    balanceDueAt: row.balance_due_at,
    parkingNotes: row.parking_notes ?? '',
    powerNotes: row.power_notes ?? '',
    accessibilityNotes: row.accessibility_notes ?? '',
    loadInNotes: row.load_in_notes ?? '',
    restroomNotes: row.restroom_notes ?? '',
    wifiNotes: row.wifi_notes ?? '',
    arrivalNotes: row.arrival_notes ?? '',
  };
}

export async function getEventVenue(adventureId: string): Promise<EventVenue | null> {
  const { data, error } = await supabase.from('event_venues').select(SELECT).eq('adventure_id', adventureId).maybeSingle();
  if (error) throw error;
  return data ? map(data as EventVenueRow) : null;
}

export async function saveSelectedEventVenue(input: {
  adventureId: string;
  organizationId: string;
  candidate: VenueCandidate;
}) {
  const provider = input.candidate.placeId ? 'google_places' : input.candidate.source;
  const row = {
    adventure_id: input.adventureId,
    organization_id: input.organizationId,
    provider,
    provider_place_id: input.candidate.placeId,
    venue_name: input.candidate.name,
    address: input.candidate.address,
    city: input.candidate.city,
    state: input.candidate.state,
    postal_code: input.candidate.postalCode,
    latitude: input.candidate.latitude,
    longitude: input.candidate.longitude,
    google_maps_url: input.candidate.mapsUrl,
    website_url: input.candidate.websiteUrl,
    photo_url: input.candidate.photoUrl,
    rating: input.candidate.rating,
    rating_count: input.candidate.ratingCount,
    primary_type: input.candidate.primaryType,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('event_venues').upsert(row, { onConflict: 'adventure_id' }).select(SELECT).single();
  if (error) throw error;

  const { error: adventureError } = await supabase.from('adventures').update({
    venue_name: input.candidate.name,
    address: input.candidate.address,
    city: input.candidate.city,
    state: input.candidate.state,
    latitude: input.candidate.latitude,
    longitude: input.candidate.longitude,
    venue_place_id: input.candidate.placeId,
    venue_source: provider,
  }).eq('id', input.adventureId);
  if (adventureError) throw adventureError;
  return map(data as EventVenueRow);
}

export async function saveManualEventVenue(input: {
  adventureId: string;
  organizationId: string;
  venueName: string;
  address?: string | null;
  city: string;
  state: string;
}) {
  const { data, error } = await supabase.from('event_venues').upsert({
    adventure_id: input.adventureId,
    organization_id: input.organizationId,
    provider: 'manual',
    provider_place_id: null,
    venue_name: input.venueName.trim(),
    address: input.address?.trim() || null,
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'adventure_id' }).select(SELECT).single();
  if (error) throw error;
  return map(data as EventVenueRow);
}

export async function updateEventVenue(adventureId: string, changes: Partial<{
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  booking_status: string;
  contract_status: string;
  contract_document_url: string | null;
  deposit_amount_cents: number | null;
  deposit_due_at: string | null;
  deposit_paid_at: string | null;
  balance_amount_cents: number | null;
  balance_due_at: string | null;
  parking_notes: string | null;
  power_notes: string | null;
  accessibility_notes: string | null;
  load_in_notes: string | null;
  restroom_notes: string | null;
  wifi_notes: string | null;
  arrival_notes: string | null;
}>) {
  const { data, error } = await supabase.from('event_venues').update({ ...changes, updated_at: new Date().toISOString() }).eq('adventure_id', adventureId).select(SELECT).single();
  if (error) throw error;
  return map(data as EventVenueRow);
}
