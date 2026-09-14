import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function strArray(value: unknown, max = 20) {
  return Array.isArray(value) ? value.map((item) => clean(item, 120)).filter(Boolean).slice(0, max) : [];
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dedupe<T>(values: T[]) {
  return [...new Set(values)];
}

function typeLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function categoryTerms(eventType: string) {
  const value = eventType.toLowerCase();
  if (/network|mixer/.test(value)) return ["event venue", "coworking", "hotel", "conference", "private room", "restaurant"];
  if (/conference|summit|convention/.test(value)) return ["conference center", "convention center", "hotel", "event venue", "meeting room"];
  if (/workshop|class|seminar|training/.test(value)) return ["meeting room", "training room", "coworking", "community center", "conference room"];
  if (/gala|award|fundraiser/.test(value)) return ["banquet hall", "event venue", "hotel", "ballroom", "reception venue"];
  if (/vendor|market|pop/.test(value)) return ["event venue", "market", "convention", "community center", "outdoor event space"];
  if (/private|party|celebration/.test(value)) return ["private event venue", "restaurant private room", "banquet hall", "hotel"];
  if (/outdoor|camp|hike|kayak|paddle/.test(value)) return ["park", "outdoor recreation", "campground", "event venue"];
  return ["event venue", "meeting room", "community center", "hotel"];
}

function fitScore(candidate: any, input: any) {
  let score = 0;
  const haystack = normalize([candidate.name, candidate.primaryType, ...(candidate.types ?? [])].filter(Boolean).join(" "));
  const targetTerms = dedupe([
    ...categoryTerms(input.eventType),
    ...(input.venueTypes ?? []),
    input.refinement,
  ].filter(Boolean).map((term: string) => normalize(term)));
  for (const term of targetTerms) {
    if (!term) continue;
    const words = term.split(" ").filter((word) => word.length >= 3);
    if (words.some((word) => haystack.includes(word))) score += 4;
  }
  if (candidate.preferred) score += 30;
  if (candidate.historyUses > 0) score += Math.min(24, 8 + candidate.historyUses * 4);
  if (candidate.source === "tenant_history") score += 10;
  if (candidate.source === "community_directory") score += 5;
  return score;
}

async function photoUri(apiKey: string, photoName: string | undefined) {
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !googleKey) return json({ error: "Venue discovery is not configured." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const organizationId = clean(body?.organizationId, 80) || null;
    const city = clean(body?.city, 120);
    const state = clean(body?.state, 40).toUpperCase();
    const eventType = clean(body?.eventType, 120) || "general event";
    const attendance = Number(body?.capacity) > 0 ? Number(body.capacity) : null;
    const attendanceRange = clean(body?.attendanceRange, 80) || null;
    const venueTypes = strArray(body?.venueTypes, 12);
    const refinement = clean(body?.refinement, 200) || null;
    const areaHint = clean(body?.areaHint, 120) || null;
    const searchRadiusKm = Number(body?.searchRadiusKm) > 0 ? Math.min(80, Number(body.searchRadiusKm)) : null;
    const excluded = new Set(strArray(body?.excludePlaceIds, 40));
    const communityDirectoryEnabled = body?.communityDirectoryEnabled === true;
    const maxResults = Math.max(1, Math.min(8, Number(body?.maxResults) || 5));

    if (!city || !state) return json({ error: "City and state are required for venue discovery." }, 400);

    if (organizationId) {
      const { data: allowed, error: permissionError } = await userClient.rpc("organization_has_permission", {
        p_organization_id: organizationId,
        p_permission_code: "events.view",
      });
      if (permissionError || allowed !== true) return json({ error: "You do not have access to this organization." }, 403);
    }

    const [preferenceResult, historyResult, communityResult] = await Promise.all([
      organizationId
        ? adminClient.from("organization_venue_preferences").select("provider,provider_place_id,venue_name,address,preference").eq("organization_id", organizationId)
        : Promise.resolve({ data: [], error: null } as any),
      organizationId
        ? adminClient.from("adventures").select("venue_name,address,latitude,longitude,venue_place_id,venue_source,city,state").eq("platform_organization_id", organizationId).not("venue_name", "is", null).limit(200)
        : Promise.resolve({ data: [], error: null } as any),
      communityDirectoryEnabled
        ? adminClient.from("community_places").select("id,name,category,address,city,state,website_url,ownership_tags,community_endorsement_count").eq("is_active", true).eq("ownership_verification_status", "verified").eq("state", state).ilike("city", city).limit(10)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const preferences = preferenceResult.data ?? [];
    const preferredKeys = new Set<string>();
    const blockedKeys = new Set<string>();
    for (const row of preferences) {
      const keys = [row.provider_place_id ? `id:${row.provider_place_id}` : "", `name:${normalize(row.venue_name)}`].filter(Boolean);
      for (const key of keys) {
        if (row.preference === "blocked") blockedKeys.add(key);
        if (row.preference === "preferred") preferredKeys.add(key);
      }
    }

    const historyMap = new Map<string, any>();
    for (const row of historyResult.data ?? []) {
      const name = clean(row.venue_name, 200);
      if (!name) continue;
      const key = row.venue_place_id ? `id:${row.venue_place_id}` : `name:${normalize(name)}`;
      if (blockedKeys.has(key) || blockedKeys.has(`name:${normalize(name)}`)) continue;
      const existing = historyMap.get(key);
      historyMap.set(key, {
        id: row.venue_place_id ? `google:${row.venue_place_id}` : `history:${normalize(name)}`,
        placeId: row.venue_place_id ?? null,
        name,
        address: row.address ?? null,
        city: row.city || city,
        state: row.state || state,
        latitude: typeof row.latitude === "number" ? row.latitude : null,
        longitude: typeof row.longitude === "number" ? row.longitude : null,
        primaryType: null,
        types: [],
        rating: null,
        ratingCount: null,
        photoUrl: null,
        mapsUrl: null,
        websiteUrl: null,
        source: "tenant_history",
        sourceLabel: "Used by your organization",
        preferred: preferredKeys.has(key) || preferredKeys.has(`name:${normalize(name)}`),
        historyUses: (existing?.historyUses ?? 0) + 1,
        fitSignals: ["Previously used by this organization"],
        unknowns: ["Current capacity", "Current availability", "Current price"],
      });
    }

    const requestedTypes = venueTypes.length ? venueTypes : categoryTerms(eventType);
    const queryParts = [
      refinement,
      `${eventType} venue`,
      requestedTypes.slice(0, 5).join(" or "),
      areaHint,
      city,
      state,
    ].filter(Boolean);
    const textQuery = queryParts.join(" in ");

    const googleResponse = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.photos,places.businessStatus",
      },
      body: JSON.stringify({ textQuery, maxResultCount: 20, languageCode: "en", regionCode: "US" }),
    });
    const googlePayload = googleResponse.ok ? await googleResponse.json() : { places: [] };
    const googlePlaces = Array.isArray(googlePayload?.places) ? googlePayload.places : [];

    const googleCandidates = await Promise.all(googlePlaces.map(async (place: any) => {
      const placeId = clean(place?.id, 300) || null;
      const name = clean(place?.displayName?.text, 200);
      if (!name || (placeId && excluded.has(placeId))) return null;
      const idKey = placeId ? `id:${placeId}` : "";
      const nameKey = `name:${normalize(name)}`;
      if ((idKey && blockedKeys.has(idKey)) || blockedKeys.has(nameKey)) return null;
      const primaryType = clean(place?.primaryTypeDisplayName?.text, 120) || null;
      const types = strArray(place?.types, 20);
      const photoUrl = await photoUri(googleKey, place?.photos?.[0]?.name);
      const preferred = (idKey && preferredKeys.has(idKey)) || preferredKeys.has(nameKey);
      const fitSignals = dedupe([
        primaryType ? typeLabel(primaryType) : "",
        preferred ? "Preferred by your organization" : "",
        areaHint ? `Matches ${areaHint}` : "",
        refinement ? `Matches the current search: ${refinement}` : "",
      ].filter(Boolean));
      return {
        id: placeId ? `google:${placeId}` : `google:${normalize(name)}`,
        placeId,
        name,
        address: clean(place?.formattedAddress, 300) || null,
        city,
        state,
        latitude: typeof place?.location?.latitude === "number" ? place.location.latitude : null,
        longitude: typeof place?.location?.longitude === "number" ? place.location.longitude : null,
        primaryType,
        types,
        rating: typeof place?.rating === "number" ? place.rating : null,
        ratingCount: Number.isFinite(Number(place?.userRatingCount)) ? Number(place.userRatingCount) : null,
        photoUrl,
        mapsUrl: clean(place?.googleMapsUri, 600) || null,
        websiteUrl: clean(place?.websiteUri, 600) || null,
        source: "google_places",
        sourceLabel: "Google Places",
        preferred,
        historyUses: 0,
        fitSignals,
        unknowns: ["Event capacity", "Availability", "Rental price", "Booking terms"],
      };
    }));

    const communityCandidates = (communityResult.data ?? []).map((place: any) => ({
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
      preferred: preferredKeys.has(`name:${normalize(place.name)}`),
      historyUses: 0,
      fitSignals: ["Verified community-directory listing"],
      unknowns: ["Event capacity", "Availability", "Rental price", "Booking terms"],
    })).filter((candidate: any) => candidate.name && !blockedKeys.has(`name:${normalize(candidate.name)}`));

    const merged = new Map<string, any>();
    const add = (candidate: any) => {
      if (!candidate?.name) return;
      const key = candidate.placeId ? `id:${candidate.placeId}` : `name:${normalize(candidate.name)}`;
      const previous = merged.get(key);
      if (!previous) {
        merged.set(key, candidate);
        return;
      }
      const historyUses = Math.max(previous.historyUses ?? 0, candidate.historyUses ?? 0);
      merged.set(key, {
        ...previous,
        ...candidate,
        source: previous.source === "tenant_history" ? "tenant_history" : candidate.source,
        sourceLabel: historyUses > 0 ? "Used by your organization" : candidate.sourceLabel,
        historyUses,
        preferred: Boolean(previous.preferred || candidate.preferred),
        fitSignals: dedupe([...(previous.fitSignals ?? []), ...(candidate.fitSignals ?? [])]),
        photoUrl: candidate.photoUrl || previous.photoUrl || null,
        mapsUrl: candidate.mapsUrl || previous.mapsUrl || null,
        websiteUrl: candidate.websiteUrl || previous.websiteUrl || null,
        primaryType: candidate.primaryType || previous.primaryType || null,
        types: dedupe([...(previous.types ?? []), ...(candidate.types ?? [])]),
      });
    };

    for (const candidate of historyMap.values()) add(candidate);
    for (const candidate of communityCandidates) add(candidate);
    for (const candidate of googleCandidates) if (candidate) add(candidate);

    const inputContext = { eventType, venueTypes: requestedTypes, refinement };
    const candidates = [...merged.values()]
      .map((candidate) => {
        const score = fitScore(candidate, inputContext);
        const audience = attendance ? `${attendance} attendees` : attendanceRange || "the expected attendance";
        const reasonParts = [
          candidate.historyUses > 0 ? `Your organization has used this venue ${candidate.historyUses} time${candidate.historyUses === 1 ? "" : "s"}.` : "",
          candidate.preferred ? "It is marked preferred by your organization." : "",
          candidate.primaryType ? `It is listed as ${candidate.primaryType.toLowerCase()}.` : "",
          `It matches the ${eventType} venue search for ${city}.`,
          `Confirm that it can support ${audience}, your date, price range and event requirements before booking.`,
        ].filter(Boolean);
        return { ...candidate, score, reason: reasonParts.join(" ") };
      })
      .sort((a, b) => b.score - a.score || b.historyUses - a.historyUses)
      .slice(0, maxResults)
      .map(({ score: _score, ...candidate }) => candidate);

    return json({
      query: textQuery,
      candidates,
      sourceCounts: {
        tenant_history: [...historyMap.values()].length,
        community_directory: communityCandidates.length,
        google_places: googleCandidates.filter(Boolean).length,
      },
      warnings: [
        "Capacity, availability, rental price and booking terms are not verified by this search.",
        ...(searchRadiusKm ? [`A ${searchRadiusKm} km preference was supplied. Distance filtering requires a precise search center, so the city/area text is used for this version.`] : []),
      ],
    });
  } catch (error) {
    console.error("host-venue-discovery", error);
    return json({ error: "Unable to retrieve venue recommendations right now." }, 500);
  }
});
