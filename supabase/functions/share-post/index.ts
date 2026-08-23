import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_SCHEME = 'melanatedadventurers';
const BRAND = 'Go Melanated';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function preview(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function page(input: {
  title: string;
  description: string;
  deepLink: string;
  canonicalUrl: string;
  imageUrl?: string | null;
  unavailable?: boolean;
}) {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const deepLink = escapeHtml(input.deepLink);
  const canonicalUrl = escapeHtml(input.canonicalUrl);
  const imageMeta = input.imageUrl
    ? `<meta property="og:image" content="${escapeHtml(input.imageUrl)}" /><meta name="twitter:card" content="summary_large_image" />`
    : '<meta name="twitter:card" content="summary" />';
  const heading = input.unavailable ? 'Post unavailable' : 'Shared from Go Melanated';
  const cta = input.unavailable
    ? '<p class="muted">This post may have been removed, made private, or is no longer available.</p>'
    : `<a class="button" href="${deepLink}">Open in Go Melanated</a><p class="muted">If the app does not open, install Go Melanated and try this link again.</p>`;
  const autoOpen = input.unavailable ? '' : `<script>setTimeout(function(){window.location.href=${JSON.stringify(input.deepLink)};},350);</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${canonicalUrl}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${BRAND}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonicalUrl}" />
${imageMeta}
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0f1713;color:#fff8e8;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);background:#17211c;border:1px solid #34483d;border-radius:28px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.brand{color:#d7b45a;font-weight:900;letter-spacing:.08em;font-size:12px;text-transform:uppercase}.title{font-size:32px;line-height:1.08;margin:10px 0 12px}.copy{font-size:18px;line-height:1.5;color:#dce5df;margin:0 0 24px}.button{display:flex;min-height:52px;align-items:center;justify-content:center;background:#d7b45a;color:#101510;text-decoration:none;font-weight:900;border-radius:16px;padding:0 18px}.muted{color:#94a198;font-size:13px;line-height:1.5;margin:14px 0 0}</style>
</head>
<body>
<main class="card"><div class="brand">${BRAND}</div><h1 class="title">${heading}</h1><p class="copy">${description}</p>${cta}</main>
${autoOpen}
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const requestUrl = new URL(req.url);
  const parts = requestUrl.pathname.split('/').filter(Boolean);
  const pIndex = parts.lastIndexOf('p');
  const postId = pIndex >= 0 ? parts[pIndex + 1] : null;
  const deepLink = postId ? `${APP_SCHEME}://community/${encodeURIComponent(postId)}` : `${APP_SCHEME}://community`;
  const canonicalUrl = requestUrl.toString();

  if (!postId) {
    const html = page({ title: BRAND, description: 'Open this shared post in Go Melanated.', deepLink, canonicalUrl, unavailable: true });
    return new Response(req.method === 'HEAD' ? null : html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    const html = page({ title: BRAND, description: 'Open this shared post in Go Melanated.', deepLink, canonicalUrl });
    return new Response(req.method === 'HEAD' ? null : html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: post } = await admin
    .from('community_posts')
    .select('id,body,image_url,audience,status,author_id,profiles!community_posts_author_id_fkey(display_name,first_name)')
    .eq('id', postId)
    .maybeSingle();

  const published = post && (!('status' in post) || post.status === 'published');
  if (!post || !published) {
    const html = page({ title: `Post unavailable · ${BRAND}`, description: 'This Go Melanated post is no longer available.', deepLink, canonicalUrl, unavailable: true });
    return new Response(req.method === 'HEAD' ? null : html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  }

  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const authorName = profile?.display_name || profile?.first_name || 'A member';
  const isPublic = post.audience === 'everyone';
  const bodyPreview = isPublic ? preview(post.body || '') : 'Open Go Melanated to view this shared community post.';
  const title = `${authorName} shared on ${BRAND}`;
  let imageUrl: string | null = null;

  if (isPublic && post.image_url) {
    if (/^https?:\/\//i.test(post.image_url)) {
      imageUrl = post.image_url;
    } else {
      const { data } = await admin.storage.from('community-media').createSignedUrl(post.image_url, 60 * 60 * 24);
      imageUrl = data?.signedUrl ?? null;
    }
  }

  const html = page({ title, description: bodyPreview || `Open this post in ${BRAND}.`, deepLink, canonicalUrl, imageUrl });
  return new Response(req.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
});
