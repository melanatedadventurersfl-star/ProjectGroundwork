import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
}

function addResult(returnUrl: string, params: Record<string, string>) {
  const url = new URL(returnUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

async function cryptoKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt"]);
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(secret),
    new TextEncoder().encode(token),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

async function fetchJson(url: URL) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || `Meta request failed (${response.status}).`);
  }
  return body;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const graphVersion = Deno.env.get("META_GRAPH_VERSION");
  const tokenSecret = Deno.env.get("META_TOKEN_ENCRYPTION_KEY");
  const callbackUrl = Deno.env.get("META_PROFILE_CALLBACK_URL") || (supabaseUrl ? `${supabaseUrl}/functions/v1/host-meta-callback` : "");

  if (!supabaseUrl || !serviceRoleKey || !appId || !appSecret || !graphVersion || !tokenSecret || !callbackUrl) {
    return new Response("Meta profile connection is not configured.", { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const incoming = new URL(req.url);
  const state = incoming.searchParams.get("state") || "";
  const code = incoming.searchParams.get("code") || "";
  const providerError = incoming.searchParams.get("error_message") || incoming.searchParams.get("error_description") || "";

  if (!state) return new Response("Missing OAuth state.", { status: 400 });

  const stateResult = await admin
    .from("host_meta_oauth_states")
    .select("id,organization_id,profile_id,return_url,expires_at,consumed_at")
    .eq("nonce", state)
    .maybeSingle();
  if (stateResult.error || !stateResult.data) return new Response("OAuth state is invalid.", { status: 400 });
  const oauthState = stateResult.data;

  if (oauthState.consumed_at || new Date(oauthState.expires_at).valueOf() < Date.now()) {
    return redirect(addResult(oauthState.return_url, { meta: "error", reason: "expired" }));
  }

  if (!oauthState.return_url.startsWith("melanatedadventurers://")) {
    return new Response("Invalid OAuth return URL.", { status: 400 });
  }

  if (providerError || !code) {
    await admin.from("host_meta_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("id", oauthState.id);
    return redirect(addResult(oauthState.return_url, { meta: "error", reason: providerError || "cancelled" }));
  }

  try {
    const exchangeUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("redirect_uri", callbackUrl);
    exchangeUrl.searchParams.set("code", code);
    const shortTokenResult = await fetchJson(exchangeUrl);
    const shortToken = String(shortTokenResult?.access_token || "");
    if (!shortToken) throw new Error("Meta did not return an access token.");

    let accessToken = shortToken;
    let expiresIn = Number(shortTokenResult?.expires_in || 0);
    try {
      const longUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
      longUrl.searchParams.set("grant_type", "fb_exchange_token");
      longUrl.searchParams.set("client_id", appId);
      longUrl.searchParams.set("client_secret", appSecret);
      longUrl.searchParams.set("fb_exchange_token", shortToken);
      const longResult = await fetchJson(longUrl);
      if (longResult?.access_token) accessToken = String(longResult.access_token);
      if (Number(longResult?.expires_in)) expiresIn = Number(longResult.expires_in);
    } catch (error) {
      console.warn("Long-lived Meta token exchange unavailable", error);
    }

    const meUrl = new URL(`https://graph.facebook.com/${graphVersion}/me`);
    meUrl.searchParams.set("fields", "id");
    meUrl.searchParams.set("access_token", accessToken);
    const me = await fetchJson(meUrl);

    const permissionsUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/permissions`);
    permissionsUrl.searchParams.set("access_token", accessToken);
    let grantedScopes: string[] = [];
    try {
      const permissions = await fetchJson(permissionsUrl);
      grantedScopes = (Array.isArray(permissions?.data) ? permissions.data : [])
        .filter((row: any) => row?.status === "granted" && row?.permission)
        .map((row: any) => String(row.permission));
    } catch (error) {
      console.warn("Unable to read Meta permissions", error);
    }

    const encrypted = await encryptToken(accessToken, tokenSecret);
    const now = new Date().toISOString();
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const connection = await admin.from("host_meta_connections").upsert({
      organization_id: oauthState.organization_id,
      connected_by: oauthState.profile_id,
      facebook_user_id: me?.id ? String(me.id) : null,
      token_ciphertext: encrypted,
      granted_scopes: grantedScopes,
      token_expires_at: tokenExpiresAt,
      status: "connected",
      updated_at: now,
    }, { onConflict: "organization_id" });
    if (connection.error) throw connection.error;

    await admin.from("host_meta_oauth_states").update({ consumed_at: now }).eq("id", oauthState.id);
    return redirect(addResult(oauthState.return_url, { meta: "connected" }));
  } catch (error) {
    console.error("host-meta-callback", error);
    await admin.from("host_meta_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("id", oauthState.id);
    return redirect(addResult(oauthState.return_url, {
      meta: "error",
      reason: error instanceof Error ? error.message.slice(0, 180) : "connection_failed",
    }));
  }
});
