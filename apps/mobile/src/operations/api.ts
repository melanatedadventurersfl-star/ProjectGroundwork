import { supabase } from '../lib/supabase';
import type { HeadcountRecord, IncidentRecord, RosterEntry, ScheduleItem } from './types';

export async function getAssignedAdventures() {
  const { data, error } = await supabase
    .from('adventure_staff_assignments')
    .select('adventure_id, role, station, adventures(id, title, starts_at, ends_at, city, state)')
    .order('starts_at', { referencedTable: 'adventures', ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRoster(adventureId: string): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from('adventure_roster')
    .select('*')
    .eq('adventure_id', adventureId)
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as RosterEntry[];
}

export async function checkInAttendee(adventureId: string, attendeeId: string, method: 'qr' | 'manual' | 'offline_sync', credentialCode?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('adventure_check_ins').upsert({
    adventure_id: adventureId,
    attendee_id: attendeeId,
    checked_in_by: userData.user?.id,
    method,
    credential_code: credentialCode ?? null,
    offline_recorded_at: method === 'offline_sync' ? new Date().toISOString() : null,
  }, { onConflict: 'adventure_id,attendee_id' });
  if (error) throw error;
}

export async function getSchedule(adventureId: string): Promise<ScheduleItem[]> {
  const { data, error } = await supabase
    .from('adventure_schedule_items')
    .select('id,title,description,location,starts_at,ends_at')
    .eq('adventure_id', adventureId)
    .order('starts_at');
  if (error) throw error;
  return (data ?? []) as ScheduleItem[];
}

export async function getHeadcounts(adventureId: string): Promise<HeadcountRecord[]> {
  const { data, error } = await supabase
    .from('adventure_headcounts')
    .select('id,label,expected_count,actual_count,recorded_at,notes')
    .eq('adventure_id', adventureId)
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HeadcountRecord[];
}

export async function recordHeadcount(adventureId: string, label: string, actualCount: number, expectedCount?: number, notes?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('adventure_headcounts').insert({
    adventure_id: adventureId,
    label,
    actual_count: actualCount,
    expected_count: expectedCount ?? null,
    notes: notes ?? null,
    recorded_by: userData.user?.id,
  });
  if (error) throw error;
}

export async function getIncidents(adventureId: string): Promise<IncidentRecord[]> {
  const { data, error } = await supabase
    .from('adventure_incidents')
    .select('id,title,severity,status,occurred_at,location,description')
    .eq('adventure_id', adventureId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as IncidentRecord[];
}

export async function createIncident(input: {
  adventureId: string;
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  location?: string;
  actionsTaken?: string;
  emergencyServicesContacted?: boolean;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('adventure_incidents').insert({
    adventure_id: input.adventureId,
    reported_by: userData.user?.id,
    title: input.title,
    description: input.description,
    severity: input.severity,
    location: input.location ?? null,
    actions_taken: input.actionsTaken ?? null,
    emergency_services_contacted: input.emergencyServicesContacted ?? false,
    occurred_at: new Date().toISOString(),
  });
  if (error) throw error;
}