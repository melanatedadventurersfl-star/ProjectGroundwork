# Member Profile Experience V2

## Goal

Make the member profile communicate who a person is outdoors before it shows what they have accumulated.

The profile hierarchy is:

1. Identity
2. Story
3. People
4. Recognition

## Owner profile

The owner profile starts with the member instead of separate Your Trail and Trail Crew panels.

### Hero and identity

- Cover image
- Profile photo
- Display name and optional username
- General city and state only
- Current rank
- Bio
- Outdoor interests
- Native profile sharing
- Edit action

### Meaningful stats

Only non-zero stats render.

- Adventures
- Unique places
- Trailmates
- Stamps

Badge totals no longer compete with the member identity in the profile header.

### Journey tab

Journey is the default profile tab and contains:

- Profile completion prompt for the owner
- Your Trail feature card
- Recent Adventures rail
- Your People / Trail Crew
- Favorite Memories
- Automatically derived Profile Highlights
- Badge Showcase
- Featured Stamps

Recognition is intentionally below story, people, and memories.

### Posts tab

Uses the existing profile post system.

### Photos tab

Shows adventure albums with direct gallery navigation.

### About tab

Contains:

- Rank progress
- Home base
- Member-since date
- Edit Profile
- Privacy controls
- Discovery controls
- View-as-member preview

The joined date no longer occupies prime profile-header space.

### Editing

The profile editor supports:

- Cover image
- Profile image
- Display name
- Username
- Bio
- Up to six outdoor interests
- City and state

The app continues to use the existing profile media and profile-save APIs.

## Visitor profile

The public/member-facing profile uses the same hierarchy as the owner profile.

### Relationship language

The existing mutual connection system is presented as Trailmates.

States include:

- Add Trailmate
- Request sent
- Accept or decline Trailmate request
- Trailmate

This release does not introduce a separate one-way following model.

### Shared context

When interests overlap, the visitor sees the number of shared interests and up to three examples.

### Privacy

The public profile continues to honor the existing public-profile RPC and privacy gates. Private profiles do not expose full Journey, posts, photos, or recognition data.

## Data strategy

This release reuses existing systems:

- `profiles`
- `member_journey`
- `member_connections`
- passport stamps
- member badges
- memory albums and photos
- public member-profile RPC

No new profile-history schema or migration is introduced.

## Empty-state rules

- Zero-value stats are hidden.
- Empty profile bio becomes an owner-only edit prompt.
- Empty Journey retains the first-chapter language.
- Empty visitor sections are not promoted above available content.

## Acceptance criteria

1. The actual member identity appears before Your Trail and Trail Crew content.
2. The previous full-width Your Trail and Trail Crew panels above the profile are removed.
3. Journey is the default profile content tab.
4. Recent adventures and people appear before badges and stamps.
5. Owner and visitor profiles share the same visual hierarchy.
6. Public profiles continue to honor privacy rules.
7. Existing Journey, Passport, Memories, connections, profile media, and posts remain the sources of truth.
8. No fake profile metrics are introduced.
9. Profile edit, share, privacy, discovery, and view-as-member actions remain reachable from the profile.
10. New members are not shown a wall of zero-value counters.