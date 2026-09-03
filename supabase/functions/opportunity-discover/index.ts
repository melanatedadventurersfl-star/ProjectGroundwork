import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const sources: Record<string, { label: string; url: string }> = {
  city_jacksonville: { label: "City of Jacksonville", url: "https://events.jacksonville.gov/all-events" },
  visit_jacksonville: { label: "Visit Jacksonville", url: "https://www.visitjacksonville.com/events/" },
  jacksonville_beach: { label: "Jacksonville Beach", url: "https://www.jacksonvillebeach.org/calendar.aspx" },
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
function stripHtml(html: string) { return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim(); }
function readOutputText(payload: any) { if (typeof payload?.output_text === "string") return payload.output_text; for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text; return ""; }
function schema() { return { type: "object", additionalProperties: false, required: ["events"], properties: { events: { type: "array", maxItems: 15, items: { type: "object", additionalProperties: false, required: ["title","summary","startsAt","endsAt","venueName","address","city","state","organizer","sourceUrl","imageUrl","ticketUrl","relevanceLabel","relevanceBasis"], properties: { title:{type:"string"}, summary:{type:"string"}, startsAt:{type:"string"}, endsAt:{type:"string"}, venueName:{type:"string"}, address:{type:"string"}, city:{type:"string"}, state:{type:"string"}, organizer:{type:"string"}, sourceUrl:{type:"string"}, imageUrl:{type:"string"}, ticketUrl:{type:"string"}, relevanceLabel:{type:["string","null"], enum:["melanated_led","melanated_focused","community_relevant",null]}, relevanceBasis:{type:"string"} } } } } }; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !openAiKey) return json({ error: "Discovery service is not configured." }, 503);
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: "Authentication required" }, 401);
  const { data: approved } = await client.rpc("is_approved_outing_host", { p_profile_id: userId });
  if (approved !== true) return json({ error: "Approved host access is required." }, 403);
  try {
    const body = await req.json();
    const sourceId = String(body?.sourceId ?? "");
    const source = sources[sourceId];
    if (!source) return json({ error: "Unsupported discovery source." }, 400);
    const response = await fetch(source.url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; GoMelanatedDiscovery/1.0)", "Accept": "text/html,application/xhtml+xml" } });
    if (!response.ok) return json({ error: `${source.label} returned HTTP ${response.status}.` }, 400);
    const html = await response.text();
    const pageText = stripHtml(html).slice(0, 45000);
    const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 500).map((match) => ({ href: match[1], text: stripHtml(match[2]).slice(0, 160) })).filter((item) => item.text.length > 2);
    const sourcePackage = JSON.stringify({ sourceId, sourceLabel: source.label, sourceRootUrl: source.url, pageText, links });
    const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` }, body: JSON.stringify({ model: MODEL, instructions: "Extract upcoming public events from this local event-calendar page for host discovery. Return only events explicitly supported by the supplied source. Resolve relative event links against sourceRootUrl. Do not invent dates, venues, organizers or ticket links. startsAt and endsAt should be ISO-like strings only when the source provides enough information. For relevanceLabel, NEVER infer race or ethnicity from names, photos, neighborhoods or vague themes. Set melanated_led only when the source explicitly says the organizer/business is Black-owned, POC-led, minority-owned, Latino-owned, Indigenous-owned, Asian-owned or equivalent. Set melanated_focused only when the event explicitly centers a named community of color, such as Juneteenth, Black culture, African diaspora, Latino/Hispanic heritage, Indigenous culture, Asian heritage or an explicitly multicultural POC program. Set community_relevant only when the source explicitly describes programming or partnerships centered on communities of color. Otherwise relevanceLabel must be null and relevanceBasis empty. Prefer events in or near Jacksonville, Florida and omit obviously past events.", input: [{ role: "user", content: [{ type: "input_text", text: sourcePackage }] }], text: { format: { type: "json_schema", name: "local_opportunity_discovery", strict: true, schema: schema() } } }) });
    const payload = await upstream.json();
    if (!upstream.ok) throw new Error("Unable to analyze this source right now.");
    const parsed = JSON.parse(readOutputText(payload) || "{\"events\":[]}");
    return json({ sourceId, sourceLabel: source.label, sourceRootUrl: source.url, events: parsed.events ?? [] });
  } catch (error) {
    console.error("opportunity-discover", error);
    return json({ error: error instanceof Error ? error.message : "Unable to discover opportunities." }, 500);
  }
});
