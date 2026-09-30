import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gpt-5.6-luna";
const TTS_MODEL = "gpt-4o-mini-tts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://melanatedadventurersfl-star.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const EVENTS = new Set(["session_started","warmup_started","stretch_started","warmup_completed","exercise_started","set_completed","exercise_feedback","cooldown_started","cooldown_completed","workout_completed","test","cue_pack","timeline_cue"]);
const STYLES = new Set(["balanced","direct","supportive","energetic","calm","technical"]);
const VIBES = new Set(["warm-familiar","gym-partner","southern-warmth","east-coast-direct","west-coast-smooth","soulful","neutral"]);
const FAST_DIALOGUE_EVENTS = new Set(["session_started","warmup_started","stretch_started","warmup_completed","exercise_started","cooldown_started","cooldown_completed","timeline_cue"]);
const FREQUENCIES = new Set(["minimal","normal","high"]);
const DETAILS = new Set(["short","standard","detailed"]);
const TALK_SPEEDS = new Set(["slow","normal","fast"]);
const NAME_USAGE = new Set(["never","occasional","often"]);
const FORM_CUES = new Set(["off","basic","detailed"]);
const PERFORMANCE_FEEDBACK = new Set(["off","session","history"]);
const MOTIVATION = new Set(["low","moderate","high"]);
const COUNTDOWN_MODES = new Set(["full","compact","beep","off"]);
const GUIDANCE = new Set(["simple","guided","detailed"]);
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
function vibeVoiceInstruction(vibe: string) {
  if (vibe === "gym-partner") return "Sound like a trusted workout partner: casual, rhythmic, confident, and familiar. Keep slang light and natural. Never force slang, imitate a racial identity, or exaggerate dialect.";
  if (vibe === "southern-warmth") return "Use a warm Southern U.S. conversational cadence. Keep it subtle, natural, grounded, and contemporary. Do not exaggerate the accent or turn it into a character.";
  if (vibe === "east-coast-direct") return "Use a brisk East Coast U.S. conversational rhythm. Sound direct, quick, confident, and familiar without becoming abrasive or caricatured.";
  if (vibe === "west-coast-smooth") return "Use a relaxed West Coast U.S. conversational cadence. Sound smooth, confident, and easygoing without sounding sleepy or performative.";
  if (vibe === "soulful") return "Use warm resonance and expressive, musical intonation while still speaking naturally. Keep it grounded and conversational, never theatrical or sung.";
  if (vibe === "neutral") return "Use a clear contemporary American coaching cadence with minimal regional coloring.";
  return "Use a warm, familiar, culturally natural American conversational cadence. Sound grounded, personable, and contemporary. Avoid forced slang, imitation, caricature, or exaggerated dialect.";
}
function vibeLanguageInstruction(vibe: string) {
  if (vibe === "gym-partner") return "Use casual workout-partner phrasing such as 'let's get it', 'lock in', or 'one more' only when it fits naturally. Do not force slang.";
  if (vibe === "southern-warmth") return "Keep wording warm, unhurried, and conversational. Do not write out a phonetic accent.";
  if (vibe === "east-coast-direct") return "Keep wording punchy, direct, and efficient.";
  if (vibe === "west-coast-smooth") return "Keep wording relaxed, confident, and conversational.";
  if (vibe === "soulful") return "Use warm, expressive wording with natural rhythm, without becoming poetic or theatrical.";
  if (vibe === "neutral") return "Use neutral contemporary coaching language.";
  return "Use warm, familiar conversational wording. Light natural phrases such as 'alright', 'let's get it', or 'you good' are fine when context fits. Never force AAVE, slang, or stereotypes.";
}
function voiceInstructions(style: string, talkSpeed: string, vibe: string) {
  const pace = talkSpeed === "slow" ? "Use a measured pace." : talkSpeed === "fast" ? "Keep the pace brisk and crisp." : "Use a natural conversational pace.";
  const delivery =
    style === "calm" ? "Speak like a calm, grounded personal trainer. Warm, steady, concise, never theatrical." :
    style === "energetic" ? "Speak like an energetic personal trainer. Upbeat and playful, never shouting or exaggerated." :
    style === "direct" ? "Speak like a direct personal trainer. Firm, efficient, concise, never insulting or aggressive." :
    style === "supportive" ? "Speak like a supportive personal trainer. Reassuring, warm, specific, and concise." :
    style === "technical" ? "Speak like a precise strength coach. Clear, instructional, concise, focused on useful technique." :
    "Speak like a confident personal trainer standing nearby. Conversational, warm, concise, lightly playful when appropriate.";
  return delivery + " " + vibeVoiceInstruction(vibe) + " " + pace;
}
function fallbackLine(event: string, context: any, vibe = "warm-familiar") {
  const name = firstName(context?.name);
  const who = name ? ` ${name}` : "";
  const routine = clean(context?.routineName, 90);
  const exercise = clean(context?.exercise?.name || context?.exerciseName, 90);
  const feedback = clean(context?.feedback, 30);
  const progression = context?.progression || {};
  const stage = context?.stage || {};
  const stageName = clean(stage?.name, 90);
  const stageTarget = clean(stage?.target, 80);
  const nextExercise = clean(context?.nextExercise?.name, 90);
  if (event === "timeline_cue") return clean(context?.line, 260);
  if (event === "session_started") {
    if (Number(context?.warmupCount) > 0) return `Alright${who}. Warm-up first, then ${Number(context?.exerciseCount) || 0} strength exercises.`;
    return `Alright${who}, you ready? ${routine ? routine + ". " : ""}Let's get started.`;
  }
  if (event === "warmup_started") return stageName ? `Warm-up first. ${stageName}. ${stageTarget}.` : "Warm-up first. Let's get moving.";
  if (event === "stretch_started") return stageName ? `${stageName}. ${stageTarget}.` : "Next stretch. Stay controlled.";
  if (event === "warmup_completed") return nextExercise ? `Warm-up complete. Next is ${nextExercise}.` : "Warm-up complete.";
  if (event === "exercise_started") {
    const lead =
      vibe === "gym-partner" ? "Alright, let's get it." :
      vibe === "east-coast-direct" ? "Lock in." :
      vibe === "west-coast-smooth" ? "Alright, you're up." :
      vibe === "southern-warmth" ? "Alright, let's get to it." :
      vibe === "soulful" ? "Alright, settle in. Let's work." :
      vibe === "neutral" ? "Next up." :
      "Alright, let's get into it.";
    return exercise ? `${lead} ${exercise}. Let's get set.` : `${lead} Next exercise.`;
  }
  if (event === "set_completed") return "Set complete. Take your rest.";
  if (event === "exercise_feedback") {
    if (feedback === "too-easy") return progression?.label ? `Looks like I'm taking it easy on you. ${clean(progression.label, 90)} next time.` : "We'll bump this up next time.";
    if (feedback === "too-hard") return "That was too much today. We'll back the next target down.";
    if (feedback === "hard") return "That made you work. We'll keep the next target controlled.";
    if (feedback === "form-off") return "Keep the target steady. Clean reps come first.";
    return "That target looks right. We'll build from there.";
  }
  if (event === "cooldown_started") return stageName ? `Strength work is done. Let's cool down with ${stageName}.` : "Strength work is done. Let's cool down.";
  if (event === "cooldown_completed") return "Cooldown complete. Review your workout before saving.";
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
    const vibe = VIBES.has(String(body?.vibe)) ? String(body.vibe) : "warm-familiar";
    const frequency = FREQUENCIES.has(String(body?.frequency)) ? String(body.frequency) : "normal";
    const voice = VOICES.has(String(body?.voice)) ? String(body.voice) : "cedar";
    const detail = DETAILS.has(String(body?.detail)) ? String(body.detail) : "short";
    const talkSpeed = TALK_SPEEDS.has(String(body?.talkSpeed)) ? String(body.talkSpeed) : "normal";
    const nameUsage = NAME_USAGE.has(String(body?.nameUsage)) ? String(body.nameUsage) : "occasional";
    const formCues = FORM_CUES.has(String(body?.formCues)) ? String(body.formCues) : "basic";
    const performanceFeedback = PERFORMANCE_FEEDBACK.has(String(body?.performanceFeedback)) ? String(body.performanceFeedback) : "session";
    const motivation = MOTIVATION.has(String(body?.motivation)) ? String(body.motivation) : "moderate";
    const countdownMode = COUNTDOWN_MODES.has(String(body?.countdownMode)) ? String(body.countdownMode) : "full";
    const warmupGuidance = GUIDANCE.has(String(body?.warmupGuidance)) ? String(body.warmupGuidance) : "guided";
    const cooldownGuidance = GUIDANCE.has(String(body?.cooldownGuidance)) ? String(body.cooldownGuidance) : "guided";
    const adaptiveCoach = body?.adaptiveCoach !== false;
    const context = body?.context && typeof body.context === "object" ? body.context : {};
    const fallback = fallbackLine(event, context, vibe);

    if (!openAiKey) return json({
      error: "AI voice is not configured on the Workout App server yet.",
      code: "ai_not_configured"
    }, 503);

    const speechSpeed = talkSpeed === "slow" ? 0.94 : talkSpeed === "fast" ? 1.12 : 1.03;

    if (event === "cue_pack") {
      const phrases: Record<string,string> = {
        three:"Three.", two:"Two.", one:"One.", go:"Go.", left_go:"Left side. Go.",
        switch:"Switch sides.", done:"Done.", next:"Next.", resume:"Resume.",
        paused:"Workout paused.", reset:"Timer reset."
      };
      const entries = await Promise.all(Object.entries(phrases).map(async ([key, line]) => {
        const speech = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
          body: JSON.stringify({ model: TTS_MODEL, voice, input: line, instructions: voiceInstructions(style, talkSpeed, vibe), response_format: "wav", speed: speechSpeed }),
        });
        if (!speech.ok) return [key, null] as const;
        const bytes = new Uint8Array(await speech.arrayBuffer());
        return [key, { line, audioBase64: toBase64(bytes), mimeType: "audio/wav" }] as const;
      }));
      const cues = Object.fromEntries(entries.filter(([,clip]) => clip));
      console.log("workout-coach cue pack ready", { voice, style, vibe, talkSpeed, count: Object.keys(cues).length });
      return json({ cues });
    }

    const safeContext = JSON.stringify({
      event,
      name: firstName(context?.name),
      routineName: clean(context?.routineName, 90),
      goal: clean(context?.goal, 50),
      phase: clean(context?.phase, 40),
      warmupCount: Number(context?.warmupCount) || 0,
      warmupMinutes: Number(context?.warmupMinutes) || 0,
      stage: context?.stage && typeof context.stage === "object" ? {
        phase: clean(context.stage.phase, 30),
        name: clean(context.stage.name, 90),
        target: clean(context.stage.target, 80),
        description: clean(context.stage.description, 180),
        cue: clean(context.stage.cue, 180),
        index: Number(context.stage.index) || 0,
        total: Number(context.stage.total) || 0,
      } : undefined,
      nextExercise: context?.nextExercise && typeof context.nextExercise === "object" ? {
        name: clean(context.nextExercise.name, 90),
        target: clean(context.nextExercise.target, 80),
      } : undefined,
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

    const maxWords = detail === "detailed" ? 42 : detail === "standard" ? 30 : 20;
    const nameRule = nameUsage === "never" ? "Do not say the user's name." : nameUsage === "often" ? "Use the user's first name naturally when it helps." : "Use the user's first name occasionally.";
    const formRule = formCues === "off" ? "Do not add form coaching." : formCues === "detailed" ? "When the supplied stage or exercise data supports it, include one precise form cue." : "Use brief form cues only when useful and supported by supplied data.";
    const performanceRule = performanceFeedback === "off" ? "Do not mention performance comparisons." : performanceFeedback === "history" ? "You may reference supplied performance history or progression data." : "Only reference performance from the current session unless explicit history data is supplied.";
    const motivationRule = motivation === "low" ? "Keep motivation restrained." : motivation === "high" ? "Use more energetic encouragement without shouting or empty praise." : "Use moderate encouragement.";
    const phaseRule = adaptiveCoach ? "Adapt delivery to the workout phase. Warm-up and cooldown should sound calmer than working sets, even with an energetic style." : "Keep the selected style consistent across phases.";
    const guidanceRule = `Warm-up guidance: ${warmupGuidance}. Cooldown guidance: ${cooldownGuidance}.`;
    const vibeRule = vibeLanguageInstruction(vibe);
    const instructions = `You are the GoWorkout voice coach. Produce one short spoken coaching line based only on the supplied workout event and data. The workout engine is authoritative. Never invent or change a weight, rep target, rest time, exercise, or progression. Never claim work the data does not show. ${nameRule} Keep the line under ${maxWords} words. No markdown, emoji, quotes, headings, or stage directions. Do not praise every action. ${formRule} ${performanceRule} ${motivationRule} ${phaseRule} ${guidanceRule} ${vibeRule} Light teasing is allowed for too-easy feedback only when the approved progression supports an increase. Never shame the user. Coach style: ${style}. Talk frequency preference: ${frequency}.`;

    let line = fallback;
    let source = "fallback";

    if (event === "test") {
      const name = nameUsage === "never" ? "" : firstName(context?.name);
      const voiceName = clean(context?.previewVoice || voice, 30);
      const lead =
        vibe === "gym-partner" ? "Let's get it." :
        vibe === "east-coast-direct" ? "Lock in." :
        vibe === "west-coast-smooth" ? "Alright, you're up." :
        vibe === "southern-warmth" ? "Let's get to work." :
        vibe === "soulful" ? "Settle in. Let's work." :
        vibe === "neutral" ? "Your coach is ready." :
        "Let's get into it.";
      line = `Alright${name ? ` ${name}` : ""}. This is ${voiceName}. ${lead} Three, two, one, go.`;
      source = "preview";
    }
    if (event !== "test" && !FAST_DIALOGUE_EVENTS.has(event)) {
    try {
      const dialogueStarted = Date.now();
      const upstream = await fetchWithTimeout("https://api.openai.com/v1/responses", {
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
      }, 2500);
      console.log("workout-coach dialogue timing", { event, ms: Date.now() - dialogueStarted, ok: upstream.ok });
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
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      console.warn("workout-coach dialogue fallback", { event, reason: timedOut ? "timeout" : String(error) });
    }
    }

    try {
      const speechStarted = Date.now();
      const speech = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({ model: TTS_MODEL, voice, input: line, instructions: voiceInstructions(style, talkSpeed, vibe), response_format: "wav", speed: speechSpeed }),
      });
      if (speech.ok) {
        const bytes = new Uint8Array(await speech.arrayBuffer());
        console.log("workout-coach audio ready", { event, voice, source, bytes: bytes.length, speechMs: Date.now() - speechStarted });
        return json({ line, source, audioBase64: toBase64(bytes), mimeType: "audio/wav" });
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