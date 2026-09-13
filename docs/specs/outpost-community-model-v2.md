# Outpost and Community Model V2

## Product model

Outpost is one continuous social home. It answers: what are my people talking about, planning, and doing?

Do not split the main Outpost into Campfires, Communities, and Outings tabs.

Use these concepts consistently:

- Community: who the member is talking with
- Interest: what the content is about
- Post: what is happening in the conversation
- Outing or event: what the member can do
- Host: who organized it

## Outpost

Order the main experience as:

1. Compact local Outpost hero
2. Featured activity carousel
3. Happening now
4. Coming up
5. Your Communities
6. Contextual recommendations when there is a strong recommendation

The hero should stay near 140 px tall so the featured card reaches the member's natural interaction area sooner.

Do not show a dedicated Trailmates strip. Connections remain ranking signals and can appear as contextual social proof.

## Featured activity

Text, photo, and outing cards use the same outer dimensions.

Keep existing carousel behavior:

- horizontal swipe browses cards
- swipe up hides the active card for the day
- swipe down restores the most recently hidden card
- X provides an explicit hide action
- Undo remains available for the short recovery window
- vertical card gestures must not scroll the page

## Communities

A Community is a persistent group of people with an identifiable owner and purpose.

Supported ownership models:

- host community
- member-led community
- Go Melanated official community
- private community

Generic activity topics are not communities by default.

Legacy starter rooms such as Camping, Hiking, Water Adventures, Family Adventures, and Beginner Outdoors become topic records and are removed from normal community discovery. Existing posts remain intact and receive matching interest associations.

Community discovery lives on a dedicated screen instead of a permanent Outpost tab. It contains:

- search
- Your Communities
- Recommended for You
- Browse Communities

Do not use a second scenic hero on this screen.

## Interests

Interests are reusable many-to-many labels.

A member, host, community, post, or event can have several interests at once.

Initial interests include Camping, Hiking, Water, Kayaking, Paddleboarding, Fishing, Family, Travel, Cycling, RV, Overlanding, Beginner Friendly, Beach, Social, Food, and Photography.

Do not model these as one boolean column per interest.

## Posting

The community composer separates destination from topic.

Destination answers: who am I posting this to?

Topics answer: what is this about?

The community field is one compact selector. On mobile it opens a bottom sheet. The sheet can search when the member has many communities.

The member can attach multiple optional interests to a post.

## Host communities

Two ownership layers must stay separate.

`community_groups.organization_id` is the platform tenant boundary. It keeps the community inside the correct company or organization workspace.

`community_groups.host_organization_id` is the public host identity that owns a host community. This answers the member-facing question: who runs this community?

Each public host identity can designate one primary community through `host_organizations.primary_community_id`. Team members who publish as that same host identity share the same community destination.

`organizations.primary_host_organization_id` selects the default public host identity for Host Center inside a tenant. It does not make every event in the tenant belong to that host.

Do not require separate host groups for Camping, Hiking, Water, Family, or other overlapping activities.

The primary community is the social home for that host identity's posts, members, and outings.

`community_groups.host_profile_id`, `host_profiles.primary_community_id`, and `organizations.primary_community_id` remain compatibility fields only. They must not decide event distribution.

## Host events and community outings

Host Center remains the source of truth for host events.

`adventures.platform_organization_id` identifies the tenant that owns the event.

`adventures.organization_id` identifies the public host identity presenting the event. It points to `host_organizations`.

When an adventure is published, the system resolves its public host identity from `adventures.organization_id`, then links it to that host identity's primary community through `community_outings`.

The event creator does not determine the community destination. Two teammates publishing as the same public host identity must produce the same community outing.

An event with no public host identity does not automatically inherit another host's community just because both records live in the same tenant.

The community outing is a reference to the adventure, not a duplicated event record.

Changes to the adventure therefore remain authoritative everywhere it appears.

Changing a public host identity's primary community repoints that host's published primary outing links. Intentional non-primary shares remain separate.

The community page includes an Outings destination that reads those linked adventures.

A host event can carry multiple interest tags independently from its event type.

## Visibility

Event visibility and host community ownership are separate concerns.

A host can associate an event with a primary community while still choosing public, unlisted, private, or community-only visibility.

Community-only visibility continues to define who can open the event.

## Data relationships

Core tables and joins:

- `organizations.primary_host_organization_id`
- `host_organizations.primary_community_id`
- `community_groups.organization_id`
- `community_groups.host_organization_id`
- `community_groups`
- `community_group_members`
- `interests`
- `profile_interests`
- `community_interests`
- `community_post_interests`
- `adventure_interests`
- `host_interests`
- `community_outings`
- `host_profiles.primary_community_id` as legacy compatibility only
- `organizations.primary_community_id` as legacy compatibility only

## Acceptance criteria

- Main Outpost has no Campfires, Communities, or Outings tabs.
- Main Outpost has no dedicated Trailmates strip.
- Compact hero moves featured activity higher.
- Featured text, photo, and outing cards use one outer height.
- Generic starter activity rooms do not appear as joinable communities in normal discovery.
- Dedicated community discovery has no redundant hero.
- Community composer uses one selector instead of a full community card list.
- Posts can carry multiple interests.
- Host events can carry multiple interests.
- Every community has a platform organization owner.
- A host community can identify the public host identity that runs it.
- A public host identity can designate one primary host community.
- A host community cannot become primary for a host identity in another tenant.
- Host Center resolves the active tenant's default public host identity.
- New Host Center events persist that public host identity on `adventures.organization_id`.
- Published Host Center events automatically appear as linked outings in the primary community for their public host identity.
- Events created by different teammates under the same public host identity route to the same primary community.
- Events without a public host identity do not get routed into an unrelated host community.
- Changing a public host identity's primary community repoints only that host identity's published primary outing links.
- Community Outings open the same underlying adventure record.
- Communities expose ownership type and distinguish host, member-led, and Go Melanated spaces.