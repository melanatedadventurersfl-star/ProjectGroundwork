import { supabase } from '../lib/supabase';

export type HostCopilotCommunityStop = {
  placeId: string;
  name: string;
  reason: string;
  ownershipTags: string[];
};

export type HostCopilotPlan = {
  title: string;
  summary: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  startsAt: string;
  endsAt: string;
  city: string;
  state: string;
  venueName: string;
  capacity: number;
  meetingInstructions: string;
  safetyNotes: string[];
  backupPlan: string;
  communityStops: HostCopilotCommunityStop[];
  confidenceNotes: string[];
};

export type HostCopilotResponse = {
  plan: HostCopilotPlan;
  source: 'ai' | 'fallback';
  model?: string;
  verifiedPlacesUsed: number;
};

export async function generateHostCopilotPlan(input: { prompt: string; city?: string; state?: string }): Promise<HostCopilotResponse> {
  const prompt = input.prompt.trim();
  if (prompt.length < 10) throw new Error('Tell the copilot a little more about the outing you want to host.');

  const { data, error } = await supabase.functions.invoke('host-copilot', {
    body: {
      prompt,
      city: input.city?.trim() || undefined,
      state: input.state?.trim().toUpperCase() || undefined,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.plan) throw new Error('The Host Copilot did not return a plan.');
  return data as HostCopilotResponse;
}
