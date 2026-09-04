import { supabase } from '../lib/supabase';

export type OpportunityType = 'vendor' | 'community_event' | 'partnership' | 'sponsorship' | 'venue' | 'marketing' | 'other';
export type OpportunityStage = 'saved' | 'discovered' | 'reviewing' | 'applied' | 'approved' | 'scheduled' | 'archived';
export type OpportunityVerification = 'go_melanated_verified' | 'platform_sourced' | 'external';
export type OpportunityRelevance = 'melanated_led' | 'melanated_focused' | 'community_relevant' | null;

export type OpportunityPreview = {
  title: string; summary: string; opportunityType: OpportunityType; eventStart: string; eventEnd: string;
  venueName: string; address: string; city: string; state: string; organizer: string; organizerWebsite: string;
  contactName: string; contactEmail: string; contactPhone: string; vendorFeeText: string; applicationDeadline: string;
  applicationUrl: string; imageUrl: string; ticketUrl: string; boothDetails: string[]; requirements: string[];
  ticketDetails: string[]; sourceUrl: string; confidenceNotes: string[];
};

export type OpportunityImportResult = { preview: OpportunityPreview; sourceLabel: string; sourceUrl: string; extractionSource: 'ai' | 'fallback' };
export type DiscoveredOpportunity = {
  title: string; summary: string; startsAt: string; endsAt: string; venueName: string; address: string; city: string; state: string;
  organizer: string; sourceUrl: string; imageUrl: string; ticketUrl: string; relevanceLabel: OpportunityRelevance; relevanceBasis: string;
};
export type DiscoveryResult = { sourceId: string; sourceLabel: string; sourceRootUrl: string; events: DiscoveredOpportunity[] };

export type SavedOpportunity = {
  id: string; owner_profile_id: string; title: string; summary: string; source_id: string; source_label: string; source_url: string;
  organizer_name: string; verification_status: OpportunityVerification; relevance_label: OpportunityRelevance; relevance_basis: string;
  starts_at: string | null; ends_at: string | null; venue_name: string; address: string; city: string; state: string;
  image_url: string; ticket_url: string; application_url: string; vendor_fee_text: string; application_deadline: string | null;
  stage: OpportunityStage; tags: string[]; notes: string; follow_up_at: string | null; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
};

export async function previewOpportunityFromUrl(sourceUrl: string): Promise<OpportunityImportResult> {
  const trimmed = sourceUrl.trim();
  const normalized = trimmed.startsWith('http://') ? `https://${trimmed.slice('http://'.length)}` : trimmed;
  if (!normalized.startsWith('https://')) throw new Error('Paste a public HTTPS link.');
  const { data, error } = await supabase.functions.invoke('opportunity-import-preview', { body: { sourceUrl: normalized } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as OpportunityImportResult;
}

export async function discoverOpportunities(sourceId: string): Promise<DiscoveryResult> {
  const { data, error } = await supabase.functions.invoke('opportunity-discover', { body: { sourceId } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as DiscoveryResult;
}

async function requireProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) throw new Error('Sign in to manage opportunities.');
  return data.user.id;
}

function stageLabel(stage: OpportunityStage) {
  if (stage === 'saved') return 'Saved';
  if (stage === 'reviewing') return 'Reviewing';
  if (stage === 'applied') return 'Applied / Contacted';
  if (stage === 'approved') return 'Approved';
  if (stage === 'scheduled') return 'Scheduled';
  if (stage === 'discovered') return 'Discovered';
  return 'Archived';
}

export async function findHostOpportunityBySourceUrl(sourceUrl: string): Promise<SavedOpportunity | null> {
  const ownerId = await requireProfileId();
  const { data, error } = await supabase.from('host_opportunities').select('*').eq('owner_profile_id', ownerId).eq('source_url', sourceUrl).neq('stage', 'archived').maybeSingle();
  if (error) throw error;
  return (data as SavedOpportunity | null) ?? null;
}

export async function getHostOpportunity(id: string): Promise<SavedOpportunity> {
  const ownerId = await requireProfileId();
  const { data, error } = await supabase.from('host_opportunities').select('*').eq('id', id).eq('owner_profile_id', ownerId).single();
  if (error) throw error;
  return data as SavedOpportunity;
}

async function throwIfDuplicate(ownerId: string, sourceUrl: string) {
  const { data, error } = await supabase.from('host_opportunities').select('id,title,stage').eq('owner_profile_id', ownerId).eq('source_url', sourceUrl).maybeSingle();
  if (error) throw error;
  if (data) {
    const where = stageLabel(data.stage as OpportunityStage);
    throw new Error(`Already saved: ${data.title || 'This opportunity'} is already in ${where}. Open the ${where === 'Saved' ? 'Saved' : 'Pipeline'} tab to manage it.`);
  }
}

export async function listHostOpportunities(): Promise<SavedOpportunity[]> {
  const ownerId = await requireProfileId();
  const { data, error } = await supabase.from('host_opportunities').select('*').eq('owner_profile_id', ownerId).neq('stage', 'archived').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedOpportunity[];
}

export async function saveDiscoveredOpportunity(event: DiscoveredOpportunity, sourceId: string, sourceLabel: string, tags: string[] = []): Promise<SavedOpportunity> {
  const ownerId = await requireProfileId();
  await throwIfDuplicate(ownerId, event.sourceUrl);
  const payload = { owner_profile_id: ownerId, title: event.title, summary: event.summary || '', source_id: sourceId, source_label: sourceLabel,
    source_url: event.sourceUrl, organizer_name: event.organizer || '', verification_status: 'platform_sourced' as OpportunityVerification,
    relevance_label: event.relevanceLabel, relevance_basis: event.relevanceBasis || '', starts_at: event.startsAt || null, ends_at: event.endsAt || null,
    venue_name: event.venueName || '', address: event.address || '', city: event.city || '', state: event.state || '', image_url: event.imageUrl || '',
    ticket_url: event.ticketUrl || '', stage: 'saved' as OpportunityStage, tags, metadata: {}, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('host_opportunities').insert(payload).select('*').single();
  if (error) throw error;
  return data as SavedOpportunity;
}

function importedPayload(preview: OpportunityPreview, sourceLabel: string) {
  const sourceId = preview.sourceUrl.includes('eventbrite.') ? 'eventbrite' : 'external';
  return { title: preview.title, summary: preview.summary || '', source_id: sourceId,
    source_label: sourceId === 'eventbrite' ? 'Eventbrite' : sourceLabel || 'External source', source_url: preview.sourceUrl,
    organizer_name: preview.organizer || '', verification_status: sourceId === 'eventbrite' ? 'platform_sourced' : 'external', starts_at: preview.eventStart || null,
    ends_at: preview.eventEnd || null, venue_name: preview.venueName || '', address: preview.address || '', city: preview.city || '', state: preview.state || '',
    image_url: preview.imageUrl || '', ticket_url: preview.ticketUrl || preview.applicationUrl || preview.sourceUrl, application_url: preview.applicationUrl || '',
    vendor_fee_text: preview.vendorFeeText || '', application_deadline: preview.applicationDeadline || null,
    metadata: { contactName: preview.contactName, contactEmail: preview.contactEmail, contactPhone: preview.contactPhone, boothDetails: preview.boothDetails,
      requirements: preview.requirements, ticketDetails: preview.ticketDetails, organizerWebsite: preview.organizerWebsite, opportunityType: preview.opportunityType,
      confidenceNotes: preview.confidenceNotes }, updated_at: new Date().toISOString() };
}

export async function saveImportedOpportunity(preview: OpportunityPreview, sourceLabel: string, tags: string[] = []): Promise<SavedOpportunity> {
  const ownerId = await requireProfileId();
  await throwIfDuplicate(ownerId, preview.sourceUrl);
  const payload = { owner_profile_id: ownerId, ...importedPayload(preview, sourceLabel), stage: 'saved' as OpportunityStage, tags };
  const { data, error } = await supabase.from('host_opportunities').insert(payload).select('*').single();
  if (error) throw error;
  return data as SavedOpportunity;
}

export async function refreshImportedOpportunity(id: string, preview: OpportunityPreview, sourceLabel: string): Promise<SavedOpportunity> {
  const ownerId = await requireProfileId();
  const { data, error } = await supabase.from('host_opportunities').update(importedPayload(preview, sourceLabel)).eq('id', id).eq('owner_profile_id', ownerId).select('*').single();
  if (error) throw error;
  return data as SavedOpportunity;
}

export async function setOpportunityStage(id: string, stage: OpportunityStage) {
  const ownerId = await requireProfileId();
  const { error } = await supabase.from('host_opportunities').update({ stage, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_profile_id', ownerId);
  if (error) throw error;
}

export async function updateOpportunityTags(id: string, tags: string[]) {
  const ownerId = await requireProfileId();
  const normalized = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 20);
  const { data, error } = await supabase.from('host_opportunities').update({ tags: normalized, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_profile_id', ownerId).select('*').single();
  if (error) throw error;
  return data as SavedOpportunity;
}

export async function updateOpportunityWorkspace(id: string, values: { notes?: string; followUpAt?: string | null; stage?: OpportunityStage }) {
  const ownerId = await requireProfileId();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (values.notes !== undefined) payload.notes = values.notes.trim();
  if (values.followUpAt !== undefined) payload.follow_up_at = values.followUpAt || null;
  if (values.stage !== undefined) payload.stage = values.stage;
  const { data, error } = await supabase.from('host_opportunities').update(payload).eq('id', id).eq('owner_profile_id', ownerId).select('*').single();
  if (error) throw error;
  return data as SavedOpportunity;
}

export async function archiveOpportunity(id: string) {
  return updateOpportunityWorkspace(id, { stage: 'archived' });
}
