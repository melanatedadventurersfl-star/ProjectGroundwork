import type { AiPlanState } from './aiPlanner';
import type { AiPlannerV2Action } from './aiPlannerV2';
import {
  compactSectionOrder,
  getWorkspaceProgress,
  isPlanningDraftReady,
  reviewPlannerV3State,
  runAiPlannerV3Turn,
  stageLabel,
  type AiPlannerV3Turn as BaseAiPlannerV3Turn,
  type V3PlanState,
} from './aiPlannerV3';
import {
  applyPlannerBrainResponse,
  requestPlannerBrain,
  type PlannerBrainResponse,
} from './aiPlannerBrain';
import type { AiPlannerSection, AiPlannerTenantContext } from './aiPlannerTenant';
import type { VenueCandidate } from './venueDiscovery';

export { compactSectionOrder, getWorkspaceProgress, isPlanningDraftReady, reviewPlannerV3State, stageLabel };
export type { V3PlanState };

export type PlannerTurnDebug = {
  engine: 'ai' | 'deterministic' | 'fallback' | 'tool';
  model?: string;
  latencyMs?: number;
  action?: string;
  reason?: string;
};

export type AiPlannerV3Turn = BaseAiPlannerV3Turn & {
  debug?: PlannerTurnDebug;
};

type PlannerHistory = { role: 'user' | 'assistant'; text: string }[];

type V31Input = {
  message: string;
  plan: AiPlanState;
  history: PlannerHistory;
  tenant: AiPlannerTenantContext;
  section?: AiPlannerSection | null;
  action?: AiPlannerV2Action;
  venueCandidate?: VenueCandidate | null;
};

function withDebug(turn: BaseAiPlannerV3Turn, debug: PlannerTurnDebug): AiPlannerV3Turn {
  return { ...turn, debug };
}

function fallbackTurn(input: V31Input, response?: PlannerBrainResponse | null): AiPlannerV3Turn {
  const reviewed = reviewPlannerV3State(input.plan, input.tenant);
  const message = response?.message
    || 'The AI planner did not answer this turn. I kept your event plan unchanged instead of guessing. Try that message again.';
  return {
    ...reviewed,
    message,
    options: ['Try again', 'Review plan'],
    activeSection: input.section ?? reviewed.activeSection ?? null,
    changedFields: [],
    systemMessages: [],
    conflictMessage: null,
    debug: {
      engine: 'fallback',
      model: response?.model,
      latencyMs: response?.latencyMs,
      action: response?.action,
      reason: 'AI response unavailable or explicitly returned fallback',
    },
  };
}

function explicitControl(input: V31Input) {
  return input.action === 'section'
    || input.action === 'venue_select'
    || input.action === 'venue_search_more'
    || (input.action === 'recommend' && input.section === 'venue')
    || input.action === 'review'
    || input.action === 'create';
}

async function runDeterministic(input: V31Input): Promise<AiPlannerV3Turn> {
  const turn = await runAiPlannerV3Turn(input);
  return withDebug(turn, {
    engine: input.action === 'venue_select' || input.action === 'venue_search_more' || (input.action === 'recommend' && input.section === 'venue') ? 'tool' : 'deterministic',
    action: input.action ?? 'control',
  });
}

function aiTurn(input: V31Input, response: PlannerBrainResponse): AiPlannerV3Turn {
  const applied = applyPlannerBrainResponse(input.plan as V3PlanState, response);
  const reviewed = reviewPlannerV3State(applied.plan, input.tenant);
  const options = response.options.map((value) => value.trim()).filter(Boolean).slice(0, 6);
  return {
    ...reviewed,
    plan: applied.plan,
    message: response.message,
    options,
    recommendation: response.recommendation ?? reviewed.recommendation ?? null,
    activeSection: response.activeSection ?? input.section ?? reviewed.activeSection ?? null,
    changedFields: applied.changedFields,
    systemMessages: applied.changedFields.length ? [`Updated: ${applied.changedFields.join(' · ')}`] : [],
    conflictMessage: null,
    debug: {
      engine: 'ai',
      model: response.model,
      latencyMs: response.latencyMs,
      action: response.action,
    },
  };
}

async function toolTurn(input: V31Input, response: PlannerBrainResponse): Promise<AiPlannerV3Turn> {
  const applied = applyPlannerBrainResponse(input.plan as V3PlanState, response);
  const refinement = response.venueRefinement.trim() || input.message.trim();
  const turn = await runAiPlannerV3Turn({
    ...input,
    message: refinement,
    plan: applied.plan,
    section: 'venue',
    action: response.action === 'venue_refine' ? 'venue_search_more' : 'recommend',
  });
  return withDebug({
    ...turn,
    changedFields: [...new Set([...applied.changedFields, ...turn.changedFields])],
  }, {
    engine: 'tool',
    model: response.model,
    latencyMs: response.latencyMs,
    action: response.action,
  });
}

async function actionTurn(input: V31Input, response: PlannerBrainResponse): Promise<AiPlannerV3Turn> {
  const applied = applyPlannerBrainResponse(input.plan as V3PlanState, response);
  if (response.action === 'review') {
    const reviewed = reviewPlannerV3State(applied.plan, input.tenant);
    return {
      ...reviewed,
      message: response.message || reviewed.message,
      changedFields: applied.changedFields,
      systemMessages: applied.changedFields.length ? [`Updated: ${applied.changedFields.join(' · ')}`] : [],
      debug: { engine: 'ai', model: response.model, latencyMs: response.latencyMs, action: 'review' },
    };
  }
  if (response.action === 'create_workspace') {
    const created = await runAiPlannerV3Turn({
      ...input,
      message: 'create event workspace',
      plan: applied.plan,
      action: 'create',
    });
    return withDebug(created, { engine: 'ai', model: response.model, latencyMs: response.latencyMs, action: 'create_workspace' });
  }
  return aiTurn(input, response);
}

export async function runAiPlannerV31Turn(input: V31Input): Promise<AiPlannerV3Turn> {
  if (explicitControl(input)) return runDeterministic(input);

  const response = await requestPlannerBrain({
    message: input.message,
    plan: input.plan as V3PlanState,
    history: input.history,
    tenant: input.tenant,
    section: input.section ?? null,
    action: input.action ?? null,
  });

  if (!response || response.engine === 'fallback') return fallbackTurn(input, response);

  if (response.action === 'venue_search' || response.action === 'venue_refine') {
    return toolTurn(input, response);
  }

  if (response.action === 'review' || response.action === 'create_workspace') {
    return actionTurn(input, response);
  }

  return aiTurn(input, response);
}
