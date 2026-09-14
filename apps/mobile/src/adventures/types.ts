export type AdventureStatus = 'published' | 'sold_out' | 'cancelled' | 'completed';
export type AdventureDifficulty = 'easy' | 'moderate' | 'challenging';
export type AdventureAccessLevel = 'public' | 'go_plus_only' | 'go_plus_early_access';
export type AdventureLocationType = 'physical' | 'online' | 'hybrid' | 'tbd';

export type AdventureSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: AdventureDifficulty;
  difficulty_applicable?: boolean;
  event_tags?: string[];
  status: AdventureStatus;
  starts_at: string;
  ends_at: string;
  address: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  venue_name: string | null;
  location_type?: AdventureLocationType;
  online_url?: string | null;
  hero_image_url: string | null;
  hero_alt_text?: string | null;
  capacity: number | null;
  spots_remaining: number | null;
  starting_price_cents: number;
  is_featured: boolean;
  is_demo?: boolean;
  is_saved?: boolean;
  access_level?: AdventureAccessLevel;
  go_plus_early_access_at?: string | null;
  public_registration_at?: string | null;
  created_by?: string | null;
};

export type AdventureDetail = AdventureSummary & {
  description: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  meeting_instructions: string | null;
};

export function adventureLocationLabel(adventure: Pick<AdventureSummary, 'location_type' | 'venue_name' | 'city' | 'state'>) {
  if (adventure.location_type === 'online') return 'Online event';
  if (adventure.location_type === 'tbd') return 'Location TBA';
  const physical = adventure.venue_name
    ? `${adventure.venue_name} · ${[adventure.city, adventure.state].filter(Boolean).join(', ')}`
    : [adventure.city, adventure.state].filter(Boolean).join(', ');
  if (adventure.location_type === 'hybrid') return physical ? `${physical} · Online` : 'Hybrid event';
  return physical || 'Location TBA';
}
