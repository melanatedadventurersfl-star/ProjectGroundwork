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
    .from('local_event_discovery')
    .select('*')
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  if (!events?.length) return [];

  let myRsvps: any[] = [];
  if (userId) {
    const { data, error: rsvpError } = await supabase
      .from('local_event_rsvps')
      .select('local_event_id, status')
      .eq('profile_id', userId)
      .in('local_event_id', events.map((event: any) => event.id));
    if (rsvpError) throw rsvpError;
    myRsvps = data ?? [];
  }

  const mine = new Map(myRsvps.map((row: any) => [row.local_event_id, row.status]));
  return events.map((event: any) => ({
    ...event,
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
