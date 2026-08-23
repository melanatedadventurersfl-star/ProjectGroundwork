import { supabase } from '../lib/supabase';

export type ReportTarget =
  | { kind: 'post'; id: string; authorId?: string }
  | { kind: 'comment'; id: string; authorId?: string };

export type ReportSubmission = {
  id: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created: boolean;
};

export const COMMUNITY_REPORT_REASONS = [
  'Harassment or bullying',
  'Hate or discrimination',
  'Threats or violence',
  'Sexual or inappropriate content',
  'Spam or scam',
  'Dangerous or harmful behavior',
  'False or misleading information',
  'Other',
] as const;

export async function reportCommunityContent(target: ReportTarget, reason: string, details?: string): Promise<ReportSubmission> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user.id) throw new Error('You must be signed in to report content.');

  const { data, error } = await supabase.rpc('submit_community_report', {
    p_target_kind: target.kind,
    p_target_id: target.id,
    p_reason: reason,
    p_details: details?.trim() || null,
  });

  if (error) throw new Error(error.message || 'We could not submit your report. Please try again.');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.report_id) throw new Error('We could not confirm your report. Please try again.');

  return {
    id: row.report_id,
    status: row.report_status,
    created: row.created !== false,
  };
}

export async function hideCommunityContent(target: ReportTarget) {
  const { error } = await supabase.rpc('hide_community_content', {
    p_target_kind: target.kind,
    p_target_id: target.id,
  });
  if (error) throw new Error(error.message || 'Unable to hide this content.');
}

export async function blockCommunityMember(memberId: string) {
  const { error } = await supabase.rpc('block_community_member', { p_blocked_id: memberId });
  if (error) throw new Error(error.message || 'Unable to block this member.');
}
