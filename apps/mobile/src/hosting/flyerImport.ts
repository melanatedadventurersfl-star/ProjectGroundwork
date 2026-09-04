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
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data as ImportPreviewResult;
  } finally {
    await supabase.storage.from('event-imports').remove([path]).catch(() => undefined);
  }
}
