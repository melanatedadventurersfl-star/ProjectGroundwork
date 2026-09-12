import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const jsonHeaders = { "Content-Type": "application/json" };

const FACT_TYPES = {
  "electric.available": "boolean",
  "electric.scope": "string",
  "electric.voltage": "number",
  "electric.amps": "string_array",
  "water.hookup": "boolean",
  "water.potable_central": "boolean",
  "sewer.hookup": "boolean",
  "dump_station.available": "boolean",
  "camping.tent": "boolean",
  "camping.rv": "boolean",
  "camping.max_rv_length_ft": "number",
  "occupancy.max_people": "number",
  "parking.included_passes": "number",
  "check_in.time": "string",
  "check_out.time": "string",
  "quiet_hours.range": "string",
  "generators.off_during_quiet_hours": "boolean",
  "fires.rings_only": "boolean",
  "pets.allowed": "boolean",
  "pets.max_per_site": "number",
  "pets.fee": "number",
  "pets.shoreline_allowed": "boolean",
  "amenities.showers": "boolean",
  "amenities.restrooms": "boolean",
  "amenities.picnic_tables": "boolean",
  "amenities.playground": "boolean",
  "amenities.concession": "boolean",
  "amenities.laundry": "boolean",
  "amenities.wifi": "boolean",
  "accessibility.ada_sites": "string_array",
  "stay_limit.tent_days": "number",
  "stay_limit.rv_days": "number",
  "stay_limit.window_days": "number",
  "reservations.available": "boolean",
  "pricing.tent_base": "number",
  "pricing.tent_total": "number",
  "pricing.rv_base": "number",
  "pricing.rv_total": "number",
  "pricing.currency": "string",
  "alcohol.allowed": "boolean",
  "hammocks.on_trees_allowed": "boolean",
  "vehicles.golf_carts_atvs_utvs_allowed": "boolean",
  "beach_driving.allowed": "boolean",
  "beach_driving.four_wheel_drive_recommended": "boolean",
  "activities.swimming": "boolean",
  "activities.fishing": "boolean",
  "activities.surfing": "boolean",
  "activities.hiking": "boolean",
  "activities.birding": "boolean",
  "launch.nonmotorized": "boolean",
  "launch.boat": "boolean",
} as const;

type FactKey = keyof typeof FACT_TYPES;

const FACT_KEYS = Object.keys(FACT_TYPES) as FactKey[];

const CAMPING_COMPLETENESS_FIELDS: FactKey[] = [
  "electric.available",
  "water.hookup",
  "sewer.hookup",
  "dump_station.available",
  "camping.tent",
  "camping.rv",
  "occupancy.max_people",
  "check_in.time",
  "check_out.time",
  "quiet_hours.range",
  "pets.allowed",
  "amenities.showers",
  "amenities.restrooms",
  "reservations.available",
  "pricing.currency",
];

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

function readOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function extractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["facts", "warnings"],
    properties: {
      facts: {
        type: "array",
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "value", "evidence", "confidence"],
          properties: {
            field: { type: "string", enum: FACT_KEYS },
            value: { type: "string" },
            evidence: { type: "string", maxLength: 500 },
            confidence: { type: "string", enum: ["explicit", "partial"] },
          },
        },
      },
      warnings: {
        type: "array",
        maxItems: 20,
        items: { type: "string" },
      },
    },
  };
}

function sourcePriority(sourceType: string) {
  if (sourceType === "official_rules") return 95;
  if (sourceType === "official_website") return 90;
  if (sourceType === "reservation") return 85;
  if (sourceType === "api") return 80;
  if (sourceType === "admin") return 70;
  return 40;
}

function parseFactValue(key: FactKey, rawValue: string) {
  const expected = FACT_TYPES[key];
  const value = rawValue.trim();

  if (expected === "boolean") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
    throw new Error(`${key} must be true or false.`);
  }

  if (expected === "number") {
    const parsed = Number(value.replace(/[$,%]/g, "").trim());
    if (!Number.isFinite(parsed)) throw new Error(`${key} must be numeric.`);
    return parsed;
  }

  if (expected === "string_array") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 30);
    } catch {
      // Fall through to comma parsing.
    }
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30);
  }

  return value.slice(0, 500);
}

function stableValue(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify([...value].map(String).sort());
  if (value && typeof value === "object") {
    const sorted = Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

async function fetchPageText(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "GoMelanatedTrailGuide/1.0" },
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`Expected an HTML page but received ${contentType || "an unknown content type"}.`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_HTML_BYTES) throw new Error("Source page is larger than 2 MB.");
  const html = await response.text();
  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) throw new Error("Source page is larger than 2 MB.");
  return stripHtml(html).slice(0, 30000);
}

async function extractFromSource(openAiKey: string, source: any) {
  const url = clean(source.source_url, 2000);
  const fileLike = source.source_type === "official_rules" || /\.pdf(?:$|\?)/i.test(url);
  let content: any[];

  if (fileLike) {
    content = [
      {
        type: "input_text",
        text: `Extract Trail Guide facts from this official source. Source: ${source.source_name}. URL: ${url}`,
      },
      { type: "input_file", file_url: url },
    ];
  } else {
    const pageText = await fetchPageText(url);
    content = [
      {
        type: "input_text",
        text: `Extract Trail Guide facts from this public source. Source: ${source.source_name}. URL: ${url}\n\n${pageText}`,
      },
    ];
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions:
        "You extract outdoor destination and campground facts for Go Melanated. Return only facts explicitly supported by the supplied source. Never infer a missing amenity, hookup, fee, rule, campsite dimension, cell signal, Wi-Fi status, or accessibility feature. If the source does not establish a field, omit it. Keep total/base prices separate when taxes or fees are stated. Evidence must be a short paraphrase of the supporting source text, not a long quotation. Boolean false means the source explicitly says the feature is unavailable or prohibited, never merely that it was not mentioned. For string_array values, return a JSON array encoded as a string. For numbers, return only the numeric value. For booleans, return true or false.",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "trail_guide_source_extract",
          strict: true,
          schema: extractionSchema(),
        },
      },
    }),
  });

  const payload = await upstream.json();
  if (!upstream.ok) {
    console.error("trail-guide-ingest upstream", payload);
    throw new Error(`Extraction failed for ${source.source_name}.`);
  }

  const outputText = readOutputText(payload);
  if (!outputText) throw new Error(`Extraction returned no structured output for ${source.source_name}.`);
  return JSON.parse(outputText) as { facts: Array<{ field: FactKey; value: string; evidence: string; confidence: "explicit" | "partial" }>; warnings: string[] };
}

async function reconcilePlace(userClient: any, placeId: string) {
  const [{ data: facts, error: factsError }, { data: sources, error: sourcesError }] = await Promise.all([
    userClient
      .from("trail_guide_facts")
      .select("id,source_id,field_key,value")
      .eq("place_id", placeId),
    userClient
      .from("trail_guide_sources")
      .select("id,priority,source_date,last_checked_at,status")
      .eq("place_id", placeId)
      .eq("status", "active"),
  ]);

  if (factsError) throw factsError;
  if (sourcesError) throw sourcesError;

  const sourceMap = new Map((sources ?? []).map((source: any) => [source.id, source]));
  const grouped = new Map<string, any[]>();

  for (const fact of facts ?? []) {
    if (!sourceMap.has(fact.source_id)) continue;
    const rows = grouped.get(fact.field_key) ?? [];
    rows.push(fact);
    grouped.set(fact.field_key, rows);
  }

  const conflictKeys: string[] = [];

  for (const [fieldKey, rows] of grouped.entries()) {
    rows.sort((a, b) => {
      const aSource: any = sourceMap.get(a.source_id);
      const bSource: any = sourceMap.get(b.source_id);
      const priorityDelta = Number(bSource?.priority ?? 0) - Number(aSource?.priority ?? 0);
      if (priorityDelta !== 0) return priorityDelta;
      const bDate = Date.parse(bSource?.source_date ?? bSource?.last_checked_at ?? "") || 0;
      const aDate = Date.parse(aSource?.source_date ?? aSource?.last_checked_at ?? "") || 0;
      return bDate - aDate;
    });

    const winner = rows[0];
    const ids = rows.map((row) => row.id);
    const { error: clearError } = await userClient
      .from("trail_guide_facts")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (clearError) throw clearError;

    const { error: winnerError } = await userClient
      .from("trail_guide_facts")
      .update({ is_current: true, updated_at: new Date().toISOString() })
      .eq("id", winner.id);
    if (winnerError) throw winnerError;

    const distinctValues = new Set(rows.map((row) => stableValue(row.value)));
    if (distinctValues.size > 1) {
      conflictKeys.push(fieldKey);
      const { error: conflictError } = await userClient
        .from("trail_guide_conflicts")
        .upsert(
          {
            place_id: placeId,
            field_key: fieldKey,
            candidate_fact_ids: ids,
            recommended_fact_id: winner.id,
            status: "open",
            resolution_note: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "place_id,field_key" },
        );
      if (conflictError) throw conflictError;
    } else {
      const { error: resolveError } = await userClient
        .from("trail_guide_conflicts")
        .update({
          status: "resolved",
          recommended_fact_id: winner.id,
          resolution_note: "Current active sources agree.",
          updated_at: new Date().toISOString(),
        })
        .eq("place_id", placeId)
        .eq("field_key", fieldKey);
      if (resolveError) throw resolveError;
    }
  }

  const present = CAMPING_COMPLETENESS_FIELDS.filter((field) => grouped.has(field)).length;
  const completeness = Math.round((present / CAMPING_COMPLETENESS_FIELDS.length) * 100);
  const { error: profileError } = await userClient
    .from("trail_guide_place_profiles")
    .update({
      completeness_score: completeness,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("place_id", placeId);
  if (profileError) throw profileError;

  return { completeness, conflictKeys };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Function environment is incomplete." }, 503);
  if (!openAiKey) return json({ error: "OPENAI_API_KEY is required for Trail Guide ingestion." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
    if (adminError || isAdmin !== true) return json({ error: "Platform admin access is required." }, 403);

    const body = await req.json();
    const placeId = clean(body?.placeId, 160);
    if (!placeId) return json({ error: "placeId is required." }, 400);

    const { data: profile, error: profileError } = await userClient
      .from("trail_guide_place_profiles")
      .select("place_id,display_name,category")
      .eq("place_id", placeId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "Create the Trail Guide place profile before ingesting sources." }, 404);

    const suppliedSources = Array.isArray(body?.sources) ? body.sources.slice(0, 6) : [];
    for (const source of suppliedSources) {
      const sourceUrl = clean(source?.url, 2000);
      const sourceName = clean(source?.name, 200);
      const sourceType = clean(source?.type || (/\.pdf(?:$|\?)/i.test(sourceUrl) ? "official_rules" : "official_website"), 40);
      if (!validHttpsUrl(sourceUrl)) return json({ error: `Invalid source URL: ${sourceUrl}` }, 400);
      if (!["official_website", "official_rules", "reservation", "api", "admin"].includes(sourceType)) {
        return json({ error: `Unsupported source type: ${sourceType}` }, 400);
      }

      const { error: sourceError } = await userClient
        .from("trail_guide_sources")
        .upsert(
          {
            place_id: placeId,
            source_type: sourceType,
            source_name: sourceName || new URL(sourceUrl).hostname,
            source_url: sourceUrl,
            source_date: source?.sourceDate || null,
            priority: Number.isFinite(Number(source?.priority)) ? Math.max(0, Math.min(100, Number(source.priority))) : sourcePriority(sourceType),
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "place_id,source_url" },
        );
      if (sourceError) throw sourceError;
    }

    const { data: sources, error: sourcesError } = await userClient
      .from("trail_guide_sources")
      .select("id,source_type,source_name,source_url,source_date,priority,status")
      .eq("place_id", placeId)
      .in("status", ["active", "failed"])
      .order("priority", { ascending: false });
    if (sourcesError) throw sourcesError;
    if (!sources?.length) return json({ error: "No active sources are registered for this place." }, 400);

    const sourceResults: any[] = [];
    let extractedCount = 0;

    for (const source of sources.slice(0, 6)) {
      if (!validHttpsUrl(source.source_url)) {
        sourceResults.push({ sourceId: source.id, sourceName: source.source_name, status: "failed", error: "Source URL is not a public HTTPS URL." });
        continue;
      }

      try {
        const extracted = await extractFromSource(openAiKey, source);
        let accepted = 0;

        for (const fact of extracted.facts ?? []) {
          if (!FACT_KEYS.includes(fact.field)) continue;
          const expectedType = FACT_TYPES[fact.field];
          let parsedValue: unknown;
          try {
            parsedValue = parseFactValue(fact.field, fact.value);
          } catch {
            continue;
          }

          const { error: factError } = await userClient
            .from("trail_guide_facts")
            .upsert(
              {
                place_id: placeId,
                source_id: source.id,
                field_key: fact.field,
                value: parsedValue,
                value_type: expectedType,
                evidence_text: clean(fact.evidence, 500),
                confidence: fact.confidence,
                observed_at: new Date().toISOString(),
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "place_id,source_id,field_key" },
            );
          if (factError) throw factError;
          accepted += 1;
          extractedCount += 1;
        }

        await userClient
          .from("trail_guide_sources")
          .update({
            status: "active",
            last_checked_at: new Date().toISOString(),
            next_check_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", source.id);

        sourceResults.push({
          sourceId: source.id,
          sourceName: source.source_name,
          status: "ok",
          facts: accepted,
          warnings: extracted.warnings ?? [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Source ingestion failed.";
        await userClient
          .from("trail_guide_sources")
          .update({
            status: "failed",
            last_checked_at: new Date().toISOString(),
            last_error: message.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", source.id);
        sourceResults.push({ sourceId: source.id, sourceName: source.source_name, status: "failed", error: message });
      }
    }

    const reconciliation = await reconcilePlace(userClient, placeId);

    return json({
      placeId,
      placeName: profile.display_name,
      extractedFacts: extractedCount,
      completeness: reconciliation.completeness,
      conflicts: reconciliation.conflictKeys,
      sources: sourceResults,
    });
  } catch (error) {
    console.error("trail-guide-ingest", error);
    return json({ error: error instanceof Error ? error.message : "Unable to ingest Trail Guide data." }, 500);
  }
});
