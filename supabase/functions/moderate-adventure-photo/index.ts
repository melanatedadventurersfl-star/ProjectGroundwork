import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = { "Content-Type": "application/json" };
const MODEL = "omni-moderation-latest";
const REVIEW_THRESHOLD = 0.35;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function maxCategoryScore(scores: Record<string, number> | undefined) {
  if (!scores) return 0;
  const values = Object.values(scores).filter((value) => Number.isFinite(value));
  return values.length ? Math.max(...values) : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Supabase function environment is incomplete." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const photoId = String(body?.photoId ?? "").trim();
    if (!photoId) return json({ error: "photoId is required" }, 400);

    const { data: photo, error: photoError } = await userClient
      .from("adventure_memory_photos")
      .select("id, profile_id, adventure_id, image_url, caption, moderation_status")
      .eq("id", photoId)
      .single();

    if (photoError || !photo) return json({ error: "Photo not found or not accessible." }, 404);

    if (photo.moderation_status !== "pending") {
      return json({ status: photo.moderation_status, alreadyModerated: true });
    }

    if (!openAiKey) {
      await adminClient
        .from("adventure_memory_photos")
        .update({
          moderation_source: "ai",
          moderation_model: MODEL,
          moderation_reason: "Automated moderation is waiting for the OpenAI API secret.",
        })
        .eq("id", photo.id);
      return json({ status: "pending", reason: "Automated moderation is not configured." }, 202);
    }

    const input: Array<Record<string, unknown>> = [];
    if (photo.caption?.trim()) input.push({ type: "text", text: photo.caption.trim() });
    input.push({ type: "image_url", image_url: { url: photo.image_url } });

    const upstream = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({ model: MODEL, input }),
    });

    const moderation = await upstream.json();
    if (!upstream.ok) {
      await adminClient
        .from("adventure_memory_photos")
        .update({
          moderation_source: "ai",
          moderation_model: MODEL,
          moderation_reason: "Automated moderation could not complete; human review required.",
        })
        .eq("id", photo.id);
      return json({ status: "pending", reason: "Moderation provider unavailable." }, 202);
    }

    const result = moderation?.results?.[0];
    if (!result) return json({ status: "pending", reason: "No moderation result returned." }, 202);

    const highestScore = maxCategoryScore(result.category_scores);
    let status: "approved" | "pending" | "rejected";
    let reason: string;

    if (result.flagged === true) {
      status = "rejected";
      reason = "Automatically rejected by safety moderation.";
    } else if (highestScore >= REVIEW_THRESHOLD) {
      status = "pending";
      reason = "Automated moderation found an ambiguous safety signal; human review required.";
    } else {
      status = "approved";
      reason = "Automatically approved by safety moderation.";
    }

    const update = {
      moderation_status: status,
      moderation_source: "ai",
      moderation_score: highestScore,
      moderation_reason: reason,
      moderation_categories: {
        flags: result.categories ?? {},
        scores: result.category_scores ?? {},
        applied_input_types: result.category_applied_input_types ?? {},
      },
      moderation_model: moderation.model ?? MODEL,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      reviewed_by: null,
    };

    const { error: updateError } = await adminClient
      .from("adventure_memory_photos")
      .update(update)
      .eq("id", photo.id);

    if (updateError) return json({ error: "Unable to save moderation result." }, 500);

    return json({ status, score: highestScore, reason });
  } catch (error) {
    console.error("moderate-adventure-photo", error);
    return json({ error: "Unable to moderate photo." }, 500);
  }
});
