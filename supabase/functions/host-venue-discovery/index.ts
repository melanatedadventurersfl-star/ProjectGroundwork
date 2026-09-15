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
  return clean(value, 300).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function arr(value: unknown, max = 20) {
  return Array.isArray(value) ? value.map((v) => clean(v, 120)).filter(Boolean).slice(0, max) : [];
}
function categoryTerms(eventType: string) {
  const value = eventType.toLowerCase();
  if (/network|mixer/.test(value)) return ["event venue", "coworking space", "hotel meeting room", "conference room", "restaurant private room"];
  if (/conference|summit|convention/.test(value)) return ["conference center", "convention center", "hotel meeting room", "event venue"];
  if (/workshop|class|seminar|training/.test(value)) return ["meeting room", "coworking space", "community center", "conference room"];
  if (/gala|award|fundraiser/.test(value)) return ["banquet hall", "ballroom", "hotel", "event venue"];
  if (/vendor|market|pop/.test(value)) return ["event venue", "community center", "convention space", "market venue"];
  if (/private|party|celebration/.test(value)) return ["private event venue", "restaurant private room", "banquet hall", "hotel"];
  if (/outdoor|camp|hike|kayak|paddle/.test(value)) return ["park", "outdoor event space", "campground", "event venue"];
  return ["event venue", "meeting room", "community center", "hotel"];
}
function addressPart(place: any, type: string, field: "longText" | "shortText" = "longText") {
  const component = Array.isArray(place?.addressComponents)
    ? place.addressComponents.find((item: any) => Array.isArray(item?.types) && item.types.includes(type))
    : null;
  return clean(component?.[field], 120);
}
function placeCity(place: any, fallback = "") {
  return addressPart(place, "locality")
    || addressPart(place, "postal_town")
    || addressPart(place, "sublocality")
    || addressPart(place, "administrative_area_level_2")
    || fallback;
}
function placeState(place: any, fallback = "") {
  return addressPart(place, "administrative_area_level_1", "shortText").toUpperCase() || fallback;
}
function directMatchScore(name: string, address: string | null, query: string) {
  const target = normalize(name);
  const q = normalize(query);
  if (!q) return 0;
  if (target === q) return 120;
  if (target.startsWith(q)) return 100;
  if (target.includes(q)) return 80;
  const words = q.split(" ").filter((word) => word.length >= 2);
  const haystack = normalize(`${name} ${address ?? ""}`);
  if (words.length && words.every((word) => haystack.includes(word))) return 60;
  if (words.some((word) => haystack.includes(word))) return 20;
  return 0;
}
async function photoUrl(apiKey: string, photoName?: string) {
  if (!photoName) return null;
  try {
    const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
    url.searchParams.set("maxWidthPx", "900");
    url.searchParams.set("skipHttpRedirect", "true");
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
  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey || !googleKey) return json({ error: "Venue discovery is not configured." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const organizationId = clean(body?.organizationId, 80) || null;
    const city = clean(body?.city, 120);
    const state = clean(body?.state, 40).toUpperCase();
    const searchMode = body?.searchMode === "direct" ? "direct" : "recommendation";
    const eventType = clean(body?.eventType, 120) || "general event";
    const refinement = clean(body?.refinement, 180);
    const areaHint = clean(body?.areaHint, 120);
    const requestedTypes = arr(body?.venueTypes, 12);
    const excluded = new Set(arr(body?.excludePlaceIds, 40));
    const maxResults = Math.max(1, Math.min(8, Number(body?.maxResults) || 5));
    const communityEnabled = body?.communityDirectoryEnabled === true;

    if (searchMode === "direct" && refinement.length < 2) return json({ error: "Enter at least two characters to search venues." }, 400);
    if (searchMode === "recommendation" && (!city || !state)) return json({ error: "City and state are required for venue recommendations." }, 400);

    if (organizationId) {
      const { data: allowed, error } = await userClient.rpc("organization_has_permission", { p_organization_id: organizationId, p_permission_code: "events.view" });
      if (error || allowed !== true) return json({ error: "You do not have access to this organization." }, 403);
    }

    const [prefsResult, historyResult, communityResult] = await Promise.all([
      organizationId ? admin.from("organization_venue_preferences").select("provider_place_id,venue_name,preference").eq("organization_id", organizationId) : Promise.resolve({ data: [] } as any),
      organizationId ? admin.from("adventures").select("venue_name,address,latitude,longitude,venue_place_id,venue_source,city,state").eq("platform_organization_id", organizationId).not("venue_name", "is", null).limit(200) : Promise.resolve({ data: [] } as any),
      searchMode === "recommendation" && communityEnabled
        ? admin.from("community_places").select("id,name,category,address,city,state,website_url").eq("is_active", true).eq("ownership_verification_status", "verified").eq("state", state).ilike("city", city).limit(10)
        : Promise.resolve({ data: [] } as any),
    ]);

    const preferred = new Set<string>();
    const blocked = new Set<string>();
    for (const row of prefsResult.data ?? []) {
      const keys = [row.provider_place_id ? `id:${row.provider_place_id}` : "", `name:${normalize(row.venue_name)}`].filter(Boolean);
      for (const key of keys) (row.preference === "blocked" ? blocked : preferred).add(key);
    }

    const candidates = new Map<string, any>();
    const add = (candidate: any) => {
      const key = candidate.placeId ? `id:${candidate.placeId}` : `name:${normalize(candidate.name)}`;
      if (!candidate.name || blocked.has(key) || blocked.has(`name:${normalize(candidate.name)}`)) return;
      const current = candidates.get(key);
      if (!current) candidates.set(key, candidate);
      else candidates.set(key, {
        ...current,
        ...candidate,
        historyUses: Math.max(current.historyUses || 0, candidate.historyUses || 0),
        preferred: Boolean(current.preferred || candidate.preferred),
        photoUrl: candidate.photoUrl || current.photoUrl || null,
      });
    };

    const historyCounts = new Map<string, number>();
    for (const row of historyResult.data ?? []) {
      const name = clean(row.venue_name, 200);
      if (!name) continue;
      if (searchMode === "direct" && directMatchScore(name, row.address ?? null, refinement) === 0) continue;
      const key = row.venue_place_id ? `id:${row.venue_place_id}` : `name:${normalize(name)}`;
      historyCounts.set(key, (historyCounts.get(key) || 0) + 1);
      add({
        id: row.venue_place_id ? `google:${row.venue_place_id}` : `history:${normalize(name)}`,
        placeId: row.venue_place_id ?? null,
        name,
        address: row.address ?? null,
        city: row.city || city,
        state: row.state || state,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        primaryType: null,
        types: [],
        rating: null,
        ratingCount: null,
        photoUrl: null,
        mapsUrl: null,
        websiteUrl: null,
        source: "tenant_history",
        sourceLabel: "Used by your organization",
        fitSignals: ["Previously used by this organization"],
        unknowns: ["Current event capacity", "Current availability", "Current price", "Booking terms"],
        preferred: preferred.has(key) || preferred.has(`name:${normalize(name)}`),
        historyUses: historyCounts.get(key) || 1,
      });
    }

    const terms = requestedTypes.length ? requestedTypes : categoryTerms(eventType);
    const textQuery = searchMode === "direct"
      ? [refinement, city, state].filter(Boolean).join(", ")
      : [refinement, `${eventType} venue`, terms.slice(0, 5).join(" or "), areaHint, city, state].filter(Boolean).join(" in ");

    const googleResponse = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.types,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.photos,places.businessStatus",
      },
      body: JSON.stringify({ textQuery, maxResultCount: 20, languageCode: "en", regionCode: "US" }),
    });
    const googleData = googleResponse.ok ? await googleResponse.json() : { places: [] };
    const googlePlaces = Array.isArray(googleData?.places) ? googleData.places : [];

    for (const place of googlePlaces) {
      const placeId = clean(place?.id, 300) || null;
      if (placeId && excluded.has(placeId)) continue;
      const name = clean(place?.displayName?.text, 200);
      if (!name) continue;
      const formattedAddress = clean(place?.formattedAddress, 300) || null;
      if (searchMode === "direct" && directMatchScore(name, formattedAddress, refinement) === 0) continue;
      const key = placeId ? `id:${placeId}` : `name:${normalize(name)}`;
      if (blocked.has(key) || blocked.has(`name:${normalize(name)}`)) continue;
      const historyUses = historyCounts.get(key) || 0;
      const preferredVenue = preferred.has(key) || preferred.has(`name:${normalize(name)}`);
      const photo = await photoUrl(googleKey, place?.photos?.[0]?.name);
      const primaryType = clean(place?.primaryTypeDisplayName?.text, 120) || null;
      const resolvedCity = placeCity(place, city);
      const resolvedState = placeState(place, state);
      const reasonBits = [
        preferredVenue ? "Preferred by your organization" : "",
        historyUses ? `Used ${historyUses} time${historyUses === 1 ? "" : "s"} by your organization` : "",
        primaryType ? `Google classifies it as ${primaryType.toLowerCase()}` : "",
        searchMode === "direct" ? `Matches ${refinement}` : refinement ? `Matches the current search preference: ${refinement}` : "",
      ].filter(Boolean);
      add({
        id: placeId ? `google:${placeId}` : `google:${normalize(name)}`,
        placeId,
        name,
        address: formattedAddress,
        city: resolvedCity,
        state: resolvedState,
        latitude: typeof place?.location?.latitude === "number" ? place.location.latitude : null,
        longitude: typeof place?.location?.longitude === "number" ? place.location.longitude : null,
        primaryType,
        types: arr(place?.types, 20),
        rating: typeof place?.rating === "number" ? place.rating : null,
        ratingCount: Number.isFinite(Number(place?.userRatingCount)) ? Number(place.userRatingCount) : null,
        photoUrl: photo,
        mapsUrl: clean(place?.googleMapsUri, 600) || null,
        websiteUrl: clean(place?.websiteUri, 600) || null,
        source: historyUses ? "tenant_history" : "google_places",
        sourceLabel: historyUses ? "Used by your organization" : "Google Places",
        fitSignals: reasonBits,
        unknowns: ["Event capacity", "Availability", "Rental price", "Booking terms"],
        preferred: preferredVenue,
        historyUses,
      });
    }

    for (const place of communityResult.data ?? []) {
      add({
        id: `community:${place.id}`,
        placeId: null,
        name: clean(place.name, 200),
        address: clean(place.address, 300) || null,
        city: clean(place.city, 120) || city,
        state: clean(place.state, 40) || state,
        latitude: null,
        longitude: null,
        primaryType: clean(place.category, 120) || null,
        types: [clean(place.category, 120)].filter(Boolean),
        rating: null,
        ratingCount: null,
        photoUrl: null,
        mapsUrl: null,
        websiteUrl: clean(place.website_url, 600) || null,
        source: "community_directory",
        sourceLabel: "Verified community directory",
        fitSignals: ["Verified community-directory listing"],
        unknowns: ["Event capacity", "Availability", "Rental price", "Booking terms"],
        preferred: preferred.has(`name:${normalize(place.name)}`),
        historyUses: 0,
      });
    }

    const ranked = [...candidates.values()].map((candidate) => {
      let score = searchMode === "direct" ? directMatchScore(candidate.name, candidate.address, refinement) : 0;
      if (candidate.preferred) score += searchMode === "direct" ? 12 : 50;
      if (candidate.historyUses) score += searchMode === "direct" ? Math.min(12, candidate.historyUses * 3) : Math.min(30, candidate.historyUses * 6);
      if (searchMode === "recommendation") {
        const haystack = normalize([candidate.name, candidate.primaryType, ...(candidate.types || [])].join(" "));
        for (const term of [...terms, refinement].filter(Boolean)) {
          const words = normalize(term).split(" ").filter((word) => word.length >= 3);
          if (words.some((word) => haystack.includes(word))) score += 4;
        }
      }
      if (candidate.rating) score += Math.min(searchMode === "direct" ? 5 : 10, candidate.rating * 2);
      const reason = candidate.fitSignals.length
        ? candidate.fitSignals.join(". ") + "."
        : searchMode === "direct"
          ? `Matches ${refinement}.`
          : `Matches the requested ${eventType.toLowerCase()} venue search in ${city}.`;
      return { ...candidate, reason, score };
    }).sort((a, b) => b.score - a.score).slice(0, maxResults).map(({ score, ...candidate }) => candidate);

    const sourceCounts = ranked.reduce((acc: Record<string, number>, candidate: any) => {
      acc[candidate.source] = (acc[candidate.source] || 0) + 1;
      return acc;
    }, {});
    const warnings = [];
    if (!googleResponse.ok) warnings.push("Live Google Places results were unavailable, so these options come from saved organization or community data only.");
    if (!ranked.length) warnings.push(searchMode === "direct" ? "No matching places were found. Try a longer venue name or add a city to the search text." : "No venue matches were returned. Try changing the area or venue preferences.");

    return json({ query: textQuery, candidates: ranked, sourceCounts, warnings });
  } catch (error) {
    console.error("host-venue-discovery", error);
    return json({ error: "Unable to search venues right now." }, 500);
  }
});
