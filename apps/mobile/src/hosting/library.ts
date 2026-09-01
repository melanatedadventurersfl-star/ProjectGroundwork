import { supabase } from '../lib/supabase';

export type HostLibraryScope = 'system' | 'organization' | 'personal';
export type HostLibraryCategory =
  | 'template'
  | 'meal_plan'
  | 'gear_list'
  | 'guest_message'
  | 'policy'
  | 'vendor'
  | 'marketing_sequence'
  | 'ticket_structure';

export type HostLibraryItem = {
  id: string;
  itemKey: string;
  scope: HostLibraryScope;
  category: HostLibraryCategory;
  title: string;
  summary: string;
  content: Record<string, unknown>;
  ownerProfileId: string | null;
  sourceEventId: string | null;
  isActive: boolean;
};

type LibraryRow = {
  id: string;
  item_key: string;
  scope: HostLibraryScope;
  category: HostLibraryCategory;
  title: string;
  summary: string;
  content: Record<string, unknown> | null;
  owner_profile_id: string | null;
  source_event_id: string | null;
  is_active: boolean;
};

const librarySelect = 'id,item_key,scope,category,title,summary,content,owner_profile_id,source_event_id,is_active';

function mapLibraryItem(row: LibraryRow): HostLibraryItem {
  return {
    id: row.id,
    itemKey: row.item_key,
    scope: row.scope,
    category: row.category,
    title: row.title,
    summary: row.summary,
    content: row.content ?? {},
    ownerProfileId: row.owner_profile_id,
    sourceEventId: row.source_event_id,
    isActive: row.is_active,
  };
}

export async function listHostLibraryItems(category?: HostLibraryCategory): Promise<HostLibraryItem[]> {
  let query = supabase
    .from('host_library_items')
    .select(librarySelect)
    .eq('is_active', true)
    .order('scope', { ascending: true })
    .order('title', { ascending: true });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as LibraryRow[]).map(mapLibraryItem);
}

export async function createPersonalLibraryItem(input: {
  category: HostLibraryCategory;
  title: string;
  summary: string;
  content?: Record<string, unknown>;
  sourceEventId?: string | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error('Add a title for this library item.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = authData.user?.id;
  if (!profileId) throw new Error('Sign in to save reusable items.');

  const itemKey = `personal-${input.category}-${profileId}-${Date.now()}`;
  const { error } = await supabase.from('host_library_items').insert({
    item_key: itemKey,
    scope: 'personal',
    category: input.category,
    title,
    summary: input.summary.trim(),
    content: input.content ?? {},
    owner_profile_id: profileId,
    source_event_id: input.sourceEventId ?? null,
  });
  if (error) throw error;
}

export async function archiveHostLibraryItem(itemId: string) {
  const { error } = await supabase
    .from('host_library_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}
