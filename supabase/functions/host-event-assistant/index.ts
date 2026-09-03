import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: jsonHeaders }); }
function clean(value: unknown, max = 3000) { return String(value ?? "").trim().slice(0, max); }

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["message","alerts","recommendedActions"],
    properties: {
      message: { type: "string" },
      alerts: {
        type: "array", maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["severity","title","detail"],
          properties: {
            severity: { type: "string", enum: ["info","attention","critical"] },
            title: { type: "string" },
            detail: { type: "string" },
          },
        },
      },
      recommendedActions: {
        type: "array", maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["label","reason","impactAreas"],
          properties: {
            label: { type: "string" },
            reason: { type: "string" },
            impactAreas: { type: "array", maxItems: 8, items: { type: "string" } },
          },
        },
      },
    },
  };
}

function outputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text;
  return "";
}

function fallback(question: string, snapshot: any) {
  const openTasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks.filter((task: any) => task.status !== "complete") : [];
  const critical = openTasks.filter((task: any) => task.priority === "critical" || task.status === "blocked");
  return {
    message: critical.length ? `I found ${critical.length} high-priority item${critical.length === 1 ? "" : "s"} that should be reviewed first.` : openTasks.length ? `There are ${openTasks.length} open tasks. I can help you work through the next one or check how a change affects the plan.` : "No open task is currently flagged. Ask me about tickets, vendors, communications, schedule changes, or what to review next.",
    alerts: critical.slice(0, 4).map((task: any) => ({ severity: task.status === "blocked" ? "critical" : "attention", title: task.title, detail: task.blockedBy ? `Blocked by ${task.blockedBy}.` : task.dueAt ? `Due ${new Date(task.dueAt).toLocaleDateString()}.` : "Needs host review." })),
    recommendedActions: openTasks.slice(0, 3).map((task: any) => ({ label: `Review ${task.title}`, reason: `This ${task.category || "event"} task is still open.`, impactAreas: [task.category || "Work"] })),
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

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) return json({ error: "Authentication required" }, 401);

  try {
    const body = await req.json();
    const question = clean(body?.question, 2500);
    const snapshot = body?.snapshot && typeof body.snapshot === "object" ? body.snapshot : null;
    if (!question || !snapshot) return json({ error: "Event context and a question are required." }, 400);

    if (!openAiKey) return json(fallback(question, snapshot));

    const source = JSON.stringify({ question, snapshot, history: Array.isArray(body?.history) ? body.history.slice(-12) : [] });
    const instructions = `You are the Go Melanated Event Assistant for an event that already exists. Analyze only the supplied event snapshot and the host's question. Do not invent ticket counts, revenue, vendor status, rules, weather, availability, permits, or business details. If information is missing, say what needs verification. Your job is to protect the plan: identify blockers, overdue or risky work, downstream impacts of proposed changes, and the smallest useful next actions. If the host asks about changing date, attendance, venue, food, tickets, vendors, communications, or equipment, identify affected areas. Keep the answer concise. Never claim you changed data. You are advisory in this endpoint. External actions require explicit approval elsewhere.`;

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: [{ role: "user", content: [{ type: "input_text", text: source }] }],
        text: { format: { type: "json_schema", name: "host_event_assistant", strict: true, schema: schema() } },
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return json(fallback(question, snapshot));
    const text = outputText(payload);
    return json(text ? JSON.parse(text) : fallback(question, snapshot));
  } catch (error) {
    console.error("host-event-assistant", error);
    return json({ error: error instanceof Error ? error.message : "Unable to analyze this event." }, 500);
  }
});
