import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gpt-5.6-luna";
const TTS_MODEL = "gpt-4o-mini-tts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://melanatedadventurersfl-star.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const EVENTS = new Set(["session_started","exercise_started","set_completed","exercise_feedback","workout_completed","test"]);
const STYLES = new Set(["balanced","calm","hype","tough"]);
const FREQUENCIES = new Set(["minimal","normal","talkative"]);
const VOICES = new Set(["alloy","ash","ballad","coral","echo","fable","nova","onyx","sage","shimmer","verse","marin","cedar"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function clean(value: unknown, max = 180) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function firstName(value: unknown) {
  const name = clean(value, 80);
  if (!name || name.toLowerCase() === "there") return "";
  return name.split(/\s+/)[0];
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
function voiceInstructions(style: string) {
  if (style === "calm") return "Speak like a calm, grounded personal trainer. Warm, natural, steady, concise, never theatrical.";
  if (style === "hype") return "Speak like an energetic personal trainer. Upbeat and playful, but do not shout or sound exaggerated.";
  if (style === "tough") return "Speak like a direct, demanding personal trainer. Firm and concise, never insulting, shaming, or aggressive.";
  return "Speak like a confident personal trainer standing nearby. Conversational, warm, concise, lightly playful when appropriate.";
}
function fallbackLine(event: string, context: any) {
  const name = firstName(context?.name);
  const who = name ? ` ${name}` : "";
  const routine = clean(context?.routineName, 90);
  const exercise = clean(context?.exercise?.name || context?.exerciseName, 90);
  const feedback = clean(context?.feedback, 30);
  const progression = context?.progression || {};
  if (event === "session_started") return `Alright${who}, you ready? ${routine ? routine + ". " : ""}Let's get started.`;
  if (event === "exercise_started") return exercise ? `Next up, ${exercise}. Let's get set.` : "Next exercise. Let's get set.";
  if (event === "set_completed") return "Set complete. Take your rest.";
  if (event === "exercise_feedback") {
    if (feedback === "too-easy") return progression?.label ? `Looks like I'm taking it easy on you. ${clean(progression.label, 90)} next time.` : "Looks like I'm taking it easy on you. We'll bump this up next time.";
    if (feedback === "too-hard") return "That was too much today. We'll back the next target down.";
    if (feedback === "hard") return "That made you work. We'll keep the next target controlled.";
    if (feedback === "form-off") return "Keep the target steady. Clean reps come first.";
    return "That target looks right. We'll build from there.";
  }
  if (event === "workout_completed") return `That's it${who}. Workout complete.`;
  return `Alright${who}. Your AI coach is ready.`;
}
function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
async function authenticate(authHeader: string, supabaseUrl: string, anonKey: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
    const origin = req.headers.get("Origin") || corsHeaders["Access-Control-Allow-Origin"];
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": requestedHeaders || corsHeaders["Access-Control-Allow-Headers"],
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin, Access-Control-Request-Headers",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("voice_key") || Deno.env.get("VOICE_KEY") || "";
  if (!supabaseUrl || !anonKey) return json({ error: "Function environment is incomplete." }, 503);

  const user = await authenticate(authHeader, supabaseUrl, anonKey);
  if (!user) return json({ error: "Authentication required" }, 401);

  try {
    const body = await req.json();
    const event = EVENTS.has(String(body?.event)) ? String(body.event) : "";
    if (!event) return json({ error: "Unsupported coach event." }, 400);

    const style = STYLES.has(String(body?.style)) ? String(body.style) : "balanced";
    const frequency = FREQUENCIES.has(String(body?.frequency)) ? String(body.frequency) : "normal";
    const voice = VOICES.has(String(body?.voice)) ? String(body.voice) : "cedar";
    const context = body?.context && typeof body.context === "object" ? body.context : {};
    const fallback = fallbackLine(event, context);

    if (!openAiKey) return json({
      error: "AI voice is not configured on the Workout App server yet.",
      code: "ai_not_configured"
    }, 503);

    const safeContext = JSON.stringify({
      event,
      name: firstName(context?.name),
      routineName: clean(context?.routineName, 90),
      goal: clean(context?.goal, 50),
      exercise: context?.exercise && typeof context.exercise === "object" ? {
        name: clean(context.exercise.name, 90),
        setNumber: Number(context.exercise.setNumber) || undefined,
        totalSets: Number(context.exercise.totalSets) || undefined,
        weight: clean(context.exercise.weight, 20),
        reps: clean(context.exercise.reps, 20),
        target: clean(context.exercise.target, 80),
        loadMode: clean(context.exercise.loadMode, 30),
      } : undefined,
      feedback: clean(context?.feedback, 30),
      progression: context?.progression && typeof context.progression === "object" ? {
        label: clean(context.progression.label, 120),
        reason: clean(context.progression.reason, 280),
        weight: Number(context.progression.weight) || 0,
        reps: clean(context.progression.reps, 30),
        rest: Number(context.progression.rest) || 0,
      } : undefined,
      performanceInsight: clean(context?.performanceInsight, 240),
      completedSets: Number(context?.completedSets) || 0,
      exerciseCount: Number(context?.exerciseCount) || 0,
      durationMinutes: Number(context?.durationMinutes) || 0,
      newPRs: Array.isArray(context?.newPRs) ? context.newPRs.slice(0, 4).map((item: any) => ({
        name: clean(item?.name, 90), weight: Number(item?.weight) || 0, reps: Number(item?.reps) || 0,
      })) : [],
    });

    const instructions = `You are the GoWorkout voice coach. Produce one short spoken coaching line based only on the supplied workout event and data. The workout engine is authoritative. Never invent or change a weight, rep target, rest time, exercise, or progression. Never claim work the data does not show. Use the user's first name occasionally. Keep the line under 32 words. No markdown, emoji, quotes, headings, or stage directions. Do not praise every action. Light teasing is allowed for too-easy feedback only when the approved progression supports an increase. Never shame the user. Coach style: ${style}. Talk frequency preference: ${frequency}.`;

    let line = fallback;
    let source = "fallback";
    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: MODEL,
          reasoning: { effort: "none" },
          instructions,
          input: [{ role: "user", content: [{ type: "input_text", text: safeContext }] }],
          max_output_tokens: 100,
          text: { format: { type: "json_schema", name: "workout_coach_line", strict: true, schema: { type: "object", additionalProperties: false, required: ["line"], properties: { line: { type: "string" } } } } },
        }),
      });
      const payload = await upstream.json();
      if (upstream.ok) {
        const raw = outputText(payload);
        const generated = clean(raw ? JSON.parse(raw)?.line : "", 260);
        if (generated) { line = generated; source = "ai"; }
      } else {
        console.error("workout-coach dialogue upstream", payload);
        const code = clean(payload?.error?.code, 80);
        if (code === "credit_balance_exhausted" || code === "insufficient_quota") {
          return json({
            error: "OpenAI API credits are exhausted. Add API credits before testing AI Coach.",
            code: "ai_quota_exhausted"
          }, 402);
        }
      }
    } catch (error) {
      console.error("workout-coach dialogue", error);
    }

    try {
      const speech = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({ model: TTS_MODEL, voice, input: line, instructions: voiceInstructions(style), response_format: "mp3", speed: 1.03 }),
      });
      if (speech.ok) {
        const bytes = new Uint8Array(await speech.arrayBuffer());
        return json({ line, source, audioBase64: toBase64(bytes), mimeType: "audio/mpeg" });
      }
      const speechText = await speech.text();
      console.error("workout-coach speech upstream", speechText);
      if (speech.status === 429 || /credit_balance_exhausted|insufficient_quota|no credits remaining/i.test(speechText)) {
        return json({
          error: "OpenAI API credits are exhausted. Add API credits before testing AI Coach.",
          code: "ai_quota_exhausted"
        }, 402);
      }
    } catch (error) {
      console.error("workout-coach speech", error);
    }

    return json({ line, source, audioBase64: "", mimeType: "" });
  } catch (error) {
    console.error("workout-coach", error);
    return json({ error: error instanceof Error ? error.message : "Unable to generate coach audio." }, 500);
  }
});