import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const MODEL = "gpt-4.1-mini";
const MAX_BYTES = 10 * 1024 * 1024;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  return btoa(binary);
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

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title","summary","description","category","difficulty","startsAt","endsAt","venueName","address","city","state","capacity","meetingInstructions","heroImageUrl","tickets","schedule","meals","policies","operations","gear","guestInfo","marketing","photos","confidenceNotes"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      category: { type: "string", enum: ["Hiking","Camping","Paddling","Beach","Cycling","Social","Workshop","Volunteer","Other"] },
      difficulty: { type: "string", enum: ["easy","moderate","challenging"] },
      startsAt: { type: "string" },
      endsAt: { type: "string" },
      venueName: { type: "string" },
      address: { type: "string" },
      city: { type: "string" },
      state: { type: "string" },
      capacity: { type: ["integer", "null"] },
      meetingInstructions: { type: "string" },
      heroImageUrl: { type: "string" },
      tickets: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false, required: ["label","priceText"], properties: { label: { type: "string" }, priceText: { type: "string" } } } },
      schedule: { type: "array", maxItems: 40, items: { type: "object", additionalProperties: false, required: ["time","title"], properties: { time: { type: "string" }, title: { type: "string" } } } },
      meals: { type: "array", maxItems: 20, items: { type: "string" } },
      policies: { type: "array", maxItems: 20, items: { type: "string" } },
      operations: { type: "array", maxItems: 30, items: { type: "string" } },
      gear: { type: "array", maxItems: 30, items: { type: "string" } },
      guestInfo: { type: "array", maxItems: 30, items: { type: "string" } },
      marketing: { type: "array", maxItems: 30, items: { type: "string" } },
      photos: { type: "array", maxItems: 10, items: { type: "string" } },
      confidenceNotes: { type: "array", maxItems: 20, items: { type: "string" } }
    }
  };
}

function hasUsefulData(preview: any) {
  return Boolean(
    clean(preview?.title) || clean(preview?.summary) || clean(preview?.description) || clean(preview?.startsAt) || clean(preview?.venueName) || clean(preview?.address) || clean(preview?.city) ||
    (Array.isArray(preview?.tickets) && preview.tickets.length) || (Array.isArray(preview?.schedule) && preview.schedule.length) || (Array.isArray(preview?.guestInfo) && preview.guestInfo.length) || (Array.isArray(preview?.marketing) && preview.marketing.length)
  );
}

function readerError(message: string, code: string, detail = "") {
  return json({ error: message, errorCode: code, detail: clean(detail, 500) });
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
  if (!openAiKey) return readerError("Flyer reading is not configured on the server yet.", "reader_not_configured");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);
    const { data: approved, error: accessError } = await userClient.rpc("is_approved_outing_host", { p_profile_id: userId });
    if (accessError || approved !== true) return json({ error: "Approved host access is required." }, 403);

    const body = await req.json();
    const path = clean(body?.path, 1000);
    const fileName = clean(body?.fileName, 240) || "Event flyer";
    const mimeType = clean(body?.mimeType, 100).toLowerCase();
    if (!path || !path.startsWith(`${userId}/`) || path.includes("../") || path.includes("\\")) return json({ error: "Invalid flyer path." }, 400);
    if (!["image/jpeg","image/png","image/webp"].includes(mimeType)) return json({ error: "Use a JPG, PNG, or WebP flyer image." }, 400);

    const { data: blob, error: downloadError } = await userClient.storage.from("event-imports").download(path);
    if (downloadError || !blob) throw downloadError ?? new Error("Unable to read the uploaded flyer.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return json({ error: "This flyer is larger than 10 MB." }, 400);

    const base64 = bytesToBase64(bytes);
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: "Read this event flyer or poster for a Go Melanated host. Extract only details visibly supported by the image. Never invent missing dates, times, locations, prices, capacity, policies, URLs, contact details, age restrictions, parking, or ticket rules. If a field is uncertain, leave it empty and add a short confidence note. Normalize a clearly written US state name to its two-letter abbreviation. startsAt and endsAt must be local YYYY-MM-DDTHH:MM strings only when both the date and time are clearly visible. If only a start time is shown, leave endsAt empty. Put ticket prices in tickets. Put visible URLs, social handles, email addresses, phone numbers, and registration references in marketing. Put parking, check-in, age restrictions, what-to-bring, and access details in guestInfo. Do not claim to decode a QR code unless readable text in the image independently reveals its destination.",
        input: [{ role: "user", content: [{ type: "input_text", text: `Extract every readable event detail from this flyer: ${fileName}` }, { type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "high" }] }],
        text: { format: { type: "json_schema", name: "host_flyer_event_preview", strict: true, schema: schema() } }
      })
    });

    const payload = await upstream.json();
    if (!upstream.ok) {
      const upstreamMessage = clean(payload?.error?.message, 500);
      console.error("host-flyer-preview upstream", JSON.stringify(payload));
      return readerError(upstreamMessage ? `Flyer reader error: ${upstreamMessage}` : "The flyer image reached the reader, but extraction failed.", "upstream_error", upstreamMessage);
    }

    const output = readOutputText(payload);
    if (!output) {
      console.error("host-flyer-preview empty output", JSON.stringify(payload));
      return readerError("The flyer image was received, but no event details were returned. Try a clearer image.", "empty_output");
    }

    let preview: any;
    try {
      preview = JSON.parse(output);
    } catch {
      console.error("host-flyer-preview invalid json", output.slice(0, 1000));
      return readerError("The flyer was read, but the extracted details could not be parsed. Try the scan again.", "invalid_output");
    }

    if (!hasUsefulData(preview)) {
      return readerError("No readable event details were found on this image. Try a clearer, tighter crop of the flyer.", "no_event_data");
    }

    const { data: importRow, error: importError } = await userClient.from("host_event_imports").insert({
      owner_profile_id: userId,
      source_type: "file_url",
      source_label: fileName,
      source_url: null,
      extracted_payload: preview,
      approved_payload: {},
      status: "preview"
    }).select("id").single();
    if (importError) throw importError;

    return json({ importId: importRow.id, preview, sourceLabel: fileName, sourceUrl: null, extractionSource: "ai", duplicate: null });
  } catch (error) {
    console.error("host-flyer-preview", error);
    return readerError(error instanceof Error ? error.message : "Unable to read this flyer.", "unexpected_error");
  }
});
