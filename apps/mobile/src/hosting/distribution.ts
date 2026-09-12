import { supabase } from '../lib/supabase';
import type { HostOutingStatus } from './api';

export type DistributionProviderId = 'go_melanated' | 'facebook' | 'instagram' | 'eventbrite' | 'email' | 'sms' | 'other';

export type DistributionCapability =
  | 'publish_event'
  | 'publish_post'
  | 'rsvp'
  | 'tickets'
  | 'waitlist'
  | 'analytics'
  | 'member_feed'
  | 'messages';

export type DistributionProviderDefinition = {
  id: DistributionProviderId;
  label: string;
  description: string;
  native: boolean;
  capabilities: DistributionCapability[];
};

export const DISTRIBUTION_PROVIDERS: DistributionProviderDefinition[] = [
  {
    id: 'go_melanated',
    label: 'Go Melanated',
    description: 'Native event listing, member feed, RSVP, tickets, waitlist and first-party analytics.',
    native: true,
    capabilities: ['publish_event', 'publish_post', 'rsvp', 'tickets', 'waitlist', 'analytics', 'member_feed'],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    description: 'External event and promotion publishing when a Meta connection is available.',
    native: false,
    capabilities: ['publish_post', 'analytics'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    description: 'External feed, reel and story publishing when a Meta connection is available.',
    native: false,
    capabilities: ['publish_post', 'analytics'],
  },
  {
    id: 'eventbrite',
    label: 'Eventbrite',
    description: 'External event listing, ticketing and order sync when Eventbrite is connected.',
    native: false,
    capabilities: ['publish_event', 'tickets', 'analytics'],
  },
  {
    id: 'email',
    label: 'Email',
    description: 'Campaign email delivery and performance through a connected email provider.',
    native: false,
    capabilities: ['publish_post', 'messages', 'analytics'],
  },
  {
    id: 'sms',
    label: 'SMS',
    description: 'Member and attendee messages through a connected SMS provider.',
    native: false,
    capabilities: ['messages', 'analytics'],
  },
];

export type EventDistributionConnection = {
  id: string;
  provider: DistributionProviderId;
  displayName: string | null;
  status: 'connected' | 'attention' | 'disconnected';
  externalEventId: string | null;
  lastSyncedAt: string | null;
  capabilities: Record<string, unknown>;
};

export type EventDistributionState = {
  adventureStatus: HostOutingStatus;
  connections: EventDistributionConnection[];
};

export type CampaignPublicationResult = {
  campaignStatus: 'planning' | 'live' | 'complete';
  adventureStatus: HostOutingStatus;
  publishedAt: string | null;
  connectionId: string;
};

export type HostDistributionProviderSummary = DistributionProviderDefinition & {
  connectionCount: number;
  eventCount: number;
  status: 'native' | 'connected' | 'attention' | 'not_connected';
  lastSyncedAt: string | null;
};

type ConnectionRow = {
  id: string;
  campaign_id: string;
  provider: DistributionProviderId;
  external_event_id: string | null;
  display_name: string | null;
  status: 'connected' | 'attention' | 'disconnected';
  last_synced_at: string | null;
  capabilities: Record<string, unknown> | null;
};

type PublicationRow = {
  campaign_status: CampaignPublicationResult['campaignStatus'];
  adventure_status: HostOutingStatus;
  published_at: string | null;
  connection_id: string;
};

export async function getEventDistributionState(campaignId: string, adventureId: string): Promise<EventDistributionState> {
  const [connectionResult, adventureResult] = await Promise.all([
    supabase
      .from('host_event_connections')
      .select('id,campaign_id,provider,external_event_id,display_name,status,last_synced_at,capabilities')
      .eq('campaign_id', campaignId)
      .order('provider'),
    supabase.from('adventures').select('status').eq('id', adventureId).single(),
  ]);
  if (connectionResult.error) throw connectionResult.error;
  if (adventureResult.error) throw adventureResult.error;

  const rows = (connectionResult.data ?? []) as ConnectionRow[];
  return {
    adventureStatus: adventureResult.data.status as HostOutingStatus,
    connections: rows.map(mapConnection),
  };
}

export async function listHostDistributionProviders(): Promise<HostDistributionProviderSummary[]> {
  const { data, error } = await supabase
    .from('host_event_connections')
    .select('id,campaign_id,provider,external_event_id,display_name,status,last_synced_at,capabilities');
  if (error) throw error;

  const rows = (data ?? []) as ConnectionRow[];
  return DISTRIBUTION_PROVIDERS.map((provider) => {
    const providerRows = rows.filter((row) => row.provider === provider.id);
    const eventCount = new Set(providerRows.map((row) => row.campaign_id)).size;
    const attention = providerRows.some((row) => row.status === 'attention');
    const connected = providerRows.some((row) => row.status === 'connected');
    const lastSyncedAt = providerRows
      .map((row) => row.last_synced_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    return {
      ...provider,
      connectionCount: providerRows.length,
      eventCount,
      status: provider.native ? 'native' : attention ? 'attention' : connected ? 'connected' : 'not_connected',
      lastSyncedAt,
    };
  });
}

export function connectionForProvider(state: EventDistributionState, provider: DistributionProviderId) {
  return state.connections.find((connection) => connection.provider === provider) ?? null;
}

export function isProviderConnected(state: EventDistributionState, provider: DistributionProviderId) {
  const connection = connectionForProvider(state, provider);
  return Boolean(connection && connection.status === 'connected');
}

export function isGoMelanatedPublished(state: EventDistributionState | null | undefined) {
  return Boolean(state && ['published', 'sold_out'].includes(state.adventureStatus));
}

export function hasPublicationDrift(campaignStatus: 'planning' | 'live' | 'complete', state: EventDistributionState | null | undefined) {
  if (!state || campaignStatus === 'complete') return false;
  return campaignStatus === 'live' !== isGoMelanatedPublished(state);
}

export async function publishHostCampaign(campaignId: string): Promise<CampaignPublicationResult> {
  const { data, error } = await supabase.rpc('publish_host_campaign', { p_campaign_id: campaignId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as PublicationRow | null;
  if (!row?.connection_id) throw new Error('Go Melanated did not return a completed publication.');
  return {
    campaignStatus: row.campaign_status,
    adventureStatus: row.adventure_status,
    publishedAt: row.published_at,
    connectionId: row.connection_id,
  };
}

// Compatibility entry point for existing Host Center surfaces that start from an adventure ID.
// The coordinated publisher still resolves and publishes the Host Center campaign as one operation.
export async function publishEventToGoMelanated(adventureId: string): Promise<CampaignPublicationResult> {
  const { data, error } = await supabase
    .from('host_campaigns')
    .select('id')
    .eq('adventure_id', adventureId)
    .neq('status', 'complete')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Open this event in Host Center before publishing it to Go Melanated.');
  return publishHostCampaign(String(data.id));
}

export async function publishMarketingItemToGoMelanated(itemId: string): Promise<{ postId: string; promotionId: string }> {
  const { data, error } = await supabase.rpc('publish_host_marketing_to_go_melanated', { p_item_id: itemId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.post_id || !row?.promotion_id) throw new Error('Go Melanated did not return a published post.');
  return { postId: String(row.post_id), promotionId: String(row.promotion_id) };
}

function mapConnection(row: ConnectionRow): EventDistributionConnection {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    status: row.status,
    externalEventId: row.external_event_id,
    lastSyncedAt: row.last_synced_at,
    capabilities: row.capabilities ?? {},
  };
}
