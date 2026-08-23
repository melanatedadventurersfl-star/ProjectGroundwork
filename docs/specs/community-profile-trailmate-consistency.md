# Community Profile: Trailmate Consistency

## Problem
When a member views someone they are already connected to, the profile currently changes into a relationship-heavy presentation. The large Trailmates card and alternate header treatment make an accepted connection feel like a separate profile type instead of the same member profile with a different relationship state.

## Product rule
There is one public/community member profile layout. Relationship status changes controls, not the profile structure.

Supported relationship states:
- none
- request sent
- request received
- accepted / Trailmates
- self

The profile header, identity, rank, stats, bio, interests, Journey / Posts / About tabs, and visible member content stay in the same positions across states.

## Visual behavior
### Standard profile shell
- Use the same visual language as the regular member profile.
- Show the profile cover first.
- Overlap the avatar against the lower edge of the cover.
- Keep name, username, location, and rank grouped beside the avatar.
- Present stats as a lightweight inline row instead of a boxed dashboard.
- Keep bio, interests, and joined date in the normal profile flow.
- Use a simple underline tab treatment for Journey / Posts / About.

### Accepted Trailmate
- Do not render a large relationship card inside the profile body.
- Show a compact `Trailmates` status pill in the top action area.
- Do not expose `Remove` as a primary profile action.
- The rest of the profile must render identically to the normal community profile.

### Not yet connected
- `Add Trailmate` remains a normal CTA below the identity content.
- A sent request may use a compact status card.
- A received request may show Accept / Decline controls.
- These controls must not replace or re-layout the profile itself.

### Privacy
- Existing privacy rules remain authoritative.
- A private profile can still show the standard identity shell.
- Content that is not permitted remains hidden and the private-state message appears below the identity section.
- An accepted Trailmate gains whatever visibility the existing RPC allows, without receiving a different UI template.

## Data requirement
`get_public_member_profile` must expose `cover_url` when the viewer is allowed to see the profile so the community profile can use the same cover treatment as the regular profile.

## Acceptance criteria
1. Viewing a connected Trailmate does not show the former full-width `Trailmates / Connected across Campfire and your Crew / Remove` card.
2. Connected users show a compact `Trailmates` status indicator in the header area.
3. Community profiles display the member's cover image when one exists.
4. The profile identity hierarchy matches the regular profile: cover, avatar, name, handle, location, rank, stats, bio, interests, joined date, then tabs/content.
5. Changing relationship state does not rearrange the profile's core content.
6. Request-sent and request-received states continue to work.
7. Private-profile visibility rules remain unchanged.
8. Existing Journey, Posts, and About content remains reachable.
