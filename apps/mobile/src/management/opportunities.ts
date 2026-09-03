import { supabase } from '../lib/supabase';

export type OpportunityType = 'vendor' | 'community_event' | 'partnership' | 'sponsorship' | 'venue' | 'marketing' | 'other';

export type OpportunityPreview = {
  title: string;
  summary: string;
  opportunityType: OpportunityType;
  eventStart: string;
  eventEnd: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  organizer: string;
  organizerWebsite: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  vendorFeeText: string;
  applicationDeadline: string;
  applicationUrl: string;
  boothDetails: string[];
  requirements: string[];
  ticketDetails: string[];
  sourceUrl: string;
  confidenceNotes: string[];
};

export type OpportunityImportResult = {
  preview: OpportunityPreview;
  sourceLabel: string;
  sourceUrl: string;
  extractionSource: 'ai' | 'fallback';
};

export async function previewOpportunityFromUrl(sourceUrl: string): Promise<OpportunityImportResult> {
  const trimmed = sourceUrl.trim();
  const normalized = trimmed.startsWith('http://') ? `https://${trimmed.slice('http://'.length)}` : trimmed;
  if (!normalized.startsWith('https://')) throw new Error('Paste a public HTTPS link.');

  const { data, error } = await supabase.functions.invoke('opportunity-import-preview', {
    body: { sourceUrl: normalized },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as OpportunityImportResult;
}
