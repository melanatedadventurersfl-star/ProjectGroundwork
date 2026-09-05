import { supabase } from '../lib/supabase';
import { getOutingHostAccess, type OutingHostRecord } from './api';

export const HOST_SETUP_KEYS = [
  'profile',
  'organization',
  'working_preferences',
  'ai_privacy',
  'notifications',
  'connections',
  'event_defaults',
  'team',
] as const;

export type HostSetupKey = (typeof HOST_SETUP_KEYS)[number];

export type HostCenterProfile = {
  profileId: string;
  organizationName: string;
  hostDisplayName: string;
  city: string;
  state: string;
  contactEmail: string;
  websiteUrl: string;
  publicDescription: string;
  publicProfileEnabled: boolean;
  workingAreas: string[];
  introStartedAt: string | null;
  introCompletedAt: string | null;
  introLastStep: number;
  profileReviewedAt: string | null;
  organizationReviewedAt: string | null;
  workingPreferencesReviewedAt: string | null;
  aiPrivacyReviewedAt: string | null;
  notificationsReviewedAt: string | null;
  connectionsReviewedAt: string | null;
  eventDefaultsReviewedAt: string | null;
  teamReviewedAt: string | null;
  defaultCity: string;
  defaultState: string;
  defaultVisibility: 'public' | 'private';
  defaultReminderSchedule: number[];
  defaultCancellationNote: string;
  defaultWaiverPreference: 'ask' | 'required' | 'not_required';
  lastHostDestination: string | null;
};

type HostCenterRow = {
  profile_id: string;
  organization_name: string | null;
  host_display_name: string | null;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  website_url: string | null;
  public_description: string | null;
  public_profile_enabled: boolean;
  working_areas: string[] | null;
  intro_started_at: string | null;
  intro_completed_at: string | null;
  intro_last_step: number;
  profile_reviewed_at: string | null;
  organization_reviewed_at: string | null;
  working_preferences_reviewed_at: string | null;
  ai_privacy_reviewed_at: string | null;
  notifications_reviewed_at: string | null;
  connections_reviewed_at: string | null;
  event_defaults_reviewed_at: string | null;
  team_reviewed_at: string | null;
  default_city: string | null;
  default_state: string | null;
  default_visibility: 'public' | 'private';
  default_reminder_schedule: unknown;
  default_cancellation_note: string | null;
  default_waiver_preference: 'ask' | 'required' | 'not_required';
  last_host_destination: string | null;
};

const SELECT = 'profile_id,organization_name,host_display_name,city,state,contact_email,website_url,public_description,public_profile_enabled,working_areas,intro_started_at,intro_completed_at,intro_last_step,profile_reviewed_at,organization_reviewed_at,working_preferences_reviewed_at,ai_privacy_reviewed_at,notifications_reviewed_at,connections_reviewed_at,event_defaults_reviewed_at,team_reviewed_at,default_city,default_state,default_visibility,default_reminder_schedule,default_cancellation_note,default_waiver_preference,last_host_destination';

function mapRow(row: HostCenterRow): HostCenterProfile {
  const reminders = Array.isArray(row.default_reminder_schedule)
    ? row.default_reminder_schedule.map(Number).filter(Number.isFinite)
    : [7, 1, 0];
  return {
    profileId: row.profile_id,
    organizationName: row.organization_name ?? '',
    hostDisplayName: row.host_display_name ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    contactEmail: row.contact_email ?? '',
    websiteUrl: row.website_url ?? '',
    publicDescription: row.public_description ?? '',
    publicProfileEnabled: row.public_profile_enabled,
    workingAreas: row.working_areas ?? [],
    introStartedAt: row.intro_started_at,
    introCompletedAt: row.intro_completed_at,
    introLastStep: row.intro_last_step,
    profileReviewedAt: row.profile_reviewed_at,
    organizationReviewedAt: row.organization_reviewed_at,
    workingPreferencesReviewedAt: row.working_preferences_reviewed_at,
    aiPrivacyReviewedAt: row.ai_privacy_reviewed_at,
    notificationsReviewedAt: row.notifications_reviewed_at,
    connectionsReviewedAt: row.connections_reviewed_at,
    eventDefaultsReviewedAt: row.event_defaults_reviewed_at,
    teamReviewedAt: row.team_reviewed_at,
    defaultCity: row.default_city ?? '',
    defaultState: row.default_state ?? '',
    defaultVisibility: row.default_visibility,
    defaultReminderSchedule: reminders,
    defaultCancellationNote: row.default_cancellation_note ?? '',
    defaultWaiverPreference: row.default_waiver_preference,
    lastHostDestination: row.last_host_destination,
  };
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to use Host Center.');
  return data.user;
}

export function sanitizeHostDestination(value?: string | string[] | null) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/host')) return '/host';
  if (candidate.startsWith('/host-login')) return '/host';
  return candidate;
}

export async function getHostCenterProfile(): Promise<HostCenterProfile | null> {
  const user = await currentUser();
  const { data, error } = await supabase.from('host_center_profiles').select(SELECT).eq('profile_id', user.id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as HostCenterRow) : null;
}

export async function ensureHostCenterProfile(): Promise<HostCenterProfile> {
  const user = await currentUser();
  const access = await getOutingHostAccess();
  if (!access.approved) throw new Error('Approved host access is required.');
  const existing = await getHostCenterProfile();
  if (existing) return existing;

  const { data: baseProfile } = await supabase
    .from('profiles')
    .select('display_name,home_city,home_state')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase.from('host_center_profiles').insert({
    profile_id: user.id,
    host_display_name: baseProfile?.display_name ?? '',
    city: baseProfile?.home_city ?? '',
    state: baseProfile?.home_state ?? '',
    contact_email: user.email ?? '',
    default_city: baseProfile?.home_city ?? '',
    default_state: baseProfile?.home_state ?? '',
    intro_started_at: new Date().toISOString(),
    intro_last_step: 1,
  }).select(SELECT).single();
  if (error) throw error;
  return mapRow(data as HostCenterRow);
}

export async function saveHostCenterProfile(input: Partial<HostCenterProfile>) {
  const user = await currentUser();
  const payload: Record<string, unknown> = { profile_id: user.id, updated_at: new Date().toISOString() };
  if (input.organizationName !== undefined) payload.organization_name = input.organizationName.trim();
  if (input.hostDisplayName !== undefined) payload.host_display_name = input.hostDisplayName.trim();
  if (input.city !== undefined) payload.city = input.city.trim();
  if (input.state !== undefined) payload.state = input.state.trim().toUpperCase();
  if (input.contactEmail !== undefined) payload.contact_email = input.contactEmail.trim();
  if (input.websiteUrl !== undefined) payload.website_url = input.websiteUrl.trim();
  if (input.publicDescription !== undefined) payload.public_description = input.publicDescription.trim();
  if (input.publicProfileEnabled !== undefined) payload.public_profile_enabled = input.publicProfileEnabled;
  if (input.workingAreas !== undefined) payload.working_areas = input.workingAreas;
  if (input.introLastStep !== undefined) payload.intro_last_step = Math.max(0, Math.min(6, input.introLastStep));
  if (input.defaultCity !== undefined) payload.default_city = input.defaultCity.trim();
  if (input.defaultState !== undefined) payload.default_state = input.defaultState.trim().toUpperCase();
  if (input.defaultVisibility !== undefined) payload.default_visibility = input.defaultVisibility;
  if (input.defaultReminderSchedule !== undefined) payload.default_reminder_schedule = input.defaultReminderSchedule;
  if (input.defaultCancellationNote !== undefined) payload.default_cancellation_note = input.defaultCancellationNote.trim();
  if (input.defaultWaiverPreference !== undefined) payload.default_waiver_preference = input.defaultWaiverPreference;
  if (input.lastHostDestination !== undefined) payload.last_host_destination = sanitizeHostDestination(input.lastHostDestination);
  const { data, error } = await supabase.from('host_center_profiles').upsert(payload, { onConflict: 'profile_id' }).select(SELECT).single();
  if (error) throw error;
  return mapRow(data as HostCenterRow);
}

const REVIEW_COLUMN: Record<HostSetupKey, string> = {
  profile: 'profile_reviewed_at',
  organization: 'organization_reviewed_at',
  working_preferences: 'working_preferences_reviewed_at',
  ai_privacy: 'ai_privacy_reviewed_at',
  notifications: 'notifications_reviewed_at',
  connections: 'connections_reviewed_at',
  event_defaults: 'event_defaults_reviewed_at',
  team: 'team_reviewed_at',
};

export async function markHostSetupReviewed(key: HostSetupKey) {
  const user = await currentUser();
  const { error } = await supabase.from('host_center_profiles').update({
    [REVIEW_COLUMN[key]]: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('profile_id', user.id);
  if (error) throw error;
}

export async function completeHostIntroduction(destination = '/host') {
  const user = await currentUser();
  const safeDestination = sanitizeHostDestination(destination);
  const { error } = await supabase.from('host_center_profiles').update({
    intro_completed_at: new Date().toISOString(),
    intro_last_step: 6,
    last_host_destination: safeDestination,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', user.id);
  if (error) throw error;
  return safeDestination;
}

export async function restartHostIntroduction() {
  const user = await currentUser();
  const { error } = await supabase.from('host_center_profiles').update({
    intro_started_at: new Date().toISOString(),
    intro_completed_at: null,
    intro_last_step: 1,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', user.id);
  if (error) throw error;
}

export function getHostSetupProgress(profile: HostCenterProfile | null) {
  if (!profile) return { completed: 0, total: HOST_SETUP_KEYS.length, percent: 0 };
  const completed = [
    profile.profileReviewedAt,
    profile.organizationReviewedAt,
    profile.workingPreferencesReviewedAt,
    profile.aiPrivacyReviewedAt,
    profile.notificationsReviewedAt,
    profile.connectionsReviewedAt,
    profile.eventDefaultsReviewedAt,
    profile.teamReviewedAt,
  ].filter(Boolean).length;
  return { completed, total: HOST_SETUP_KEYS.length, percent: Math.round((completed / HOST_SETUP_KEYS.length) * 100) };
}

export type HostEntryState = {
  approved: boolean;
  accessRecord: OutingHostRecord | null;
  profile: HostCenterProfile | null;
  destination: string;
};

export async function resolveHostEntry(next?: string | string[] | null): Promise<HostEntryState> {
  const destination = sanitizeHostDestination(next);
  const access = await getOutingHostAccess();
  if (!access.approved) return { approved: false, accessRecord: access.record, profile: null, destination };
  const profile = await ensureHostCenterProfile();
  return { approved: true, accessRecord: access.record, profile, destination };
}
