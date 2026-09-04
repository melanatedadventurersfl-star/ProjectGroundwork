import { Linking } from 'react-native';

import { supabase } from '../lib/supabase';

export type MetaConnectionStatus = {
  configured: boolean;
  connection: null | {
    facebook_page_id: string | null;
    facebook_page_name: string | null;
    instagram_account_id: string | null;
    instagram_username: string | null;
    status: 'connected' | 'expired' | 'revoked' | 'error';
    last_synced_at: string | null;
    token_expires_at: string | null;
  };
};

export type MetaPageAsset = {
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

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('host-meta-connect', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function getMetaConnectionStatus(organizationId: string) {
  return invoke<MetaConnectionStatus>({ action: 'status', organizationId });
}

export async function startMetaConnection(organizationId: string) {
  const returnUrl = `melanatedadventurers://host/meta-connect?organizationId=${encodeURIComponent(organizationId)}`;
  const result = await invoke<{ configured: boolean; authUrl: string }>({ action: 'start', organizationId, returnUrl });
  if (!result.authUrl) throw new Error('Meta did not return a sign-in URL.');
  await Linking.openURL(result.authUrl);
}

export async function listMetaPageAssets(organizationId: string) {
  const result = await invoke<{ assets: MetaPageAsset[]; selectedPageId: string | null }>({ action: 'assets', organizationId });
  return result;
}

export async function selectMetaPage(organizationId: string, pageId: string) {
  return invoke<{ connected: boolean; page: { id: string; name: string }; instagram: null | { id: string; username: string | null }; lastSyncedAt: string }>({
    action: 'select', organizationId, pageId,
  });
}

export async function syncMetaProfiles(organizationId: string) {
  return invoke<{ connected: boolean; lastSyncedAt: string }>({ action: 'sync', organizationId });
}

export async function disconnectMetaProfiles(organizationId: string) {
  return invoke<{ disconnected: boolean }>({ action: 'disconnect', organizationId });
}
