import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["message", "plan", "readiness", "stage", "gaps", "options", "recommendation", "taskPacks"],
    properties: {
      message: { type: "string" },
      plan: {
        type: "object",
        additionalProperties: false,
        required: ["title","summary","description","category","difficulty","startsAt","endsAt","venueName","city","state","capacity","meetingInstructions","paid","priceCents","components","requirements","safetyNotes","backupPlan"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          difficulty: { type: "string", enum: ["easy","moderate","challenging"] },
          startsAt: { type: "string" },
          endsAt: { type: "string" },
          venueName: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          capacity: { type: "integer", minimum: 0 },
          meetingInstructions: { type: "string" },
          paid: { type: "boolean" },
          priceCents: { type: "integer", minimum: 0 },
          components: { type: "array", items: { type: "string" }, maxItems: 20 },
          requirements: { type: "array", items: { type: "string" }, maxItems: 30 },
          safetyNotes: { type: "array", items: { type: "string" }, maxItems: 30 },
          backupPlan: { type: "string" },
        },
      },
      readiness: { type: "integer", minimum: 0, maximum: 100 },
      stage: { type: "string", enum: ["possibility","momentum","confidence","ready"] },
      gaps: { type: "array", items: { type: "string" }, maxItems: 20 },
      options: { type: "array", items: { type: "string" }, maxItems: 6 },
      recommendation: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["label","reason","needsVerification"],
            properties: {
              label: { type: "string" },
              reason: { type: "string" },
              needsVerification: { type: "boolean" },
            },
          },
        ],
      },
      taskPacks: { type: "array", items: { type: "string", enum: ["food","waivers","safety","vendors","equipment","communications","marketing","event_day"] }, maxItems: 8 },
    },
  };
}

function outputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function fallback(message: string, current: any, tenant: any) {
  const plan = {
    title: clean(current?.title, 180),
    summary: clean(current?.summary, 500),
    description: clean(current?.description, 2500),
    category: clean(current?.category, 120),
    difficulty: ["easy","moderate","challenging"].includes(current?.difficulty) ? current.difficulty : "easy",
    startsAt: clean(current?.startsAt, 80),
    endsAt: clean(current?.endsAt, 80),
    venueName: clean(current?.venueName, 220),
    city: clean(current?.city, 120),
    state: clean(current?.state, 80),
    capacity: Number(current?.capacity || 0),
    meetingInstructions: clean(current?.meetingInstructions, 1000),
    paid: current?.paid === true,
    priceCents: Number(current?.priceCents || 0),
    components: Array.isArray(current?.components) ? current.components.map(String).slice(0, 20) : [],
    requirements: Array.isArray(current?.requirements) ? current.requirements.map(String).slice(0, 30) : [],
    safetyNotes: Array.isArray(current?.safetyNotes) ? current.safetyNotes.map(String).slice(0, 30) : [],
    backupPlan: clean(current?.backupPlan, 1200),
  };

  const lower = message.toLowerCase().trim();
  const configuredCategories = Array.isArray(tenant?.eventCategories)
    ? tenant.eventCategories.map(String).filter(Boolean).slice(0, 10)
    : [];
  const genericCategories = configuredCategories.length
    ? configuredCategories
    : ["Networking","Workshop","Conference","Fundraiser","Gala / Awards","Vendor Market / Pop-up"];

  const inferred = [
    { match: /\b(networking|mixer)\b/, category: "Networking", title: "Networking Event" },
    { match: /\b(workshop|class|seminar)\b/, category: "Workshop", title: "Workshop" },
    { match: /\b(conference|summit|convention)\b/, category: "Conference", title: "Conference" },
    { match: /\b(fundraiser|fundraising|charity event)\b/, category: "Fundraiser", title: "Fundraiser" },
    { match: /\b(gala|awards? dinner|awards? ceremony)\b/, category: "Gala / Awards", title: "Gala / Awards Event" },
    { match: /\b(vendor market|vendor fair|pop[- ]?up|marketplace)\b/, category: "Vendor Market / Pop-up", title: "Vendor Market" },
    { match: /\b(employee training|team training|staff training|team event)\b/, category: "Employee / Team Event", title: "Team Event" },
    { match: /\b(private party|birthday|anniversary|celebration)\b/, category: "Private Event", title: "Private Event" },
    { match: /\b(virtual event|webinar|online event)\b/, category: "Virtual Event", title: "Virtual Event" },
    { match: /\b(nature walk|hike|hiking|kayak|paddle|canoe|camping|campout|outdoor event)\b/, category: "Outdoor Event", title: "Outdoor Event" },
  ].find((item) => item.match.test(lower));

  if (inferred) {
    if (!plan.category) plan.category = inferred.category;
    if (!plan.title) plan.title = inferred.title;
    if (!plan.summary) plan.summary = `A ${inferred.category.toLowerCase()} event.`;
    if (!plan.description) plan.description = plan.summary;
  }

  const location = message.match(/\bin\s+([a-z .'-]+?)(?:,\s*([a-z]{2}))?(?:\s+(?:for|with|on|at|next|this|and)\b|[,.!?]|$)/i);
  if (location && !plan.city) {
    plan.city = titleCase(location[1] || "");
    if (!plan.state && location[2]) plan.state = location[2].toUpperCase();
  }

  const capacity = lower.match(/\b(\d{1,4})\s*(people|guests|attendees|persons)\b/);
  if (capacity) plan.capacity = Number(capacity[1]);

  const gaps = [
    !plan.title ? "Event title" : "",
    !plan.category ? "Event type" : "",
    !plan.city ? "City" : "",
    !plan.state ? "State" : "",
    !plan.capacity ? "Expected attendance" : "",
    !plan.startsAt ? "Date and start time" : "",
    !plan.endsAt ? "End time" : "",
  ].filter(Boolean);

  const readiness = Math.max(10, Math.min(90, 100 - gaps.length * 10));
  let nextMessage = "What kind of event are you planning?";
  let options = genericCategories.slice(0, 6);
  if (plan.title && !plan.city) {
    nextMessage = "What city should I plan around?";
    options = [];
  } else if (plan.title && plan.city && !plan.state) {
    nextMessage = `What state is ${plan.city} in?`;
    options = [];
  } else if (plan.title && plan.city && plan.state && !plan.capacity) {
    nextMessage = `About how many ${clean(tenant?.attendeeLabel, 40) || "attendees"} are you planning for?`;
    options = ["10 or fewer","10–25","25–50","50+","Not sure yet"];
  } else if (plan.title) {
    nextMessage = "I have the event idea. Choose a planning section or tell me what you want to change next.";
    options = ["Date & schedule","Venue","Registration","Communications","Review plan"];
  }

  const category = plan.category.toLowerCase();
  const taskPacks = ["communications","event_day"];
  if (plan.components.includes("food")) taskPacks.push("food");
  if (plan.components.includes("vendors")) taskPacks.push("vendors");
  if (plan.components.includes("equipment")) taskPacks.push("equipment");
  if (plan.paid || plan.components.includes("marketing")) taskPacks.push("marketing");
  if (plan.components.includes("safety") || /outdoor|hiking|paddling|camping|kayak|canoe/.test(category)) taskPacks.push("safety");

  return {
    message: nextMessage,
    plan,
    readiness,
    stage: readiness >= 85 ? "ready" : readiness >= 65 ? "confidence" : readiness >= 30 ? "momentum" : "possibility",
    gaps,
    options,
    recommendation: null,
    taskPacks: unique(taskPacks),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Function environment is incomplete." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) return json({ error: "Authentication required" }, 401);
  const userId = userData.user.id;
  const { data: approved, error: accessError } = await userClient.rpc("is_approved_outing_host", { p_profile_id: userId });
  if (accessError || approved !== true) return json({ error: "Approved host access is required." }, 403);

  let message = "";
  let currentPlan: any = {};
  let tenant: any = {};

  try {
    const body = await req.json();
    message = clean(body?.message, 2500);
    if (!message) return json({ error: "Tell the planner what you want to work on." }, 400);
    currentPlan = body?.plan && typeof body.plan === "object" ? body.plan : {};
    tenant = body?.tenant && typeof body.tenant === "object" ? body.tenant : {};
    const history = Array.isArray(body?.history) ? body.history.slice(-16) : [];
    const preferences = body?.preferences ?? {};
    const section = clean(body?.section, 80);
    const action = clean(body?.action, 40);

    if (!openAiKey) return json(fallback(message, currentPlan, tenant));

    const source = JSON.stringify({
      message,
      currentPlan,
      history,
      section,
      action,
      tenant: {
        organizationName: clean(tenant?.organizationName, 160),
        organizationKind: clean(tenant?.organizationKind, 80),
        eventCategories: Array.isArray(tenant?.eventCategories) ? tenant.eventCategories.slice(0, 20) : [],
        venueTypes: Array.isArray(tenant?.venueTypes) ? tenant.venueTypes.slice(0, 20) : [],
        attendeeLabel: clean(tenant?.attendeeLabel, 60),
        brandVoice: clean(tenant?.brandVoice, 240),
      },
      privacy: {
        personalMemory: Boolean(preferences.personal_memory_enabled),
        eventHistoryLearning: Boolean(preferences.event_history_learning_enabled),
        organizationMemory: Boolean(preferences.organization_memory_enabled),
        saveConversations: Boolean(preferences.save_conversations_enabled),
        analytics: Boolean(preferences.product_analytics_enabled),
      },
    });

    const instructions = `You are a tenant-neutral AI Event Planner inside a multi-organization event platform. The active organization and its planner configuration are supplied in the input. Never assume the organization is an outdoor, nature, camping, recreation or community group unless the current event or tenant settings explicitly say so.

Turn rough event ideas into structured event drafts through conversation. Infer facts the host already supplied before asking questions. For example, "a networking event in Jacksonville for 75 professionals" already supplies event type, city and attendance. Preserve confirmed details. Event-specific host input overrides prior event decisions, which override tenant settings, which override generic planning defaults.

Ask one useful question at a time. Honor the requested section and action when supplied. Do not answer a section request with a generic "what do you want to work on next" prompt. If a section is already developed, summarize it and offer concrete next actions. Treat intentionally incomplete events as normal. Readiness is planning completeness, not permission to save a draft.

Recommendations must be explicit suggestions with a reason. Never treat a recommendation request as a skip. Never invent venue availability, prices, permits, rules, weather, vendor facts or access details. Mark changing or external recommendations needsVerification=true. Separate confirmed facts from suggestions.

Use neutral event terminology from the tenant configuration. Do not introduce hiking, camping, paddling, trails, weather backup or outdoor safety unless relevant to this event. For business events, consider appropriate areas such as venue, registration, guests, staffing, vendors, communications, marketing, finance, AV, accessibility and documents when useful. For outdoor events, activity-specific safety can become relevant.

Recognize corrections and contradictions. A later explicit value replaces an earlier value. Do not silently keep both. Do not use historical personalization unless the matching privacy toggle is on. Return the full updated plan every turn.`;

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: [{ role: "user", content: [{ type: "input_text", text: source }] }],
        text: { format: { type: "json_schema", name: "host_ai_planner_turn", strict: true, schema: schema() } },
      }),
    });

    const payload = await upstream.json();
    if (!upstream.ok) {
      console.error("host-ai-planner upstream", payload);
      return json(fallback(message, currentPlan, tenant));
    }
    const text = outputText(payload);
    if (!text) return json(fallback(message, currentPlan, tenant));

    try {
      return json(JSON.parse(text));
    } catch (parseError) {
      console.error("host-ai-planner parse", parseError);
      return json(fallback(message, currentPlan, tenant));
    }
  } catch (error) {
    console.error("host-ai-planner", error);
    if (message) return json(fallback(message, currentPlan, tenant));
    return json({ error: "Unable to start AI planning." }, 500);
  }
});