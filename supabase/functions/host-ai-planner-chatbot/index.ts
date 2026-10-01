import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const CONFIGURED_MODEL = (Deno.env.get("HOST_AI_PLANNER_MODEL") || "").trim();
const DEFAULT_MODEL = "gpt-4.1-mini";
const MODEL_CANDIDATES = [...new Set([CONFIGURED_MODEL, DEFAULT_MODEL, "gpt-4.1"].filter(Boolean))];
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

const patchFields = [
  "title",
  "summary",
  "description",
  "category",
  "difficulty",
  "plannerDate",
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
  "backupPlan",
  "virtualEvent",
  "hybridEvent",
  "visibility",
  "venueSearchRefinement",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function list(value: unknown, max = 30) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item, 1000)).filter(Boolean).slice(0, max);
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "message",
      "patches",
      "options",
      "recommendation",
      "action",
      "activeSection",
      "venueRefinement",
      "componentsToAdd",
      "componentsToRemove",
      "requirementsToAdd",
      "requirementsToRemove",
      "safetyNotesToAdd",
      "safetyNotesToRemove",
      "sectionUpdates",
      "affectedSections",
    ],
    properties: {
      message: { type: "string" },
      patches: {
        type: "array",
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "operation", "value", "status", "reason"],
          properties: {
            field: { type: "string", enum: patchFields },
            operation: { type: "string", enum: ["set", "clear"] },
            value: { type: "string" },
            status: { type: "string", enum: ["confirmed", "tentative", "suggested", "unknown", "deferred"] },
            reason: { type: "string" },
          },
        },
      },
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
      action: { type: "string", enum: ["continue", "venue_search", "venue_refine", "review", "create_workspace"] },
      activeSection: {
        anyOf: [
          { type: "null" },
          { type: "string", enum: plannerSections },
        ],
      },
      venueRefinement: { type: "string" },
      componentsToAdd: { type: "array", items: { type: "string" }, maxItems: 20 },
      componentsToRemove: { type: "array", items: { type: "string" }, maxItems: 20 },
      requirementsToAdd: { type: "array", items: { type: "string" }, maxItems: 30 },
      requirementsToRemove: { type: "array", items: { type: "string" }, maxItems: 30 },
      safetyNotesToAdd: { type: "array", items: { type: "string" }, maxItems: 30 },
      safetyNotesToRemove: { type: "array", items: { type: "string" }, maxItems: 30 },
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
      affectedSections: { type: "array", items: { type: "string", enum: plannerSections }, maxItems: 12 },
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

function failureCode(payload: any, status: number) {
  const code = clean(payload?.error?.code || payload?.error?.type, 80);
  return code ? `HTTP ${status} ${code}` : `HTTP ${status}`;
}

function fallback(message: string, section: string, reason: string, attemptedModels = MODEL_CANDIDATES) {
  return {
    engine: "fallback",
    model: attemptedModels.at(-1) || DEFAULT_MODEL,
    message: message
      ? "The AI planner did not answer this turn. I kept your event plan unchanged instead of guessing. Try that message again."
      : "Tell me what you want to plan.",
    patches: [],
    options: ["Try again", "Review plan"],
    recommendation: null,
    action: "continue",
    activeSection: plannerSections.includes(section) ? section : null,
    venueRefinement: "",
    componentsToAdd: [],
    componentsToRemove: [],
    requirementsToAdd: [],
    requirementsToRemove: [],
    safetyNotesToAdd: [],
    safetyNotesToRemove: [],
    sectionUpdates: [],
    affectedSections: [],
    debugReason: reason,
    attemptedModels,
  };
}

async function callPlannerModel(openAiKey: string, instructions: string, source: string) {
  const failures: string[] = [];

  for (const model of MODEL_CANDIDATES) {
    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions,
          input: [{ role: "user", content: [{ type: "input_text", text: source }] }],
          text: {
            format: {
              type: "json_schema",
              name: "event_planner_chatbot_turn",
              strict: true,
              schema: responseSchema(),
            },
          },
        }),
      });

      let payload: any = null;
      try {
        payload = await upstream.json();
      } catch (parseError) {
        console.error("host-ai-planner-chatbot upstream json", model, parseError);
      }

      if (!upstream.ok) {
        const reason = failureCode(payload, upstream.status);
        failures.push(`${model}: ${reason}`);
        console.error("host-ai-planner-chatbot upstream", model, reason, payload);
        continue;
      }

      const text = outputText(payload);
      if (!text) {
        failures.push(`${model}: no output text`);
        console.error("host-ai-planner-chatbot no output", model, payload);
        continue;
      }

      try {
        return { parsed: JSON.parse(text), model, failures };
      } catch (parseError) {
        failures.push(`${model}: output parse failure`);
        console.error("host-ai-planner-chatbot parse", model, parseError);
      }
    } catch (requestError) {
      failures.push(`${model}: request failure`);
      console.error("host-ai-planner-chatbot request", model, requestError);
    }
  }

  return { parsed: null, model: "", failures };
}

async function canUsePlanner(userClient: any, userId: string, tenant: any) {
  const organizationId = clean(tenant?.organizationId, 80);
  if (organizationId) {
    const { data: canManage, error } = await userClient.rpc("organization_has_permission", {
      p_organization_id: organizationId,
      p_permission_code: "events.manage",
    });
    if (error) {
      console.error("host-ai-planner-chatbot tenant permission", error);
      return false;
    }
    return canManage === true;
  }

  const { data: approved, error } = await userClient.rpc("is_approved_outing_host", { p_profile_id: userId });
  if (error) {
    console.error("host-ai-planner-chatbot legacy permission", error);
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

  let message = "";
  let section = "";

  try {
    const body = await req.json();
    message = clean(body?.message, 4000);
    section = clean(body?.section, 80);
    if (!message) return json({ error: "Tell the planner what you want to work on." }, 400);

    const plan = body?.plan && typeof body.plan === "object" ? body.plan : {};
    const tenant = body?.tenant && typeof body.tenant === "object" ? body.tenant : {};
    const history = Array.isArray(body?.history) ? body.history.slice(-20) : [];
    const preferences = body?.preferences ?? {};
    const runtime = body?.runtime && typeof body.runtime === "object" ? body.runtime : {};
    const action = clean(body?.action, 60) || "continue";

    const allowed = await canUsePlanner(userClient, userData.user.id, tenant);
    if (!allowed) return json({ error: "Event planning permission required." }, 403);
    if (!openAiKey) return json(fallback(message, section, "OPENAI_API_KEY is missing"));

    const source = JSON.stringify({
      userMessage: message,
      currentPlan: plan,
      activeSection: section || null,
      requestedAction: action,
      recentConversation: history,
      runtime: {
        nowIso: clean(runtime?.nowIso, 80),
        localDate: clean(runtime?.localDate, 40),
        localTime: clean(runtime?.localTime, 40),
        timeZone: clean(runtime?.timeZone, 100),
        locale: clean(runtime?.locale, 40),
      },
      tenant: {
        organizationId: clean(tenant?.organizationId, 80),
        organizationName: clean(tenant?.organizationName, 160),
        organizationKind: clean(tenant?.organizationKind, 80),
        eventCategories: list(tenant?.eventCategories, 30),
        venueTypes: list(tenant?.venueTypes, 30),
        attendeeLabel: clean(tenant?.attendeeLabel, 80),
        brandVoice: clean(tenant?.brandVoice, 400),
        sections: list(tenant?.sections, 20),
      },
      privacy: {
        personalMemory: Boolean(preferences.personal_memory_enabled),
        eventHistoryLearning: Boolean(preferences.event_history_learning_enabled),
        organizationMemory: Boolean(preferences.organization_memory_enabled),
        saveConversations: Boolean(preferences.save_conversations_enabled),
        analytics: Boolean(preferences.product_analytics_enabled),
      },
    });

    const instructions = `You are the primary conversational intelligence for an event-planning application. You are the first interpreter of normal user messages. Do not behave like a form wizard and do not wait for exact keywords.

Your job on every turn is to do three things together when useful: understand what the host means, answer them naturally, and return structured patches for event facts that changed.

RUNTIME AND RELATIVE TIME
The runtime object is authoritative. Use runtime.localDate, runtime.localTime, and runtime.timeZone to resolve relative language such as tomorrow, tonight, this Saturday, next Friday, two weeks from now, after work, or next month. Never ask for a date the host already supplied in relative language.
If the host says only a date such as "tomorrow", set plannerDate to YYYY-MM-DD and do not invent a start time. If the conversation already contains a date and the host then says "6 to 9", set startsAt and endsAt as local wall-time ISO strings such as 2026-09-16T18:00:00 and 2026-09-16T21:00:00. If the host gives a date and time together, set plannerDate, startsAt, and endsAt when available.

CONVERSATION
Read recentConversation before responding. A short reply is usually an answer to the last assistant question. For example, if the assistant asked for date and time and the host says "Tomorrow", acknowledge the resolved calendar date and ask only for the missing time. Do not repeat the same question.
Answer open-ended planning questions directly. The host can ask for judgment, comparisons, ideas, tradeoffs, pricing strategy, staffing, guest flow, promotion, vendors, safety, venue types, or what you would recommend. Give useful reasoning even if no structured field changes.
Do not force every answer to end with a question. Ask at most one highest-value follow-up when a decision is genuinely needed.

EVENT IDENTITY
Preserve the host's event concept. If they say "movie night", the title should remain Movie Night unless they choose another title. Never turn a movie night into Networking Event because a category list lacks an exact match. Pick the closest tenant category or Other, while preserving the title.
Extract multiple facts from one message. "Movie night tomorrow for maybe 30 people" should produce title=Movie Night, an appropriate category, plannerDate resolved from runtime, and capacity=30 tentative.

PATCHES
Return only facts changed, confirmed, corrected, cleared, or newly inferred from the current turn. Do not return a full replacement plan.
Use operation=set when applying a value. Use operation=clear when the host explicitly retracts a value or a new decision invalidates it. For clear, value must be an empty string.
Use status=confirmed for direct host facts, tentative for language such as maybe/about/around/thinking, suggested for your recommendation, deferred when the host intentionally leaves something open, and unknown only when clearing an invalidated value.
Dates must use YYYY-MM-DD. Date-times must use YYYY-MM-DDTHH:mm:ss in the host's local wall time unless the user explicitly supplied an offset.
For priceCents return integer cents as a string, for example 3500. For paid and virtual/hybrid booleans return "true" or "false". For capacity return a whole number as a string.

CONSEQUENCES
When a change means other planning areas should be reconsidered, put those section names in affectedSections. Example: increasing attendance from 20 to 150 can affect venue, staffing, finance, registration, safety, and guests. Changing venue can affect guests and staffing. Do not mark unrelated sections.
Use sectionUpdates for useful planning notes that belong to a section but are not a dedicated field. Use componentsToAdd and componentsToRemove for operational systems such as marketing, communications, finance, vendors, team, safety, food, equipment, or tickets.

TOOLS AND EXTERNAL FACTS
Use action=venue_search only when the host explicitly asks to find, search, show, or recommend real places. Use action=venue_refine when they refine a prior venue search. Put the search intent in venueRefinement. Do not invent real venue names, availability, capacity, prices, parking, hours, permits, or booking terms. The app performs the real venue lookup.
If the host asks what kind of venue would fit, answer with venue types and tradeoffs. Do not trigger a real venue search unless they ask for actual places.
Use action=review only when they ask to review the plan. Use action=create_workspace only when they clearly ask to create the event/workspace. The app validates and performs those actions.
Never claim an event, draft, venue, payment, message, publication, or booking was saved, created, sent, published, paid, or booked. The client owns side effects and persistence status.

TENANT AND PRIVACY
Stay tenant-neutral. Never assume this organization is Go Melanated, an outdoor group, a Black-centered group, or any other tenant unless current tenant data says so. Respect the privacy flags and do not invent historical personalization.

QUALITY BAR
Behave like an experienced event coordinator in a chat conversation. Understand implications rather than matching phrases. Preserve prior confirmed facts unless the host changes them. If the user corrects something, replace the old decision and clear conflicting state when necessary. If you are uncertain whether a statement is a decision, keep it tentative instead of pretending it is confirmed.`;

    const result = await callPlannerModel(openAiKey, instructions, source);
    if (!result.parsed) {
      return json(fallback(message, section, result.failures.join(" | ") || "All model attempts failed"));
    }

    return json({
      ...result.parsed,
      engine: "ai",
      model: result.model,
      attemptedModels: MODEL_CANDIDATES,
      priorModelFailures: result.failures,
    });
  } catch (error) {
    console.error("host-ai-planner-chatbot", error);
    return json(fallback(message, section, "Unhandled chatbot error"));
  }
});