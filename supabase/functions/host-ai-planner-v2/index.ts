import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const jsonHeaders = { "Content-Type": "application/json" };
const plannerSections = [
  "basics",
  "schedule",
  "venue",
  "registration",
  "guests",
  "staffing",
  "vendors",
  "communications",
  "marketing",
  "finance",
  "safety",
  "documents",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function planSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "summary",
      "description",
      "category",
      "difficulty",
      "startsAt",
      "endsAt",
      "venueName",
      "city",
      "state",
      "capacity",
      "attendanceRange",
      "meetingInstructions",
      "paid",
      "priceCents",
      "components",
      "requirements",
      "safetyNotes",
      "backupPlan",
    ],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      category: { type: "string" },
      difficulty: { type: "string", enum: ["easy", "moderate", "challenging"] },
      startsAt: { type: "string" },
      endsAt: { type: "string" },
      venueName: { type: "string" },
      city: { type: "string" },
      state: { type: "string" },
      capacity: { type: "integer", minimum: 0 },
      attendanceRange: { type: "string" },
      meetingInstructions: { type: "string" },
      paid: { type: "boolean" },
      priceCents: { type: "integer", minimum: 0 },
      components: { type: "array", items: { type: "string" }, maxItems: 20 },
      requirements: { type: "array", items: { type: "string" }, maxItems: 30 },
      safetyNotes: { type: "array", items: { type: "string" }, maxItems: 30 },
      backupPlan: { type: "string" },
    },
  };
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "message",
      "plan",
      "readiness",
      "stage",
      "gaps",
      "options",
      "recommendation",
      "taskPacks",
      "action",
      "activeSection",
      "venueRefinement",
      "changedFields",
      "sectionUpdates",
    ],
    properties: {
      message: { type: "string" },
      plan: planSchema(),
      readiness: { type: "integer", minimum: 0, maximum: 100 },
      stage: { type: "string", enum: ["possibility", "momentum", "confidence", "ready"] },
      gaps: { type: "array", items: { type: "string" }, maxItems: 20 },
      options: { type: "array", items: { type: "string" }, maxItems: 6 },
      recommendation: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["label", "reason", "needsVerification"],
            properties: {
              label: { type: "string" },
              reason: { type: "string" },
              needsVerification: { type: "boolean" },
            },
          },
        ],
      },
      taskPacks: {
        type: "array",
        items: { type: "string", enum: ["food", "waivers", "safety", "vendors", "equipment", "communications", "marketing", "event_day"] },
        maxItems: 8,
      },
      action: { type: "string", enum: ["continue", "venue_search", "venue_refine", "review", "create_workspace"] },
      activeSection: {
        anyOf: [
          { type: "null" },
          { type: "string", enum: plannerSections },
        ],
      },
      venueRefinement: { type: "string" },
      changedFields: { type: "array", items: { type: "string" }, maxItems: 20 },
      sectionUpdates: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["section", "note"],
          properties: {
            section: { type: "string", enum: plannerSections },
            note: { type: "string" },
          },
        },
      },
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

function cleanPlan(current: any) {
  return {
    title: clean(current?.title, 180),
    summary: clean(current?.summary, 500),
    description: clean(current?.description, 2500),
    category: clean(current?.category, 120),
    difficulty: ["easy", "moderate", "challenging"].includes(current?.difficulty) ? current.difficulty : "easy",
    startsAt: clean(current?.startsAt, 80),
    endsAt: clean(current?.endsAt, 80),
    venueName: clean(current?.venueName, 220),
    city: clean(current?.city, 120),
    state: clean(current?.state, 80),
    capacity: Number.isInteger(Number(current?.capacity)) && Number(current?.capacity) > 0 ? Number(current.capacity) : 0,
    attendanceRange: clean(current?.attendanceRange, 80),
    meetingInstructions: clean(current?.meetingInstructions, 1200),
    paid: current?.paid === true,
    priceCents: Number.isInteger(Number(current?.priceCents)) && Number(current?.priceCents) > 0 ? Number(current.priceCents) : 0,
    components: Array.isArray(current?.components) ? unique(current.components.map(String).map((item: string) => item.trim()).filter(Boolean)).slice(0, 20) : [],
    requirements: Array.isArray(current?.requirements) ? unique(current.requirements.map(String).map((item: string) => item.trim()).filter(Boolean)).slice(0, 30) : [],
    safetyNotes: Array.isArray(current?.safetyNotes) ? unique(current.safetyNotes.map(String).map((item: string) => item.trim()).filter(Boolean)).slice(0, 30) : [],
    backupPlan: clean(current?.backupPlan, 1200),
  };
}

function fallback(message: string, current: any, section: string) {
  const plan = cleanPlan(current);
  const gaps = [
    !plan.title ? "Event title" : "",
    !plan.category ? "Event type" : "",
    !plan.startsAt ? "Date and start time" : "",
    !plan.endsAt ? "End time" : "",
    !plan.city ? "City" : "",
    !plan.state ? "State" : "",
  ].filter(Boolean);
  const readiness = Math.max(10, Math.min(90, 100 - gaps.length * 12));

  return {
    message: message
      ? "I kept your plan intact. I could not use the planning intelligence service for this turn, so I did not guess at new details."
      : "Tell me what you want to plan.",
    plan,
    readiness,
    stage: readiness >= 85 ? "ready" : readiness >= 65 ? "confidence" : readiness >= 30 ? "momentum" : "possibility",
    gaps,
    options: ["Keep planning", "Review plan"],
    recommendation: null,
    taskPacks: unique([
      "communications",
      "event_day",
      ...(plan.components.includes("food") ? ["food"] : []),
      ...(plan.components.includes("vendors") ? ["vendors"] : []),
      ...(plan.components.includes("equipment") ? ["equipment"] : []),
      ...(plan.components.includes("marketing") || plan.paid ? ["marketing"] : []),
      ...(plan.components.includes("safety") ? ["safety"] : []),
    ]),
    action: "continue",
    activeSection: plannerSections.includes(section) ? section : null,
    venueRefinement: "",
    changedFields: [],
    sectionUpdates: [],
  };
}

async function canUsePlanner(userClient: any, userId: string, tenant: any) {
  const organizationId = clean(tenant?.organizationId, 80);
  if (organizationId) {
    const { data: canManage, error } = await userClient.rpc("organization_has_permission", {
      p_organization_id: organizationId,
      p_permission_code: "events.manage",
    });
    if (error) {
      console.error("host-ai-planner tenant permission", error);
      return false;
    }
    return canManage === true;
  }

  const { data: approved, error } = await userClient.rpc("is_approved_outing_host", { p_profile_id: userId });
  if (error) {
    console.error("host-ai-planner legacy permission", error);
    return false;
  }
  return approved === true;
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

  let message = "";
  let currentPlan: any = {};
  let tenant: any = {};
  let section = "";

  try {
    const body = await req.json();
    message = clean(body?.message, 3000);
    if (!message) return json({ error: "Tell the planner what you want to work on." }, 400);

    currentPlan = body?.plan && typeof body.plan === "object" ? body.plan : {};
    tenant = body?.tenant && typeof body.tenant === "object" ? body.tenant : {};
    section = clean(body?.section, 80);
    const history = Array.isArray(body?.history) ? body.history.slice(-16) : [];
    const preferences = body?.preferences ?? {};
    const action = clean(body?.action, 40);
    const mode = clean(body?.mode, 40);

    const allowed = await canUsePlanner(userClient, userId, tenant);
    if (!allowed) return json({ error: "Event planning permission required." }, 403);

    if (!openAiKey) return json(fallback(message, currentPlan, section));

    const source = JSON.stringify({
      message,
      currentPlan,
      history,
      section,
      action,
      mode,
      tenant: {
        organizationId: clean(tenant?.organizationId, 80),
        organizationName: clean(tenant?.organizationName, 160),
        organizationKind: clean(tenant?.organizationKind, 80),
        eventCategories: Array.isArray(tenant?.eventCategories) ? tenant.eventCategories.slice(0, 20) : [],
        venueTypes: Array.isArray(tenant?.venueTypes) ? tenant.venueTypes.slice(0, 20) : [],
        attendeeLabel: clean(tenant?.attendeeLabel, 60),
        brandVoice: clean(tenant?.brandVoice, 240),
        sections: Array.isArray(tenant?.sections) ? tenant.sections.slice(0, 20) : [],
      },
      privacy: {
        personalMemory: Boolean(preferences.personal_memory_enabled),
        eventHistoryLearning: Boolean(preferences.event_history_learning_enabled),
        organizationMemory: Boolean(preferences.organization_memory_enabled),
        saveConversations: Boolean(preferences.save_conversations_enabled),
        analytics: Boolean(preferences.product_analytics_enabled),
      },
    });

    const instructions = `You are the reasoning layer for an event-planning workspace inside a multi-organization platform.

You are a planner, not a form wizard. Understand what the host means even when their wording does not match a predefined pathway. Answer the host's question directly, reason from the event context, and build the structured plan in the same turn when their message contains useful decisions.

Do not require the host to use exact phrases. A host may describe a movie night, rooftop mixer, listening party, vendor activation, retreat, dinner, launch, training, field day, screening, cruise, festival, or a completely new event concept. Preserve their concept and title. If the tenant category list does not contain an exact category, use the closest appropriate category or "Other" without replacing the host's event identity.

Extract multiple facts from one message. Preserve confirmed details unless the host clearly changes them. A later explicit decision overrides an earlier one. Distinguish advice from confirmed facts. Do not silently turn a suggestion into a confirmed event detail.

The current section is context, not a prison. If the host is in Marketing and says "Through Facebook", treat that as a marketing detail. If they interrupt with "Actually make it 150 people", update attendance and continue naturally.

Answer open-ended planning questions with useful reasoning. Examples include comparing venue formats, deciding what kind of space fits the event, thinking through staffing, guest flow, pricing strategy, promotion, vendor needs, or whether a proposed idea makes operational sense. Do not answer only questions that match examples in code.

Do not force every response to end in a question. Sometimes the best response is an answer, a recommendation, a short summary of what changed, or a few next actions.

Build the plan as you answer. Use components for applicable planning systems. Use requirements for concise operational decisions or constraints that do not have a dedicated field. Use sectionUpdates for useful section-specific notes. Do not stuff casual conversation into the plan.

Use action="venue_search" only when the host explicitly asks to find, search for, show, or recommend real places. Use action="venue_refine" when they are refining an existing venue search. Put the search intent in venueRefinement. Never invent real venues, availability, prices, capacity, parking, permits, booking terms, or external facts. The app will call the venue discovery tool when you request it.

Use action="review" when the host asks to review the plan. Use action="create_workspace" only when the host explicitly asks to create the event or workspace. The client will still validate required fields and permissions.

Treat dates, money, capacity, permissions, publishing, and destructive changes as structured facts that the client validates. You can extract them, but do not claim an event is created, saved, published, booked, paid, or sent unless the app confirms that action.

Never claim a planning draft is saved. The client owns persistence status.

Never assume this tenant is an outdoor, nature, camping, recreation, Black-centered, community, or Go Melanated organization unless the supplied tenant or current event says so. Do not leak terminology or assumptions from another tenant.

Respect privacy toggles. Do not infer from historical personalization when the corresponding privacy setting is off.

Return the full updated plan every turn. For unknown scalar fields, preserve the supplied current value. If a boolean such as paid is unknown, keep the current value rather than inventing one. Keep external recommendations clearly marked with needsVerification=true.`;

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: [{ role: "user", content: [{ type: "input_text", text: source }] }],
        text: {
          format: {
            type: "json_schema",
            name: "host_ai_planner_fluid_turn",
            strict: true,
            schema: schema(),
          },
        },
      }),
    });

    const payload = await upstream.json();
    if (!upstream.ok) {
      console.error("host-ai-planner upstream", payload);
      return json(fallback(message, currentPlan, section));
    }

    const text = outputText(payload);
    if (!text) return json(fallback(message, currentPlan, section));

    try {
      return json(JSON.parse(text));
    } catch (parseError) {
      console.error("host-ai-planner parse", parseError);
      return json(fallback(message, currentPlan, section));
    }
  } catch (error) {
    console.error("host-ai-planner", error);
    if (message) return json(fallback(message, currentPlan, section));
    return json({ error: "Unable to start AI planning." }, 500);
  }
});
