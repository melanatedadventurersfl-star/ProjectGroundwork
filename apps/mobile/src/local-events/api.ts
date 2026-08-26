import { supabase } from '../lib/supabase';

const EVENT_MEDIA_BUCKET = 'event-media';

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
  host_avatar_url: string | null;
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

  const [profileResult, accessResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('event_host_level, status')
      .eq('id', userId)
      .single(),
    supabase.rpc('can_create_local_event'),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (accessResult.error) throw accessResult.error;

  const level = (profileResult.data.event_host_level ?? 'member') as EventHostAccess['level'];
  return {
    level,
    canCreate: profileResult.data.status === 'active' && accessResult.data === true,
  };
}

export async function getGroupCampfireAccess(groupId: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user.id) return false;

  const { data: group, error: groupError } = await supabase
    .from('community_groups')
    .select('kind')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (group?.kind !== 'local') return false;

  const { data, error } = await supabase.rpc('can_create_group_campfire', { target_group_id: groupId });
  if (error) throw error;
  return data === true;
}

async function attachMyRsvps(events: any[]): Promise<LocalEvent[]> {
  if (!events.length) return [];
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  let myRsvps: any[] = [];
  if (userId) {
    const { data, error } = await supabase
      .from('local_event_rsvps')
      .select('local_event_id, status')
      .eq('profile_id', userId)
      .in('local_event_id', events.map((event: any) => event.id));
    if (error) throw error;
    myRsvps = data ?? [];
  }
  const mine = new Map(myRsvps.map((row: any) => [row.local_event_id, row.status]));
  return events.map((event: any) => ({ ...event, my_rsvp: mine.get(event.id) ?? null })) as LocalEvent[];
}

export async function listLocalEvents(): Promise<LocalEvent[]> {
  const { data: events, error } = await supabase
    .from('local_event_discovery')
    .select('*')
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return attachMyRsvps(events ?? []);
}

export async function listGroupCampfires(groupId: string): Promise<LocalEvent[]> {
  const { data: group, error: groupError } = await supabase
    .from('community_groups')
    .select('kind')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (group?.kind !== 'local') return [];

  const { data: events, error } = await supabase
    .from('local_event_discovery')
    .select('*')
    .eq('status', 'published')
    .eq('group_id', groupId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return attachMyRsvps(events ?? []);
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

export async function uploadLocalEventImage(input: {
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to upload an event photo.');
  if (!input.bytes.byteLength) throw new Error('Event photo is empty.');

  const path = `${userId}/local-events/${Date.now()}.${input.extension}`;
  const payload = input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer;
  const { error } = await supabase.storage.from(EVENT_MEDIA_BUCKET).upload(path, payload, {
    contentType: input.contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
  imageUrl?: string;
  groupId?: string | null;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to create a local event.');

  if (input.groupId) {
    const canCreate = await getGroupCampfireAccess(input.groupId);
    if (!canCreate) throw new Error('Community Campfires are only available in local Communities and can only be created by Community Leaders or master accounts.');
  }

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
    image_url: input.imageUrl || null,
    capacity: input.capacity ?? null,
    is_free: true,
    status: 'published',
    group_id: input.groupId ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}