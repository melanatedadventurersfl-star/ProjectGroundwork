import { supabase } from '../lib/supabase';

export type OutingHostStatus = 'pending' | 'approved' | 'paused' | 'revoked';
export type OutingHostType = 'community' | 'organization' | 'official';

export type OutingHostRecord = {
  profile_id: string;
  status: OutingHostStatus;
  host_type: OutingHostType;
  risk_tier: 'standard' | 'enhanced';
  can_create_paid_outings: boolean;
  payout_status: 'not_started' | 'pending' | 'verified' | 'restricted';
  application_note: string | null;
  approved_at: string | null;
  terms_accepted_at: string | null;
};

export type HostOutingStatus = 'draft' | 'scheduled' | 'published' | 'sold_out' | 'cancelled' | 'completed';

export type HostOuting = {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  status: HostOutingStatus;
  starts_at: string;
  ends_at: string;
  city: string;
  state: string;
  venue_name: string | null;
  meeting_instructions: string | null;
  capacity: number | null;
  spots_remaining: number | null;
  starting_price_cents: number;
  published_at: string | null;
};

export type CreateHostOutingInput = {
  title: string;
  summary: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  startsAt: string;
  endsAt: string;
  city: string;
  state: string;
  venueName?: string;
  capacity?: number | null;
  meetingInstructions?: string;
};

export type UpdateHostOutingInput = CreateHostOutingInput;

const HOST_OUTING_SELECT = 'id,title,summary,description,category,difficulty,status,starts_at,ends_at,city,state,venue_name,meeting_instructions,capacity,spots_remaining,starting_price_cents,published_at';

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('You must be signed in.');
  return profileId;
}

function validatedSchedule(startsAtValue: string, endsAtValue: string) {
  const startsAt = new Date(startsAtValue);
  const endsAt = new Date(endsAtValue);
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) throw new Error('Use valid start and end dates.');
  if (endsAt <= startsAt) throw new Error('The outing must end after it starts.');
  return { startsAt, endsAt };
}

function validateOutingInput(input: UpdateHostOutingInput) {
  if (!input.title.trim()) throw new Error('Add an outing title.');
  if (!input.summary.trim()) throw new Error('Add a short summary.');
  if (!input.description.trim()) throw new Error('Add an outing description.');
  if (!input.city.trim() || !input.state.trim()) throw new Error('Add the city and state.');
  if (input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity < 1)) throw new Error('Capacity must be at least 1.');
  return validatedSchedule(input.startsAt, input.endsAt);
}

export async function getOutingHostAccess(): Promise<{
  approved: boolean;
  paidEnabled: boolean;
  record: OutingHostRecord | null;
}> {
  const profileId = await currentProfileId();
  const [hostResult, approvedResult, paidResult] = await Promise.all([
    supabase.from('outing_hosts').select('profile_id,status,host_type,risk_tier,can_create_paid_outings,payout_status,application_note,approved_at,terms_accepted_at').eq('profile_id', profileId).maybeSingle(),
    supabase.rpc('is_approved_outing_host', { p_profile_id: profileId }),
    supabase.rpc('can_host_paid_outings', { p_profile_id: profileId }),
  ]);

  if (hostResult.error) throw hostResult.error;
  if (approvedResult.error) throw approvedResult.error;
  if (paidResult.error) throw paidResult.error;

  return {
    approved: approvedResult.data === true,
    paidEnabled: paidResult.data === true,
    record: (hostResult.data as OutingHostRecord | null) ?? null,
  };
}

export async function applyToHost(applicationNote: string) {
  const profileId = await currentProfileId();
  const note = applicationNote.trim();
  if (note.length < 20) throw new Error('Tell us a little more about the outings you want to host.');

  const { data, error } = await supabase
    .from('outing_hosts')
    .insert({
      profile_id: profileId,
      status: 'pending',
      host_type: 'community',
      risk_tier: 'standard',
      can_create_paid_outings: false,
      payout_status: 'not_started',
      application_note: note,
      terms_accepted_at: new Date().toISOString(),
    })
    .select('profile_id,status,host_type,risk_tier,can_create_paid_outings,payout_status,application_note,approved_at,terms_accepted_at')
    .single();
  if (error) throw error;
  return data as OutingHostRecord;
}

export async function listMyHostOutings(): Promise<HostOuting[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('adventures')
    .select(HOST_OUTING_SELECT)
    .eq('created_by', profileId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HostOuting[];
}

export async function createDraftOuting(input: CreateHostOutingInput): Promise<HostOuting> {
  const profileId = await currentProfileId();
  const { startsAt, endsAt } = validateOutingInput(input);

  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'outing';
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from('adventures')
    .insert({
      slug,
      title: input.title.trim(),
      summary: input.summary.trim(),
      description: input.description.trim(),
      category: input.category.trim() || 'Social',
      difficulty: input.difficulty,
      status: 'draft',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      venue_name: input.venueName?.trim() || null,
      capacity: input.capacity ?? null,
      spots_remaining: input.capacity ?? null,
      meeting_instructions: input.meetingInstructions?.trim() || null,
      starting_price_cents: 0,
      is_featured: false,
      created_by: profileId,
    })
    .select(HOST_OUTING_SELECT)
    .single();
  if (error) throw error;
  return data as HostOuting;
}

export async function updateHostOuting(adventureId: string, input: UpdateHostOutingInput): Promise<HostOuting> {
  const { startsAt, endsAt } = validateOutingInput(input);
  const existing = (await listMyHostOutings()).find((item) => item.id === adventureId);
  if (!existing) throw new Error('Outing not found.');
  if (existing.status === 'cancelled' || existing.status === 'completed') throw new Error('Cancelled and completed outings cannot be edited.');

  const nextCapacity = input.capacity ?? null;
  const usedSpots = existing.capacity != null && existing.spots_remaining != null
    ? Math.max(existing.capacity - existing.spots_remaining, 0)
    : 0;
  if (nextCapacity != null && nextCapacity < usedSpots) throw new Error(`Capacity cannot be lower than the ${usedSpots} spots already committed.`);

  const { data, error } = await supabase
    .from('adventures')
    .update({
      title: input.title.trim(),
      summary: input.summary.trim(),
      description: input.description.trim(),
      category: input.category.trim() || 'Social',
      difficulty: input.difficulty,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      venue_name: input.venueName?.trim() || null,
      capacity: nextCapacity,
      spots_remaining: nextCapacity == null ? null : Math.max(nextCapacity - usedSpots, 0),
      meeting_instructions: input.meetingInstructions?.trim() || null,
    })
    .eq('id', adventureId)
    .select(HOST_OUTING_SELECT)
    .single();
  if (error) throw error;
  return data as HostOuting;
}

export async function publishHostOuting(adventureId: string) {
  const { data, error } = await supabase.rpc('publish_host_outing', { p_adventure_id: adventureId });
  if (error) throw error;
  return data as HostOuting;
}

export async function transitionHostOuting(adventureId: string, status: 'cancelled' | 'completed') {
  const { data, error } = await supabase.rpc('transition_host_outing', {
    p_adventure_id: adventureId,
    p_status: status,
  });
  if (error) throw error;
  return data as HostOuting;
}

export async function getHostOutingMetrics(adventureId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_cents')
    .eq('adventure_id', adventureId);
  if (error) throw error;

  const paidOrders = (data ?? []).filter((order) => order.status === 'paid');
  return {
    orders: paidOrders.length,
    grossCents: paidOrders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0),
  };
}

export async function listHostAttendees(adventureId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_cents,order_attendees(id,first_name,last_name,email,registration_answers,ticket_type_id,ticket_types(name),ticket_credentials(id,credential_code,checked_in_at))')
    .eq('adventure_id', adventureId)
    .in('status', ['paid', 'held']);
  if (error) throw error;
  return data ?? [];
}

export async function checkInCredential(credentialCode: string) {
  const code = credentialCode.trim();
  if (!code) throw new Error('Enter a ticket credential.');
  const { data, error } = await supabase.rpc('host_check_in_credential', { p_credential_code: code });
  if (error) throw error;
  return data;
}
