import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = { "Content-Type": "application/json" };
const MODEL = "gpt-4.1-mini";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function fallbackPlan(prompt: string, city: string, state: string) {
  const lower = prompt.toLowerCase();
  const category = lower.includes("hike") ? "Hiking" : lower.includes("camp") ? "Camping" : lower.includes("paddle") || lower.includes("kayak") ? "Paddling" : lower.includes("beach") ? "Beach" : lower.includes("bike") ? "Cycling" : "Social";
  const difficulty = lower.includes("challenging") || lower.includes("hard") ? "challenging" : lower.includes("moderate") ? "moderate" : "easy";
  const capacityMatch = lower.match(/(?:about|around|for)?\s*(\d{1,3})\s*(?:people|guests|members|attendees)/i);
  const capacity = capacityMatch ? Math.max(2, Math.min(100, Number(capacityMatch[1]))) : 12;
  return {
    title: category === "Social" ? "Community Outing" : `${category} Outing`,
    summary: "A community-led outing built from your idea. Review the details before publishing.",
    description: prompt.trim(),
    category,
    difficulty,
    startsAt: "",
    endsAt: "",
    city,
    state,
    venueName: "",
    capacity,
    meetingInstructions: "Add a precise meeting landmark, parking details, and an arrival window before publishing.",
    safetyNotes: ["Confirm current conditions and venue rules before the outing.", "Review the plan and use host judgment before publishing."],
    backupPlan: "Choose a nearby backup location or alternate activity if conditions change.",
    communityStops: [],
    confidenceNotes: ["AI generation was unavailable, so this is a structured planning starter."],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Function environment is incomplete." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const { data: approved, error: accessError } = await userClient.rpc("is_approved_outing_host", { p_profile_id: userId });
    if (accessError || approved !== true) return json({ error: "Approved host access is required." }, 403);

    const body = await req.json();
    const prompt = String(body?.prompt ?? "").trim().slice(0, 2000);
    const city = String(body?.city ?? "").trim().slice(0, 100);
    const state = String(body?.state ?? "FL").trim().toUpperCase().slice(0, 2);
    if (prompt.length < 10) return json({ error: "Tell the copilot a little more about the outing you want to host." }, 400);

    let placeQuery = adminClient
      .from("community_places")
      .select("id,name,category,description,address,city,state,website_url,ownership_tags,ownership_verification_status,community_endorsement_count")
      .eq("is_active", true)
      .eq("ownership_verification_status", "verified")
      .order("community_endorsement_count", { ascending: false })
      .limit(12);
    if (state) placeQuery = placeQuery.eq("state", state);
    if (city) placeQuery = placeQuery.ilike("city", city);
    const { data: verifiedPlaces } = await placeQuery;
    const places = verifiedPlaces ?? [];

    if (!openAiKey) return json({ plan: fallbackPlan(prompt, city, state), source: "fallback", verifiedPlacesUsed: 0 });

    const system = `You are Go Melanated Host Copilot. Turn a host's rough idea into a practical draft outing. Be concise, beginner-aware, operationally useful, and never claim an outing is safe. Hosts must verify conditions, closures, permits, accessibility, weather, and venue rules themselves.\n\nCOMMUNITY PRIORITY: When suitable VERIFIED community places are supplied, prefer Black- and brown-owned businesses and community-centered stops. Ownership is sensitive factual data. NEVER infer ownership from a name, photo, neighborhood, language, cuisine, or demographics. You may only describe a place as Black-owned, Latino-owned, Indigenous-owned, Asian-owned, brown-owned, or similar when that exact ownership tag appears in the supplied verified place records. If no verified records fit, do not invent any ownership claim.\n\nReturn only valid JSON matching the requested schema. Dates/times must be local values formatted YYYY-MM-DDTHH:MM. If the user's timing is ambiguous, leave startsAt/endsAt empty and explain in confidenceNotes rather than guessing. Today is ${new Date().toISOString().slice(0, 10)}.`;

    const user = JSON.stringify({ prompt, preferredCity: city || null, preferredState: state || null, verifiedCommunityPlaces: places });
    const schema = {
      name: "host_copilot_plan",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["title","summary","description","category","difficulty","startsAt","endsAt","city","state","venueName","capacity","meetingInstructions","safetyNotes","backupPlan","communityStops","confidenceNotes"],
        properties: {
          title: { type: "string" }, summary: { type: "string" }, description: { type: "string" },
          category: { type: "string", enum: ["Hiking","Camping","Paddling","Beach","Cycling","Social","Workshop","Volunteer","Other"] },
          difficulty: { type: "string", enum: ["easy","moderate","challenging"] },
          startsAt: { type: "string" }, endsAt: { type: "string" }, city: { type: "string" }, state: { type: "string" }, venueName: { type: "string" },
          capacity: { type: "integer", minimum: 2, maximum: 250 }, meetingInstructions: { type: "string" },
          safetyNotes: { type: "array", items: { type: "string" }, maxItems: 6 }, backupPlan: { type: "string" },
          communityStops: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["placeId","name","reason","ownershipTags"], properties: { placeId: { type: "string" }, name: { type: "string" }, reason: { type: "string" }, ownershipTags: { type: "array", items: { type: "string" } } } } },
          confidenceNotes: { type: "array", items: { type: "string" }, maxItems: 5 }
        }
      }
    };

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_schema", json_schema: schema } }),
    });
    const completion = await upstream.json();
    if (!upstream.ok) {
      console.error("host-copilot upstream", completion);
      return json({ plan: fallbackPlan(prompt, city, state), source: "fallback", verifiedPlacesUsed: places.length });
    }
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return json({ plan: fallbackPlan(prompt, city, state), source: "fallback", verifiedPlacesUsed: places.length });
    const plan = JSON.parse(content);
    const allowedPlaceIds = new Set(places.map((place: any) => String(place.id)));
    plan.communityStops = Array.isArray(plan.communityStops) ? plan.communityStops.filter((stop: any) => allowedPlaceIds.has(String(stop.placeId))) : [];
    return json({ plan, source: "ai", model: completion.model ?? MODEL, verifiedPlacesUsed: places.length });
  } catch (error) {
    console.error("host-copilot", error);
    return json({ error: "Unable to build the outing plan right now." }, 500);
  }
});
