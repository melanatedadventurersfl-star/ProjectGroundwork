import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = { "Content-Type": "application/json" };
const MODEL = "gpt-4.1-mini";
const MEMORY_INTENT = /\b(remember|history|my trail|last time|went|visited|camped|hiked|before|past|been to|did i|last summer)\b/i;
const NEW_TOPIC_INTENT = /\b(campsgiving|trip|vacation|weekend getaway|camping trip|road trip|new trip|different trip|plan a trip|plan my trip)\b/i;
const PLANNING_INTENT = /\b(plan|trip|itinerary|weekend|camping|campsgiving|vacation|day out|adventure|outing)\b/i;
const MULTIDAY_INTENT = /\b(weekend|overnight|multi[- ]?day|trip|vacation|campsgiving|camping trip|road trip)\b/i;
const DISCOVERY_INTENT = /\b(what should i do|what else|show me|recommend|surprise me|ideas|options|something to do|find me)\b/i;
const MODIFICATION_INTENT = /\b(change|swap|replace|remove|shorter|easier|harder|add|move|undo|go back|make it)\b/i;
const QUESTION_INTENT = /^(what|why|how|when|where|is|are|can|should|do|does|did|will|would|could)\b/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

type CandidatePlace = {
  id: string;
  name: string;
  category: string;
  area: string;
  type: string;
  tags: string[];
  summary: string;
  details?: string[];
  collections?: string[];
};

type ConversationTurn = {
  role: 'user' | 'assistant';
  text: string;
};

type AdventureSession = {
  mode?: string;
  constraints?: Record<string, unknown>;
  selectedPlaceIds?: string[];
  rejectedPlaceIds?: string[];
  activePlan?: any[];
  previousPlan?: any[];
  lastIntent?: string;
};

type GuideMode = 'answer' | 'clarify' | 'discover' | 'plan' | 'modify' | 'compare';

type Clarification = {
  question: string;
  options: string[];
};

function sanitizeSession(raw: unknown): AdventureSession {
  if (!raw || typeof raw !== 'object') return {};
  const session = raw as Record<string, unknown>;
  return {
    mode: typeof session.mode === 'string' ? session.mode.slice(0, 40) : undefined,
    constraints: session.constraints && typeof session.constraints === 'object' ? session.constraints as Record<string, unknown> : {},
    selectedPlaceIds: Array.isArray(session.selectedPlaceIds) ? session.selectedPlaceIds.slice(0, 30).map(String) : [],
    rejectedPlaceIds: Array.isArray(session.rejectedPlaceIds) ? session.rejectedPlaceIds.slice(0, 30).map(String) : [],
    activePlan: Array.isArray(session.activePlan) ? session.activePlan.slice(0, 10) : [],
    previousPlan: Array.isArray(session.previousPlan) ? session.previousPlan.slice(0, 10) : [],
    lastIntent: typeof session.lastIntent === 'string' ? session.lastIntent.slice(0, 500) : undefined,
  };
}

function classifyMode(query: string, session: AdventureSession): GuideMode {
  const lower = query.toLowerCase().trim();
  const hasPlan = (session.activePlan?.length ?? 0) > 0;
  if (MODIFICATION_INTENT.test(lower) && hasPlan) return 'modify';
  if (/\b(compare|versus|vs\.?|which one)\b/i.test(lower)) return 'compare';
  if (PLANNING_INTENT.test(lower)) return 'plan';
  if (DISCOVERY_INTENT.test(lower)) return 'discover';
  if (QUESTION_INTENT.test(lower)) return 'answer';
  return hasPlan ? 'modify' : 'discover';
}

function detectNewTopic(query: string, session: AdventureSession) {
  if (!NEW_TOPIC_INTENT.test(query)) return false;
  if (!(session.activePlan?.length || session.selectedPlaceIds?.length)) return false;
  const previous = String(session.lastIntent ?? '').toLowerCase();
  const current = query.toLowerCase();
  if (!previous) return true;
  if (current.includes('campsgiving') && !previous.includes('campsgiving')) return true;
  if (/\b(new|different|another)\b/i.test(current)) return true;
  if (/\btrip|vacation|campsgiving\b/i.test(current) && !/\btrip|vacation|campsgiving\b/i.test(previous)) return true;
  return false;
}

function resetTopicContext(session: AdventureSession): AdventureSession {
  return {
    ...session,
    selectedPlaceIds: [],
    rejectedPlaceIds: [],
    activePlan: [],
    previousPlan: [],
    mode: 'discover',
  };
}

function inferClarification(query: string, city: string, mode: GuideMode): Clarification | null {
  const lower = query.toLowerCase();
  if (mode !== 'plan') return null;

  const asksForMultiday = MULTIDAY_INTENT.test(lower);
  const hasSpecificDayPlanDuration = /\b(2\s*(?:to|-)\s*3 hours?|half[- ]?day|full[- ]?day|today|tonight|this afternoon|tomorrow morning|tomorrow afternoon)\b/i.test(lower);
  const hasDates = /\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}|\b\d{1,2}[/-]\d{1,2}\b/i.test(lower);
  const hasTripType = /\b(camp|camping|hotel|stay|lodging|day trip|activities|food|restaurant|hike|trail|beach|water|museum|event)\b/i.test(lower);

  if (asksForMultiday && !hasDates && !hasSpecificDayPlanDuration) {
    return {
      question: `Absolutely. Before I build this, what kind of ${city ? city + ' ' : ''}trip are you planning?`,
      options: ['Full weekend', 'Camping + activities', 'Activities only', 'Food + activities'],
    };
  }

  if (asksForMultiday && !hasTripType) {
    return {
      question: 'What do you want me to solve first?',
      options: ['Where to stay/camp', 'Things to do', 'Meals + activities', 'Build the whole trip'],
    };
  }

  return null;
}

function candidateText(place: CandidatePlace) {
  return [place.name, place.category, place.area, place.type, ...(place.tags ?? []), place.summary, ...(place.details ?? []), ...(place.collections ?? [])].join(' ').toLowerCase();
}

function noveltySort(candidates: CandidatePlace[], session: AdventureSession, query: string) {
  const shown = new Set([...(session.selectedPlaceIds ?? []), ...(session.rejectedPlaceIds ?? [])]);
  const wantsDifferent = /\b(what else|different|another|surprise me|new option|more options)\b/i.test(query);
  return [...candidates].sort((a, b) => {
    const aPenalty = shown.has(a.id) ? (wantsDifferent ? 100 : 8) : 0;
    const bPenalty = shown.has(b.id) ? (wantsDifferent ? 100 : 8) : 0;
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
    const aDiversity = new Set([a.category, a.type, ...(a.tags ?? []).slice(0, 2)]).size;
    const bDiversity = new Set([b.category, b.type, ...(b.tags ?? []).slice(0, 2)]).size;
    return bDiversity - aDiversity;
  });
}

function diversifiedFallback(query: string, candidates: CandidatePlace[], journey: any[], session: AdventureSession, mode: GuideMode, fallbackReason: string) {
  const lower = query.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  const unseen = noveltySort(candidates, session, query);
  const scored = unseen.map((place, index) => {
    const haystack = candidateText(place);
    const matchedTokens = tokens.filter((token) => haystack.includes(token));
    let score = matchedTokens.length * 3 - index * 0.01;
    if (/\bwater|beach|river|lake|spring|paddle|kayak\b/i.test(lower) && /water|beach|river|lake|spring|paddle|kayak|marsh/.test(haystack)) score += 5;
    if (/\btrail|hike|walk\b/i.test(lower) && /trail|hike|walk|boardwalk/.test(haystack)) score += 5;
    if (/\beasy|beginner|relaxed|chill\b/i.test(lower) && /easy|beginner|family|boardwalk|accessible|relax|park/.test(haystack)) score += 4;
    if ((session.rejectedPlaceIds ?? []).includes(place.id)) score -= 100;
    if ((session.selectedPlaceIds ?? []).includes(place.id) && /\b(what else|different|another|surprise me)\b/i.test(lower)) score -= 100;
    return { place, score, matchedTokens };
  }).sort((a, b) => b.score - a.score);

  const picks = scored.filter((row) => row.score > -50).slice(0, 4);
  const places = picks.map((row, index) => ({
    id: row.place.id,
    reason: row.matchedTokens.length
      ? `Fits ${row.matchedTokens.slice(0, 2).join(' and ')} from your request${index === 0 ? ' and is the strongest fresh match' : ''}.`
      : `A different ${row.place.category.toLowerCase()} option around ${row.place.area}.`,
  }));

  const wantsMemory = MEMORY_INTENT.test(query);
  const memoryHits = wantsMemory
    ? journey.filter((item: any) => tokens.some((token) => [item.title, item.city, item.category, item.highlight, item.reflection].filter(Boolean).join(' ').toLowerCase().includes(token))).slice(0, 3).map((item: any) => ({ adventureId: item.adventure_id, title: item.title, experiencedAt: item.experienced_at, note: item.highlight || item.reflection || 'From your outdoor history.' }))
    : [];

  if (mode === 'plan') {
    return {
      answer: 'I can help build this, but I do not want to fake a complete itinerary from limited data. Pick a direction below and I’ll keep narrowing it.',
      places,
      communityStops: [],
      memoryHits,
      dayPlan: [],
      followUps: ['Build around the first option', 'Show me different options', 'Make it more relaxed', 'Ask me what you still need'],
      confidenceNotes: [`AI generation was unavailable (${fallbackReason}), so I used diversified local matching without creating a canned itinerary.`, 'Always confirm current hours, conditions, closures, and access before leaving.'],
    };
  }

  return {
    answer: places.length ? 'I found a few different options to consider. I’m avoiding recently recycled picks where possible.' : memoryHits.length ? 'I found a few matches from your outdoor history.' : 'I do not have enough reliable matches yet. Give me a little more direction and I’ll narrow it down.',
    places,
    communityStops: [],
    memoryHits,
    dayPlan: [],
    followUps: ['Show me something different', 'Make it beginner friendly', 'Build a plan from one of these'],
    confidenceNotes: [`AI generation was unavailable (${fallbackReason}), so this answer used diversified local matching instead.`, 'Always confirm current hours, conditions, closures, and access before leaving.'],
  };
}

function clarificationResult(clarification: Clarification, diagnostics: Record<string, unknown>) {
  return {
    result: {
      answer: clarification.question,
      places: [],
      communityStops: [],
      memoryHits: [],
      dayPlan: [],
      followUps: clarification.options,
      confidenceNotes: [],
    },
    source: 'planner_clarification',
    diagnostics,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authentication required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'Function environment is incomplete.' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.id) return json({ error: 'Authentication required' }, 401);

    const body = await req.json();
    const query = String(body?.query ?? '').trim().slice(0, 2000);
    const city = String(body?.city ?? '').trim().slice(0, 100);
    const state = String(body?.state ?? 'FL').trim().toUpperCase().slice(0, 2);
    const weather = body?.weather && typeof body.weather === 'object' ? body.weather : null;
    const conversation: ConversationTurn[] = Array.isArray(body?.conversation)
      ? body.conversation.slice(-8).map((turn: any) => ({
        role: turn?.role === 'assistant' ? 'assistant' : 'user',
        text: String(turn?.text ?? '').trim().slice(0, 1200),
      })).filter((turn: ConversationTurn) => turn.text.length > 0)
      : [];
    const candidates: CandidatePlace[] = Array.isArray(body?.candidates) ? body.candidates.slice(0, 80).map((place: any) => ({
      id: String(place?.id ?? '').slice(0, 120),
      name: String(place?.name ?? '').slice(0, 180),
      category: String(place?.category ?? '').slice(0, 80),
      area: String(place?.area ?? '').slice(0, 120),
      type: String(place?.type ?? '').slice(0, 120),
      tags: Array.isArray(place?.tags) ? place.tags.slice(0, 10).map((value: any) => String(value).slice(0, 80)) : [],
      summary: String(place?.summary ?? '').slice(0, 500),
      details: Array.isArray(place?.details) ? place.details.slice(0, 8).map((value: any) => String(value).slice(0, 180)) : [],
      collections: Array.isArray(place?.collections) ? place.collections.slice(0, 8).map((value: any) => String(value).slice(0, 120)) : [],
    })).filter((place: CandidatePlace) => place.id && place.name) : [];
    if (query.length < 3) return json({ error: 'Ask me what you want to do, find, or remember.' }, 400);

    const rawSession = sanitizeSession(body?.session);
    const topicChanged = detectNewTopic(query, rawSession);
    const session = topicChanged ? resetTopicContext(rawSession) : rawSession;
    const mode = classifyMode(query, session);
    const clarification = inferClarification(query, city, mode);

    if (clarification) {
      return json(clarificationResult(clarification, {
        mode,
        topicChanged,
        reason: 'underspecified_planning_request',
      }));
    }

    const [{ data: journey }, { data: communityPlaces }] = await Promise.all([
      userClient.from('member_journey').select('adventure_id,title,category,city,state,experienced_at,rating,highlight,reflection').order('experienced_at', { ascending: false }).limit(30),
      userClient.from('community_places').select('id,name,category,description,address,city,state,website_url,ownership_tags,ownership_verification_status,community_endorsement_count').eq('is_active', true).order('community_endorsement_count', { ascending: false }).limit(80),
    ]);
    const journeyRows = journey ?? [];
    const communityRows = communityPlaces ?? [];
    const verifiedPlaces = communityRows
      .filter((place: any) => String(place.ownership_verification_status ?? '') === 'verified')
      .filter((place: any) => !state || String(place.state ?? '').toUpperCase() === state)
      .filter((place: any) => !city || String(place.city ?? '').toLowerCase() === city.toLowerCase() || query.toLowerCase().includes(String(place.city ?? '').toLowerCase()));

    const rankedCandidates = noveltySort(candidates, session, query).slice(0, 60);

    if (!openAiKey) {
      return json({
        result: diversifiedFallback(query, rankedCandidates, journeyRows, session, mode, 'missing_openai_key'),
        source: 'catalog_fallback',
        diagnostics: { mode, topicChanged, fallbackReason: 'missing_openai_key', candidateCount: rankedCandidates.length },
      });
    }

    const system = `You are Go, Go Melanated's intelligent outdoor and trip-planning guide. Your job is to understand first, ask when necessary, retrieve from the supplied sources, diversify choices, then plan only when the request is ready.\n\nDECISION ORDER:\n1. Understand the user's goal and detect whether this is a new topic, a question, discovery, comparison, planning request, or modification of an existing plan.\n2. If a planning request is missing information that materially changes the answer, ask ONE concise clarifying question and return no itinerary.\n3. If enough information exists, choose from the supplied source records. Avoid repeating recently shown places unless the user explicitly wants to keep them.\n4. Build itineraries only after choosing good candidates. Do not default to canned times or a fixed park-food-park template.\n5. Mutate only the part of an existing plan the user asked to change.\n6. Briefly explain why the recommendation fits.\n\nSESSION RULES:\n- adventureSession is authoritative structured state. Treat a new named trip/event or explicit new-trip request as a fresh topic when topicChanged=true.\n- recentlyShownPlaceIds should receive a strong novelty penalty for requests like "what else", "different", or "surprise me".\n- rejectedPlaceIds must not be recommended again unless the user explicitly asks for one back.\n\nPLANNING TYPES:\nUse the request to distinguish quick outing, half day, full day, weekend trip, camping trip, event trip, food plan, or general Q&A. A multi-day or named-event request should not be squeezed into a one-day template.\n\nSOURCE RULES:\nUse only supplied Trail Guide candidates for trailGuide place IDs and supplied community place records for communityStop IDs. Never invent IDs. You may answer general planning questions without an itinerary.\n\nCOMMUNITY PRIORITY:\nWhen relevant verified records are supplied, prioritize verified Black- and brown-owned/community-centered businesses as optional stops. Ownership is sensitive factual data. Never infer ownership. Only state ownership identity when it appears in ownership_tags on a verified record.\n\nMEMORY:\nOnly surface personal journey records when the user asks about history, preferences grounded in past experience, or prior outings.\n\nSAFETY:\nDo not promise safety, availability, access, hours, closures, permits, accessibility, route conditions, or weather. Recommend checking current official information where appropriate.\n\nSTYLE:\nBe concise, natural, and useful. Do not use implementation language such as "I updated the same adventure instead of starting over." State the outcome instead.\n\nReturn only valid JSON matching the schema.`;

    const schema = {
      name: 'member_guide_result_v2',
      strict: true,
      schema: {
        type: 'object', additionalProperties: false,
        required: ['responseMode','answer','clarificationQuestion','clarificationOptions','places','communityStops','memoryHits','dayPlan','followUps','confidenceNotes','whyThisPlan'],
        properties: {
          responseMode: { type: 'string', enum: ['answer','clarify','discover','plan','modify','compare'] },
          answer: { type: 'string' },
          clarificationQuestion: { type: ['string','null'] },
          clarificationOptions: { type: 'array', maxItems: 4, items: { type: 'string' } },
          places: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['id','reason'], properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
          communityStops: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['placeId','name','reason','ownershipTags'], properties: { placeId: { type: 'string' }, name: { type: 'string' }, reason: { type: 'string' }, ownershipTags: { type: 'array', items: { type: 'string' } } } } },
          memoryHits: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['adventureId','title','experiencedAt','note'], properties: { adventureId: { type: 'string' }, title: { type: 'string' }, experiencedAt: { type: 'string' }, note: { type: 'string' } } } },
          dayPlan: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, required: ['time','title','kind','referenceId','note'], properties: { time: { type: 'string' }, title: { type: 'string' }, kind: { type: 'string', enum: ['trail-guide','community-stop','other'] }, referenceId: { type: 'string' }, note: { type: 'string' } } } },
          followUps: { type: 'array', maxItems: 4, items: { type: 'string' } },
          confidenceNotes: { type: 'array', maxItems: 5, items: { type: 'string' } },
          whyThisPlan: { type: 'string' },
        },
      },
    };

    const recentConversationText = conversation.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n');
    const memoryRelevant = MEMORY_INTENT.test(query) || MEMORY_INTENT.test(recentConversationText);
    const context = JSON.stringify({
      currentRequest: query,
      inferredMode: mode,
      topicChanged,
      adventureSession: session,
      recentlyShownPlaceIds: [...new Set([...(session.selectedPlaceIds ?? []), ...(session.rejectedPlaceIds ?? [])])],
      recentConversation: conversation,
      preferredCity: city || null,
      preferredState: state || null,
      weather,
      trailGuideCandidates: rankedCandidates,
      verifiedCommunityPlaces: verifiedPlaces,
      personalJourney: memoryRelevant ? journeyRows : [],
    });

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.55,
        messages: [{ role: 'system', content: system }, { role: 'user', content: context }],
        response_format: { type: 'json_schema', json_schema: schema },
      }),
    });

    const completion = await upstream.json();
    if (!upstream.ok) {
      console.error('member-guide upstream', completion);
      return json({
        result: diversifiedFallback(query, rankedCandidates, journeyRows, session, mode, 'openai_non_ok'),
        source: 'catalog_fallback',
        diagnostics: { mode, topicChanged, fallbackReason: 'openai_non_ok', upstreamStatus: upstream.status, candidateCount: rankedCandidates.length },
      });
    }

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) {
      return json({
        result: diversifiedFallback(query, rankedCandidates, journeyRows, session, mode, 'empty_completion'),
        source: 'catalog_fallback',
        diagnostics: { mode, topicChanged, fallbackReason: 'empty_completion', candidateCount: rankedCandidates.length },
      });
    }

    const result = JSON.parse(content);
    const candidateIds = new Set(rankedCandidates.map((place) => place.id));
    const communityById = new Map(verifiedPlaces.map((place: any) => [String(place.id), place]));
    const journeyById = new Map(journeyRows.map((item: any) => [String(item.adventure_id), item]));

    result.places = Array.isArray(result.places) ? result.places.filter((item: any) => candidateIds.has(String(item.id))) : [];
    result.communityStops = Array.isArray(result.communityStops) ? result.communityStops.filter((item: any) => communityById.has(String(item.placeId))).map((item: any) => {
      const source = communityById.get(String(item.placeId)) as any;
      return { ...item, name: source.name, ownershipTags: source.ownership_tags ?? [] };
    }) : [];
    result.memoryHits = memoryRelevant && Array.isArray(result.memoryHits) ? result.memoryHits.filter((item: any) => journeyById.has(String(item.adventureId))).map((item: any) => {
      const source = journeyById.get(String(item.adventureId)) as any;
      return { ...item, title: source.title, experiencedAt: source.experienced_at };
    }) : [];
    result.dayPlan = Array.isArray(result.dayPlan) ? result.dayPlan.filter((step: any) => step.kind === 'other' || (step.kind === 'trail-guide' && candidateIds.has(String(step.referenceId))) || (step.kind === 'community-stop' && communityById.has(String(step.referenceId)))) : [];

    if (result.responseMode === 'clarify') {
      result.dayPlan = [];
      result.places = [];
      result.communityStops = [];
      result.followUps = Array.isArray(result.clarificationOptions) ? result.clarificationOptions.slice(0, 4) : [];
      if (result.clarificationQuestion) result.answer = result.clarificationQuestion;
    }

    return json({
      result,
      source: 'ai',
      model: completion.model ?? MODEL,
      diagnostics: {
        mode,
        topicChanged,
        fallbackReason: null,
        candidateCount: rankedCandidates.length,
        verifiedCommunityPlacesUsed: verifiedPlaces.length,
        responseMode: result.responseMode,
      },
    });
  } catch (error) {
    console.error('member-guide', error);
    return json({ error: 'I could not build that recommendation right now.' }, 500);
  }
});
