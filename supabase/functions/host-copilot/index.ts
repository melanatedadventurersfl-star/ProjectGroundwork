import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = { "Content-Type": "application/json" };
const MODEL = "gpt-4.1-mini";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function inferCategory(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("conference") || lower.includes("summit")) return "Conference";
  if (lower.includes("workshop")) return "Workshop";
  if (lower.includes("class") || lower.includes("training")) return "Class";
  if (lower.includes("festival")) return "Festival";
  if (lower.includes("network") || lower.includes("mixer")) return "Networking";
  if (lower.includes("food") || lower.includes("dinner") || lower.includes("brunch")) return "Food";
  if (lower.includes("corporate") || lower.includes("company retreat")) return "Corporate";
  if (lower.includes("private") || lower.includes("birthday") || lower.includes("wedding")) return "Private";
  if (lower.includes("hike")) return "Hiking";
  if (lower.includes("camp")) return "Camping";
  if (lower.includes("paddle") || lower.includes("kayak")) return "Paddling";
  if (lower.includes("beach")) return "Beach";
  if (lower.includes("bike") || lower.includes("cycling")) return "Cycling";
  if (lower.includes("sport") || lower.includes("tournament") || lower.includes("game")) return "Sports";
  if (lower.includes("volunteer")) return "Volunteer";
  return "Other";
}

function fallbackPlan(prompt: string, city: string, state: string) {
  const lower = prompt.toLowerCase();
  const category = inferCategory(prompt);
  const difficulty = lower.includes("complex") || lower.includes("challenging") || lower.includes("hard") ? "challenging" : lower.includes("moderate") ? "moderate" : "easy";
  const capacityMatch = lower.match(/(?:about|around|for)?\s*(\d{1,4})\s*(?:people|guests|members|attendees)/i);
  const capacity = capacityMatch ? Math.max(2, Math.min(1000, Number(capacityMatch[1]))) : 25;
  return {
    title: `${category} Event`,
    summary: "A structured event starter built from your idea. Review every detail before publishing.",
    description: prompt.trim(),
    category,
    difficulty,
    startsAt: "",
    endsAt: "",
    city,
    state,
    venueName: "",
    capacity,
    meetingInstructions: "Add the exact venue, arrival or check-in instructions, access details, and timing before publishing.",
    safetyNotes: ["Confirm current venue rules, access requirements, and operating conditions before the event.", "Review the plan and use organizer judgment before publishing."],
    backupPlan: "Add an alternate venue, schedule, or activity when the event depends on conditions outside your control.",
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
  if (!supabaseUrl || !anonKey) return json({ error: "Function environment is incomplete." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const { data: organizations, error: organizationsError } = await userClient.rpc("list_my_organizations");
    if (organizationsError) throw organizationsError;
    const activeOrganization = (organizations ?? []).find((row: any) => row.is_active === true) ?? null;
    if (!activeOrganization?.id) return json({ error: "Choose an organization before using Host Copilot." }, 403);

    const { data: canUseAi, error: permissionError } = await userClient.rpc("organization_has_permission", {
      p_organization_id: activeOrganization.id,
      p_permission_code: "ai.use",
    });
    if (permissionError) throw permissionError;
    if (canUseAi !== true) return json({ error: "AI access is not enabled for your role in this organization." }, 403);

    const body = await req.json();
    const prompt = String(body?.prompt ?? "").trim().slice(0, 2000);
    const city = String(body?.city ?? "").trim().slice(0, 100);
    const state = String(body?.state ?? "").trim().toUpperCase().slice(0, 2);
    if (prompt.length < 10) return json({ error: "Tell the copilot a little more about the event you want to create." }, 400);

    const communityPriorityEnabled = activeOrganization.is_platform_default === true;
    let places: any[] = [];
    if (communityPriorityEnabled && adminClient) {
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
      places = verifiedPlaces ?? [];
    }

    if (!openAiKey) return json({ plan: fallbackPlan(prompt, city, state), source: "fallback", verifiedPlacesUsed: 0, communityPriorityEnabled });

    const communityInstruction = communityPriorityEnabled
      ? "\n\nORGANIZATION-SPECIFIC COMMUNITY PRIORITY: When suitable VERIFIED community places are supplied, this organization prefers verified Black- and brown-owned businesses and community-centered stops. Ownership is sensitive factual data. Never infer ownership from a name, photo, neighborhood, language, cuisine, or demographics. Only use an ownership label when that exact tag appears in the supplied verified place record. If no verified record fits, do not invent an ownership claim."
      : "\n\nDo not add demographic, cultural-ownership, or community-ownership assumptions. This organization has no configured ownership-priority rule for this planner.";

    const system = `You are the Host Copilot for ${String(activeOrganization.name ?? "the active organization")}. Turn a host's rough idea into a practical event draft. The organization may host classes, conferences, festivals, networking events, private events, sports, food events, outdoor activities, community programs, or other experiences. Do not assume the organization is an outdoor group. Be concise and operationally useful. Never claim an event is safe. Hosts must verify venue rules, conditions, permits, accessibility, pricing, availability, weather when relevant, and other changing facts themselves.${communityInstruction}\n\nReturn only valid JSON matching the requested schema. Dates and times must be local values formatted YYYY-MM-DDTHH:MM. If timing is ambiguous, leave startsAt and endsAt empty and explain that in confidenceNotes rather than guessing. Today is ${new Date().toISOString().slice(0, 10)}.`;

    const user = JSON.stringify({
      organization: { id: activeOrganization.id, name: activeOrganization.name, kind: activeOrganization.kind },
      prompt,
      preferredCity: city || null,
      preferredState: state || null,
      verifiedCommunityPlaces: places,
    });
    const schema = {
      name: "host_copilot_plan",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["title","summary","description","category","difficulty","startsAt","endsAt","city","state","venueName","capacity","meetingInstructions","safetyNotes","backupPlan","communityStops","confidenceNotes"],
        properties: {
          title: { type: "string" }, summary: { type: "string" }, description: { type: "string" },
          category: { type: "string", enum: ["Conference","Workshop","Class","Festival","Networking","Food","Corporate","Private","Sports","Hiking","Camping","Paddling","Beach","Cycling","Volunteer","Community","Other"] },
          difficulty: { type: "string", enum: ["easy","moderate","challenging"] },
          startsAt: { type: "string" }, endsAt: { type: "string" }, city: { type: "string" }, state: { type: "string" }, venueName: { type: "string" },
          capacity: { type: "integer", minimum: 2, maximum: 1000 }, meetingInstructions: { type: "string" },
          safetyNotes: { type: "array", items: { type: "string" }, maxItems: 6 }, backupPlan: { type: "string" },
          communityStops: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["placeId","name","reason","ownershipTags"], properties: { placeId: { type: "string" }, name: { type: "string" }, reason: { type: "string" }, ownershipTags: { type: "array", items: { type: "string" } } } } },
          confidenceNotes: { type: "array", items: { type: "string" }, maxItems: 5 },
        },
      },
    };

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_schema", json_schema: schema } }),
    });
    const completion = await upstream.json();
    if (!upstream.ok) {
      console.error("host-copilot upstream", completion);
      return json({ plan: fallbackPlan(prompt, city, state), source: "fallback", verifiedPlacesUsed: places.length, communityPriorityEnabled });
    }
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return json({ plan: fallbackPlan(prompt, city, state), source: "fallback", verifiedPlacesUsed: places.length, communityPriorityEnabled });
    const plan = JSON.parse(content);
    const allowedPlaceIds = new Set(places.map((place: any) => String(place.id)));
    plan.communityStops = communityPriorityEnabled && Array.isArray(plan.communityStops)
      ? plan.communityStops.filter((stop: any) => allowedPlaceIds.has(String(stop.placeId)))
      : [];
    return json({ plan, source: "ai", model: completion.model ?? MODEL, verifiedPlacesUsed: places.length, communityPriorityEnabled });
  } catch (error) {
    console.error("host-copilot", error);
    return json({ error: "Unable to build the event plan right now." }, 500);
  }
});
