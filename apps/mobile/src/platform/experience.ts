import { supabase } from '../lib/supabase';
import { getActiveOrganization, type OrganizationWorkspace } from './organizations';

export type ExperienceStatus = 'draft' | 'active' | 'archived';

export type ExperienceBranding = {
  brand_name?: string;
  primary?: string;
  surface?: string;
  accent?: string;
  text?: string;
  logo_url?: string;
  cover_image_url?: string;
  [key: string]: unknown;
};

export type ExperienceTerminology = {
  home?: string;
  events?: string;
  community?: string;
  directory?: string;
  journey?: string;
  member?: string;
  host?: string;
  [key: string]: unknown;
};

export type OrganizationExperience = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  publicSlug: string;
  blueprintCode: string;
  status: ExperienceStatus;
  branding: ExperienceBranding;
  navigation: Record<string, unknown>;
  terminology: ExperienceTerminology;
  homeLayout: unknown[];
  membershipSettings: Record<string, unknown>;
  publicSettings: Record<string, unknown>;
};

export type OrganizationExperienceModule = {
  experienceId: string;
  code: string;
  label: string;
  enabled: boolean;
  navPosition: number | null;
  routeKey: string | null;
  iconKey: string | null;
  settings: Record<string, unknown>;
};

export type ActiveExperienceContext = {
  organization: OrganizationWorkspace;
  experience: OrganizationExperience;
  modules: OrganizationExperienceModule[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeExperience(row: any): OrganizationExperience {
  return {
    id: row.id,
    organizationId: row.organization_id,
    key: row.experience_key,
    name: row.name,
    publicSlug: row.public_slug,
    blueprintCode: row.blueprint_code,
    status: row.status,
    branding: asRecord(row.branding) as ExperienceBranding,
    navigation: asRecord(row.navigation),
    terminology: asRecord(row.terminology) as ExperienceTerminology,
    homeLayout: Array.isArray(row.home_layout) ? row.home_layout : [],
    membershipSettings: asRecord(row.membership_settings),
    publicSettings: asRecord(row.public_settings),
  };
}

function normalizeModule(row: any): OrganizationExperienceModule {
  return {
    experienceId: row.experience_id,
    code: row.module_code,
    label: row.label,
    enabled: row.enabled === true,
    navPosition: typeof row.nav_position === 'number' ? row.nav_position : null,
    routeKey: row.route_key ?? null,
    iconKey: row.icon_key ?? null,
    settings: asRecord(row.settings),
  };
}

export async function getOrganizationExperience(
  organizationId: string,
  experienceKey = 'primary',
): Promise<OrganizationExperience | null> {
  const { data, error } = await supabase
    .from('organization_experiences')
    .select('id,organization_id,experience_key,name,public_slug,blueprint_code,status,branding,navigation,terminology,home_layout,membership_settings,public_settings')
    .eq('organization_id', organizationId)
    .eq('experience_key', experienceKey)
    .limit(1);

  if (error) throw error;
  const row = data?.[0];
  return row ? normalizeExperience(row) : null;
}

export async function listExperienceModules(experienceId: string): Promise<OrganizationExperienceModule[]> {
  const { data, error } = await supabase
    .from('organization_experience_modules')
    .select('experience_id,module_code,label,enabled,nav_position,route_key,icon_key,settings')
    .eq('experience_id', experienceId)
    .order('nav_position', { ascending: true, nullsFirst: false })
    .order('module_code', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeModule);
}

export async function getActiveExperienceContext(): Promise<ActiveExperienceContext | null> {
  const organization = await getActiveOrganization();
  if (!organization) return null;

  const experience = await getOrganizationExperience(organization.id);
  if (!experience) return null;

  const modules = await listExperienceModules(experience.id);
  return { organization, experience, modules };
}

export function experienceLabel(
  experience: OrganizationExperience,
  key: keyof ExperienceTerminology,
  fallback: string,
): string {
  const value = experience.terminology[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
