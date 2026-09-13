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
  'Beach',
  'Social',
  'Food',
  'Photography',
] as const;

export function isLegacyTopicCommunity(group: Pick<CommunityGroup, 'name' | 'kind' | 'is_topic'>) {
  return group.is_topic === true || (group.kind === 'interest' && LEGACY_TOPIC_COMMUNITY_NAMES.has(group.name.trim().toLowerCase()));
}

export function isPeopleCommunity(group: Pick<CommunityGroup, 'name' | 'kind' | 'is_topic'>) {
  return !isLegacyTopicCommunity(group);
}

export function communityOwnershipLabel(group: CommunityGroup) {
  if (group.owner_type === 'platform' || group.community_type === 'official') return 'Run by Go Melanated';
  if (group.owner_type === 'host' || group.community_type === 'host') return 'Host community';
  if (group.kind === 'adventure') return 'Trip community';
  if (group.kind === 'local') return group.city ? `Member-led in ${group.city}` : 'Member-led community';
  return 'Member-led community';
}
