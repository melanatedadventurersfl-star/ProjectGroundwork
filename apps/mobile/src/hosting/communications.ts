import { supabase } from '../lib/supabase';

export type HostMessageAudience = 'registered' | 'checked_in' | 'waitlist';

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('You must be signed in.');
  return profileId;
}

export async function listHostWaitlist(adventureId: string) {
  const { data, error } = await supabase
    .from('adventure_waitlist')
    .select('id,profile_id,status,position,offered_at,claim_expires_at,created_at,profiles(display_name,username,avatar_url)')
    .eq('adventure_id', adventureId)
    .in('status', ['waiting', 'offered'])
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function joinAdventureWaitlist(adventureId: string) {
  const { data, error } = await supabase.rpc('join_adventure_waitlist', { p_adventure_id: adventureId });
  if (error) throw error;
  return data;
}

export async function updateWaitlistStatus(waitlistId: string, status: 'offered' | 'expired' | 'removed') {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'offered') {
    const offeredAt = new Date();
    const expiresAt = new Date(offeredAt.getTime() + 24 * 60 * 60 * 1000);
    patch.offered_at = offeredAt.toISOString();
    patch.claim_expires_at = expiresAt.toISOString();
  }
  const { data, error } = await supabase
    .from('adventure_waitlist')
    .update(patch)
    .eq('id', waitlistId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listHostMessages(adventureId: string) {
  const { data, error } = await supabase
    .from('host_outing_messages')
    .select('id,audience,subject,body,sent_at')
    .eq('adventure_id', adventureId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createHostMessage(input: {
  adventureId: string;
  audience: HostMessageAudience;
  subject: string;
  body: string;
}) {
  const hostId = await currentProfileId();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error('Add a subject.');
  if (body.length < 3) throw new Error('Add a message.');

  const { data, error } = await supabase
    .from('host_outing_messages')
    .insert({
      adventure_id: input.adventureId,
      host_id: hostId,
      audience: input.audience,
      subject,
      body,
    })
    .select('id,audience,subject,body,sent_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listRegistrationQuestions(adventureId: string) {
  const { data, error } = await supabase
    .from('adventure_registration_questions')
    .select('id,label,help_text,question_type,required,options,sort_order,is_active')
    .eq('adventure_id', adventureId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addRegistrationQuestion(input: {
  adventureId: string;
  label: string;
  helpText?: string;
  required?: boolean;
}) {
  const label = input.label.trim();
  if (!label) throw new Error('Add a question.');
  const existing = await listRegistrationQuestions(input.adventureId);
  const { data, error } = await supabase
    .from('adventure_registration_questions')
    .insert({
      adventure_id: input.adventureId,
      label,
      help_text: input.helpText?.trim() || null,
      question_type: 'text',
      required: input.required === true,
      sort_order: existing.length,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setRegistrationQuestionActive(questionId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('adventure_registration_questions')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', questionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
