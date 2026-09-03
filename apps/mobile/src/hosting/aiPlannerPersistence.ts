import { supabase } from '../lib/supabase';
import { getAiPrivacyPreferences, type AiPlanState, type AiPlannerTurn } from './aiPlanner';

type PlannerMessage = { role: 'user' | 'assistant'; text: string };

export async function persistAiPlannerTurn(input: {
  sessionId: string | null;
  plan: AiPlanState;
  turn: AiPlannerTurn;
  history: PlannerMessage[];
}): Promise<string | null> {
  const preferences = await getAiPrivacyPreferences();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) return input.sessionId;

  let sessionId = input.sessionId;
  if (preferences.save_conversations_enabled) {
    const payload = {
      profile_id: profileId,
      status: 'planning',
      event_type: input.plan.category || null,
      readiness: input.turn.readiness,
      plan: input.plan,
      required_gaps: input.turn.gaps,
      recommended_components: input.plan.components ?? [],
      task_packs: input.turn.taskPacks,
      conversation: input.history,
      updated_at: new Date().toISOString(),
    };
    if (sessionId) {
      const { error } = await supabase.from('host_ai_planner_sessions').update(payload).eq('id', sessionId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('host_ai_planner_sessions').insert(payload).select('id').single();
      if (error) throw error;
      sessionId = data.id;
    }
  }

  if (preferences.product_analytics_enabled) {
    const { error } = await supabase.from('host_ai_product_events').insert({
      profile_id: profileId,
      planner_session_id: sessionId,
      event_name: 'planner_turn',
      event_type: input.plan.category || null,
      intent_type: input.turn.taskPacks[0] || null,
      question_category: input.turn.gaps[0] || null,
      recommendation_type: input.turn.recommendation?.label || null,
      readiness_after: input.turn.readiness,
      metadata: {
        stage: input.turn.stage,
        gap_count: input.turn.gaps.length,
        component_count: input.plan.components?.length ?? 0,
      },
    });
    if (error) throw error;
  }

  return sessionId;
}

export async function linkAiPlannerSessionToEvent(sessionId: string | null, adventureId: string) {
  if (!sessionId) return;
  const { error } = await supabase.from('host_ai_planner_sessions').update({ adventure_id: adventureId, status: 'created', updated_at: new Date().toISOString() }).eq('id', sessionId);
  if (error) throw error;
}
