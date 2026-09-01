import { supabase } from '../lib/supabase';
import type { ImportPreviewResult } from './creation';

export type HostImportAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

const MAX_FILES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'html', 'htm', 'zip', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

function safeName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return cleaned.slice(0, 120) || 'event-file';
}

function extension(name: string) {
  return name.toLowerCase().split('.').pop() ?? '';
}

export function validateHostImportAssets(files: HostImportAsset[]) {
  if (!files.length) throw new Error('Choose at least one event file.');
  if (files.length > MAX_FILES) throw new Error(`Choose up to ${MAX_FILES} files at a time.`);
  for (const file of files) {
    if (!ALLOWED_EXTENSIONS.includes(extension(file.name))) throw new Error(`${file.name} is not a supported event file.`);
    if (file.size != null && file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  }
}

export async function uploadAndPreviewHostImport(files: HostImportAsset[]): Promise<ImportPreviewResult & { files: { name: string; mimeType: string; size: number | null }[] }> {
  validateHostImportAssets(files);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sign in to import event files.');

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const uploadedPaths: string[] = [];
  const uploadedFiles: { path: string; name: string; mimeType: string; size: number | null }[] = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file) continue;
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error(`Unable to read ${file.name} from this device.`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
      const name = safeName(file.name);
      const path = `${userId}/${sessionId}/${String(index + 1).padStart(2, '0')}-${name}`;
      const mimeType = file.mimeType || response.headers.get('content-type') || 'application/octet-stream';
      const { error: uploadError } = await supabase.storage.from('event-imports').upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
      uploadedFiles.push({ path, name: file.name, mimeType, size: bytes.byteLength });
    }

    const { data, error } = await supabase.functions.invoke('host-import-upload-preview', {
      body: { files: uploadedFiles },
    });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data as ImportPreviewResult & { files: { name: string; mimeType: string; size: number | null }[] };
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from('event-imports').remove(uploadedPaths);
    throw error;
  }
}
