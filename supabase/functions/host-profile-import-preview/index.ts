import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import JSZip from "npm:jszip@3.10.1";

const MODEL = "gpt-4.1-mini";
const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const clean = (value: unknown, max = 8000) => String(value ?? "").trim().slice(0, max);

type DocumentType = "host_profile" | "event" | "vendor" | "venue" | "brand_kit" | "unknown";
type Classification = { documentType: DocumentType; confidence: number; reasons: string[] };

function safeTenantImportPath(path: string, platformOrganizationId: string, hostOrganizationId: string, userId: string) {
  const prefix = `tenants/${platformOrganizationId}/host-profiles/${hostOrganizationId}/imports/${userId}/`;
  return path.startsWith(prefix) && !path.includes("../") && !path.includes("\\");
}

function publicHttpUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid public website URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Enter a public http or https website URL.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Local or private network addresses cannot be imported.");
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) throw new Error("Local or private network addresses cannot be imported.");
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((part) => part > 255)) throw new Error("Enter a valid public website URL.");
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) {
      throw new Error("Local or private network addresses cannot be imported.");
    }
  }
  return url;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  return btoa(binary);
}

function mimeFor(name: string, supplied = "") {
  if (supplied && supplied !== "application/octet-stream") return supplied.toLowerCase();
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function decodeXmlEntities(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function extractDocxText(bytes: Uint8Array) {
  const docx = await JSZip.loadAsync(bytes);
  const file = docx.file("word/document.xml");
  if (!file) return "";
  const xml = await file.async("string");
  return decodeXmlEntities(xml.replace(/<w:tab[^>]*\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 50000);
}

function htmlToText(raw: string) {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().slice(0, 50000);
}

function emptyPreview() {
  return {
    name: "", hostType: "", tagline: "", shortDescription: "", description: "", city: "", state: "",
    websiteUrl: "", publicEmail: "", phone: "", instagramUrl: "", facebookUrl: "", specialties: [] as string[],
    serviceAreas: [] as string[], audiences: [] as string[], languages: [] as string[], accessibility: "",
    foundedYear: null as number | null, confidenceNotes: [] as string[],
  };
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function findLabeled(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\-]\\s*([^\\n]+)`, "i"));
    if (match?.[1]) return clean(match[1], 1000);
  }
  return "";
}

function findOrganizerName(text: string) {
  const labeled = findLabeled(text, ["Business name", "Organization name", "Company name", "Host name", "Organizer", "Organization", "Company"]);
  if (labeled) return labeled;
  const inline = text.match(/(?:hosted|presented|organized|produced)\s+by\s+([^\n|•]{2,160})/i);
  return inline?.[1] ? clean(inline[1].replace(/\s{2,}.*/, ""), 160) : "";
}

function listAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const inline = findLabeled(text, [label]);
    if (inline) return unique(inline.split(/[,;|]/).map((item) => clean(item, 120))).slice(0, 20);
  }
  return [];
}

function scorePatterns(text: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function classifyDocument(text: string): Classification {
  const value = text.slice(0, 80000);
  if (!value.trim()) return { documentType: "unknown", confidence: 0.2, reasons: ["No readable text was available for document classification."] };

  const eventScore = scorePatterns(value, [
    /\b(event date|event details|event schedule|doors open|admission|ticket(?:s|ing)?|early access|general admission)\b/i,
    /\b(venue|check[- ]?in|refund policy|parking|dress code|capacity)\b/i,
    /\b(hosted|presented|organized)\s+by\b/i,
    /\b\d{1,2}:\d{2}\s*(?:am|pm)\b/i,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  ]);
  const profileScore = scorePatterns(value, [
    /\b(about us|company overview|organization overview|our mission|our story|media kit)\b/i,
    /\b(services|specialties|service areas|who we serve|founded|established)\b/i,
    /\b(contact us|website|social media)\b/i,
  ]);
  const vendorScore = scorePatterns(value, [/\b(vendor application|vendor packet|exhibitor|booth fee|booth size|vendor requirements)\b/i]);
  const venueScore = scorePatterns(value, [/\b(venue rental|rental rates|floor plan|room capacity|facility rules|banquet hall)\b/i]);
  const brandScore = scorePatterns(value, [/\b(brand guidelines|brand guide|logo usage|color palette|typography|brand standards)\b/i]);

  const scored: Array<[DocumentType, number]> = [
    ["event", eventScore], ["host_profile", profileScore], ["vendor", vendorScore], ["venue", venueScore], ["brand_kit", brandScore],
  ];
  scored.sort((a, b) => b[1] - a[1]);
  const [winner, winnerScore] = scored[0];
  const runnerUp = scored[1]?.[1] ?? 0;
  if (winnerScore <= 0) return { documentType: "unknown", confidence: 0.35, reasons: ["The document does not contain enough recognizable profile, event, vendor, venue, or brand-kit signals."] };

  const confidence = Math.min(0.98, 0.55 + winnerScore * 0.08 + Math.max(0, winnerScore - runnerUp) * 0.06);
  const reasonByType: Record<DocumentType, string> = {
    event: "Event-specific details such as dates, admission, schedule, venue, or check-in were detected.",
    host_profile: "Organization/profile details such as services, mission, service areas, or company background were detected.",
    vendor: "Vendor or exhibitor terms were detected.",
    venue: "Venue rental or facility details were detected.",
    brand_kit: "Brand-guideline, logo, color, or typography details were detected.",
    unknown: "The document type could not be identified reliably.",
  };
  return { documentType: winner, confidence, reasons: [reasonByType[winner]] };
}

function fallbackFromText(text: string, classification: Classification) {
  const preview = emptyPreview();
  preview.name = findOrganizerName(text);
  preview.tagline = findLabeled(text, ["Tagline", "Slogan"]);
  preview.description = findLabeled(text, ["About the organizer", "About the host", "About us", "Company overview", "Organization overview", "Mission"]);
  preview.shortDescription = findLabeled(text, ["Short description", "Summary", "Company summary", "Organization summary"]) || preview.description.slice(0, 220);
  preview.websiteUrl = text.match(/https?:\/\/[^\s<>)]+/i)?.[0] ?? "";
  preview.publicEmail = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  preview.phone = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? "";
  preview.instagramUrl = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s<>)]+/i)?.[0] ?? "";
  preview.facebookUrl = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s<>)]+/i)?.[0] ?? "";
  preview.specialties = listAfterLabel(text, ["Specialties", "Services", "Offerings", "What we do"]);
  preview.serviceAreas = listAfterLabel(text, ["Service areas", "Areas served", "Markets served"]);
  preview.audiences = listAfterLabel(text, ["Audience", "Audiences", "Who we serve"]);
  preview.languages = listAfterLabel(text, ["Languages"]);
  preview.accessibility = findLabeled(text, ["Accessibility", "Accessibility information", "Accommodations"]);
  const founded = text.match(/(?:founded|established|since)\s*(?:in\s*)?(18\d{2}|19\d{2}|20\d{2})/i);
  preview.foundedYear = founded ? Number(founded[1]) : null;
  if (/\bnonprofit|non-profit|501\(c\)/i.test(text)) preview.hostType = "nonprofit";
  else if (/\bvenue\b/i.test(text) && classification.documentType === "host_profile") preview.hostType = "venue";
  else if (/\bcompany|business\b/i.test(text)) preview.hostType = "business";
  else if (preview.name) preview.hostType = "organization";

  preview.confidenceNotes = ["Basic source extraction was used. Review every proposed field before applying it to the public profile."];
  if (classification.documentType === "event") {
    preview.confidenceNotes.push("This appears to be an event document. Only clearly identified host or organizer details are proposed here. Import the full document in Event Builder.");
  } else if (classification.documentType !== "host_profile" && classification.documentType !== "unknown") {
    preview.confidenceNotes.push(`This appears to be a ${classification.documentType.replace("_", " ")} document. Only supported host-profile details are proposed here.`);
  }
  return preview;
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["documentType","documentTypeConfidence","documentTypeReasons","name","hostType","tagline","shortDescription","description","city","state","websiteUrl","publicEmail","phone","instagramUrl","facebookUrl","specialties","serviceAreas","audiences","languages","accessibility","foundedYear","confidenceNotes"],
    properties: {
      documentType: { type: "string", enum: ["host_profile","event","vendor","venue","brand_kit","unknown"] },
      documentTypeConfidence: { type: "number", minimum: 0, maximum: 1 },
      documentTypeReasons: { type: "array", maxItems: 10, items: { type: "string" } },
      name: { type: "string" },
      hostType: { type: "string", enum: ["","individual","business","organization","nonprofit","community","venue","creator","other"] },
      tagline: { type: "string" }, shortDescription: { type: "string" }, description: { type: "string" }, city: { type: "string" }, state: { type: "string" },
      websiteUrl: { type: "string" }, publicEmail: { type: "string" }, phone: { type: "string" }, instagramUrl: { type: "string" }, facebookUrl: { type: "string" },
      specialties: { type: "array", maxItems: 20, items: { type: "string" } },
      serviceAreas: { type: "array", maxItems: 20, items: { type: "string" } },
      audiences: { type: "array", maxItems: 20, items: { type: "string" } },
      languages: { type: "array", maxItems: 20, items: { type: "string" } },
      accessibility: { type: "string" }, foundedYear: { type: ["integer", "null"] },
      confidenceNotes: { type: "array", maxItems: 20, items: { type: "string" } },
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

function normalizePreview(raw: any) {
  const preview = emptyPreview();
  const hostTypes = new Set(["individual","business","organization","nonprofit","community","venue","creator","other"]);
  preview.name = clean(raw?.name, 160);
  preview.hostType = hostTypes.has(raw?.hostType) ? raw.hostType : "";
  preview.tagline = clean(raw?.tagline, 180);
  preview.shortDescription = clean(raw?.shortDescription, 280);
  preview.description = clean(raw?.description, 6000);
  preview.city = clean(raw?.city, 120);
  preview.state = clean(raw?.state, 80);
  preview.websiteUrl = clean(raw?.websiteUrl, 500);
  preview.publicEmail = clean(raw?.publicEmail, 320);
  preview.phone = clean(raw?.phone, 120);
  preview.instagramUrl = clean(raw?.instagramUrl, 500);
  preview.facebookUrl = clean(raw?.facebookUrl, 500);
  preview.specialties = unique(Array.isArray(raw?.specialties) ? raw.specialties.map((value: unknown) => clean(value, 120)) : []).slice(0, 20);
  preview.serviceAreas = unique(Array.isArray(raw?.serviceAreas) ? raw.serviceAreas.map((value: unknown) => clean(value, 120)) : []).slice(0, 20);
  preview.audiences = unique(Array.isArray(raw?.audiences) ? raw.audiences.map((value: unknown) => clean(value, 120)) : []).slice(0, 20);
  preview.languages = unique(Array.isArray(raw?.languages) ? raw.languages.map((value: unknown) => clean(value, 120)) : []).slice(0, 20);
  preview.accessibility = clean(raw?.accessibility, 3000);
  const foundedYear = Number(raw?.foundedYear);
  preview.foundedYear = Number.isInteger(foundedYear) && foundedYear >= 1800 && foundedYear <= 2200 ? foundedYear : null;
  preview.confidenceNotes = unique(Array.isArray(raw?.confidenceNotes) ? raw.confidenceNotes.map((value: unknown) => clean(value, 500)) : []).slice(0, 20);
  return preview;
}

function normalizeClassification(raw: any, fallback: Classification): Classification {
  const valid = new Set<DocumentType>(["host_profile","event","vendor","venue","brand_kit","unknown"]);
  const documentType = valid.has(raw?.documentType) ? raw.documentType as DocumentType : fallback.documentType;
  const confidenceNumber = Number(raw?.documentTypeConfidence);
  const confidence = Number.isFinite(confidenceNumber) ? Math.max(0, Math.min(1, confidenceNumber)) : fallback.confidence;
  const reasons = unique(Array.isArray(raw?.documentTypeReasons) ? raw.documentTypeReasons.map((value: unknown) => clean(value, 300)) : fallback.reasons).slice(0, 10);
  return { documentType, confidence, reasons };
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

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const organizationId = clean(body?.organizationId, 80);
    const platformOrganizationId = clean(body?.platformOrganizationId, 80);
    const mode = clean(body?.mode, 30);
    if (!organizationId || !platformOrganizationId || !["files","website","pasted_text"].includes(mode)) return json({ error: "Invalid profile import request." }, 400);

    const { data: organizationRows, error: organizationsError } = await client.rpc("list_my_organizations");
    if (organizationsError) throw organizationsError;
    const activeOrganization = (organizationRows ?? []).find((row: any) => row.id === platformOrganizationId && row.is_active === true);
    if (!activeOrganization) return json({ error: "Switch to this organization before importing profile details." }, 403);

    const { data: canManage, error: permissionError } = await client.rpc("organization_has_permission", {
      p_organization_id: platformOrganizationId,
      p_permission_code: "organization.settings.manage",
    });
    if (permissionError) throw permissionError;
    if (canManage !== true) return json({ error: "Organization settings permission is required." }, 403);

    const { data: hostOrganization, error: hostError } = await client.from("host_organizations")
      .select("id,platform_organization_id").eq("id", organizationId).eq("platform_organization_id", platformOrganizationId).maybeSingle();
    if (hostError) throw hostError;
    if (!hostOrganization) return json({ error: "This host profile belongs to a different organization." }, 403);

    const inputContent: any[] = [];
    const textSources: string[] = [];
    let sourceLabel = "Profile details";
    let sourceUrl: string | null = null;

    if (mode === "pasted_text") {
      const sourceText = clean(body?.sourceText, 50000);
      if (!sourceText) return json({ error: "Paste profile or business details first." }, 400);
      textSources.push(sourceText);
      sourceLabel = "Pasted profile details";
    }

    if (mode === "website") {
      const parsed = publicHttpUrl(clean(body?.sourceUrl, 1000));
      sourceUrl = parsed.toString();
      const response = await fetch(sourceUrl, { headers: { "User-Agent": "ExperiencePlatform-ProfileImporter/1.0" }, redirect: "follow" });
      publicHttpUrl(response.url);
      if (!response.ok) return json({ error: `Unable to read that website (${response.status}).` }, 400);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) return json({ error: "That URL does not point to a readable public web page." }, 400);
      const text = htmlToText((await response.text()).slice(0, 250000));
      if (!text) return json({ error: "No readable public profile details were found on that page." }, 400);
      textSources.push(text);
      sourceLabel = parsed.hostname;
    }

    if (mode === "files") {
      const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
      if (!files.length) return json({ error: "Upload at least one profile source file." }, 400);
      if (Array.isArray(body?.files) && body.files.length > MAX_FILES) return json({ error: `Upload up to ${MAX_FILES} files at a time.` }, 400);
      sourceLabel = files.length === 1 ? clean(files[0]?.name, 240) || "Uploaded profile file" : `${files.length} uploaded profile files`;

      for (const raw of files) {
        const path = clean(raw?.path, 1000);
        const name = clean(raw?.name, 240);
        if (!path || !name || !safeTenantImportPath(path, platformOrganizationId, organizationId, userId)) return json({ error: "One uploaded file path is outside the active organization." }, 400);
        const mime = mimeFor(name, clean(raw?.mimeType, 160));
        const { data: blob, error: downloadError } = await client.storage.from("event-imports").download(path);
        if (downloadError || !blob) throw downloadError ?? new Error(`Unable to read ${name}.`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.byteLength > MAX_FILE_BYTES) return json({ error: `${name} is larger than 10 MB.` }, 400);

        if (mime === "text/plain") {
          const text = new TextDecoder().decode(bytes).trim().slice(0, 50000);
          if (text) textSources.push(`${name}\n${text}`);
        } else if (mime === "text/html") {
          const text = htmlToText(new TextDecoder().decode(bytes));
          if (text) textSources.push(`${name}\n${text}`);
        } else if (mime.includes("wordprocessingml")) {
          const text = await extractDocxText(bytes);
          if (text) textSources.push(`${name}\n${text}`);
        } else if (["image/jpeg","image/png","image/webp"].includes(mime)) {
          inputContent.push({ type: "input_image", image_url: `data:${mime};base64,${bytesToBase64(bytes)}`, detail: "high" });
        } else if (mime === "application/pdf") {
          inputContent.push({ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${bytesToBase64(bytes)}` });
        } else {
          return json({ error: `${name} is not a supported profile source file.` }, 400);
        }
      }
    }

    const combinedText = textSources.join("\n\n--- SOURCE ---\n\n").slice(0, 80000);
    const deterministicClassification = classifyDocument(combinedText);
    let classification = deterministicClassification;
    let extractionSource: "ai" | "source" | "fallback" = combinedText ? "source" : "fallback";
    let extractionMessage = combinedText ? "Basic source extraction was used." : "No readable text was available for basic extraction.";
    let preview = fallbackFromText(combinedText, classification);

    if (openAiKey && (combinedText || inputContent.length)) {
      const content = [...inputContent];
      if (combinedText) content.unshift({ type: "input_text", text: `SOURCE MATERIAL\n${combinedText}` });
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: MODEL,
          instructions: "First classify the supplied material as host_profile, event, vendor, venue, brand_kit, or unknown. Then extract only public host/business/organization profile details explicitly supported by the source. If the material is primarily an event document, extract only clearly identified organizer/host identity and contact details. Do not treat the event title, event venue, event audience, event accessibility, ticketing, schedule, or event policies as host-profile fields. Do not infer race, ethnicity, mission, audience, ownership, certifications, accessibility, service area, or contact details. Leave missing fields empty. Imported information is only a proposal for human review and must not be treated as published data.",
          input: [{ role: "user", content }],
          text: { format: { type: "json_schema", name: "host_profile_import_preview", strict: true, schema: schema() } },
        }),
      });
      const payload = await upstream.json();
      const output = upstream.ok ? readOutputText(payload) : "";
      if (output) {
        try {
          const raw = JSON.parse(output);
          preview = normalizePreview(raw);
          const aiClassification = normalizeClassification(raw, deterministicClassification);
          classification = deterministicClassification.documentType === "event" && deterministicClassification.confidence >= 0.7 ? deterministicClassification : aiClassification;
          extractionSource = "ai";
          extractionMessage = "AI extraction completed. Review every proposed field before applying it.";
        } catch {
          preview.confidenceNotes = unique([...preview.confidenceNotes, "AI extraction returned an unreadable result, so basic source extraction was used."]);
          extractionMessage = "AI extraction returned an unreadable result. Basic source extraction was used instead.";
        }
      } else {
        preview.confidenceNotes = unique([...preview.confidenceNotes, "AI extraction was unavailable, so basic source extraction was used."]);
        extractionMessage = "AI extraction was unavailable. Basic source extraction was used instead.";
      }
    } else if (!openAiKey) {
      preview.confidenceNotes = unique([...preview.confidenceNotes, "AI extraction is not configured for this environment. Basic source extraction was used."]);
      extractionMessage = "AI extraction is not configured. Basic source extraction was used.";
    }

    if (classification.documentType === "event" && !preview.confidenceNotes.some((note) => /event document/i.test(note))) {
      preview.confidenceNotes = unique([...preview.confidenceNotes, "This appears to be an event document. Only clearly identified host or organizer details are proposed here. Import the full document in Event Builder."]);
    }

    const extractedPayload = {
      ...preview,
      _documentType: classification.documentType,
      _documentTypeConfidence: classification.confidence,
      _documentTypeReasons: classification.reasons,
      _extractionSource: extractionSource,
      _extractionMessage: extractionMessage,
    };
    const { data: importRow, error: importError } = await client.from("host_profile_imports").insert({
      organization_id: organizationId,
      platform_organization_id: platformOrganizationId,
      owner_profile_id: userId,
      source_type: mode,
      source_label: sourceLabel,
      source_url: sourceUrl,
      extracted_payload: extractedPayload,
      approved_payload: {},
      status: "preview",
    }).select("id").single();
    if (importError) throw importError;

    return json({
      importId: importRow.id,
      sourceLabel,
      sourceUrl,
      extractionSource,
      extractionMessage,
      documentType: classification.documentType,
      documentTypeConfidence: classification.confidence,
      documentTypeReasons: classification.reasons,
      eventHandoffRecommended: classification.documentType === "event",
      preview,
    });
  } catch (error) {
    console.error("host-profile-import-preview", error);
    return json({ error: error instanceof Error ? error.message : "Unable to read these host profile details." }, 500);
  }
});
