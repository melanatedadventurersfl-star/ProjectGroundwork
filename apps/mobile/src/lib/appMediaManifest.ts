import { supabase } from './supabase';
import { appMediaPublicUrl } from './appMedia';

export type AppMediaManifestRow = {
  media_key: string;
  object_path: string;
  content_type: 'image/jpeg' | 'image/png' | 'image/webp';
  byte_size: number;
  updated_at: string;
};

export async function getAppMediaUrl(mediaKey: string) {
  const { data, error } = await supabase
    .from('app_media_manifest')
    .select('media_key, object_path, content_type, byte_size, updated_at')
    .eq('media_key', mediaKey)
    .maybeSingle<AppMediaManifestRow>();

  if (error) throw error;
  if (!data) return null;

  return appMediaPublicUrl(data.object_path, data.updated_at);
}

export async function publishAppMedia({
  mediaKey,
  objectPath,
  contentType,
  byteSize,
}: {
  mediaKey: string;
  objectPath: string;
  contentType: AppMediaManifestRow['content_type'];
  byteSize: number;
}) {
  const { error } = await supabase.from('app_media_manifest').upsert({
    media_key: mediaKey,
    object_path: objectPath,
    content_type: contentType,
    byte_size: byteSize,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
  return getAppMediaUrl(mediaKey);
}
