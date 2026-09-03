import { supabase } from '../lib/supabase';

export type PublicHostEvent = {
  id: string;
  title: string;
  starts_at: string;
  city: string;
  state: string;
  category: string;
  hero_image_url?: string | null;
  spots_remaining?: number | null;
  capacity?: number | null;
  status: string;
};

export type PublicHostProfile = {
  id: string;
  host_type: 'community' | 'organization' | 'official';
  approved_at?: string | null;
  display_name?: string | null;
  organization_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  tagline?: string | null;
  home_city?: string | null;
  home_state?: string | null;
  location_summary?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  contact_email?: string | null;
  specialties: string[];
  availability_status?: string | null;
  accepting_messages: boolean;
  faq: Array<{ question?: string; answer?: string }>;
  policies: Array<{ label?: string; url?: string; text?: string }>;
  created_at: string;
  events_hosted: number;
  upcoming_event_count: number;
  follower_count: number;
  viewer_follows: boolean;
  upcoming_events: PublicHostEvent[];
  past_events: PublicHostEvent[];
};

export async function getPublicHostProfile(hostProfileId: string) {
  const { data, error } = await supabase.rpc('get_public_host_profile', {
    p_host_profile_id: hostProfileId,
  });
  if (error) throw error;
  return (data ?? null) as PublicHostProfile | null;
}

export async function setPublicHostFollow(hostProfileId: string, follow: boolean) {
  const { error } = await supabase.rpc('set_host_follow', {
    p_host_profile_id: hostProfileId,
    p_follow: follow,
  });
  if (error) throw error;
}

export async function sendHostInquiry(hostProfileId: string, message: string, adventureId?: string | null) {
  const { data, error } = await supabase.rpc('send_host_inquiry', {
    p_host_profile_id: hostProfileId,
    p_message: message,
    p_adventure_id: adventureId ?? null,
  });
  if (error) throw error;
  return data as string;
}
