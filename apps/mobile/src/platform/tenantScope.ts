import { supabase } from '../lib/supabase';
import { getActiveOrganization, type OrganizationWorkspace } from './organizations';

export async function requireActiveOrganization(): Promise<OrganizationWorkspace> {
  const organization = await getActiveOrganization();
  if (!organization) throw new Error('Choose an organization before continuing.');
  return organization;
}

export async function requireActiveOrganizationId(): Promise<string> {
  return (await requireActiveOrganization()).id;
}

export async function assertHostOrganizationInActiveTenant(hostOrganizationId: string) {
  const activeOrganizationId = await requireActiveOrganizationId();
  const { data, error } = await supabase
    .from('host_organizations')
    .select('id,platform_organization_id')
    .eq('id', hostOrganizationId)
    .eq('platform_organization_id', activeOrganizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This host profile belongs to a different organization. Switch organizations to manage it.');
  return { hostOrganizationId: data.id as string, platformOrganizationId: activeOrganizationId };
}

export async function assertAdventureInActiveTenant(adventureId: string) {
  const activeOrganizationId = await requireActiveOrganizationId();
  const { data, error } = await supabase
    .from('adventures')
    .select('id,platform_organization_id')
    .eq('id', adventureId)
    .eq('platform_organization_id', activeOrganizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This event belongs to a different organization. Switch organizations to manage it.');
  return { adventureId: data.id as string, platformOrganizationId: activeOrganizationId };
}

export function tenantStoragePath(platformOrganizationId: string, ...segments: Array<string | number | null | undefined>) {
  const safeSegments = segments
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map((value) => String(value).replace(/^\/+|\/+$/g, '').replace(/\.\./g, ''))
    .filter(Boolean);
  return ['tenants', platformOrganizationId, ...safeSegments].join('/');
}

export function tenantCacheKey(platformOrganizationId: string, key: string) {
  return `tenant:${platformOrganizationId}:${key}`;
}
