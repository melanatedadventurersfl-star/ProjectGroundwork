import { supabase } from '../lib/supabase';
import type { ImportPreviewResult } from './creation';

export type FlyerAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

const MAX_BYTES = 10 * 1024 * 1024;

function extensionFor(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

async function functionErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        try {
          const text = await context.clone().text();
          if (text.trim()) return text.trim();
        } catch {
          // Fall through to the standard message.
        }
      }
    }
  }
  return error instanceof Error ? error.message : 'Unable to read this flyer.';
}

export async function uploadAndPreviewFlyer(asset: FlyerAsset): Promise<ImportPreviewResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sign in to scan an event flyer.');

  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Unable to read this flyer from your device.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error('This flyer is larger than 10 MB.');

  const mimeType = asset.mimeType || response.headers.get('content-type') || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('Use a JPG, PNG, or WebP flyer image.');
  }

  const extension = extensionFor(mimeType);
  const safeFileName = (asset.fileName || `event-flyer.${extension}`).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const path = `${userId}/flyers/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from('event-imports').upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  try {
    const { data, error } = await supabase.functions.invoke('host-flyer-preview', {
      body: { path, fileName: safeFileName, mimeType },
    });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.error) throw new Error(String(data.error));
    if (!data?.preview) throw new Error('The flyer reader returned no event draft.');
    return data as ImportPreviewResult;
  } finally {
    await supabase.storage.from('event-imports').remove([path]).catch(() => undefined);
  }
}
