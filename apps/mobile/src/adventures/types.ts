export type AdventureStatus = 'published' | 'sold_out' | 'cancelled' | 'completed';
export type AdventureDifficulty = 'easy' | 'moderate' | 'challenging';
export type AdventureAccessLevel = 'public' | 'go_plus_only' | 'go_plus_early_access';

export type AdventureSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: AdventureDifficulty;
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
  hero_image_url: string | null;
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