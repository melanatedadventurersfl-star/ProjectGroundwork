import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import type { EventVisibility } from './hostProfiles';
import type { EventBuilderDifficulty } from './eventBuilderConfig';
import type { EventLocationType } from './api';

export type LocalEventVenue = {
  placeId: string | null;
  name: string;
  address: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  source: string;
  sourceLabel: string;
};

export type LocalEventDraft = {
  version: 2;
  organizationId: string;
  creationKey: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: EventBuilderDifficulty;
  startsAt: string | null;
  endsAt: string | null;
  locationType: EventLocationType;
  venueName: string;
  city: string;
  state: string;
  onlineUrl: string;
  capacityMode: 'unlimited' | 'limited';
  capacity: string;
  meetingInstructions: string;
  visibility: EventVisibility;
  selectedGroupIds: string[];
  primaryCommunityId: string | null;
  paid: boolean;
  price: string;
  coverUri: string | null;
  coverAltText: string;
  selectedVenue?: LocalEventVenue | null;
  activeStep?: 'basics' | 'schedule' | 'access';
  showMoreDetails?: boolean;
  updatedAt: string;
};

function keyFor(organizationId: string) {
  return `host-event-draft:v2:${organizationId}`;
}

function getWebStorage() {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    throw new Error('Browser storage is unavailable.');
  }
  return globalThis.localStorage;
}

async function getItem(key: string) {
  if (Platform.OS === 'web') return getWebStorage().getItem(key);
  return Storage.getItem(key);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebStorage().setItem(key, value);
    return;
  }
  await Storage.setItem(key, value);
}

async function removeItem(key: string) {
  if (Platform.OS === 'web') {
    getWebStorage().removeItem(key);
    return;
  }
  await Storage.removeItem(key);
}

export async function loadLocalEventDraft(organizationId: string): Promise<LocalEventDraft | null> {
  const raw = await getItem(keyFor(organizationId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalEventDraft>;
    if (parsed.version !== 2 || parsed.organizationId !== organizationId || !parsed.creationKey) return null;
    return parsed as LocalEventDraft;
  } catch {
    return null;
  }
}

export async function saveLocalEventDraft(draft: LocalEventDraft) {
  await setItem(keyFor(draft.organizationId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
}

export async function removeLocalEventDraft(organizationId: string) {
  await removeItem(keyFor(organizationId));
}
