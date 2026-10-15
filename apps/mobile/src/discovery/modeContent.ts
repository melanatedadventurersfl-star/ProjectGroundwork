import type { CommunityGroup, CommunityPost } from '../community/api';
import type { DiscoveryMode } from './catalog';

// A community without a clear theme appears in both modes. Never auto-join
// or imply membership in a group just because its name matches a mode.
const OUTDOOR = /adventur|outdoor|camp|hik|trail|fish|paddl|kayak|canoe|river|spring|forest|nature|beach|cycling|bik|greenway|walk|bird|lake/i;
const URBAN = /jaxblack|night|nightlife|music|concert|jazz|art|gallery|theat|comedy|danc|brunch|dining|restaurant|food|city|urban|culture|network|rooftop|film|museum|bar|downtown/i;

export function groupWorld(group: Pick<CommunityGroup, 'name' | 'description' | 'adventure_id'>): DiscoveryMode | 'shared' {
  if (group.adventure_id) return 'nature';
  const name = group.name.toLowerCase();
  if (/jaxblack/i.test(name)) return 'night';
  const text = (group.name + ' ' + (group.description ?? '')).toLowerCase();
  if (OUTDOOR.test(text)) return 'nature';
  if (URBAN.test(text)) return 'night';
  return 'shared';
}

export function belongsInWorld(group: Pick<CommunityGroup, 'name' | 'description' | 'adventure_id'>, mode: DiscoveryMode) {
  const world = groupWorld(group);
  return world === 'shared' || world === mode;
}

export function postsForWorld(posts: CommunityPost[], joinedGroups: CommunityGroup[], mode: DiscoveryMode) {
  const relevantIds = new Set(joinedGroups.filter(group => belongsInWorld(group, mode)).map(group => group.id));
  // Global activity is shared. Group activity needs an actual membership and a matching world.
  return posts.filter(post => {
    if (post.group_id) return relevantIds.has(post.group_id);
    if (post.audience !== 'everyone') return false;
    const world = post.metadata?.world ?? post.metadata?.mode;
    if (world === 'nature' || world === 'night') return world === mode;
    // Older public updates without a world label belong to the original outdoor feed.
    // Never present them as city content unless explicitly marked shared.
    return world === 'shared' || mode === 'nature';
  });
}
