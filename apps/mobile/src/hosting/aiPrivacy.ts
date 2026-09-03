import { supabase } from '../lib/supabase';
import type { AiPrivacyPreferences } from './aiPlanner';

export const AI_PRIVACY_DEFAULTS: AiPrivacyPreferences = {
  personal_memory_enabled: false,
  event_history_learning_enabled: false,
  organization_memory_enabled: false,
  save_conversations_enabled: false,
  product_analytics_enabled: false,
  recommendation_history_enabled: false,
};

export async function saveAiPrivacyPreferences(preferences: AiPrivacyPreferences) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to update AI privacy settings.');
  const { error } = await supabase.from('host_ai_preferences').upsert({
    profile_id: profileId,
    ...preferences,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' });
  if (error) throw error;
}

export async function clearAiMemories() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to clear AI memory.');
  const { error } = await supabase.from('host_ai_memories').update({ active: false, updated_at: new Date().toISOString() }).eq('profile_id', profileId).eq('active', true);
  if (error) throw error;
}
