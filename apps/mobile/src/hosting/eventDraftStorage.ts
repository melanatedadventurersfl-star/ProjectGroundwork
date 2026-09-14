import Storage from 'expo-sqlite/kv-store';

import type { EventVisibility } from './hostProfiles';
import type { EventBuilderDifficulty } from './eventBuilderConfig';
import type { EventLocationType } from './api';

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
  updatedAt: string;
};

function keyFor(organizationId: string) {
  return `host-event-draft:v2:${organizationId}`;
}

export async function loadLocalEventDraft(organizationId: string): Promise<LocalEventDraft | null> {
  const raw = await Storage.getItem(keyFor(organizationId));
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
  await Storage.setItem(keyFor(draft.organizationId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
}

export async function removeLocalEventDraft(organizationId: string) {
  await Storage.removeItem(keyFor(organizationId));
}
