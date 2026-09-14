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

function fallbackFromText(text: string) {
  const preview = emptyPreview();
  preview.name = findLabeled(text, ["Business name", "Organization name", "Company name", "Host name", "Name"]);
  preview.tagline = findLabeled(text, ["Tagline", "Slogan"]);
  preview.description = findLabeled(text, ["About", "Description", "Mission"]);
  preview.shortDescription = preview.description.slice(0, 220);
  preview.websiteUrl = text.match(/https?:\/\/[^\s<>)]+/i)?.[0] ?? "";
  preview.publicEmail = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  preview.phone = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? "";
  preview.instagramUrl = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s<>)]+/i)?.[0] ?? "";
  preview.facebookUrl = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s<>)]+/i)?.[0] ?? "";
  const yearMatch = text.match(/(?:founded|established|since)\s*(?:in\s*)?(18\d{2}|19\d{2}|20\d{2})/i);
  preview.foundedYear = yearMatch ? Number(yearMatch[1]) : null;
  preview.confidenceNotes = ["Basic extraction was used. Review every field before applying it to the public profile."];
  return preview;
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name","hostType","tagline","shortDescription","description","city","state","websiteUrl","publicEmail","phone","instagramUrl","facebookUrl","specialties","serviceAreas","audiences","languages","accessibility","foundedYear","confidenceNotes"],
    properties: {
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
    if (!organizationId || !platformOrganizationId || !["files","website","pasted_text"].includes(mode)) {
      return json({ error: "Invalid profile import request." }, 400);
    }

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

    const { data: hostOrganization, error: hostError } = await client
      .from("host_organizations")
      .select("id,platform_organization_id")
      .eq("id", organizationId)
      .eq("platform_organization_id", platformOrganizationId)
      .maybeSingle();
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
      const html = (await response.text()).slice(0, 250000);
      const text = htmlToText(html);
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
    let extractionSource: "ai" | "source" | "fallback" = combinedText ? "source" : "fallback";
    let preview = fallbackFromText(combinedText);

    if (openAiKey && (combinedText || inputContent.length)) {
      const content = [...inputContent];
      if (combinedText) content.unshift({ type: "input_text", text: `SOURCE MATERIAL\n${combinedText}` });
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: MODEL,
          instructions: "Extract a proposed public host, business, organization, nonprofit, community, venue, or creator profile from the supplied source material. Use only details supported by the source. Do not infer race, ethnicity, mission, audience, ownership, certifications, accessibility, service area, or contact details. Leave missing fields empty. Imported information is only a proposal for human review and must not be treated as published data.",
          input: [{ role: "user", content }],
          text: { format: { type: "json_schema", name: "host_profile_import_preview", strict: true, schema: schema() } },
        }),
      });
      const payload = await upstream.json();
      const output = upstream.ok ? readOutputText(payload) : "";
      if (output) {
        try {
          preview = normalizePreview(JSON.parse(output));
          extractionSource = "ai";
        } catch {
          preview.confidenceNotes = unique([...preview.confidenceNotes, "AI extraction returned an unreadable result, so basic source extraction was used."]);
        }
      }
    }

    const { data: importRow, error: importError } = await client.from("host_profile_imports").insert({
      organization_id: organizationId,
      platform_organization_id: platformOrganizationId,
      owner_profile_id: userId,
      source_type: mode,
      source_label: sourceLabel,
      source_url: sourceUrl,
      extracted_payload: preview,
      approved_payload: {},
      status: "preview",
    }).select("id").single();
    if (importError) throw importError;

    return json({ importId: importRow.id, sourceLabel, sourceUrl, extractionSource, preview });
  } catch (error) {
    console.error("host-profile-import-preview", error);
    return json({ error: error instanceof Error ? error.message : "Unable to read these host profile details." }, 500);
  }
});
