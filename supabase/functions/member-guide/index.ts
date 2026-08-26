import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = { "Content-Type": "application/json" };
const MODEL = "gpt-4.1-mini";
const MEMORY_INTENT = /\b(remember|history|my trail|last time|went|visited|camped|hiked|before|past|been to|did i)\b/i;

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

function fallbackAnswer(query: string, candidates: CandidatePlace[], journey: any[]) {
  const lower = query.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  const scored = candidates.map((place) => {
    const haystack = [place.name, place.category, place.area, place.type, ...(place.tags ?? []), place.summary, ...(place.details ?? []), ...(place.collections ?? [])].join(' ').toLowerCase();
    const matchedTokens = tokens.filter((token) => haystack.includes(token));
    return { place, score: matchedTokens.length, matchedTokens };
  }).sort((a, b) => b.score - a.score);
  const places = scored.filter((row) => row.score > 0).slice(0, 3).map((row) => ({
    id: row.place.id,
    reason: row.matchedTokens.length
      ? `Matches ${row.matchedTokens.slice(0, 2).join(' and ')} from your request.`
      : `Matches your request for ${row.place.category.toLowerCase()}.`,
  }));
  const wantsMemory = MEMORY_INTENT.test(query);
  const memoryHits = wantsMemory
    ? journey.filter((item: any) => tokens.some((token) => [item.title, item.city, item.category, item.highlight, item.reflection].filter(Boolean).join(' ').toLowerCase().includes(token))).slice(0, 3).map((item: any) => ({ adventureId: item.adventure_id, title: item.title, experiencedAt: item.experienced_at, note: item.highlight || item.reflection || 'From your outdoor history.' }))
    : [];
  return {
    answer: places.length ? 'I found a few Trail Guide options that fit parts of your request. Open one to check the details and current conditions.' : memoryHits.length ? 'I found a few matches from your outdoor history.' : 'I could not confidently match that yet. Try adding an activity, location, distance, or vibe.',
    places,
    communityStops: [],
    memoryHits,
    dayPlan: [],
    followUps: ['Make it beginner friendly', 'Build a half-day plan', 'Include a verified community-owned stop'],
    confidenceNotes: ['AI generation was unavailable, so this answer used Trail Guide matching instead.', 'Always confirm current hours, conditions, closures, and access before leaving.'],
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
    const candidates: CandidatePlace[] = Array.isArray(body?.candidates) ? body.candidates.slice(0, 60).map((place: any) => ({
      id: String(place?.id ?? '').slice(0, 120),
      name: String(place?.name ?? '').slice(0, 180),
      category: String(place?.category ?? '').slice(0, 80),
      area: String(place?.area ?? '').slice(0, 120),
      type: String(place?.type ?? '').slice(0, 120),
      tags: Array.isArray(place?.tags) ? place.tags.slice(0, 8).map((value: any) => String(value).slice(0, 80)) : [],
      summary: String(place?.summary ?? '').slice(0, 500),
      details: Array.isArray(place?.details) ? place.details.slice(0, 6).map((value: any) => String(value).slice(0, 180)) : [],
      collections: Array.isArray(place?.collections) ? place.collections.slice(0, 6).map((value: any) => String(value).slice(0, 120)) : [],
    })).filter((place: CandidatePlace) => place.id && place.name) : [];
    if (query.length < 3) return json({ error: 'Ask me what you want to do, find, or remember.' }, 400);

    const [{ data: journey }, { data: communityPlaces }] = await Promise.all([
      userClient.from('member_journey').select('adventure_id,title,category,city,state,experienced_at,rating,highlight,reflection').order('experienced_at', { ascending: false }).limit(30),
      userClient.from('community_places').select('id,name,category,description,address,city,state,website_url,ownership_tags,ownership_verification_status,community_endorsement_count').eq('is_active', true).eq('ownership_verification_status', 'verified').order('community_endorsement_count', { ascending: false }).limit(30),
    ]);
    const journeyRows = journey ?? [];
    const verifiedPlaces = (communityPlaces ?? []).filter((place: any) => !state || String(place.state ?? '').toUpperCase() === state).filter((place: any) => !city || String(place.city ?? '').toLowerCase() === city.toLowerCase() || query.toLowerCase().includes(String(place.city ?? '').toLowerCase()));

    if (!openAiKey) return json({ result: fallbackAnswer(query, candidates, journeyRows), source: 'fallback' });

    const system = `You are Go Melanated's member outdoor guide. Help members FIND places, EXPLAIN why they fit, BUILD simple outdoor day plans, and REMEMBER their own past outdoor experiences. Use only the supplied Trail Guide candidates for Trail Guide place recommendations and only the supplied verified community place records for ownership claims. Never invent a place ID.\n\nCOMMUNITY PRIORITY: when relevant verified records are supplied, prioritize Black- and brown-owned/community-centered businesses as optional stops. Ownership is sensitive factual data. NEVER infer ownership from a person's name, image, neighborhood, cuisine, language, or demographics. You may only state an ownership identity that appears in ownership_tags from a supplied verified record. If none fit, say no verified match is available yet.\n\nMEMORY: Personal journey records are private context for this member. Only surface memoryHits when the member is actually asking about prior experiences, their history, or patterns/preferences that require that history. Do not inject unrelated past outings into an ordinary place-search request. Do not claim details absent from those records.\n\nSAFETY: You are a planning assistant, not a safety authority. Never promise that a trail, venue, weather condition, route, body of water, or activity is safe. Current hours, closures, permits, accessibility, water conditions, and weather can change. Recommend checking current official information before leaving.\n\nReturn only valid JSON matching the schema.`;

    const schema = {
      name: 'member_guide_result',
      strict: true,
      schema: {
        type: 'object', additionalProperties: false,
        required: ['answer','places','communityStops','memoryHits','dayPlan','followUps','confidenceNotes'],
        properties: {
          answer: { type: 'string' },
          places: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['id','reason'], properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
          communityStops: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['placeId','name','reason','ownershipTags'], properties: { placeId: { type: 'string' }, name: { type: 'string' }, reason: { type: 'string' }, ownershipTags: { type: 'array', items: { type: 'string' } } } } },
          memoryHits: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['adventureId','title','experiencedAt','note'], properties: { adventureId: { type: 'string' }, title: { type: 'string' }, experiencedAt: { type: 'string' }, note: { type: 'string' } } } },
          dayPlan: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['time','title','kind','referenceId','note'], properties: { time: { type: 'string' }, title: { type: 'string' }, kind: { type: 'string', enum: ['trail-guide','community-stop','other'] }, referenceId: { type: 'string' }, note: { type: 'string' } } } },
          followUps: { type: 'array', maxItems: 4, items: { type: 'string' } },
          confidenceNotes: { type: 'array', maxItems: 5, items: { type: 'string' } },
        },
      },
    };

    const context = JSON.stringify({ query, preferredCity: city || null, preferredState: state || null, weather, trailGuideCandidates: candidates, verifiedCommunityPlaces: verifiedPlaces, personalJourney: journeyRows });
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.35, messages: [{ role: 'system', content: system }, { role: 'user', content: context }], response_format: { type: 'json_schema', json_schema: schema } }),
    });
    const completion = await upstream.json();
    if (!upstream.ok) {
      console.error('member-guide upstream', completion);
      return json({ result: fallbackAnswer(query, candidates, journeyRows), source: 'fallback' });
    }
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return json({ result: fallbackAnswer(query, candidates, journeyRows), source: 'fallback' });
    const result = JSON.parse(content);

    const candidateIds = new Set(candidates.map((place) => place.id));
    const communityById = new Map(verifiedPlaces.map((place: any) => [String(place.id), place]));
    const journeyById = new Map(journeyRows.map((item: any) => [String(item.adventure_id), item]));
    result.places = Array.isArray(result.places) ? result.places.filter((item: any) => candidateIds.has(String(item.id))) : [];
    result.communityStops = Array.isArray(result.communityStops) ? result.communityStops.filter((item: any) => communityById.has(String(item.placeId))).map((item: any) => {
      const source = communityById.get(String(item.placeId)) as any;
      return { ...item, name: source.name, ownershipTags: source.ownership_tags ?? [] };
    }) : [];
    result.memoryHits = MEMORY_INTENT.test(query) && Array.isArray(result.memoryHits) ? result.memoryHits.filter((item: any) => journeyById.has(String(item.adventureId))).map((item: any) => {
      const source = journeyById.get(String(item.adventureId)) as any;
      return { ...item, title: source.title, experiencedAt: source.experienced_at };
    }) : [];
    result.dayPlan = Array.isArray(result.dayPlan) ? result.dayPlan.filter((step: any) => step.kind === 'other' || (step.kind === 'trail-guide' && candidateIds.has(String(step.referenceId))) || (step.kind === 'community-stop' && communityById.has(String(step.referenceId)))) : [];

    return json({ result, source: 'ai', model: completion.model ?? MODEL, verifiedCommunityPlacesUsed: verifiedPlaces.length });
  } catch (error) {
    console.error('member-guide', error);
    return json({ error: 'I could not build that recommendation right now.' }, 500);
  }
});
