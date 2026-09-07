import { supabase } from '../lib/supabase';

export type OverwatchSection =
  | 'overview'
  | 'members'
  | 'memberships'
  | 'hosts'
  | 'vendors'
  | 'groups'
  | 'events'
  | 'approvals'
  | 'reports'
  | 'audit';

export type OverwatchEntityType =
  | 'member'
  | 'host'
  | 'vendor'
  | 'vendor_profile'
  | 'group'
  | 'adventure'
  | 'local_event'
  | 'report';

export type OverwatchRecord = Record<string, unknown> & {
  id: string;
  entity_type?: OverwatchEntityType | string;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OverwatchSearchResult = {
  entity_type: OverwatchEntityType;
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type OverwatchSnapshot = {
  counts: {
    members: number;
    active_members: number;
    hosts: number;
    approved_hosts: number;
    vendors: number;
    approved_vendors: number;
    groups: number;
    events: number;
    active_memberships: number;
    pending_approvals: number;
    open_reports: number;
  };
  members: OverwatchRecord[];
  hosts: OverwatchRecord[];
  vendors: OverwatchRecord[];
  groups: OverwatchRecord[];
  events: OverwatchRecord[];
  reports: OverwatchRecord[];
  audit: OverwatchRecord[];
  recent_activity: OverwatchSearchResult[];
};

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || 'Overwatch request failed.');
}

export async function getOverwatchAccess() {
  const { data, error } = await supabase.rpc('is_overwatch_owner');
  throwIfError(error);
  return data === true;
}

export async function getOverwatchSnapshot(): Promise<OverwatchSnapshot> {
  const { data, error } = await supabase.rpc('overwatch_snapshot');
  throwIfError(error);
  return data as OverwatchSnapshot;
}

export async function searchOverwatch(query: string): Promise<OverwatchSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase.rpc('overwatch_search', { p_query: trimmed, p_limit: 60 });
  throwIfError(error);
  return (data ?? []) as OverwatchSearchResult[];
}

export async function getOverwatchEntityDetail(entityType: string, entityId: string): Promise<OverwatchRecord> {
  const { data, error } = await supabase.rpc('overwatch_entity_detail', {
    p_entity_type: entityType,
    p_entity_id: entityId,
  });
  throwIfError(error);
  return data as OverwatchRecord;
}

export async function controlOverwatchEntity(input: {
  entityType: string;
  entityId: string;
  action: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc('overwatch_control', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_action: input.action,
    p_reason: input.reason?.trim() || null,
  });
  throwIfError(error);
  return data as Record<string, unknown>;
}
