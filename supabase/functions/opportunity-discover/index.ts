import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DiscoverySource = { id: string; label: string; url: string; copy: string };

const flagshipSources: DiscoverySource[] = [
  { id: "city_jacksonville", label: "City of Jacksonville", url: "https://events.jacksonville.gov/all-events", copy: "Community and city event calendar" },
  { id: "visit_jacksonville", label: "Visit Jacksonville", url: "https://www.visitjacksonville.com/events/", copy: "Regional events and festivals" },
  { id: "jacksonville_beach", label: "Jacksonville Beach", url: "https://www.jacksonvillebeach.org/calendar.aspx", copy: "Beaches events, markets and festivals" },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function clean(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function readOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function publicHttpUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Discovery source has an invalid URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Discovery sources must use public http or https URLs.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Local or private discovery sources are not allowed.");
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) throw new Error("Local or private discovery sources are not allowed.");
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    const [a, b] = octets;
    if (octets.some((part) => part > 255) || a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) throw new Error("Local or private discovery sources are not allowed.");
  }
  return url;
}

function configuredSources(settings: unknown): DiscoverySource[] {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return [];
  const rows = (settings as Record<string, unknown>).opportunity_sources;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const id = clean(item.id, 80) || `source-${index + 1}`;
    const label = clean(item.label, 160);
    const url = clean(item.url, 1000);
    const copy = clean(item.copy, 240) || "Organization discovery source";
    if (!label || !url) return [];
    try { publicHttpUrl(url); } catch { return []; }
    return [{ id, label, url, copy }];
  });
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["events"],
    properties: {
      events: {
        type: "array",
        maxItems: 15,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title","summary","startsAt","endsAt","venueName","address","city","state","organizer","sourceUrl","imageUrl","ticketUrl","relevanceLabel","relevanceBasis"],
          properties: {
            title: { type: "string" }, summary: { type: "string" }, startsAt: { type: "string" }, endsAt: { type: "string" }, venueName: { type: "string" },
            address: { type: "string" }, city: { type: "string" }, state: { type: "string" }, organizer: { type: "string" }, sourceUrl: { type: "string" },
            imageUrl: { type: "string" }, ticketUrl: { type: "string" },
            relevanceLabel: { type: ["string", "null"], enum: ["melanated_led","melanated_focused","community_relevant",null] },
            relevanceBasis: { type: "string" },
          },
        },
      },
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Discovery service is not configured." }, 503);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const { data: organizations, error: organizationsError } = await client.rpc("list_my_organizations");
    if (organizationsError) throw organizationsError;
    const activeOrganization = (organizations ?? []).find((row: any) => row.is_active === true) ?? null;
    if (!activeOrganization?.id) return json({ error: "Choose an organization before discovering opportunities." }, 403);

    const { data: canView, error: permissionError } = await client.rpc("organization_has_permission", {
      p_organization_id: activeOrganization.id,
      p_permission_code: "events.view",
    });
    if (permissionError) throw permissionError;
    if (canView !== true) return json({ error: "Opportunity discovery is not available for your role in this organization." }, 403);

    const body = await req.json();
    const requestedOrganizationId = clean(body?.organizationId, 80);
    if (requestedOrganizationId && requestedOrganizationId !== activeOrganization.id) return json({ error: "Switch organizations before using this discovery source." }, 403);

    const tenantSources = configuredSources(activeOrganization.event_builder_settings);
    const sources = activeOrganization.is_platform_default === true
      ? [...flagshipSources, ...tenantSources.filter((source) => !flagshipSources.some((item) => item.id === source.id))]
      : tenantSources;

    if (body?.action === "list_sources") {
      return json({ organizationId: activeOrganization.id, sources: sources.map(({ id, label, copy }) => ({ id, label, copy })) });
    }

    const sourceId = clean(body?.sourceId, 80);
    const source = sources.find((item) => item.id === sourceId);
    if (!source) {
      return json({ error: sources.length ? "This discovery source is not configured for the active organization." : "No opportunity discovery sources are configured for this organization." }, 400);
    }

    if (!openAiKey) return json({ error: "Opportunity discovery analysis is not configured." }, 503);

    const sourceUrl = publicHttpUrl(source.url);
    const response = await fetch(sourceUrl, { redirect: "follow", headers: { "User-Agent": "ExperiencePlatform-Discovery/1.0", "Accept": "text/html,application/xhtml+xml" } });
    publicHttpUrl(response.url);
    if (!response.ok) return json({ error: `${source.label} returned HTTP ${response.status}.` }, 400);

    const html = await response.text();
    const pageText = stripHtml(html).slice(0, 45000);
    const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .slice(0, 500)
      .map((match) => ({ href: match[1], text: stripHtml(match[2]).slice(0, 160) }))
      .filter((item) => item.text.length > 2);
    const sourcePackage = JSON.stringify({ sourceId, sourceLabel: source.label, sourceRootUrl: source.url, pageText, links });

    const flagshipRelevance = activeOrganization.is_platform_default === true;
    const relevanceInstruction = flagshipRelevance
      ? "For relevanceLabel, never infer race or ethnicity from names, photos, neighborhoods, or vague themes. Set melanated_led only when the source explicitly states that the organizer or business is Black-owned, POC-led, minority-owned, Latino-owned, Indigenous-owned, Asian-owned, or equivalent. Set melanated_focused only when the event explicitly centers a named community of color. Set community_relevant only when the source explicitly describes programming or partnerships centered on communities of color. Otherwise relevanceLabel must be null and relevanceBasis empty."
      : "This tenant has no demographic relevance classification configured. relevanceLabel must always be null and relevanceBasis must be empty.";

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: `Extract upcoming public events from this organization-approved event-calendar source. Return only events explicitly supported by the supplied source. Resolve relative event links against sourceRootUrl. Do not invent dates, venues, organizers, ticket links, audience, ownership, or relevance. startsAt and endsAt should be ISO-like strings only when the source provides enough information. ${relevanceInstruction} Omit obviously past events.`,
        input: [{ role: "user", content: [{ type: "input_text", text: sourcePackage }] }],
        text: { format: { type: "json_schema", name: "tenant_opportunity_discovery", strict: true, schema: schema() } },
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) throw new Error("Unable to analyze this source right now.");
    const parsed = JSON.parse(readOutputText(payload) || '{"events":[]}');
    const events = Array.isArray(parsed.events) ? parsed.events : [];
    if (!flagshipRelevance) {
      for (const event of events) {
        event.relevanceLabel = null;
        event.relevanceBasis = "";
      }
    }
    return json({ organizationId: activeOrganization.id, sourceId, sourceLabel: source.label, sourceRootUrl: source.url, events });
  } catch (error) {
    console.error("opportunity-discover", error);
    return json({ error: error instanceof Error ? error.message : "Unable to discover opportunities." }, 500);
  }
});
