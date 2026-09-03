import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const MAX_REMOTE_BYTES = 5 * 1024 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(html: string) {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
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
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return "";
}

function extractJsonLd(html: string) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const results: any[] = [];
  for (const block of blocks.slice(0, 24)) {
    try {
      const parsed = JSON.parse(block[1]);
      const values = Array.isArray(parsed)
        ? parsed
        : parsed?.["@graph"] && Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];
      results.push(...values.slice(0, 50));
    } catch {
      continue;
    }
  }
  return results.slice(0, 120);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function typeIncludes(node: any, expected: string) {
  const type = node?.["@type"];
  return type === expected || (Array.isArray(type) && type.includes(expected));
}

function findEventNode(nodes: any[]) {
  return nodes.find((node) => typeIncludes(node, "Event")) ?? null;
}

function addressParts(location: any) {
  const address = location?.address ?? {};
  if (typeof address === "string") return { address, city: "", state: "" };
  const street = firstString(address?.streetAddress);
  const city = firstString(address?.addressLocality);
  const state = firstString(address?.addressRegion);
  const postal = firstString(address?.postalCode);
  return {
    address: [street, city, state, postal].filter(Boolean).join(", "),
    city,
    state,
  };
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function extractPhone(text: string) {
  return text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] ?? "";
}

function textAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:\-]?\\s*([^|•]{3,120})`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function fallbackPreview(sourceUrl: string, title: string, description: string, pageText: string, jsonLd: any[]) {
  const event = findEventNode(jsonLd);
  const location = Array.isArray(event?.location) ? event.location[0] : event?.location;
  const address = addressParts(location);
  const organizer = Array.isArray(event?.organizer) ? event.organizer[0] : event?.organizer;
  const offers = Array.isArray(event?.offers) ? event.offers : event?.offers ? [event.offers] : [];
  const ticketDetails = offers.slice(0, 12).map((offer: any) => {
    const label = firstString(offer?.name, offer?.category, "Ticket");
    const price = offer?.price !== undefined && offer?.price !== null ? String(offer.price) : "";
    const currency = firstString(offer?.priceCurrency);
    const availability = firstString(offer?.availability)?.split("/").pop() ?? "";
    return [label, price ? `${currency ? `${currency} ` : ""}${price}` : "", availability].filter(Boolean).join(" · ");
  }).filter(Boolean);

  const lower = pageText.toLowerCase();
  const opportunityType = lower.includes("vendor") || lower.includes("booth") || lower.includes("exhibitor")
    ? "vendor"
    : lower.includes("sponsor")
      ? "sponsorship"
      : lower.includes("partner")
        ? "partnership"
        : "community_event";

  const feeText = textAfter(pageText, ["vendor fee", "booth fee", "exhibitor fee", "registration fee"]);
  const deadline = textAfter(pageText, ["application deadline", "vendor deadline", "deadline to apply", "applications close"]);

  return {
    title: firstString(event?.name, title).slice(0, 250),
    summary: firstString(event?.description, description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 700),
    opportunityType,
    eventStart: firstString(event?.startDate),
    eventEnd: firstString(event?.endDate),
    venueName: firstString(location?.name),
    address: address.address,
    city: address.city,
    state: address.state,
    organizer: firstString(organizer?.name),
    organizerWebsite: firstString(organizer?.url),
    contactName: "",
    contactEmail: extractEmail(pageText),
    contactPhone: extractPhone(pageText),
    vendorFeeText: feeText,
    applicationDeadline: deadline,
    applicationUrl: firstString(offers.find((offer: any) => offer?.url)?.url),
    boothDetails: [],
    requirements: [],
    ticketDetails,
    sourceUrl,
    confidenceNotes: event
      ? ["Some details were read directly from structured event data. Review the source before saving."]
      : ["The source exposed limited structured data. Review the original page for missing details."],
  };
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
      title: { type: "string" }, summary: { type: "string" },
      opportunityType: { type: "string", enum: ["vendor", "community_event", "partnership", "sponsorship", "venue", "marketing", "other"] },
      eventStart: { type: "string" }, eventEnd: { type: "string" }, venueName: { type: "string" }, address: { type: "string" },
      city: { type: "string" }, state: { type: "string" }, organizer: { type: "string" }, organizerWebsite: { type: "string" },
      contactName: { type: "string" }, contactEmail: { type: "string" }, contactPhone: { type: "string" }, vendorFeeText: { type: "string" },
      applicationDeadline: { type: "string" }, applicationUrl: { type: "string" },
      boothDetails: { type: "array", maxItems: 20, items: { type: "string" } }, requirements: { type: "array", maxItems: 30, items: { type: "string" } },
      ticketDetails: { type: "array", maxItems: 20, items: { type: "string" } }, sourceUrl: { type: "string" },
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

function mergePreview(base: any, extracted: any, sourceUrl: string) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extracted ?? {})) {
    if (Array.isArray(value)) {
      if (value.length) merged[key] = value;
    } else if (typeof value === "string") {
      if (value.trim()) merged[key] = value.trim();
    } else if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  merged.sourceUrl = sourceUrl;
  return merged;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoMelanatedOpportunityImporter/2.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
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
    const pageText = stripHtml(html).slice(0, 50000);
    const jsonLd = extractJsonLd(html);

    const fallback = fallbackPreview(sourceUrl, pageTitle, description, pageText, jsonLd);
    let preview = fallback;
    let extractionSource: "ai" | "fallback" = "fallback";

    if (openAiKey) {
      const sourcePackage = JSON.stringify({ sourceUrl, pageTitle, description, jsonLd, pageText });
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: MODEL,
          instructions: "Extract opportunity information from this public page. Return only facts present in the source. Preserve event dates, venue, city/state, organizer, contact details, ticket information, vendor or exhibitor fees, application deadlines, application links, booth details and requirements when supported. Leave unsupported fields empty. Do not invent data. If the page is an Eventbrite attendee event with no vendor application, classify it as community_event unless the source explicitly offers a vendor, partnership, sponsorship, venue or marketing opportunity.",
          input: [{ role: "user", content: [{ type: "input_text", text: sourcePackage }] }],
          text: { format: { type: "json_schema", name: "opportunity_import_preview", strict: true, schema: schema() } },
        }),
      });
      const payload = await upstream.json();
      if (upstream.ok) {
        const outputText = readOutputText(payload);
        if (outputText) {
          preview = mergePreview(fallback, JSON.parse(outputText), sourceUrl);
          extractionSource = "ai";
        }
      } else {
        console.error("opportunity-import-preview upstream", payload);
      }
    }

    return json({ preview, sourceLabel: preview.title || pageTitle.slice(0, 250), sourceUrl, extractionSource });
  } catch (error) {
    console.error("opportunity-import-preview", error);
    return json({ error: error instanceof Error ? error.message : "Unable to import this opportunity source." }, 500);
  }
});
