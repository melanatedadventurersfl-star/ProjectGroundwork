import { supabase } from '../lib/supabase';

export async function awardTutorialCompletionStamp() {
  const { error } = await supabase.rpc('award_tutorial_completion_stamp');
  if (error) throw error;
}
