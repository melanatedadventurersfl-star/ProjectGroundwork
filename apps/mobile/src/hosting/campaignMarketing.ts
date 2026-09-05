import { supabase } from '../lib/supabase';

export type CampaignMarketingStatus = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published' | 'skipped';
export type CampaignMarketingPlatform = 'go_melanated' | 'facebook' | 'instagram' | 'meetup' | 'eventbrite' | 'email' | 'sms' | 'other';
export type CampaignMarketingContentType = 'post' | 'static_post' | 'carousel' | 'reel' | 'story' | 'email' | 'other';

export type CampaignMarketingItem = {
  id: string;
  campaignId: string;
  itemKey: string;
  title: string;
  contentType: CampaignMarketingContentType;
  platforms: CampaignMarketingPlatform[];
  plannedFor: string;
  scheduledAt: string | null;
  status: CampaignMarketingStatus;
  copyText: string | null;
  assetUrl: string | null;
  notes: string | null;
  ownerProfileId: string | null;
  sourceTaskId: string | null;
  publishedAt: string | null;
};

type MarketingRow = {
  id: string;
  campaign_id: string;
  item_key: string;
  title: string;
  content_type: CampaignMarketingContentType;
  platforms: CampaignMarketingPlatform[];
  planned_for: string;
  scheduled_at: string | null;
  status: CampaignMarketingStatus;
  copy_text: string | null;
  asset_url: string | null;
  notes: string | null;
  owner_profile_id: string | null;
  source_task_id: string | null;
  published_at: string | null;
};

const marketingSelect = 'id,campaign_id,item_key,title,content_type,platforms,planned_for,scheduled_at,status,copy_text,asset_url,notes,owner_profile_id,source_task_id,published_at';

function mapMarketingItem(row: MarketingRow): CampaignMarketingItem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    itemKey: row.item_key,
    title: row.title,
    contentType: row.content_type,
    platforms: row.platforms ?? [],
    plannedFor: row.planned_for,
    scheduledAt: row.scheduled_at,
    status: row.status,
    copyText: row.copy_text,
    assetUrl: row.asset_url,
    notes: row.notes,
    ownerProfileId: row.owner_profile_id,
    sourceTaskId: row.source_task_id,
    publishedAt: row.published_at,
  };
}

export async function listCampaignMarketingItems(campaignId: string): Promise<CampaignMarketingItem[]> {
  const { data, error } = await supabase
    .from('host_campaign_marketing_items')
    .select(marketingSelect)
    .eq('campaign_id', campaignId)
    .order('planned_for', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MarketingRow[]).map(mapMarketingItem);
}

export async function createCampaignMarketingItem(input: {
  campaignId: string;
  title: string;
  plannedFor: string;
  platforms?: CampaignMarketingPlatform[];
  contentType?: CampaignMarketingContentType;
  copyText?: string | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error('Add a title for the marketing item.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.plannedFor)) throw new Error('Use a date in YYYY-MM-DD format.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = authData.user?.id ?? null;
  const itemKey = `manual-${input.plannedFor}-${Date.now()}`;

  const { error } = await supabase.from('host_campaign_marketing_items').insert({
    campaign_id: input.campaignId,
    item_key: itemKey,
    title,
    planned_for: input.plannedFor,
    platforms: input.platforms?.length ? input.platforms : ['go_melanated'],
    content_type: input.contentType ?? 'post',
    copy_text: input.copyText?.trim() || null,
    status: 'idea',
    owner_profile_id: profileId,
    created_by: profileId,
    updated_by: profileId,
  });
  if (error) throw error;
}

export async function updateCampaignMarketingStatus(itemId: string, status: CampaignMarketingStatus) {
  const { data: authData } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = {
    status,
    updated_by: authData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  if (status === 'published') patch.published_at = new Date().toISOString();
  if (status !== 'published') patch.published_at = null;

  const { error } = await supabase.from('host_campaign_marketing_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

export async function updateCampaignMarketingDraft(itemId: string, values: {
  copyText?: string | null;
  notes?: string | null;
  platforms?: CampaignMarketingPlatform[];
}) {
  const { data: authData } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = {
    updated_by: authData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  if (values.copyText !== undefined) patch.copy_text = values.copyText;
  if (values.notes !== undefined) patch.notes = values.notes;
  if (values.platforms !== undefined) patch.platforms = values.platforms;

  const { error } = await supabase.from('host_campaign_marketing_items').update(patch).eq('id', itemId);
  if (error) throw error;
}
