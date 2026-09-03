import { supabase } from '../lib/supabase';

export type EventAssistantSnapshot = {
  event: { title: string; location: string; startsAt: string; endsAt: string; status: string };
  readiness: number;
  tasks: Array<{ title: string; category: string; status: string; priority: string; dueAt: string | null; blockedBy?: string }>;
  components: string[];
  operations: Record<string, unknown>;
  analytics: Record<string, unknown>;
};

export type EventAssistantResponse = {
  message: string;
  alerts: Array<{ severity: 'info' | 'attention' | 'critical'; title: string; detail: string }>;
  recommendedActions: Array<{ label: string; reason: string; impactAreas: string[] }>;
};

export async function askEventAssistant(input: { question: string; snapshot: EventAssistantSnapshot; history?: Array<{ role: 'user' | 'assistant'; text: string }> }): Promise<EventAssistantResponse> {
  const question = input.question.trim();
  if (!question) throw new Error('Ask the Event Assistant a question.');
  const { data, error } = await supabase.functions.invoke('host-event-assistant', { body: { ...input, question } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as EventAssistantResponse;
}
