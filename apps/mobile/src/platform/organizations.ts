import { supabase } from '../lib/supabase';

export type OrganizationRole =
  | 'owner'
  | 'admin'
  | 'event_manager'
  | 'marketing'
  | 'finance'
  | 'host'
  | 'staff'
  | 'worker'
  | 'vendor'
  | 'member'
  | 'viewer';

export type OrganizationPermission =
  | 'organization.view'
  | 'organization.settings.manage'
  | 'organization.branding.manage'
  | 'members.view'
  | 'members.manage'
  | 'roles.manage'
  | 'events.view'
  | 'events.manage'
  | 'events.publish'
  | 'tasks.view'
  | 'tasks.manage'
  | 'tasks.assign'
  | 'vendors.view'
  | 'vendors.manage'
  | 'workers.view'
  | 'workers.manage'
  | 'communications.view'
  | 'communications.send'
  | 'marketing.view'
  | 'marketing.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'analytics.view'
  | 'files.view'
  | 'files.manage'
  | 'integrations.view'
  | 'integrations.manage'
  | 'ai.use'
  | 'ai.manage'
  | 'audit.view';

export type OrganizationKind = 'community' | 'company' | 'nonprofit' | 'brand' | 'team' | 'other';

export type OrganizationWorkspace = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  status: string;
  visibility: 'public' | 'private';
  logoUrl: string | null;
  coverImageUrl: string | null;
  roles: OrganizationRole[];
  isActive: boolean;
  isPlatformDefault: boolean;
};

export type ProvisionOrganizationInput = {
  name: string;
  slug: string;
  kind?: OrganizationKind;
  visibility?: 'public' | 'private';
  blueprintCode?: 'community';
  primaryColor?: string | null;
  accentColor?: string | null;
  makeActive?: boolean;
};

export type ProvisionOrganizationResult = {
  organizationId: string;
  experienceId: string;
  name: string;
  slug: string;
  blueprintCode: string;
  experienceStatus: string;
  madeActive: boolean;
};

function normalizeOrganization(row: any): OrganizationWorkspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    visibility: row.visibility,
    logoUrl: row.logo_url ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    roles: Array.isArray(row.roles) ? row.roles : [],
    isActive: row.is_active === true,
    isPlatformDefault: row.is_platform_default === true,
  };
}

export async function listMyOrganizations(): Promise<OrganizationWorkspace[]> {
  const { data, error } = await supabase.rpc('list_my_organizations');
  if (error) throw error;
  return (data ?? []).map(normalizeOrganization);
}

export async function getActiveOrganization(): Promise<OrganizationWorkspace | null> {
  const organizations = await listMyOrganizations();
  return organizations.find((organization) => organization.isActive)
    ?? organizations.find((organization) => organization.isPlatformDefault)
    ?? organizations[0]
    ?? null;
}

export async function setActiveOrganization(organizationId: string): Promise<OrganizationWorkspace> {
  const { data, error } = await supabase.rpc('set_active_organization', {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Unable to switch organization.');

  const organizations = await listMyOrganizations();
  const active = organizations.find((organization) => organization.id === organizationId);
  if (!active) throw new Error('The selected organization is no longer available.');
  return { ...active, isActive: true };
}

export async function hasOrganizationPermission(
  organizationId: string,
  permission: OrganizationPermission,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('organization_has_permission', {
    p_organization_id: organizationId,
    p_permission_code: permission,
  });
  if (error) throw error;
  return data === true;
}

export async function provisionOrganization(input: ProvisionOrganizationInput): Promise<ProvisionOrganizationResult> {
  const { data, error } = await supabase.rpc('provision_organization', {
    p_name: input.name.trim(),
    p_slug: input.slug.trim().toLowerCase(),
    p_kind: input.kind ?? 'community',
    p_visibility: input.visibility ?? 'private',
    p_blueprint_code: input.blueprintCode ?? 'community',
    p_primary_color: input.primaryColor?.trim() || null,
    p_accent_color: input.accentColor?.trim() || null,
    p_make_active: input.makeActive === true,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Organization provisioning returned an invalid response.');
  }

  const row = data as Record<string, unknown>;
  if (typeof row.organization_id !== 'string' || typeof row.experience_id !== 'string') {
    throw new Error('Organization provisioning did not return tenant identifiers.');
  }

  return {
    organizationId: row.organization_id,
    experienceId: row.experience_id,
    name: typeof row.name === 'string' ? row.name : input.name.trim(),
    slug: typeof row.slug === 'string' ? row.slug : input.slug.trim().toLowerCase(),
    blueprintCode: typeof row.blueprint_code === 'string' ? row.blueprint_code : 'community',
    experienceStatus: typeof row.experience_status === 'string' ? row.experience_status : 'draft',
    madeActive: row.made_active === true,
  };
}

export function organizationRoleLabel(role: OrganizationRole): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'admin': return 'Admin';
    case 'event_manager': return 'Event Manager';
    case 'marketing': return 'Marketing';
    case 'finance': return 'Finance';
    case 'host': return 'Host';
    case 'staff': return 'Team Member';
    case 'worker': return 'Worker';
    case 'vendor': return 'Vendor';
    case 'member': return 'Member';
    case 'viewer': return 'Viewer';
  }
}
