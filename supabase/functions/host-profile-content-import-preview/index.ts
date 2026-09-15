import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import JSZip from "npm:jszip@3.10.1";
import { extractWorkbookSheets, workbookSheetsToText, type WorkbookSheet } from "./xlsx.ts";

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

type ImportTarget = "faq" | "policies";
type ContentScope = "host" | "event" | "mixed" | "unknown";
type FAQItem = { id: string; question: string; answer: string; category: string; displayOrder: number | null; publish: boolean; sourceLabel: string };
type PolicyItem = { id: string; policyType: string; title: string; body: string; appliesTo: "host" | "event" | "unknown"; effectiveDate: string; publish: boolean; sourceLabel: string };

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item).trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

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
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) throw new Error("Local or private network addresses cannot be imported.");
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
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/plain";
  if (supplied && supplied !== "application/octet-stream" && supplied !== "application/vnd.ms-excel") return supplied.toLowerCase();
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
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:p|div|section|article|h[1-6]|li|tr|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 50000);
}

function sourceLines(text: string) {
  return String(text ?? "").split(/\r?\n+/).map((value) => value.trim()).filter(Boolean);
}

function isInternalStart(line: string) {
  return /^(?:internal use only|internal only|confidential|private and confidential|do not publish|staff only)\b/i.test(line.trim());
}

function isUpperHeading(line: string) {
  const value = line.trim();
  const letters = value.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && value === value.toUpperCase() && value.length <= 100;
}

function publicSourceText(text: string) {
  const lines = sourceLines(text);
  const output: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (isInternalStart(line)) { skipping = true; continue; }
    if (skipping) {
      if (isUpperHeading(line) && !isInternalStart(line)) skipping = false;
      else continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function normalizeHeader(value: string) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function truthyPublish(value: string) {
  const normalized = clean(value, 30).toLowerCase();
  if (!normalized) return true;
  return !["no", "false", "0", "draft", "do not publish", "private"].includes(normalized);
}

function rowsFromTabText(text: string) {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes("\t")) continue;
    const row = line.split("\t").map((cell) => cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function findHeader(rows: string[][], aliases: Record<string, string[]>) {
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map(normalizeHeader);
    const mapping: Record<string, number> = {};
    for (const [key, labels] of Object.entries(aliases)) {
      const column = normalized.findIndex((cell) => labels.includes(cell));
      if (column >= 0) mapping[key] = column;
    }
    if (Object.keys(mapping).length >= 2) return { index, mapping };
  }
  return null;
}

function parseFaqRows(rows: string[][], sourceLabel: string) {
  const aliases = {
    category: ["category", "faq category"],
    question: ["question", "faq question"],
    answer: ["answer", "faq answer", "response"],
    displayOrder: ["display order", "order", "sort order"],
    publish: ["publish", "published", "public"],
  };
  const header = findHeader(rows, aliases);
  if (!header || header.mapping.question === undefined || header.mapping.answer === undefined) return [] as FAQItem[];
  const items: FAQItem[] = [];
  for (const row of rows.slice(header.index + 1)) {
    const question = clean(row[header.mapping.question], 500);
    const answer = clean(row[header.mapping.answer], 6000);
    if (!question || !answer) continue;
    const orderRaw = header.mapping.displayOrder === undefined ? "" : clean(row[header.mapping.displayOrder], 20);
    const order = Number(orderRaw);
    items.push({
      id: crypto.randomUUID(),
      question,
      answer,
      category: header.mapping.category === undefined ? "" : clean(row[header.mapping.category], 160),
      displayOrder: Number.isFinite(order) ? order : null,
      publish: header.mapping.publish === undefined ? true : truthyPublish(row[header.mapping.publish] ?? ""),
      sourceLabel,
    });
  }
  return items;
}

function parsePolicyRows(rows: string[][], sourceLabel: string) {
  const aliases = {
    policyType: ["policy type", "type", "category"],
    title: ["title", "policy title", "policy"],
    body: ["policy text", "body", "policy details", "details", "text"],
    appliesTo: ["applies to", "scope"],
    effectiveDate: ["effective date", "effective"],
    publish: ["publish", "published", "public"],
  };
  const header = findHeader(rows, aliases);
  if (!header || header.mapping.title === undefined || header.mapping.body === undefined) return [] as PolicyItem[];
  const items: PolicyItem[] = [];
  for (const row of rows.slice(header.index + 1)) {
    const title = clean(row[header.mapping.title], 300);
    const body = clean(row[header.mapping.body], 10000);
    if (!title || !body) continue;
    const scopeRaw = header.mapping.appliesTo === undefined ? "" : normalizeHeader(row[header.mapping.appliesTo] ?? "");
    const appliesTo = scopeRaw.includes("event") ? "event" : scopeRaw.includes("host") || scopeRaw.includes("organization") ? "host" : "unknown";
    items.push({
      id: crypto.randomUUID(),
      policyType: header.mapping.policyType === undefined ? "" : clean(row[header.mapping.policyType], 120),
      title,
      body,
      appliesTo,
      effectiveDate: header.mapping.effectiveDate === undefined ? "" : clean(row[header.mapping.effectiveDate], 120),
      publish: header.mapping.publish === undefined ? true : truthyPublish(row[header.mapping.publish] ?? ""),
      sourceLabel,
    });
  }
  return items;
}

function parseFaqText(text: string, sourceLabel: string) {
  const lines = sourceLines(publicSourceText(text));
  const items: FAQItem[] = [];
  let pendingQuestion = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const q = line.match(/^(?:q(?:uestion)?\s*[:.-]\s*)(.+)$/i);
    if (q) { pendingQuestion = clean(q[1], 500); continue; }
    const a = line.match(/^(?:a(?:nswer)?\s*[:.-]\s*)(.+)$/i);
    if (a && pendingQuestion) {
      items.push({ id: crypto.randomUUID(), question: pendingQuestion, answer: clean(a[1], 6000), category: "", displayOrder: null, publish: true, sourceLabel });
      pendingQuestion = "";
      continue;
    }
    if (/\?$/.test(line) && line.length <= 500) {
      const next = lines[index + 1];
      if (next && !/\?$/.test(next) && !/^(?:q(?:uestion)?|a(?:nswer)?)\s*[:.-]/i.test(next)) {
        items.push({ id: crypto.randomUUID(), question: line.replace(/^\d+[.)]\s*/, ""), answer: clean(next.replace(/^[-•]\s*/, ""), 6000), category: "", displayOrder: null, publish: true, sourceLabel });
        index += 1;
      }
    }
  }
  return unique(items, (item) => item.question);
}

const POLICY_TYPES: Array<[string, RegExp]> = [
  ["Cancellation", /cancel(?:lation|ations)?/i],
  ["Refunds", /refund/i],
  ["Transfers", /transfer/i],
  ["Age requirements", /\bage\b|minor|children|youth/i],
  ["Accessibility", /accessib|accommodation/i],
  ["Conduct", /conduct|behavior|behaviour|code of conduct/i],
  ["Weather", /weather|storm|rain|heat|wind/i],
  ["Vendor", /vendor|exhibitor/i],
  ["Privacy", /privacy|personal data|data policy/i],
  ["Payment", /payment|billing|deposit/i],
];

function inferPolicyType(title: string) {
  return POLICY_TYPES.find(([, pattern]) => pattern.test(title))?.[0] ?? "Other";
}

function policyHeading(line: string) {
  const trimmed = line.trim().replace(/^\d+[.)]\s*/, "");
  if (trimmed.length > 180) return false;
  if (/^[A-Z][A-Za-z &/()-]{2,80}:$/.test(trimmed)) return true;
  return /\b(policy|policies|refunds?|cancellations?|transfers?|conduct|weather|privacy|payments?|accessibility|age requirements?)\b:?$/i.test(trimmed);
}

function parsePolicyText(text: string, sourceLabel: string) {
  const lines = sourceLines(publicSourceText(text));
  const items: PolicyItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/^([^:]{2,180}(?:policy|refunds?|cancellations?|transfers?|conduct|weather|privacy|payments?|accessibility|age requirements?))\s*:\s*(.+)$/i);
    if (inline) {
      const title = clean(inline[1], 300);
      items.push({ id: crypto.randomUUID(), policyType: inferPolicyType(title), title, body: clean(inline[2], 10000), appliesTo: "unknown", effectiveDate: "", publish: true, sourceLabel });
      continue;
    }
    if (!policyHeading(line)) continue;
    const title = clean(line.replace(/:$/, ""), 300);
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (policyHeading(lines[cursor]) && body.length) break;
      body.push(lines[cursor]);
      if (body.join(" ").length > 10000) break;
    }
    if (body.length) items.push({ id: crypto.randomUUID(), policyType: inferPolicyType(title), title, body: clean(body.join("\n"), 10000), appliesTo: "unknown", effectiveDate: "", publish: true, sourceLabel });
  }
  return unique(items, (item) => item.title);
}

function classifyScope(text: string): { scope: ContentScope; confidence: number; reasons: string[] } {
  const publicText = publicSourceText(text);
  const eventPatterns = [
    /\b(event date|event schedule|doors open|admission|ticket(?:s|ing)?|check[- ]?in|venue|event location)\b/i,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b\d{1,2}:\d{2}\s*(?:am|pm)\b/i,
    /\bthis event\b|\bevent-specific\b/i,
  ];
  const hostPatterns = [/\borganization-wide\b|\bcompany policy\b|\bhost policy\b|\ball events\b|\bstandard policy\b|\bgeneral faq\b/i, /\babout us\b|\bservices\b|\bpublic contact\b/i];
  const eventScore = eventPatterns.reduce((score, pattern) => score + (pattern.test(publicText) ? 1 : 0), 0);
  const hostScore = hostPatterns.reduce((score, pattern) => score + (pattern.test(publicText) ? 1 : 0), 0);
  if (eventScore >= 2 && hostScore > 0) return { scope: "mixed", confidence: Math.min(.95, .62 + eventScore * .07), reasons: ["The source contains both event-specific details and organization-level content."] };
  if (eventScore >= 2) return { scope: "event", confidence: Math.min(.96, .66 + eventScore * .07), reasons: ["Dates, tickets, venue, schedule, or other event-specific details were detected."] };
  if (hostScore > 0) return { scope: "host", confidence: Math.min(.92, .66 + hostScore * .08), reasons: ["Organization-level or reusable host content was detected."] };
  return { scope: "unknown", confidence: .45, reasons: ["The source does not contain enough scope signals to classify it confidently."] };
}

function faqSchema() {
  return {
    type: "object", additionalProperties: false,
    required: ["scope", "scopeConfidence", "scopeReasons", "items", "confidenceNotes"],
    properties: {
      scope: { type: "string", enum: ["host", "event", "mixed", "unknown"] },
      scopeConfidence: { type: "number", minimum: 0, maximum: 1 },
      scopeReasons: { type: "array", maxItems: 8, items: { type: "string" } },
      items: { type: "array", maxItems: 60, items: { type: "object", additionalProperties: false, required: ["question", "answer", "category", "displayOrder", "publish"], properties: {
        question: { type: "string" }, answer: { type: "string" }, category: { type: "string" }, displayOrder: { type: ["integer", "null"] }, publish: { type: "boolean" },
      } } },
      confidenceNotes: { type: "array", maxItems: 20, items: { type: "string" } },
    },
  };
}

function policySchema() {
  return {
    type: "object", additionalProperties: false,
    required: ["scope", "scopeConfidence", "scopeReasons", "items", "confidenceNotes"],
    properties: {
      scope: { type: "string", enum: ["host", "event", "mixed", "unknown"] },
      scopeConfidence: { type: "number", minimum: 0, maximum: 1 },
      scopeReasons: { type: "array", maxItems: 8, items: { type: "string" } },
      items: { type: "array", maxItems: 60, items: { type: "object", additionalProperties: false, required: ["policyType", "title", "body", "appliesTo", "effectiveDate", "publish"], properties: {
        policyType: { type: "string" }, title: { type: "string" }, body: { type: "string" }, appliesTo: { type: "string", enum: ["host", "event", "unknown"] }, effectiveDate: { type: "string" }, publish: { type: "boolean" },
      } } },
      confidenceNotes: { type: "array", maxItems: 20, items: { type: "string" } },
    },
  };
}

function readOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text;
  return "";
}

function normalizeAiFaq(raw: any, sourceLabel: string) {
  const items: FAQItem[] = (Array.isArray(raw?.items) ? raw.items : []).map((item: any) => ({
    id: crypto.randomUUID(), question: clean(item?.question, 500), answer: clean(item?.answer, 6000), category: clean(item?.category, 160),
    displayOrder: Number.isInteger(Number(item?.displayOrder)) ? Number(item.displayOrder) : null, publish: item?.publish !== false, sourceLabel,
  })).filter((item: FAQItem) => item.question && item.answer);
  return unique(items, (item) => item.question);
}

function normalizeAiPolicies(raw: any, sourceLabel: string) {
  const items: PolicyItem[] = (Array.isArray(raw?.items) ? raw.items : []).map((item: any) => ({
    id: crypto.randomUUID(), policyType: clean(item?.policyType, 120) || inferPolicyType(clean(item?.title, 300)), title: clean(item?.title, 300), body: clean(item?.body, 10000),
    appliesTo: ["host", "event"].includes(item?.appliesTo) ? item.appliesTo : "unknown", effectiveDate: clean(item?.effectiveDate, 120), publish: item?.publish !== false, sourceLabel,
  })).filter((item: PolicyItem) => item.title && item.body);
  return unique(items, (item) => item.title);
}

function normalizedScope(raw: any, fallback: ReturnType<typeof classifyScope>) {
  const scope: ContentScope = ["host", "event", "mixed", "unknown"].includes(raw?.scope) ? raw.scope : fallback.scope;
  const confidenceRaw = Number(raw?.scopeConfidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : fallback.confidence;
  const reasons = Array.isArray(raw?.scopeReasons) ? raw.scopeReasons.map((value: unknown) => clean(value, 400)).filter(Boolean).slice(0, 8) : fallback.reasons;
  return { scope, confidence, reasons };
}

function mergeFaq(source: FAQItem[], ai: FAQItem[]) {
  const byQuestion = new Map(ai.map((item) => [normalizeHeader(item.question), item]));
  for (const item of source) byQuestion.set(normalizeHeader(item.question), item);
  return [...byQuestion.values()];
}

function mergePolicies(source: PolicyItem[], ai: PolicyItem[]) {
  const byTitle = new Map(ai.map((item) => [normalizeHeader(item.title), item]));
  for (const item of source) byTitle.set(normalizeHeader(item.title), item);
  return [...byTitle.values()];
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
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const organizationId = clean(body?.organizationId, 80);
    const platformOrganizationId = clean(body?.platformOrganizationId, 80);
    const mode = clean(body?.mode, 30);
    const target = clean(body?.target, 30) as ImportTarget;
    if (!organizationId || !platformOrganizationId || !["files", "website", "pasted_text"].includes(mode) || !["faq", "policies"].includes(target)) return json({ error: "Invalid content import request." }, 400);

    const { data: organizationRows, error: organizationsError } = await client.rpc("list_my_organizations");
    if (organizationsError) throw organizationsError;
    if (!(organizationRows ?? []).some((row: any) => row.id === platformOrganizationId && row.is_active === true)) return json({ error: "Switch to this organization before importing content." }, 403);
    const { data: canManage, error: permissionError } = await client.rpc("organization_has_permission", { p_organization_id: platformOrganizationId, p_permission_code: "organization.settings.manage" });
    if (permissionError) throw permissionError;
    if (canManage !== true) return json({ error: "Organization settings permission is required." }, 403);
    const { data: hostOrganization, error: hostError } = await client.from("host_organizations").select("id,platform_organization_id").eq("id", organizationId).eq("platform_organization_id", platformOrganizationId).maybeSingle();
    if (hostError) throw hostError;
    if (!hostOrganization) return json({ error: "This host profile belongs to a different organization." }, 403);

    const inputContent: any[] = [];
    const textSources: string[] = [];
    const workbookSheets: WorkbookSheet[] = [];
    let sourceLabel = target === "faq" ? "FAQ source" : "Policy source";
    let sourceUrl: string | null = null;

    if (mode === "pasted_text") {
      const sourceText = clean(body?.sourceText, 50000);
      if (!sourceText) return json({ error: `Paste ${target === "faq" ? "FAQ" : "policy"} content first.` }, 400);
      textSources.push(sourceText);
      sourceLabel = "Pasted content";
    }

    if (mode === "website") {
      const parsed = publicHttpUrl(clean(body?.sourceUrl, 1000));
      sourceUrl = parsed.toString();
      const response = await fetch(sourceUrl, { headers: { "User-Agent": "ExperiencePlatform-ContentImporter/1.0" }, redirect: "follow" });
      publicHttpUrl(response.url);
      if (!response.ok) return json({ error: `Unable to read that website (${response.status}).` }, 400);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) return json({ error: "That URL does not point to a readable public web page." }, 400);
      const text = htmlToText((await response.text()).slice(0, 250000));
      if (!text) return json({ error: "No readable public content was found on that page." }, 400);
      textSources.push(text);
      sourceLabel = parsed.hostname;
    }

    if (mode === "files") {
      const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
      if (!files.length) return json({ error: "Upload at least one source file." }, 400);
      if (body.files.length > MAX_FILES) return json({ error: `Upload up to ${MAX_FILES} files at a time.` }, 400);
      sourceLabel = files.length === 1 ? clean(files[0]?.name, 240) || "Uploaded source" : `${files.length} uploaded files`;
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
        } else if (mime.includes("spreadsheetml") || name.toLowerCase().endsWith(".xlsx")) {
          const sheets = await extractWorkbookSheets(bytes);
          workbookSheets.push(...sheets);
          const text = workbookSheetsToText(sheets);
          if (text) textSources.push(`${name}\n${text}`);
        } else if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
          inputContent.push({ type: "input_image", image_url: `data:${mime};base64,${bytesToBase64(bytes)}`, detail: "high" });
        } else if (mime === "application/pdf") {
          inputContent.push({ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${bytesToBase64(bytes)}` });
        } else return json({ error: `${name} is not a supported source file.` }, 400);
      }
    }

    const combinedText = publicSourceText(textSources.join("\n\n--- SOURCE ---\n\n").slice(0, 80000));
    const deterministicScope = classifyScope(combinedText);
    let scope = deterministicScope;
    let extractionSource: "ai" | "source" | "fallback" = combinedText ? "source" : "fallback";
    let extractionMessage = combinedText ? "Source extraction completed. Review each proposed item before applying it." : "No readable text was available for basic extraction.";
    const confidenceNotes: string[] = [];

    let faqItems: FAQItem[] = [];
    let policyItems: PolicyItem[] = [];
    if (target === "faq") {
      for (const sheet of workbookSheets) faqItems.push(...parseFaqRows(sheet.rows, sourceLabel));
      faqItems.push(...parseFaqRows(rowsFromTabText(combinedText), sourceLabel));
      faqItems.push(...parseFaqText(combinedText, sourceLabel));
      faqItems = unique(faqItems, (item) => item.question);
    } else {
      for (const sheet of workbookSheets) policyItems.push(...parsePolicyRows(sheet.rows, sourceLabel));
      policyItems.push(...parsePolicyRows(rowsFromTabText(combinedText), sourceLabel));
      policyItems.push(...parsePolicyText(combinedText, sourceLabel));
      policyItems = unique(policyItems, (item) => item.title);
    }

    if (openAiKey && (combinedText || inputContent.length)) {
      const content = [...inputContent];
      if (combinedText) content.unshift({ type: "input_text", text: `PUBLIC SOURCE MATERIAL\n${combinedText}` });
      const instructions = target === "faq"
        ? "Extract public FAQ question-and-answer pairs explicitly supported by the supplied source. Do not invent questions or answers. Preserve the source meaning and wording. Ignore internal-only, private, confidential, staff-only, and do-not-publish content. Classify whether the source is reusable host-level content, event-specific content, mixed, or unknown. Keep event-specific FAQ content marked as event scope rather than silently treating it as host-level content. Output is a proposal for human review only."
        : "Extract public policy sections explicitly supported by the supplied source. Preserve policy wording as closely as possible. Do not rewrite, simplify, strengthen, weaken, or invent legal or policy terms. Ignore internal-only, private, confidential, staff-only, and do-not-publish content. Classify whether the source is reusable host-level content, event-specific content, mixed, or unknown. Mark each policy as host, event, or unknown when the source supports that distinction. Output is a proposal for human review only.";
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: MODEL,
          instructions,
          input: [{ role: "user", content }],
          text: { format: { type: "json_schema", name: `host_${target}_import_preview`, strict: true, schema: target === "faq" ? faqSchema() : policySchema() } },
        }),
      });
      const payload = await upstream.json();
      const output = upstream.ok ? readOutputText(payload) : "";
      if (output) {
        try {
          const raw = JSON.parse(output);
          scope = normalizedScope(raw, deterministicScope);
          if (target === "faq") faqItems = mergeFaq(faqItems, normalizeAiFaq(raw, sourceLabel));
          else policyItems = mergePolicies(policyItems, normalizeAiPolicies(raw, sourceLabel));
          if (Array.isArray(raw?.confidenceNotes)) confidenceNotes.push(...raw.confidenceNotes.map((value: unknown) => clean(value, 500)).filter(Boolean));
          extractionSource = "ai";
          extractionMessage = "AI and source extraction completed. Review every proposed item before applying it.";
        } catch {
          confidenceNotes.push("AI extraction returned an unreadable result, so source extraction was kept.");
        }
      } else confidenceNotes.push("AI extraction was unavailable, so source extraction was used.");
    } else if (!openAiKey) confidenceNotes.push("AI extraction is not configured for this environment. Source extraction was used.");

    const items = target === "faq" ? faqItems : policyItems;
    if (!items.length) confidenceNotes.push(`No ${target === "faq" ? "FAQ pairs" : "policy sections"} were identified automatically. Try a labeled document, spreadsheet template, website page, or pasted text.`);
    if (scope.scope === "event" || scope.scope === "mixed") confidenceNotes.push("Event-specific content was detected. Review scope before applying anything to the reusable host profile.");

    const extractedPayload = {
      target,
      scope: scope.scope,
      scopeConfidence: scope.confidence,
      scopeReasons: scope.reasons,
      items,
      _extractionSource: extractionSource,
      _extractionMessage: extractionMessage,
      _confidenceNotes: confidenceNotes,
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
      target,
      sourceLabel,
      sourceUrl,
      extractionSource,
      extractionMessage,
      scope: scope.scope,
      scopeConfidence: scope.confidence,
      scopeReasons: scope.reasons,
      eventHandoffRecommended: scope.scope === "event" || scope.scope === "mixed",
      confidenceNotes,
      items,
    });
  } catch (error) {
    console.error("host-profile-content-import-preview", error);
    return json({ error: error instanceof Error ? error.message : "Unable to read this host content." }, 500);
  }
});
