import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Function environment is incomplete." }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const tenant = body.tenant;
  const hasTenantContext = Boolean(
    tenant &&
    typeof tenant === "object" &&
    !Array.isArray(tenant) &&
    ("organizationId" in tenant || "organizationName" in tenant || "experienceId" in tenant),
  );
  const target = hasTenantContext ? "host-ai-planner-v2" : "host-ai-planner-legacy";

  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/${target}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  } catch (error) {
    console.error("host-ai-planner dispatcher", error);
    return json({ error: "Unable to route AI planning." }, 503);
  }
});
