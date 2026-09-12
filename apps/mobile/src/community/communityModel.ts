import type { CommunityGroup } from './api';

export const LEGACY_TOPIC_COMMUNITY_NAMES = new Set([
  'camping',
  'hiking',
  'water adventures',
  'family adventures',
  'beginner outdoors',
]);

export const DEFAULT_OUTDOOR_INTERESTS = [
  'Camping',
  'Hiking',
  'Water',
  'Kayaking',
  'Paddleboarding',
  'Fishing',
  'Family',
  'Travel',
  'Cycling',
  'RV',
  'Overlanding',
  'Beginner Friendly',
  'Food',
  'Photography',
] as const;

export function isLegacyTopicCommunity(group: Pick<CommunityGroup, 'name' | 'kind'>) {
  return group.kind === 'interest' && LEGACY_TOPIC_COMMUNITY_NAMES.has(group.name.trim().toLowerCase());
}

export function isPeopleCommunity(group: Pick<CommunityGroup, 'name' | 'kind'>) {
  return !isLegacyTopicCommunity(group);
}

export function communityOwnershipLabel(group: CommunityGroup) {
  if (group.kind === 'adventure') return 'Trip community';
  if (group.kind === 'local') return group.city ? `Community in ${group.city}` : 'Member community';
  return 'Go Melanated community';
}
