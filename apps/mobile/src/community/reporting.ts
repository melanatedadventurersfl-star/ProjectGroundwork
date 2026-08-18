import { supabase } from '../lib/supabase';

export type ReportTarget =
  | { kind: 'post'; id: string }
  | { kind: 'comment'; id: string };

export const COMMUNITY_REPORT_REASONS = [
  'Harassment or bullying',
  'Hate or discrimination',
  'Sexual or inappropriate content',
  'Spam or scam',
  'Dangerous or harmful behavior',
  'False or misleading information',
  'Other',
] as const;

export async function reportCommunityContent(target: ReportTarget, reason: string, details?: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to report content.');

  const payload = {
    reporter_id: userId,
    post_id: target.kind === 'post' ? target.id : null,
    comment_id: target.kind === 'comment' ? target.id : null,
    reason,
    details: details?.trim() || null,
  };

  const { error } = await supabase.from('community_reports').insert(payload);
  if (error) throw error;
}
