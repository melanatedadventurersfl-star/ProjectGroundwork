import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const jsonHeaders = { "Content-Type": "application/json" };
const DEFER_ATTENDANCE = "__planner_defer_attendance__";
const DEFER_DATE = "__planner_defer_date__";
const DEFER_VENUE = "__planner_defer_venue__";
const DEFER_ARRIVAL = "__planner_defer_arrival__";

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

function fallback(message: string, current: any) {
  const plan = {
    title: current?.title || "",
    summary: current?.summary || "",
    description: current?.description || "",
    category: current?.category || "Social",
    difficulty: current?.difficulty || "easy",
    startsAt: current?.startsAt || "",
    endsAt: current?.endsAt || "",
    venueName: current?.venueName || "",
    city: current?.city || "",
    state: current?.state || "FL",
    capacity: Number(current?.capacity || 0),
    meetingInstructions: current?.meetingInstructions || "",
    paid: Boolean(current?.paid),
    priceCents: Number(current?.priceCents || 0),
    components: Array.isArray(current?.components) ? [...current.components] : [],
    requirements: Array.isArray(current?.requirements) ? [...current.requirements] : [],
    safetyNotes: Array.isArray(current?.safetyNotes) ? [...current.safetyNotes] : [],
    backupPlan: current?.backupPlan || "",
  };

  const lower = message.toLowerCase().trim();
  const addMarker = (marker: string) => { plan.requirements = unique([...plan.requirements, marker]); };
  const hasMarker = (marker: string) => plan.requirements.includes(marker);

  if (!plan.city && lower.includes("jacksonville")) plan.city = "Jacksonville";
  if (!plan.city && lower.includes("ocala")) plan.city = "Ocala";

  if (!plan.title && (lower.includes("nature walk") || lower.includes("nature hike") || lower.includes("hike"))) {
    plan.title = plan.city ? `Nature Walk in ${plan.city}` : "Nature Walk";
    plan.category = "Hiking";
    plan.summary = plan.city ? `A group nature walk in ${plan.city}.` : "A group nature walk.";
    plan.description = plan.summary;
    plan.components = ["venue","schedule","activities","safety","communications","team"];
  } else if (!plan.title && (lower.includes("kayak") || lower.includes("paddle") || lower.includes("canoe"))) {
    plan.title = plan.city ? `${plan.city} Social Paddle` : "Social Paddle";
    plan.category = "Paddling";
    plan.summary = plan.city ? `A relaxed group paddle near ${plan.city}.` : "A relaxed group paddle.";
    plan.description = plan.summary;
    plan.components = ["venue","safety","equipment","tickets","communications","team"];
  } else if (!plan.title && (lower.includes("camping") || lower.includes("campout") || lower.includes("camp out"))) {
    plan.title = plan.city ? `Camping Trip in ${plan.city}` : "Camping Trip";
    plan.category = "Camping";
    plan.summary = plan.city ? `A group camping trip near ${plan.city}.` : "A group camping trip.";
    plan.description = plan.summary;
    plan.components = ["venue","schedule","activities","food","equipment","safety","communications","team"];
  }

  const capacityMatch = lower.match(/\b(\d{1,4})\s*(people|guests|attendees|persons)?\b/);
  if (!plan.capacity && capacityMatch) plan.capacity = Number(capacityMatch[1]);
  if (!plan.capacity && lower.includes("10 or fewer")) plan.capacity = 10;
  if (!plan.capacity && (lower.includes("10–25") || lower.includes("10-25"))) plan.capacity = 25;
  if (!plan.capacity && (lower.includes("25–50") || lower.includes("25-50"))) plan.capacity = 50;
  if (!plan.capacity && lower.includes("50+")) plan.capacity = 60;

  if (lower === "not sure yet" && plan.title && !plan.capacity) addMarker(DEFER_ATTENDANCE);
  else if ((lower === "not sure yet" || lower === "this weekend" || lower === "next weekend") && !plan.startsAt) addMarker(DEFER_DATE);
  else if (lower === "skip for now" && !plan.venueName) addMarker(DEFER_VENUE);
  else if (lower === "skip for now" && !plan.meetingInstructions) addMarker(DEFER_ARRIVAL);

  const gaps = [
    !plan.title ? "Event idea or title" : "",
    !plan.capacity ? "Expected attendance" : "",
    !plan.startsAt ? "Date and start time" : "",
    !plan.endsAt ? "End time" : "",
    !plan.city ? "City" : "",
    !plan.venueName ? "Venue or meeting point" : "",
    !plan.meetingInstructions ? "Arrival instructions" : "",
  ].filter(Boolean);

  const readiness = Math.max(10, Math.min(95, 100 - gaps.length * 12));
  let nextMessage = "Tell me a little more about the event you want to host.";
  let options = ["Nature walk", "Camping trip", "Social meetup"];

  if (plan.title && !plan.capacity && !hasMarker(DEFER_ATTENDANCE)) {
    nextMessage = `${plan.title} is taking shape${plan.city ? ` in ${plan.city}` : ""}. About how many people are you planning for?`;
    options = ["10 or fewer", "10–25", "25–50", "50+", "Not sure yet"];
  } else if (!plan.startsAt && !hasMarker(DEFER_DATE)) {
    nextMessage = "What date are you considering? You can give me an exact date, choose a weekend, or leave it open for now.";
    options = ["This weekend", "Next weekend", "I have a date", "Not sure yet"];
  } else if (!plan.venueName && !hasMarker(DEFER_VENUE)) {
    nextMessage = lower === "this weekend" || lower === "next weekend"
      ? `${message.trim()} noted. We can lock the exact day and time later. Do you already have a venue or meeting point, or should I recommend options?`
      : "Do you already have a venue or meeting point, or should I recommend options?";
    options = ["Recommend locations", "I know the location", "Skip for now"];
  } else if (!plan.meetingInstructions && !hasMarker(DEFER_ARRIVAL)) {
    nextMessage = "What should guests know about arrival or check-in?";
    options = ["Recommend for me", "I’ll add instructions", "Skip for now"];
  } else if (!plan.startsAt) {
    nextMessage = "We can keep planning with the exact date open. What do you want to work on next?";
    options = ["Location", "Tickets", "Activities", "Safety", "Set date"];
  } else {
    nextMessage = "The core plan is taking shape. What do you want to work on next?";
    options = ["Tickets", "Activities", "Safety", "Communications", "Review plan"];
  }

  return {
    message: nextMessage,
    plan,
    readiness,
    stage: readiness >= 95 ? "ready" : readiness >= 75 ? "confidence" : readiness >= 35 ? "momentum" : "possibility",
    gaps,
    options,
    recommendation: null,
    taskPacks: plan.category === "Paddling" ? ["safety","waivers","equipment","communications","marketing","event_day"] : plan.category === "Camping" ? ["food","safety","equipment","communications","marketing","event_day"] : ["safety","communications","marketing","event_day"],
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

  try {
    const body = await req.json();
    message = clean(body?.message, 2500);
    if (!message) return json({ error: "Tell the planner what you want to work on." }, 400);
    currentPlan = body?.plan && typeof body.plan === "object" ? body.plan : {};
    const history = Array.isArray(body?.history) ? body.history.slice(-16) : [];
    const preferences = body?.preferences ?? {};
    const lower = message.toLowerCase().trim();

    if (!openAiKey || ["not sure yet", "this weekend", "next weekend", "skip for now"].includes(lower)) {
      return json(fallback(message, currentPlan));
    }

    const source = JSON.stringify({ message, currentPlan, history, privacy: {
      personalMemory: Boolean(preferences.personal_memory_enabled),
      eventHistoryLearning: Boolean(preferences.event_history_learning_enabled),
      organizationMemory: Boolean(preferences.organization_memory_enabled),
      saveConversations: Boolean(preferences.save_conversations_enabled),
      analytics: Boolean(preferences.product_analytics_enabled),
    }});

    const instructions = `You are the Go Melanated Host Center AI Event Planner. Turn a rough event idea into a usable draft through conversation. Ask one strong question at a time. Do not behave like a giant form. When the host gives a simple idea such as "a nature walk in Jacksonville," immediately infer the event type, city and sensible working title, preserve those details, then ask the next most useful question. If the host says Not sure yet, Skip for now, This weekend, or Next weekend, acknowledge it and move to a different planning topic instead of repeating the same question. Do not invent an exact date or time from a broad weekend answer. Preserve any requirement value beginning __planner_ exactly and never mention those internal values to the user. Recommend answers when useful. Preserve confirmed information. Never invent a business, venue rule, price, permit, weather condition, safety fact, or availability. If a recommendation depends on changing or external facts, set needsVerification=true and explain the reason briefly. Separate facts from recommendations. Keep responses concise and operational. Readiness measures planning completeness. It must not block saving a draft. A publish-ready plan needs title, category, date/start/end, venue or meeting point, city/state, attendance, admission model, arrival instructions, safety/backup needs appropriate to the event, communications and task packs. For paddling/water events, automatically consider safety, waivers, equipment, weather/condition backup, lead/sweep roles and communications. For food, add food tasks. For vendors add vendor tasks. For paid/public events consider marketing. The user must remain in control. Optional personal memory and analytics are OFF unless the privacy object says otherwise. Do not use or imply historical personalization when its toggle is off. Return the full updated plan every turn.`;

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
      return json(fallback(message, currentPlan));
    }
    const text = outputText(payload);
    if (!text) return json(fallback(message, currentPlan));

    try {
      return json(JSON.parse(text));
    } catch (parseError) {
      console.error("host-ai-planner parse", parseError);
      return json(fallback(message, currentPlan));
    }
  } catch (error) {
    console.error("host-ai-planner", error);
    if (message) return json(fallback(message, currentPlan));
    return json({ error: "Unable to start AI planning." }, 500);
  }
});
