import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const MAX_REMOTE_BYTES = 5 * 1024 * 1024;
const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    return true;
  } catch {
    return false;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractJsonLd(html: string) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const results: unknown[] = [];
  for (const block of blocks.slice(0, 16)) {
    try {
      const parsed = JSON.parse(block[1]);
      const values = Array.isArray(parsed)
        ? parsed
        : parsed?.["@graph"] && Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];
      results.push(...values.slice(0, 30));
    } catch {
      continue;
    }
  }
  return results.slice(0, 80);
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title", "summary", "opportunityType", "eventStart", "eventEnd", "venueName", "address", "city", "state",
      "organizer", "organizerWebsite", "contactName", "contactEmail", "contactPhone", "vendorFeeText", "applicationDeadline",
      "applicationUrl", "boothDetails", "requirements", "ticketDetails", "sourceUrl", "confidenceNotes"
    ],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      opportunityType: { type: "string", enum: ["vendor", "community_event", "partnership", "sponsorship", "venue", "marketing", "other"] },
      eventStart: { type: "string" },
      eventEnd: { type: "string" },
      venueName: { type: "string" },
      address: { type: "string" },
      city: { type: "string" },
      state: { type: "string" },
      organizer: { type: "string" },
      organizerWebsite: { type: "string" },
      contactName: { type: "string" },
      contactEmail: { type: "string" },
      contactPhone: { type: "string" },
      vendorFeeText: { type: "string" },
      applicationDeadline: { type: "string" },
      applicationUrl: { type: "string" },
      boothDetails: { type: "array", maxItems: 20, items: { type: "string" } },
      requirements: { type: "array", maxItems: 30, items: { type: "string" } },
      ticketDetails: { type: "array", maxItems: 20, items: { type: "string" } },
      sourceUrl: { type: "string" },
      confidenceNotes: { type: "array", maxItems: 16, items: { type: "string" } },
    },
  };
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

function fallbackPreview(sourceUrl: string, title: string, description: string) {
  return {
    title,
    summary: description.slice(0, 500),
    opportunityType: "other",
    eventStart: "",
    eventEnd: "",
    venueName: "",
    address: "",
    city: "",
    state: "",
    organizer: "",
    organizerWebsite: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    vendorFeeText: "",
    applicationDeadline: "",
    applicationUrl: "",
    boothDetails: [],
    requirements: [],
    ticketDetails: [],
    sourceUrl,
    confidenceNotes: ["Structured extraction was unavailable. Review the source before saving."],
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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const { data: approved, error: accessError } = await userClient.rpc("is_approved_outing_host", { p_profile_id: userId });
    if (accessError || approved !== true) return json({ error: "Approved host access is required." }, 403);

    const body = await req.json();
    const sourceUrl = clean(body?.sourceUrl, 2000);
    if (!validHttpsUrl(sourceUrl)) return json({ error: "Enter a public HTTPS event, vendor, venue or opportunity URL." }, 400);

    const response = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "GoMelanatedOpportunityImporter/1.0" },
    });
    if (!response.ok) return json({ error: `Source returned HTTP ${response.status}.` }, 400);

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_REMOTE_BYTES) return json({ error: "Source page is larger than 5 MB." }, 400);
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_REMOTE_BYTES) return json({ error: "Source page is larger than 5 MB." }, 400);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return json({ error: "That URL does not appear to be a public webpage." }, 400);
    }

    const html = new TextDecoder().decode(buffer);
    const pageTitle = meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || new URL(sourceUrl).hostname;
    const description = meta(html, "og:description") || meta(html, "description");
    const pageText = stripHtml(html).slice(0, 30000);
    const jsonLd = extractJsonLd(html);

    let preview = fallbackPreview(sourceUrl, pageTitle.slice(0, 250), description);
    let extractionSource: "ai" | "fallback" = "fallback";

    if (openAiKey) {
      const sourcePackage = JSON.stringify({
        sourceUrl,
        pageTitle,
        description,
        jsonLd,
        pageText,
      });
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: MODEL,
          instructions: "Extract business opportunity information for Melanated Adventurers from the supplied public webpage. The source may describe a festival, Eventbrite event, vendor application, sponsorship, partnership, venue, community event, expo, market, or marketing opportunity. Return only facts supported by the source. Leave fields empty when the source does not support them. Never invent fees, deadlines, contact information, dates, booth sizes, requirements, or application links. Prefer explicit vendor/application information over general attendee ticket information. Dates must use YYYY-MM-DD or YYYY-MM-DDTHH:MM only when clearly stated. opportunityType should describe the business opportunity, not the event category. Include uncertainty or missing critical information in confidenceNotes.",
          input: [{ role: "user", content: [{ type: "input_text", text: sourcePackage }] }],
          text: { format: { type: "json_schema", name: "opportunity_import_preview", strict: true, schema: schema() } },
        }),
      });
      const payload = await upstream.json();
      if (upstream.ok) {
        const outputText = readOutputText(payload);
        if (outputText) {
          preview = JSON.parse(outputText);
          preview.sourceUrl = sourceUrl;
          extractionSource = "ai";
        }
      } else {
        console.error("opportunity-import-preview upstream", payload);
      }
    }

    return json({ preview, sourceLabel: pageTitle.slice(0, 250), sourceUrl, extractionSource });
  } catch (error) {
    console.error("opportunity-import-preview", error);
    return json({ error: error instanceof Error ? error.message : "Unable to import this opportunity source." }, 500);
  }
});
