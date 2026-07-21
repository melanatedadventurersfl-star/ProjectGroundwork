export type AdventureStatus = 'published' | 'sold_out';
export type AdventureDifficulty = 'easy' | 'moderate' | 'challenging';

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
  city: string;
  state: string;
  venue_name: string | null;
  hero_image_url: string | null;
  capacity: number | null;
  spots_remaining: number | null;
  starting_price_cents: number;
  is_featured: boolean;
  is_saved?: boolean;
};

export type AdventureDetail = AdventureSummary & {
  description: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  meeting_instructions: string | null;
};
