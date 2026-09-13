import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gpt-4.1-mini";
const MAX_GOOGLE_PHOTOS = 8;
const MAX_ANALYZED_PHOTOS = 3;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const PHOTO_CATEGORIES = [
  "campsite",
  "rv_site",
  "tent_site",
  "beach",
  "water",
  "landscape",
  "trail",
  "recreation",
  "building",
  "sign",
  "bathroom",
  "wildlife",
  "food",
  "person_heavy",
  "other",
] as const;

type PhotoCategory = typeof PHOTO_CATEGORIES[number];

type PhotoAnalysis = {
  index: number;
  category: PhotoCategory;
  heroSuitability: number;
  representativeness: number;
  destinationMatch: number;
  peopleHeavy: boolean;
};

type ResolvedPhoto = {
  url: string;
  sourceUrl: string | null;
  title: string;
  credit: string;
  attributionUri: string | null;
  widthPx: number | null;
  heightPx: number | null;
  order: number;
  analysis?: Omit<PhotoAnalysis, "index">;
};

function json(body: unknown, status = 200, cacheControl?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
    },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
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

function analysisSchema(photoCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["photos"],
    properties: {
      photos: {
        type: "array",
        minItems: photoCount,
        maxItems: photoCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "category", "heroSuitability", "representativeness", "destinationMatch", "peopleHeavy"],
          properties: {
            index: { type: "integer", minimum: 0, maximum: Math.max(0, photoCount - 1) },
            category: { type: "string", enum: PHOTO_CATEGORIES },
            heroSuitability: { type: "number", minimum: 0, maximum: 1 },
            representativeness: { type: "number", minimum: 0, maximum: 1 },
            destinationMatch: { type: "number", minimum: 0, maximum: 1 },
            peopleHeavy: { type: "boolean" },
          },
        },
      },
    },
  };
}

async function analyzePhotos(
  openAiKey: string,
  photos: ResolvedPhoto[],
  context: { name: string; area: string; category: string; type: string; tags: string[]; summary: string },
  maxPhotos: number,
) {
  const candidates = photos.slice(0, Math.min(MAX_ANALYZED_PHOTOS, maxPhotos));
  if (!candidates.length) return new Map<number, Omit<PhotoAnalysis, "index">>();

  const content: any[] = [
    {
      type: "input_text",
      text: [
        `Choose strong Trail Guide header photos for ${context.name}, ${context.area}.`,
        `Destination category: ${context.category || "unknown"}.`,
        `Destination type: ${context.type || "unknown"}.`,
        context.tags.length ? `Tags: ${context.tags.join(", ")}.` : "",
        context.summary ? `Summary: ${context.summary}.` : "",
        "Classify each image by its dominant subject. Score heroSuitability for a wide destination header, representativeness for how well it shows what a visitor should expect, and destinationMatch for whether it plausibly shows this exact place. Penalize signs, bathrooms, food, close-up wildlife, portraits, person-heavy images, screenshots, and tight detail shots. For campgrounds, favor campsites, RV/tent sites, campground-overview scenes, beach access, landscape, and recreation over wildlife. Return one result for every image index.",
      ].filter(Boolean).join("\n"),
    },
  ];

  for (const photo of candidates) {
    content.push({ type: "input_text", text: `Photo ${photo.order}` });
    content.push({ type: "input_image", image_url: photo.url, detail: "low" });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: "Analyze only what is visible in the supplied images and the supplied destination context. Do not infer hidden amenities or facts. Return the requested JSON only.",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "trail_guide_google_photo_analysis",
            strict: true,
            schema: analysisSchema(candidates.length),
          },
        },
      }),
    });

    const payload = await upstream.json();
    if (!upstream.ok) {
      console.error("place-photo analysis upstream", payload);
      return new Map<number, Omit<PhotoAnalysis, "index">>();
    }

    const outputText = readOutputText(payload);
    if (!outputText) return new Map<number, Omit<PhotoAnalysis, "index">>();
    const parsed = JSON.parse(outputText) as { photos?: PhotoAnalysis[] };
    const result = new Map<number, Omit<PhotoAnalysis, "index">>();
    for (const row of parsed.photos ?? []) {
      if (!Number.isInteger(row.index) || row.index < 0 || row.index >= candidates.length) continue;
      result.set(row.index, {
        category: row.category,
        heroSuitability: Math.max(0, Math.min(1, Number(row.heroSuitability) || 0)),
        representativeness: Math.max(0, Math.min(1, Number(row.representativeness) || 0)),
        destinationMatch: Math.max(0, Math.min(1, Number(row.destinationMatch) || 0)),
        peopleHeavy: Boolean(row.peopleHeavy),
      });
    }
    return result;
  } catch (error) {
    console.error("place-photo analysis", error);
    return new Map<number, Omit<PhotoAnalysis, "index">>();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return json({ error: "Google Places is not configured." }, 503);

  try {
    const body = await req.json();
    const name = clean(body?.name, 200);
    const area = clean(body?.area, 200);
    const state = clean(body?.state || "FL", 40) || "FL";
    const includeGallery = body?.includeGallery !== false;
    const includeHeroAnalysis = body?.includeHeroAnalysis === true;
    const photoMaxWidthPx = boundedInteger(body?.photoMaxWidthPx, 900, 400, 1600);
    const analysisLimit = boundedInteger(body?.analysisLimit, 3, 1, MAX_ANALYZED_PHOTOS);
    const trailGuideCategory = clean(body?.trailGuideCategory, 80);
    const trailGuideType = clean(body?.trailGuideType, 120);
    const trailGuideSummary = clean(body?.trailGuideSummary, 800);
    const trailGuideTags = Array.isArray(body?.trailGuideTags)
      ? body.trailGuideTags.map((value: unknown) => clean(value, 80)).filter(Boolean).slice(0, 20)
      : [];

    if (!name) return json({ error: "Place name is required." }, 400);

    const query = [name, area, state].filter(Boolean).join(", ");
    const searchResponse = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.googleMapsUri",
          "places.websiteUri",
          "places.rating",
          "places.userRatingCount",
          "places.currentOpeningHours",
          "places.businessStatus",
          "places.photos",
        ].join(","),
      },
      body: JSON.stringify({ textQuery: query, pageSize: 3 }),
    });

    const searchData = await searchResponse.json();
    if (!searchResponse.ok) {
      return json({ error: searchData?.error?.message || "Unable to search Google Places." }, searchResponse.status);
    }

    const place = Array.isArray(searchData?.places) ? searchData.places[0] : null;
    if (!place?.id) return json({ place: null, photos: [] }, 200, "private, max-age=120");

    const photos = includeGallery && Array.isArray(place.photos) ? place.photos.slice(0, MAX_GOOGLE_PHOTOS) : [];
    const resolvedPhotos = (await Promise.all(photos.map(async (photo: any, index: number) => {
      if (!photo?.name) return null;
      try {
        const mediaUrl = new URL(`https://places.googleapis.com/v1/${photo.name}/media`);
        mediaUrl.searchParams.set("maxWidthPx", String(photoMaxWidthPx));
        mediaUrl.searchParams.set("skipHttpRedirect", "true");
        mediaUrl.searchParams.set("key", apiKey);
        const mediaResponse = await fetch(mediaUrl);
        const mediaData = await mediaResponse.json();
        if (!mediaResponse.ok || !mediaData?.photoUri) return null;
        const attribution = Array.isArray(photo.authorAttributions) && photo.authorAttributions.length > 0
          ? photo.authorAttributions[0]
          : null;
        return {
          url: mediaData.photoUri,
          sourceUrl: photo.googleMapsUri || place.googleMapsUri || null,
          title: place.displayName?.text || name,
          credit: attribution?.displayName || "Google Maps",
          attributionUri: attribution?.uri || null,
          widthPx: Number.isFinite(Number(photo.widthPx)) ? Number(photo.widthPx) : null,
          heightPx: Number.isFinite(Number(photo.heightPx)) ? Number(photo.heightPx) : null,
          order: index,
        } satisfies ResolvedPhoto;
      } catch {
        return null;
      }
    }))).filter((photo): photo is ResolvedPhoto => Boolean(photo));

    if (includeHeroAnalysis && resolvedPhotos.length > 0) {
      const openAiKey = Deno.env.get("OPENAI_API_KEY");
      if (openAiKey) {
        const analysis = await analyzePhotos(openAiKey, resolvedPhotos, {
          name,
          area,
          category: trailGuideCategory,
          type: trailGuideType,
          tags: trailGuideTags,
          summary: trailGuideSummary,
        }, analysisLimit);
        for (const photo of resolvedPhotos) {
          const row = analysis.get(photo.order);
          if (row) photo.analysis = row;
        }
      }
    }

    return json({
      place: {
        placeId: place.id,
        displayName: place.displayName?.text || name,
        formattedAddress: place.formattedAddress ?? null,
        mapsUrl: place.googleMapsUri ?? null,
        websiteUrl: place.websiteUri ?? null,
        rating: typeof place.rating === "number" ? place.rating : null,
        userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null,
        weekdayDescriptions: Array.isArray(place.currentOpeningHours?.weekdayDescriptions)
          ? place.currentOpeningHours.weekdayDescriptions
          : [],
        businessStatus: place.businessStatus ?? null,
      },
      photos: resolvedPhotos,
    }, 200, "private, max-age=300");
  } catch (error) {
    console.error("place-photo", error);
    return json({ error: "Unable to load Google Places data." }, 500);
  }
});
