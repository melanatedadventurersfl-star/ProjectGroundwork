# Dynamic Outpost Create FAB V1

## Purpose

Add one floating create control to Outpost that answers one question: what can this member add here right now?

The button must never expose an action the current account cannot complete.

## Placement

- Floating circular button in the lower-right of Outpost.
- 56 px visual target with a centered plus icon.
- Gold fill with dark green icon.
- Native placement sits above the bottom tab bar and safe area.
- Web placement remains inside the app viewport instead of hugging the browser edge.
- Hide the button when the current account has no valid create actions.

## Permission model

V1 resolves create actions from three sources:

1. Account role from `profiles.platform_role`.
2. Host status from `profiles.event_host_level`.
3. Current joined Communities from `getGroups()`.

Admin status also checks the existing `is_platform_admin` RPC.

### Member

A normal member can only create content inside an existing Community they already joined.

Allowed from the Outpost FAB:

- Post to a joined Community.

Not allowed from the Outpost FAB:

- Create a Community.
- Create a hosted event.
- Create an outing as a host action.
- Open admin creation tools.

If the member has no joined Community, the FAB is hidden.

### Vendor

Vendor accounts follow member creation rules unless they also hold a host or admin permission.

### Host

Hosts receive member actions plus:

- Create an Outing.
- Create a Hosted Event.

Host status is true when `event_host_level` is populated, `platform_role` is `host`, or the account is an admin.

### Admin / Founder

Admins receive all host actions plus:

- Open Admin Tools.

V1 does not add a new Community-creation route because the current mobile route set has no standalone Community creator. The FAB must not advertise unsupported actions.

## Dynamic behavior

### No valid actions

Do not render the FAB.

### One valid action

Tapping the FAB executes that action directly.

Example: a normal member with at least one joined Community goes directly to the Community-post composer.

### Multiple valid actions

Tapping the FAB opens a bottom action sheet.

Action order:

1. Post to a Community.
2. Create an Outing.
3. Create a Hosted Event.
4. Admin Tools.

The sheet closes before navigation.

## Community post flow

1. Member taps the FAB.
2. Member enters the dedicated `Post to a Community` composer.
3. Composer loads only joined Communities.
4. If the member belongs to one Community, it is selected automatically.
5. If the member belongs to several Communities, the member selects the destination.
6. Member writes a post and may attach one photo.
7. Publish performs a final membership check through the current joined-Community list.
8. Post is created with `audience: 'group'` and the selected `groupId`.
9. User returns to Outpost.

The dedicated route prevents the Outpost FAB from dropping a normal member into the broader Community composer where `Everyone`, `Connections`, or `Circle` audiences are available.

## Community post composer V1

Required:

- Joined Community destination selector.
- Text body up to 4,000 characters.
- Optional image attachment through the existing Community image-upload path.
- Update or Ask post type.
- Clear publishing and loading states.
- Empty state when the user has no joined Community.
- Error state that preserves the draft.

Not in V1:

- Video attachment.
- Polls.
- Scheduled member posts.
- Draft persistence across app restarts.
- Moderation status UI.
- Posting as a business identity.

These stay in the follow-on creation system rather than blocking the floating-control release.

## Routes used

- Member Community post: `/community/create-in-community`
- Host outing: `/local-events/create`
- Hosted event: `/host/create-scratch`
- Admin tools: `/admin`

## Security and permission rules

- UI role checks are convenience gates, not authorization boundaries.
- Database policies and existing create APIs remain responsible for final authorization.
- Joined Community destinations come from current `getGroups()` results only.
- Never accept an arbitrary Community ID from the FAB without confirming that the returned group has `is_member = true`.
- Role data reloads whenever the Outpost tab regains focus.

## Accessibility

- FAB accessibility label: `Create`.
- Action sheet buttons expose descriptive labels.
- Close button and backdrop dismiss the sheet.
- Tap targets are at least 44 px.
- Destination selection has a visible selected state and accessibility state.

## Failure behavior

- Profile-role query failure falls back to member-level behavior.
- Admin RPC failure does not grant admin actions.
- Group-loading failure hides member posting instead of exposing an unverified destination.
- Failed image upload does not create a partial post.
- Failed post creation keeps the composer content visible.

## Acceptance criteria

- A normal member never sees host or admin actions.
- A normal member can only choose Communities they have joined.
- A member with no joined Communities does not see the FAB.
- A host sees Community post, outing, and hosted-event actions when available.
- An admin sees the host set plus Admin Tools.
- A vendor without host/admin status receives member behavior.
- The FAB remains above the bottom navigation on iOS and Android.
- The FAB does not cover the primary Outpost tab controls.
- One valid action skips the action sheet.
- Multiple valid actions open the action sheet.
- The Community composer publishes with `audience: 'group'`.
- The app does not add unsupported Community-creation controls.

## Follow-on

V1.1 can make the action order sensitive to the active Outpost subtab once that tab state is lifted into shared screen context. It can also add moderator-specific permissions, draft persistence, posting identities, moderation queues, video, polls, and scheduling without changing the FAB contract.