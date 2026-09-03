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
    components: Array.isArray(current?.components) ? current.components : [],
    requirements: Array.isArray(current?.requirements) ? current.requirements : [],
    safetyNotes: Array.isArray(current?.safetyNotes) ? current.safetyNotes : [],
    backupPlan: current?.backupPlan || "",
  };
  const lower = message.toLowerCase();
  if (!plan.title && lower.includes("kayak")) {
    plan.title = "St. Johns Social Paddle";
    plan.category = "Paddling";
    plan.summary = "A relaxed group paddle on the St. Johns River.";
    plan.components = ["venue","safety","equipment","tickets","communications","team"];
  }
  const gaps = [
    !plan.venueName ? "Launch or venue" : "",
    !plan.startsAt ? "Date and start time" : "",
    !plan.endsAt ? "End time" : "",
    !plan.capacity ? "Expected attendance" : "",
    !plan.meetingInstructions ? "Arrival instructions" : "",
  ].filter(Boolean);
  const readiness = Math.max(10, Math.min(95, 100 - gaps.length * 14));
  return {
    message: !plan.venueName ? "Do you already have a launch or venue in mind, or should I recommend options?" : !plan.startsAt ? "What date are you considering? I can help recommend a start time after that." : !plan.capacity ? "About how many people are you planning for?" : "The core plan is taking shape. Tell me what you want to handle next, or ask me to finish the remaining setup.",
    plan,
    readiness,
    stage: readiness >= 95 ? "ready" : readiness >= 75 ? "confidence" : readiness >= 35 ? "momentum" : "possibility",
    gaps,
    options: !plan.venueName ? ["Recommend locations","I know the location","Skip for now"] : !plan.startsAt ? ["This weekend","Next weekend","I have a date"] : ["Continue","Show my plan","Finish what you can"],
    recommendation: null,
    taskPacks: lower.includes("kayak") || plan.category === "Paddling" ? ["safety","waivers","equipment","communications","marketing","event_day"] : ["communications","marketing","event_day"],
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

  try {
    const body = await req.json();
    const message = clean(body?.message, 2500);
    if (!message) return json({ error: "Tell the planner what you want to work on." }, 400);
    const currentPlan = body?.plan && typeof body.plan === "object" ? body.plan : {};
    const history = Array.isArray(body?.history) ? body.history.slice(-16) : [];
    const preferences = body?.preferences ?? {};

    if (!openAiKey) return json(fallback(message, currentPlan));

    const source = JSON.stringify({ message, currentPlan, history, privacy: {
      personalMemory: Boolean(preferences.personal_memory_enabled),
      eventHistoryLearning: Boolean(preferences.event_history_learning_enabled),
      organizationMemory: Boolean(preferences.organization_memory_enabled),
      saveConversations: Boolean(preferences.save_conversations_enabled),
      analytics: Boolean(preferences.product_analytics_enabled),
    }});

    const instructions = `You are the Go Melanated Host Center AI Event Planner. You guide an event host from a rough idea to a 95-100% ready operational plan through a conversation. Ask one strong question at a time. Do not behave like a giant form. Recommend answers when useful, and offer options such as Recommend for me, I don't know, or Skip for now. Preserve confirmed information. Never invent a business, venue rule, price, permit, weather condition, safety fact, or availability. If a recommendation depends on changing or external facts, set needsVerification=true and explain the reason briefly. Separate facts from recommendations. Use the host's language where practical. Keep responses concise and operational. For emotional design, use stage language: possibility means the idea is taking shape, momentum means essentials are coming together, confidence means almost ready to host, ready means 95% or more with no publishing blockers. Readiness must reflect actual completeness, not optimism. Required basics are title, category, date/start/end, venue or meeting point, city/state, attendance, admission model, arrival instructions, safety/backup needs appropriate to the event, communications, and task packs. For paddling/water events, automatically consider safety, waivers, equipment, weather/condition backup, lead/sweep roles and communications. For food, add food tasks. For vendors add vendor tasks. For paid/public events consider marketing. The user must remain in control. Optional personal memory and analytics are OFF unless the privacy object says otherwise. Do not use or imply historical personalization when its toggle is off. Return the full updated plan every turn.`;

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
    return json(JSON.parse(text));
  } catch (error) {
    console.error("host-ai-planner", error);
    return json({ error: error instanceof Error ? error.message : "Unable to continue AI planning." }, 500);
  }
});
