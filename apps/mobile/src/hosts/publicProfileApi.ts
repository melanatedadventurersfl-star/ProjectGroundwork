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

export type HostProfileEditorData = {
  hostProfileId: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  organizationName: string;
  tagline: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  contactEmail: string;
  showEmail: boolean;
  locationSummary: string;
  specialties: string[];
  availabilityStatus: string;
  acceptingMessages: boolean;
  faq: Array<{ question: string; answer: string }>;
  policies: Array<{ label: string; url: string; text: string }>;
};

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function getPublicHostProfile(hostProfileId: string) {
  const { data, error } = await supabase.rpc('get_public_host_profile', {
    p_host_profile_id: hostProfileId,
  });
  if (error) throw error;
  return (data ?? null) as PublicHostProfile | null;
}

export async function getHostProfileEditorData(): Promise<HostProfileEditorData> {
  const { data: authData } = await supabase.auth.getUser();
  const hostProfileId = authData.user?.id;
  if (!hostProfileId) throw new Error('Sign in required.');

  const [{ data: host, error: hostError }, { data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('outing_hosts').select('status').eq('profile_id', hostProfileId).maybeSingle(),
    supabase.from('profiles').select('display_name,avatar_url,cover_url,bio,home_city,home_state').eq('id', hostProfileId).single(),
    supabase.from('host_profile_settings').select('*').eq('host_profile_id', hostProfileId).maybeSingle(),
  ]);

  if (hostError) throw hostError;
  if (profileError) throw profileError;
  if (settingsError) throw settingsError;
  if (!host || host.status !== 'approved') throw new Error('Approved host access is required.');

  return {
    hostProfileId,
    displayName: profile.display_name ?? '',
    avatarUrl: profile.avatar_url ?? null,
    coverUrl: profile.cover_url ?? null,
    bio: profile.bio ?? '',
    organizationName: settings?.organization_name ?? profile.display_name ?? '',
    tagline: settings?.tagline ?? '',
    websiteUrl: settings?.website_url ?? '',
    instagramUrl: settings?.instagram_url ?? '',
    facebookUrl: settings?.facebook_url ?? '',
    contactEmail: settings?.contact_email ?? '',
    showEmail: settings?.show_email ?? false,
    locationSummary: settings?.location_summary ?? [profile.home_city, profile.home_state].filter(Boolean).join(', '),
    specialties: Array.isArray(settings?.specialties) ? settings.specialties : [],
    availabilityStatus: settings?.availability_status ?? '',
    acceptingMessages: settings?.accepting_messages ?? true,
    faq: Array.isArray(settings?.faq) ? settings.faq : [],
    policies: Array.isArray(settings?.policies) ? settings.policies : [],
  };
}

export async function saveHostProfileEditorData(input: HostProfileEditorData) {
  const { data: authData } = await supabase.auth.getUser();
  const profileId = authData.user?.id;
  if (!profileId || profileId !== input.hostProfileId) throw new Error('You can only edit your own host profile.');

  const settings = {
    host_profile_id: profileId,
    organization_name: cleanText(input.organizationName),
    tagline: cleanText(input.tagline),
    website_url: cleanText(input.websiteUrl),
    instagram_url: cleanText(input.instagramUrl),
    facebook_url: cleanText(input.facebookUrl),
    contact_email: cleanText(input.contactEmail),
    show_email: input.showEmail,
    location_summary: cleanText(input.locationSummary),
    specialties: input.specialties.map((item) => item.trim()).filter(Boolean).slice(0, 12),
    availability_status: cleanText(input.availabilityStatus),
    accepting_messages: input.acceptingMessages,
    faq: input.faq
      .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
      .filter((item) => item.question && item.answer)
      .slice(0, 10),
    policies: input.policies
      .map((item) => ({ label: item.label.trim(), url: item.url.trim(), text: item.text.trim() }))
      .filter((item) => item.label && (item.url || item.text))
      .slice(0, 10),
  };

  const { error } = await supabase.from('host_profile_settings').upsert(settings, { onConflict: 'host_profile_id' });
  if (error) throw error;
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
