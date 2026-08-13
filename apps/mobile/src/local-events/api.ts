import { supabase } from '../lib/supabase';

export type LocalEvent = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string | null;
  city: string;
  state: string;
  venue_name: string | null;
  meeting_details: string | null;
  image_url: string | null;
  capacity: number | null;
  is_free: boolean;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  group_id: string | null;
  host_name: string;
  rsvp_count: number;
  my_rsvp: 'going' | 'interested' | 'cancelled' | null;
};

export type EventHostAccess = {
  canCreate: boolean;
  level: 'member' | 'trusted_host' | 'community_lead' | 'staff';
};

export async function getEventHostAccess(): Promise<EventHostAccess> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { canCreate: false, level: 'member' };

  const { data, error } = await supabase
    .from('profiles')
    .select('event_host_level, status')
    .eq('id', userId)
    .single();
  if (error) throw error;

  const level = (data.event_host_level ?? 'member') as EventHostAccess['level'];
  return {
    level,
    canCreate: data.status === 'active' && ['trusted_host', 'community_lead', 'staff'].includes(level),
  };
}

export async function listLocalEvents(): Promise<LocalEvent[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  const { data: events, error } = await supabase
    .from('local_events')
    .select('id, host_id, title, description, category, starts_at, ends_at, city, state, venue_name, meeting_details, image_url, capacity, is_free, status, group_id')
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  if (!events?.length) return [];

  const hostIds = [...new Set(events.map((event) => event.host_id as string))];
  const eventIds = events.map((event) => event.id as string);
  const [{ data: hosts, error: hostError }, { data: rsvps, error: rsvpError }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, first_name').in('id', hostIds),
    supabase.from('local_event_rsvps').select('local_event_id, profile_id, status').in('local_event_id', eventIds).neq('status', 'cancelled'),
  ]);
  if (hostError) throw hostError;
  if (rsvpError) throw rsvpError;

  const hostNames = new Map((hosts ?? []).map((host: any) => [host.id, host.display_name ?? host.first_name ?? 'Member host']));
  const counts = new Map<string, number>();
  const mine = new Map<string, LocalEvent['my_rsvp']>();
  for (const row of rsvps ?? []) {
    const eventId = (row as any).local_event_id as string;
    counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
    if (userId && (row as any).profile_id === userId) mine.set(eventId, (row as any).status as LocalEvent['my_rsvp']);
  }

  return events.map((event: any) => ({
    ...event,
    host_name: hostNames.get(event.host_id) ?? 'Member host',
    rsvp_count: counts.get(event.id) ?? 0,
    my_rsvp: mine.get(event.id) ?? null,
  })) as LocalEvent[];
}

export async function getLocalEvent(id: string): Promise<LocalEvent> {
  const events = await listLocalEvents();
  const event = events.find((item) => item.id === id);
  if (!event) throw new Error('Local event not found.');
  return event;
}

export async function setLocalEventRsvp(localEventId: string, status: 'going' | 'interested' | 'cancelled') {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to RSVP.');
  const { error } = await supabase.from('local_event_rsvps').upsert(
    { local_event_id: localEventId, profile_id: userId, status, updated_at: new Date().toISOString() },
    { onConflict: 'local_event_id,profile_id' },
  );
  if (error) throw error;
}

export async function createLocalEvent(input: {
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt?: string;
  city: string;
  state: string;
  venueName?: string;
  capacity?: number;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to create a local event.');

  const { data, error } = await supabase.from('local_events').insert({
    host_id: userId,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    starts_at: input.startsAt,
    ends_at: input.endsAt || null,
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    venue_name: input.venueName?.trim() || null,
    capacity: input.capacity ?? null,
    is_free: true,
    status: 'published',
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
