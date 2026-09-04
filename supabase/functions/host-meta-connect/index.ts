import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function cryptoKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decryptToken(ciphertext: string, secret: string) {
  const [ivPart, dataPart] = ciphertext.split(".");
  if (!ivPart || !dataPart) throw new Error("Stored Meta token is invalid.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    await cryptoKey(secret),
    base64ToBytes(dataPart),
  );
  return new TextDecoder().decode(plain);
}

function graphUrl(version: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function graphJson(url: URL, accessToken: string) {
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body?.error) {
    const message = body?.error?.message || `Meta request failed (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

type PageAsset = {
  id: string;
  name: string;
  url: string | null;
  about: string | null;
  website: string | null;
  imageUrl: string | null;
  followers: number | null;
  instagram: null | {
    id: string;
    username: string | null;
    name: string | null;
    biography: string | null;
    website: string | null;
    imageUrl: string | null;
    followers: number | null;
  };
};

async function listAssets(version: string, userToken: string): Promise<Array<PageAsset & { pageToken: string }>> {
  const accounts = await graphJson(graphUrl(version, "me/accounts", { fields: "id,name,access_token" }), userToken);
  const rows = Array.isArray(accounts?.data) ? accounts.data : [];
  const assets: Array<PageAsset & { pageToken: string }> = [];

  for (const row of rows) {
    const pageId = String(row?.id || "");
    const pageToken = String(row?.access_token || "");
    if (!pageId || !pageToken) continue;

    const page = await graphJson(
      graphUrl(version, pageId, { fields: "id,name,link,about,website,picture.type(large){url},fan_count,instagram_business_account" }),
      pageToken,
    );

    let instagram: PageAsset["instagram"] = null;
    const igId = page?.instagram_business_account?.id ? String(page.instagram_business_account.id) : "";
    if (igId) {
      try {
        const ig = await graphJson(
          graphUrl(version, igId, { fields: "id,username,name,biography,website,profile_picture_url,followers_count" }),
          pageToken,
        );
        instagram = {
          id: igId,
          username: ig?.username ? String(ig.username) : null,
          name: ig?.name ? String(ig.name) : null,
          biography: ig?.biography ? String(ig.biography) : null,
          website: ig?.website ? String(ig.website) : null,
          imageUrl: ig?.profile_picture_url ? String(ig.profile_picture_url) : null,
          followers: Number.isFinite(Number(ig?.followers_count)) ? Number(ig.followers_count) : null,
        };
      } catch (error) {
        console.warn("Unable to read linked Instagram profile", error);
      }
    }

    assets.push({
      id: pageId,
      name: String(page?.name || row?.name || "Facebook Page"),
      url: page?.link ? String(page.link) : null,
      about: page?.about ? String(page.about) : null,
      website: page?.website ? String(page.website) : null,
      imageUrl: page?.picture?.data?.url ? String(page.picture.data.url) : null,
      followers: Number.isFinite(Number(page?.fan_count)) ? Number(page.fan_count) : null,
      instagram,
      pageToken,
    });
  }

  return assets;
}

async function saveMetaSocialProfiles(admin: any, organizationId: string, userId: string, asset: PageAsset) {
  const now = new Date().toISOString();
  const pagePayload = {
    organization_id: organizationId,
    kind: "facebook_page",
    display_name: asset.name,
    handle: null,
    url: asset.url || `https://www.facebook.com/${asset.id}`,
    description: asset.about,
    image_url: asset.imageUrl,
    audience_count: asset.followers,
    audience_label: "followers",
    is_public: true,
    connection_mode: "meta",
    provider_account_id: asset.id,
    imported_data: {
      display_name: asset.name,
      url: asset.url,
      description: asset.about,
      website: asset.website,
      image_url: asset.imageUrl,
      audience_count: asset.followers,
    },
    last_synced_at: now,
    created_by: userId,
    updated_at: now,
  };

  const existingPage = await admin
    .from("host_social_profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("kind", "facebook_page")
    .eq("provider_account_id", asset.id)
    .maybeSingle();
  if (existingPage.error) throw existingPage.error;
  const pageResult = existingPage.data?.id
    ? await admin.from("host_social_profiles").update(pagePayload).eq("id", existingPage.data.id)
    : await admin.from("host_social_profiles").insert(pagePayload);
  if (pageResult.error) throw pageResult.error;

  if (asset.instagram) {
    const ig = asset.instagram;
    const igPayload = {
      organization_id: organizationId,
      kind: "instagram",
      display_name: ig.name || ig.username || "Instagram",
      handle: ig.username ? `@${ig.username.replace(/^@/, "")}` : null,
      url: ig.username ? `https://www.instagram.com/${ig.username.replace(/^@/, "")}/` : `https://www.instagram.com/`,
      description: ig.biography,
      image_url: ig.imageUrl,
      audience_count: ig.followers,
      audience_label: "followers",
      is_public: true,
      connection_mode: "meta",
      provider_account_id: ig.id,
      imported_data: {
        display_name: ig.name,
        username: ig.username,
        description: ig.biography,
        website: ig.website,
        image_url: ig.imageUrl,
        audience_count: ig.followers,
      },
      last_synced_at: now,
      created_by: userId,
      updated_at: now,
    };
    const existingIg = await admin
      .from("host_social_profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("kind", "instagram")
      .eq("provider_account_id", ig.id)
      .maybeSingle();
    if (existingIg.error) throw existingIg.error;
    const igResult = existingIg.data?.id
      ? await admin.from("host_social_profiles").update(igPayload).eq("id", existingIg.data.id)
      : await admin.from("host_social_profiles").insert(igPayload);
    if (igResult.error) throw igResult.error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("META_APP_ID");
  const graphVersion = Deno.env.get("META_GRAPH_VERSION");
  const tokenSecret = Deno.env.get("META_TOKEN_ENCRYPTION_KEY");
  const callbackUrl = Deno.env.get("META_PROFILE_CALLBACK_URL") || (supabaseUrl ? `${supabaseUrl}/functions/v1/host-meta-callback` : "");
  const scopes = (Deno.env.get("META_PROFILE_SCOPES") || "pages_show_list,pages_read_engagement,instagram_basic")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Function environment is incomplete." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const userResult = await userClient.auth.getUser();
    const userId = userResult.data.user?.id;
    if (userResult.error || !userId) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const action = String(body?.action || "status");
    const organizationId = String(body?.organizationId || "");
    if (!organizationId) return json({ error: "Organization is required." }, 400);

    const permission = await userClient.rpc("can_manage_host_organization", { p_organization_id: organizationId });
    if (permission.error || permission.data !== true) return json({ error: "Organization owner or admin access is required." }, 403);

    const configured = Boolean(appId && graphVersion && tokenSecret && callbackUrl);

    if (action === "status") {
      const result = await admin
        .from("host_meta_connections")
        .select("facebook_page_id,facebook_page_name,instagram_account_id,instagram_username,status,last_synced_at,token_expires_at")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (result.error) throw result.error;
      return json({ configured, connection: result.data ?? null });
    }

    if (!configured) {
      return json({
        error: "Meta connection is not configured yet.",
        code: "META_CONFIG_REQUIRED",
        required: ["META_APP_ID", "META_APP_SECRET", "META_GRAPH_VERSION", "META_TOKEN_ENCRYPTION_KEY"],
        callbackUrl,
      }, 503);
    }

    if (action === "start") {
      const nonce = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const returnUrl = String(body?.returnUrl || `melanatedadventurers://host/meta-connect?organizationId=${encodeURIComponent(organizationId)}`);
      if (!returnUrl.startsWith("melanatedadventurers://")) return json({ error: "Invalid return URL." }, 400);
      const stateInsert = await admin.from("host_meta_oauth_states").insert({
        organization_id: organizationId,
        profile_id: userId,
        nonce,
        return_url: returnUrl,
      });
      if (stateInsert.error) throw stateInsert.error;

      const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
      authUrl.searchParams.set("client_id", appId!);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("state", nonce);
      authUrl.searchParams.set("scope", scopes.join(","));
      authUrl.searchParams.set("response_type", "code");
      return json({ configured: true, authUrl: authUrl.toString(), callbackUrl });
    }

    const connectionResult = await admin.from("host_meta_connections").select("*").eq("organization_id", organizationId).maybeSingle();
    if (connectionResult.error) throw connectionResult.error;
    const connection = connectionResult.data;
    if (!connection) return json({ error: "Connect Facebook first." }, 409);
    if (!tokenSecret) return json({ error: "Meta token encryption is not configured." }, 503);
    const userToken = await decryptToken(String(connection.token_ciphertext), tokenSecret);

    if (action === "assets") {
      const assets = await listAssets(graphVersion!, userToken);
      return json({
        assets: assets.map(({ pageToken: _pageToken, ...asset }) => asset),
        selectedPageId: connection.facebook_page_id,
      });
    }

    if (action === "select" || action === "sync") {
      const pageId = action === "select" ? String(body?.pageId || "") : String(connection.facebook_page_id || "");
      if (!pageId) return json({ error: "Choose a Facebook Page first." }, 400);
      const assets = await listAssets(graphVersion!, userToken);
      const asset = assets.find((item) => item.id === pageId);
      if (!asset) return json({ error: "That Facebook Page is no longer available to this Meta login." }, 404);
      await saveMetaSocialProfiles(admin, organizationId, userId, asset);
      const now = new Date().toISOString();
      const update = await admin.from("host_meta_connections").update({
        facebook_page_id: asset.id,
        facebook_page_name: asset.name,
        instagram_account_id: asset.instagram?.id ?? null,
        instagram_username: asset.instagram?.username ?? null,
        status: "connected",
        last_synced_at: now,
        updated_at: now,
      }).eq("organization_id", organizationId);
      if (update.error) throw update.error;
      return json({
        connected: true,
        page: { id: asset.id, name: asset.name },
        instagram: asset.instagram ? { id: asset.instagram.id, username: asset.instagram.username } : null,
        lastSyncedAt: now,
      });
    }

    if (action === "disconnect") {
      const clear = await admin.from("host_social_profiles").update({
        connection_mode: "manual",
        provider_account_id: null,
        last_synced_at: null,
        updated_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("connection_mode", "meta");
      if (clear.error) throw clear.error;
      const remove = await admin.from("host_meta_connections").delete().eq("organization_id", organizationId);
      if (remove.error) throw remove.error;
      return json({ disconnected: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("host-meta-connect", error);
    return json({ error: error instanceof Error ? error.message : "Meta profile connection failed." }, 500);
  }
});
