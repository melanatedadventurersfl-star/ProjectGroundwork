import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function clean(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}
function normalize(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function addressPart(place: any, type: string, field: "longText" | "shortText" = "longText") {
  const component = Array.isArray(place?.addressComponents)
    ? place.addressComponents.find((item: any) => Array.isArray(item?.types) && item.types.includes(type))
    : null;
  return clean(component?.[field], 120);
}
function directScore(name: string, address: string | null, query: string) {
  const target = normalize(name);
  const q = normalize(query);
  if (!q) return 0;
  if (target === q) return 120;
  if (target.startsWith(q)) return 100;
  if (target.includes(q)) return 80;
  const words = q.split(" ").filter((word) => word.length >= 2);
  const haystack = normalize(`${name} ${address ?? ""}`);
  return words.length && words.every((word) => haystack.includes(word)) ? 60 : words.some((word) => haystack.includes(word)) ? 20 : 0;
}
async function resolvePhoto(apiKey: string, photoName?: string) {
  if (!photoName) return null;
  const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  url.searchParams.set("maxWidthPx", "900");
  url.searchParams.set("skipHttpRedirect", "true");
  try {
    const response = await fetch(url, { headers: { "X-Goog-Api-Key": apiKey } });
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload?.photoUri === "string" ? payload.photoUri : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Venue discovery is not configured." }, 503);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.id) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const organizationId = clean(body?.organizationId, 80) || null;
    const city = clean(body?.city, 120);
    const state = clean(body?.state, 40).toUpperCase();
    const mode = body?.searchMode === "direct" ? "direct" : "recommendation";
    const refinement = clean(body?.refinement, 180);
    const eventType = clean(body?.eventType, 120) || "event";
    const maxResults = Math.max(1, Math.min(8, Number(body?.maxResults) || 6));

    if (mode === "direct" && refinement.length < 2) return json({ error: "Enter at least two characters to search venues." }, 400);
    if (mode === "recommendation" && (!city || !state)) return json({ error: "City and state are required for venue recommendations." }, 400);

    if (organizationId) {
      const { data: allowed, error } = await userClient.rpc("organization_has_permission", { p_organization_id: organizationId, p_permission_code: "events.view" });
      if (error || allowed !== true) return json({ error: "You do not have access to this organization." }, 403);
    }

    const history = organizationId
      ? await admin.from("adventures").select("venue_name,address,latitude,longitude,venue_place_id,venue_source,city,state").eq("platform_organization_id", organizationId).not("venue_name", "is", null).limit(100)
      : { data: [] as any[] };
    const candidates = new Map<string, any>();
    const add = (candidate: any) => {
      const key = candidate.placeId ? `id:${candidate.placeId}` : `name:${normalize(candidate.name)}`;
      const current = candidates.get(key);
      if (!current) candidates.set(key, candidate);
      else candidates.set(key, { ...current, ...candidate, photoUrl: candidate.photoUrl || current.photoUrl || null });
    };

    for (const row of history.data ?? []) {
      const name = clean(row.venue_name, 200);
      if (!name) continue;
      if (mode === "direct" && directScore(name, row.address ?? null, refinement) === 0) continue;
      add({ id: row.venue_place_id ? `google:${row.venue_place_id}` : `history:${normalize(name)}`, placeId: row.venue_place_id ?? null, name, address: row.address ?? null, city: row.city || city, state: row.state || state, postalCode: null, latitude: row.latitude ?? null, longitude: row.longitude ?? null, primaryType: null, types: [], rating: null, ratingCount: null, photoUrl: null, mapsUrl: null, websiteUrl: null, source: "tenant_history", sourceLabel: "Used by your organization", fitSignals: ["Previously used by this organization"], unknowns: ["Current event capacity", "Current availability", "Current price", "Booking terms"], preferred: false, historyUses: 1 });
    }

    const textQuery = mode === "direct"
      ? [refinement, city, state].filter(Boolean).join(", ")
      : [`${eventType} venue`, refinement, city, state].filter(Boolean).join(" in ");
    let googleStatus: "available" | "error" | "unconfigured" = placesKey ? "available" : "unconfigured";

    if (placesKey) {
      try {
        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": placesKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.types,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.photos",
          },
          body: JSON.stringify({ textQuery, maxResultCount: 20, languageCode: "en", regionCode: "US" }),
        });
        if (!response.ok) googleStatus = "error";
        else {
          const payload = await response.json();
          for (const place of Array.isArray(payload?.places) ? payload.places : []) {
            const name = clean(place?.displayName?.text, 200);
            const address = clean(place?.formattedAddress, 300) || null;
            if (!name || (mode === "direct" && directScore(name, address, refinement) === 0)) continue;
            const placeId = clean(place?.id, 300) || null;
            add({
              id: placeId ? `google:${placeId}` : `google:${normalize(name)}`,
              placeId,
              name,
              address,
              city: addressPart(place, "locality") || addressPart(place, "postal_town") || addressPart(place, "administrative_area_level_2") || city,
              state: addressPart(place, "administrative_area_level_1", "shortText").toUpperCase() || state,
              postalCode: addressPart(place, "postal_code") || null,
              latitude: typeof place?.location?.latitude === "number" ? place.location.latitude : null,
              longitude: typeof place?.location?.longitude === "number" ? place.location.longitude : null,
              primaryType: clean(place?.primaryTypeDisplayName?.text, 120) || null,
              types: Array.isArray(place?.types) ? place.types.slice(0, 20) : [],
              rating: typeof place?.rating === "number" ? place.rating : null,
              ratingCount: Number.isFinite(Number(place?.userRatingCount)) ? Number(place.userRatingCount) : null,
              photoUrl: await resolvePhoto(placesKey, place?.photos?.[0]?.name),
              mapsUrl: clean(place?.googleMapsUri, 600) || null,
              websiteUrl: clean(place?.websiteUri, 600) || null,
              source: "google_places",
              sourceLabel: "Google Places",
              fitSignals: [mode === "direct" ? `Matches ${refinement}` : `Matches ${eventType} venue search`],
              unknowns: ["Event capacity", "Availability", "Rental price", "Booking terms"],
              preferred: false,
              historyUses: 0,
            });
          }
        }
      } catch (error) {
        console.error("host-venue-discovery-v2 google", error);
        googleStatus = "error";
      }
    }

    const ranked = [...candidates.values()]
      .map((candidate) => ({ ...candidate, score: mode === "direct" ? directScore(candidate.name, candidate.address, refinement) : (candidate.rating ?? 0) * 2 + (candidate.source === "google_places" ? 5 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ score, ...candidate }) => ({ ...candidate, reason: candidate.fitSignals.join(". ") + "." }));

    const warnings: string[] = [];
    if (googleStatus === "unconfigured") warnings.push("Google Places is not configured. Showing saved organization venues only.");
    if (googleStatus === "error") warnings.push("Google Places is temporarily unavailable. Showing saved organization venues only.");
    if (!ranked.length) warnings.push(mode === "direct" ? "No matching places were found." : "No venue matches were returned.");
    const sourceCounts = ranked.reduce((acc: Record<string, number>, candidate: any) => { acc[candidate.source] = (acc[candidate.source] || 0) + 1; return acc; }, {});

    return json({ query: textQuery, candidates: ranked, sourceCounts, warnings, providers: { googlePlaces: { status: googleStatus } } });
  } catch (error) {
    console.error("host-venue-discovery-v2", error);
    return json({ error: "Unable to search venues right now." }, 500);
  }
});