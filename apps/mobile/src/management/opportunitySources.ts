import { supabase } from '../lib/supabase';
import { requireActiveOrganizationId } from '../platform/tenantScope';

export type OpportunityDiscoverySource = {
  id: string;
  label: string;
  copy: string;
};

export async function listOpportunityDiscoverySources(): Promise<OpportunityDiscoverySource[]> {
  const organizationId = await requireActiveOrganizationId();
  const { data, error } = await supabase.functions.invoke('opportunity-discover', {
    body: { action: 'list_sources', organizationId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return Array.isArray(data?.sources)
    ? data.sources.filter((source: unknown): source is OpportunityDiscoverySource => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
        const row = source as Record<string, unknown>;
        return typeof row.id === 'string' && typeof row.label === 'string' && typeof row.copy === 'string';
      })
    : [];
}
