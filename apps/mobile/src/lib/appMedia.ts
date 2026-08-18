import { supabase } from './supabase';

const APP_MEDIA_BUCKET = 'app-media';

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export async function uploadVerifiedAppImage({
  path,
  bytes,
  contentType,
}: {
  path: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}) {
  if (!path || path.startsWith('/') || path.includes('..')) {
    throw new Error('Invalid app-media path.');
  }
  if (!bytes.byteLength) {
    throw new Error('Image file is empty.');
  }

  const payload = exactArrayBuffer(bytes);
  const { error: uploadError } = await supabase.storage.from(APP_MEDIA_BUCKET).upload(path, payload, {
    contentType,
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: storedBlob, error: downloadError } = await supabase.storage.from(APP_MEDIA_BUCKET).download(path);
  if (downloadError || !storedBlob) {
    await supabase.storage.from(APP_MEDIA_BUCKET).remove([path]);
    throw downloadError ?? new Error('Uploaded image could not be read back for verification.');
  }

  const storedBytes = new Uint8Array(await storedBlob.arrayBuffer());
  if (!bytesEqual(bytes, storedBytes)) {
    await supabase.storage.from(APP_MEDIA_BUCKET).remove([path]);
    throw new Error(`Image verification failed after upload: ${bytes.byteLength} source bytes, ${storedBytes.byteLength} stored bytes.`);
  }

  const { data } = supabase.storage.from(APP_MEDIA_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export function appMediaPublicUrl(path: string, version?: string | number) {
  const { data } = supabase.storage.from(APP_MEDIA_BUCKET).getPublicUrl(path);
  return version == null ? data.publicUrl : `${data.publicUrl}?v=${encodeURIComponent(String(version))}`;
}
