import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Function environment is incomplete." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Authentication required" }, 401);

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
    if (adminError || isAdmin !== true) return json({ error: "Platform admin access is required." }, 403);

    const body = await req.json();
    const placeId = clean(body?.placeId, 160);
    const candidateId = clean(body?.candidateId, 80);
    const mode = clean(body?.mode || (candidateId ? "preferred" : "automatic"), 20);
    if (!placeId) return json({ error: "placeId is required." }, 400);
    if (!["preferred", "automatic", "refresh"].includes(mode)) return json({ error: "Unsupported mode." }, 400);

    const { data: profile, error: profileError } = await adminClient
      .from("trail_guide_place_profiles")
      .select("place_id,display_name")
      .eq("place_id", placeId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "Trail Guide place was not found." }, 404);

    if (mode === "preferred") {
      if (!candidateId) return json({ error: "candidateId is required for preferred mode." }, 400);
      const { data: candidate, error: candidateError } = await adminClient
        .from("trail_guide_hero_candidates")
        .select("id,place_id,status")
        .eq("id", candidateId)
        .eq("place_id", placeId)
        .maybeSingle();
      if (candidateError) throw candidateError;
      if (!candidate || candidate.status !== "approved") return json({ error: "Choose an approved hero candidate for this destination." }, 400);

      const { error: clearError } = await adminClient
        .from("trail_guide_hero_candidates")
        .update({ is_preferred: false, updated_at: new Date().toISOString() })
        .eq("place_id", placeId)
        .eq("is_preferred", true);
      if (clearError) throw clearError;

      const { error: selectError } = await adminClient
        .from("trail_guide_hero_candidates")
        .update({ is_preferred: true, updated_at: new Date().toISOString() })
        .eq("id", candidateId);
      if (selectError) throw selectError;
    } else if (mode === "automatic") {
      const { error: clearError } = await adminClient
        .from("trail_guide_hero_candidates")
        .update({ is_preferred: false, updated_at: new Date().toISOString() })
        .eq("place_id", placeId)
        .eq("is_preferred", true);
      if (clearError) throw clearError;
    }

    const { data: selectedId, error: refreshError } = await adminClient.rpc("refresh_trail_guide_hero_selection", { target_place_id: placeId });
    if (refreshError) throw refreshError;

    const [{ data: selected }, { data: updatedProfile }] = await Promise.all([
      selectedId
        ? adminClient.from("trail_guide_hero_candidates").select("id,source_type,source_name,image_url,storage_path,hero_score,is_preferred,is_generic,tags").eq("id", selectedId).maybeSingle()
        : Promise.resolve({ data: null }),
      adminClient.from("trail_guide_place_profiles").select("place_id,hero_candidate_id,hero_selection_mode,hero_confidence,hero_selection_reason,hero_last_reviewed_at").eq("place_id", placeId).maybeSingle(),
    ]);

    return json({ placeId, placeName: profile.display_name, selected, profile: updatedProfile });
  } catch (error) {
    console.error("trail-guide-hero-select", error);
    return json({ error: error instanceof Error ? error.message : "Unable to update Trail Guide hero selection." }, 500);
  }
});
