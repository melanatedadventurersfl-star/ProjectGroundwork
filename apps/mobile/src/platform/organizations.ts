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
