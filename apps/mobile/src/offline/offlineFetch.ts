import Storage from 'expo-sqlite/kv-store';

const CACHE_PREFIX = 'ma-offline-http:v1:';
const MAX_CACHE_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_RESPONSE_CHARS = 1_500_000;

type CachedHttpResponse = {
  body: string;
  status: number;
  statusText: string;
  contentType: string | null;
  contentRange: string | null;
  savedAt: number;
};

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

const networkFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input: FetchInput) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: FetchInput, init?: FetchInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL) && input.method) return input.method.toUpperCase();
  return 'GET';
}

function requestHeaders(input: FetchInput, init?: FetchInit) {
  const headers = new Headers();
  if (typeof input !== 'string' && !(input instanceof URL)) {
    new Headers(input.headers).forEach((value, key) => headers.set(key, value));
  }
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

function simpleHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheScope(headers: Headers) {
  const authorization = headers.get('authorization') ?? '';
  if (!authorization) return 'anon';
  return `auth-${simpleHash(authorization)}`;
}

function shouldCache(url: string, method: string) {
  if (method !== 'GET') return false;
  return url.includes('/rest/v1/') || url.includes('/auth/v1/user');
}

function cacheKey(url: string, headers: Headers) {
  const accept = headers.get('accept') ?? '';
  const prefer = headers.get('prefer') ?? '';
  return `${CACHE_PREFIX}${cacheScope(headers)}:${simpleHash(`${url}|${accept}|${prefer}`)}`;
}

async function saveResponse(key: string, response: Response) {
  if (!response.ok) return;
  try {
    const clone = response.clone();
    const body = await clone.text();
    if (body.length > MAX_RESPONSE_CHARS) return;

    const cached: CachedHttpResponse = {
      body,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentRange: response.headers.get('content-range'),
      savedAt: Date.now(),
    };
    await Storage.setItem(key, JSON.stringify(cached));
  } catch {
    // Cache failures should never block a successful network response.
  }
}

async function readResponse(key: string) {
  try {
    const raw = await Storage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedHttpResponse;
    if (!cached.savedAt || Date.now() - cached.savedAt > MAX_CACHE_AGE_MS) {
      await Storage.removeItem(key);
      return null;
    }

    const headers = new Headers();
    if (cached.contentType) headers.set('content-type', cached.contentType);
    if (cached.contentRange) headers.set('content-range', cached.contentRange);
    headers.set('x-ma-offline-cache', '1');
    headers.set('x-ma-offline-saved-at', new Date(cached.savedAt).toISOString());

    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  } catch {
    return null;
  }
}

export async function offlineFirstFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const url = requestUrl(input);
  const method = requestMethod(input, init);
  if (!shouldCache(url, method)) return networkFetch(input, init);

  const key = cacheKey(url, requestHeaders(input, init));

  try {
    const response = await networkFetch(input, init);
    void saveResponse(key, response);
    return response;
  } catch (networkError) {
    const cached = await readResponse(key);
    if (cached) return cached;
    throw networkError;
  }
}

export async function clearOfflineHttpCache() {
  try {
    const keys = await Storage.getAllKeys();
    const offlineKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    await Promise.all(offlineKeys.map((key) => Storage.removeItem(key)));
  } catch {
    // Clearing cache is best-effort. Auth sign-out must still continue.
  }
}
