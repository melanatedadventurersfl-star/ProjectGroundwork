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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function clean(value: unknown, max = 5000) { return String(value ?? "").trim().slice(0, max); }
function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    return true;
  } catch { return false; }
}
function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function stripHtml(html: string) {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decodeEntities(match[1].trim()); }
  return "";
}
function firstString(...values: unknown[]) { for (const value of values) if (typeof value === "string" && value.trim()) return decodeEntities(value.trim()); return ""; }
function flattenObjects(value: unknown, out: any[], depth = 0) {
  if (depth > 9 || out.length >= 5000 || value === null || value === undefined) return;
  if (Array.isArray(value)) { for (const item of value) flattenObjects(item, out, depth + 1); return; }
  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  out.push(obj);
  for (const child of Object.values(obj)) flattenObjects(child, out, depth + 1);
}
function extractStructuredObjects(html: string) {
  const objects: any[] = [];
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].slice(0, 80);
  for (const script of scripts) {
    const attrs = script[1] || "";
    const raw = (script[2] || "").trim();
    const isJson = /application\/ld\+json|application\/json|__NEXT_DATA__|data-hydration/i.test(attrs);
    if (!isJson || (!raw.startsWith("{") && !raw.startsWith("["))) continue;
    try { flattenObjects(JSON.parse(raw), objects); } catch { continue; }
  }
  return objects;
}
function scoreEvent(obj: any) {
  let score = 0;
  const type = obj?.["@type"];
  if (type === "Event" || (Array.isArray(type) && type.includes("Event"))) score += 10;
  if (obj?.startDate || obj?.start?.local || obj?.start?.utc || obj?.start_time) score += 4;
  if (obj?.endDate || obj?.end?.local || obj?.end?.utc || obj?.end_time) score += 2;
  if (obj?.name || obj?.title) score += 2;
  if (obj?.location || obj?.venue || obj?.primary_venue) score += 3;
  if (obj?.organizer || obj?.organizer_name || obj?.organization) score += 2;
  if (obj?.offers || obj?.ticket_availability || obj?.price) score += 2;
  return score;
}
function findEvent(objects: any[]) { return objects.map((obj) => ({ obj, score: scoreEvent(obj) })).filter((x) => x.score >= 5).sort((a,b) => b.score - a.score)[0]?.obj ?? null; }
function addressParts(location: any) {
  const address = location?.address ?? location?.address_data ?? location ?? {};
  if (typeof address === "string") return { address: decodeEntities(address), city: "", state: "" };
  const street = firstString(address?.streetAddress, address?.address_1, address?.address1, address?.localized_address_display);
  const city = firstString(address?.addressLocality, address?.city, address?.city_name);
  const state = firstString(address?.addressRegion, address?.region, address?.region_name, address?.state);
  const postal = firstString(address?.postalCode, address?.postal_code, address?.zip);
  const formatted = firstString(address?.localized_address_display, address?.formatted_address);
  return { address: formatted || [street, city, state, postal].filter(Boolean).join(", "), city, state };
}
function extractEmail(text: string) { return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ""; }
function extractPhone(text: string) { return text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] ?? ""; }
function textAfter(text: string, labels: string[]) { for (const label of labels) { const m = text.match(new RegExp(`${label}\\s*[:\-]?\\s*([^|•]{3,120})`, "i")); if (m?.[1]) return m[1].trim(); } return ""; }
function eventImage(event: any, html: string) {
  const image = event?.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return firstString(image[0]?.url, image[0]);
  return firstString(image?.url, event?.logo?.url, event?.logo?.original?.url, meta(html, "og:image"));
}
function ticketPriceDetails(event: any, offers: any[]) {
  const details = offers.slice(0, 12).map((offer: any) => {
    const label = firstString(offer?.name, offer?.category, "Ticket");
    const price = offer?.price ?? offer?.lowPrice ?? offer?.minimum_price;
    const high = offer?.highPrice ?? offer?.maximum_price;
    const currency = firstString(offer?.priceCurrency, offer?.currency);
    const availability = firstString(offer?.availability)?.split("/").pop() ?? "";
    const amount = price !== undefined && price !== null ? `${currency ? `${currency} ` : ""}${price}${high !== undefined && high !== null && String(high) !== String(price) ? ` - ${high}` : ""}` : "";
    return [label, amount, availability].filter(Boolean).join(" · ");
  }).filter(Boolean);
  const availability = event?.ticket_availability;
  const min = availability?.minimum_ticket_price?.display || availability?.minimum_ticket_price?.value;
  const max = availability?.maximum_ticket_price?.display || availability?.maximum_ticket_price?.value;
  if (!details.length && (min || max)) details.push(`Tickets · ${min || ""}${min && max && min !== max ? ` - ${max}` : max || ""}`);
  return details;
}
function fallbackPreview(sourceUrl: string, title: string, description: string, pageText: string, objects: any[], html: string) {
  const event = findEvent(objects) || {};
  const location = Array.isArray(event?.location) ? event.location[0] : event?.location || event?.venue || event?.primary_venue || {};
  const address = addressParts(location);
  const organizerObj = Array.isArray(event?.organizer) ? event.organizer[0] : event?.organizer || event?.organization || {};
  const offers = Array.isArray(event?.offers) ? event.offers : event?.offers ? [event.offers] : [];
  const ticketDetails = ticketPriceDetails(event, offers);
  const lower = pageText.toLowerCase();
  const opportunityType = lower.includes("vendor") || lower.includes("booth") || lower.includes("exhibitor") ? "vendor" : lower.includes("sponsor") ? "sponsorship" : lower.includes("partner") ? "partnership" : "community_event";
  const feeText = textAfter(pageText, ["vendor fee", "booth fee", "exhibitor fee", "registration fee"]);
  const deadline = textAfter(pageText, ["application deadline", "vendor deadline", "deadline to apply", "applications close"]);
  const start = firstString(event?.startDate, event?.start?.local, event?.start?.utc, event?.start_time);
  const end = firstString(event?.endDate, event?.end?.local, event?.end?.utc, event?.end_time);
  const venueName = firstString(location?.name, event?.venue_name, event?.primary_venue?.name);
  const organizer = firstString(organizerObj?.name, event?.organizer_name, event?.organization_name);
  const ticketUrl = firstString(offers.find((offer:any) => offer?.url)?.url, event?.url, event?.ticket_url, sourceUrl);
  return {
    title: firstString(event?.name, event?.title, title).slice(0, 250),
    summary: firstString(event?.description, event?.summary, description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1200),
    opportunityType, eventStart: start, eventEnd: end, venueName, address: address.address, city: address.city, state: address.state,
    organizer, organizerWebsite: firstString(organizerObj?.url, event?.organizer_url), contactName: "", contactEmail: extractEmail(pageText), contactPhone: extractPhone(pageText),
    vendorFeeText: feeText, applicationDeadline: deadline, applicationUrl: firstString(offers.find((offer:any) => offer?.url)?.url),
    imageUrl: eventImage(event, html), ticketUrl, boothDetails: [], requirements: [], ticketDetails, sourceUrl,
    confidenceNotes: scoreEvent(event) >= 5 ? ["Details were read from structured event data where available. Review the source before saving."] : ["The source exposed limited structured data. Review the original page for missing details."],
  };
}
function schema() {
  return { type: "object", additionalProperties: false, required: ["title","summary","opportunityType","eventStart","eventEnd","venueName","address","city","state","organizer","organizerWebsite","contactName","contactEmail","contactPhone","vendorFeeText","applicationDeadline","applicationUrl","imageUrl","ticketUrl","boothDetails","requirements","ticketDetails","sourceUrl","confidenceNotes"], properties: {
    title:{type:"string"}, summary:{type:"string"}, opportunityType:{type:"string",enum:["vendor","community_event","partnership","sponsorship","venue","marketing","other"]}, eventStart:{type:"string"}, eventEnd:{type:"string"}, venueName:{type:"string"}, address:{type:"string"}, city:{type:"string"}, state:{type:"string"}, organizer:{type:"string"}, organizerWebsite:{type:"string"}, contactName:{type:"string"}, contactEmail:{type:"string"}, contactPhone:{type:"string"}, vendorFeeText:{type:"string"}, applicationDeadline:{type:"string"}, applicationUrl:{type:"string"}, imageUrl:{type:"string"}, ticketUrl:{type:"string"}, boothDetails:{type:"array",maxItems:20,items:{type:"string"}}, requirements:{type:"array",maxItems:30,items:{type:"string"}}, ticketDetails:{type:"array",maxItems:20,items:{type:"string"}}, sourceUrl:{type:"string"}, confidenceNotes:{type:"array",maxItems:16,items:{type:"string"}}
  }};
}
function readOutputText(payload:any) { if (typeof payload?.output_text === "string") return payload.output_text; for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text; return ""; }
function mergePreview(base:any, extracted:any, sourceUrl:string) { const merged={...base}; for (const [key,value] of Object.entries(extracted ?? {})) { if (Array.isArray(value)) { if (value.length) merged[key]=value; } else if (typeof value === "string") { if (value.trim()) merged[key]=decodeEntities(value.trim()); } else if (value !== null && value !== undefined) merged[key]=value; } merged.sourceUrl=sourceUrl; return merged; }

Deno.serve(async (req:Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const authHeader=req.headers.get("Authorization"); if (!authHeader) return json({error:"Authentication required"},401);
  const supabaseUrl=Deno.env.get("SUPABASE_URL"); const anonKey=Deno.env.get("SUPABASE_ANON_KEY"); const openAiKey=Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({error:"Function environment is incomplete."},503);
  const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:userData,error:userError}=await userClient.auth.getUser(); const userId=userData.user?.id; if (userError || !userId) return json({error:"Authentication required"},401);
    const {data:approved,error:accessError}=await userClient.rpc("is_approved_outing_host",{p_profile_id:userId}); if (accessError || approved !== true) return json({error:"Approved host access is required."},403);
    const body=await req.json(); const sourceUrl=clean(body?.sourceUrl,2000); if (!validHttpsUrl(sourceUrl)) return json({error:"Enter a public HTTPS event, vendor, venue or opportunity URL."},400);
    const response=await fetch(sourceUrl,{redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1","Accept":"text/html,application/xhtml+xml","Accept-Language":"en-US,en;q=0.9"}});
    if (!response.ok) return json({error:`Source returned HTTP ${response.status}.`},400);
    const declared=Number(response.headers.get("content-length") ?? 0); if (declared > MAX_REMOTE_BYTES) return json({error:"Source page is larger than 5 MB."},400);
    const buffer=new Uint8Array(await response.arrayBuffer()); if (buffer.byteLength > MAX_REMOTE_BYTES) return json({error:"Source page is larger than 5 MB."},400);
    const contentType=response.headers.get("content-type") ?? ""; if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return json({error:"That URL does not appear to be a public webpage."},400);
    const html=new TextDecoder().decode(buffer); const pageTitle=decodeEntities(meta(html,"og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || new URL(sourceUrl).hostname); const description=decodeEntities(meta(html,"og:description") || meta(html,"description")); const pageText=stripHtml(html).slice(0,80000); const structured=extractStructuredObjects(html);
    const fallback=fallbackPreview(sourceUrl,pageTitle,description,pageText,structured,html); let preview=fallback; let extractionSource:"ai"|"fallback"="fallback";
    if (openAiKey) {
      const sourcePackage=JSON.stringify({sourceUrl,pageTitle,description,structuredObjects:structured.slice(0,800),pageText});
      const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${openAiKey}`},body:JSON.stringify({model:MODEL,instructions:"Extract event or opportunity information from this public page. Return only facts present in the supplied source. Preserve exact dates and times, full venue and address, city/state, organizer, description, contact details, ticket price or price range, ticket URL, event image URL, vendor or exhibitor fees, application deadlines, application links, booth details and requirements when supported. Leave unsupported fields empty. Do not invent data. If this is an Eventbrite attendee event with no vendor application, classify it as community_event.",input:[{role:"user",content:[{type:"input_text",text:sourcePackage}]}],text:{format:{type:"json_schema",name:"opportunity_import_preview",strict:true,schema:schema()}}})});
      const payload=await upstream.json(); if (upstream.ok) { const outputText=readOutputText(payload); if (outputText) { preview=mergePreview(fallback,JSON.parse(outputText),sourceUrl); extractionSource="ai"; } } else console.error("opportunity-import-preview upstream",payload);
    }
    const host=new URL(sourceUrl).hostname.toLowerCase(); const sourceLabel=host.includes("eventbrite.") ? "Eventbrite" : host.replace(/^www\./,"");
    return json({preview,sourceLabel,sourceUrl,extractionSource});
  } catch (error) { console.error("opportunity-import-preview",error); return json({error:error instanceof Error ? error.message : "Unable to import this opportunity source."},500); }
});
