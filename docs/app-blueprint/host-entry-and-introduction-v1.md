# Host Center Entry and Introduction V1

## Purpose

Host Center needs a dedicated entry experience that lets approved hosts go directly into operations without first entering the member-facing Go Melanated product.

The system keeps one Go Melanated identity per person. Host Center is a separate product shell, not a separate account database.

## Product rule

One account -> multiple roles -> separate product shells -> shared identity and event data.

A user who signs in through the Host Center entry should remain in Host Center until they deliberately choose Exit Host Center.

## Scope

V1 includes:

- Dedicated Host Center login route.
- Host permission verification after authentication.
- Approved, pending, needs-info, paused, declined, revoked and no-access states.
- Host-specific first-run introduction.
- Persistent Host Setup Checklist.
- Organization and host-profile setup.
- Working preferences.
- AI and privacy explanation with optional controls remaining off unless the user enables them.
- Connections orientation.
- First-action choice.
- Return-to-work destination support.
- Host Center navigation isolation from member navigation.
- Replay introduction and continue setup support.
- Exit Host Center action.
- Shared-account model with no duplicate host credentials.

V1 does not create live Meta, Eventbrite, payout or calendar integrations. It prepares the connection and setup surfaces for those systems.

## HOST-ENTRY-01: Dedicated Host Login

Route: `/host-login`

The screen uses Go Melanated identity but Host Center positioning.

Required content:

- Go Melanated brand.
- Host Center label.
- Short operational description.
- Email.
- Password.
- Show/hide password.
- Forgot password.
- Sign in.
- Link back to the member sign-in experience.

The Host login must never route an approved host through Trailhead, Explore, Outpost or the member Home before Host Center.

## HOST-ENTRY-02: Authentication and access routing

After password authentication:

1. Read the authenticated user.
2. Check `outing_hosts` access through the existing host-access rules.
3. If approved, read Host Center setup state.
4. If first Host Center entry, route to `/host/intro`.
5. If introduction is complete, route to the requested Host Center destination when present.
6. Otherwise route to `/host`.

Non-approved states:

- `pending`: Show Host access pending.
- `needs_info`: Show More information needed.
- `paused`: Show Host access paused.
- `declined`: Show Host access unavailable.
- `revoked`: Show Host access revoked.
- no host record: Show This account does not have Host Center access.

The user may return to normal Go Melanated from these states.

## HOST-ENTRY-03: Return-to-work destination

A Host Center URL may include a destination parameter.

Example:

`/host-login?next=/host/assistant/<event-id>`

After authentication and any required introduction, Host Center should return the user to that approved Host Center path.

The destination must be constrained to `/host` routes. External URLs and member routes must not be accepted as Host Center return destinations.

## HOST-SHELL-01: Navigation isolation

Every `/host/*` screen belongs to the Host Center shell.

Member bottom navigation and member top navigation must remain hidden inside Host Center.

Host Center mobile navigation:

- Home
- Work
- Events
- Calendar
- More

V1 may continue to use existing Host Center page navigation until the dedicated host navigation component is complete, but member navigation must never appear inside the Host Center shell.

## HOST-SHELL-02: Exit Host Center

Host Center includes an explicit Exit Host Center action.

Exit Host Center routes to the normal member experience. It does not sign the user out.

The action should not silently discard unsaved work.

## HOST-INTRO-01: First-run introduction

The introduction is separate from member onboarding.

Existing members do not repeat member onboarding when they become hosts.

The Host introduction is six steps:

1. Welcome to Host Center.
2. How Host Center works.
3. Host and organization profile.
4. Working preferences.
5. AI and Privacy.
6. Connections and first action.

The host can leave and resume the introduction.

The user can skip optional setup, but the introduction completion state remains separate from setup checklist completion.

## HOST-INTRO-02: Welcome

Explain the operating areas:

- Events
- Work
- Calendar
- Teams
- Vendors
- Marketing
- Communications
- Finances
- Inventory

Primary message:

Plan, organize, promote and run your events from one place.

## HOST-INTRO-03: Event lifecycle orientation

Explain:

Idea -> Build Event -> Work Plan -> Promote -> Run Event -> Review

The purpose is orientation, not a full tutorial.

## HOST-INTRO-04: Host profile and organization

Collect or confirm:

- Organization or business name.
- Host display name.
- City.
- State.
- Contact email.
- Website.
- Public description.
- Public-profile visibility.

Optional fields do not block Host Center access.

## HOST-INTRO-05: Working preferences

Allow a host to select the areas they normally handle:

- Event planning
- Operations
- Marketing
- Vendors
- Finance
- Food
- Logistics
- Volunteers
- Communications
- Guest experience

These preferences customize setup and recommendations. They do not grant permissions.

## HOST-INTRO-06: AI and Privacy

Explain the Event Planner and Event Assistant.

Optional AI settings remain off unless the host explicitly enables them.

Controls:

- Personal Memory.
- Learn From Event History.
- Shared Organization Memory.
- Save AI Planning Conversations.
- Product Improvement Analytics.
- Recommendation History.

The introduction may link to the full AI & Privacy screen.

No preselected consent.

## HOST-INTRO-07: Connections orientation

Show connection categories:

- Eventbrite.
- Facebook.
- Instagram.
- Email.
- Calendar.

Each unsupported or unconfigured service is labeled Not connected or Coming later. The setup flow must not imply that a provider is connected when it is not.

## HOST-INTRO-08: First action

After the introduction, offer:

- Plan an event with AI.
- Build an event manually.
- Import an existing event.
- Explore Host Center.

Selecting one completes the introduction and routes directly to that action.

## HOST-SETUP-01: Persistent setup checklist

Host Center tracks setup separately from intro completion.

Checklist:

- Host profile.
- Organization details.
- Working preferences.
- AI & Privacy reviewed.
- Notifications reviewed.
- Connections reviewed.
- Event defaults reviewed.
- Team reviewed.

The dashboard can show `Host Setup X of 8 complete` until all items are complete.

The checklist must not block normal Host Center use unless a specific downstream feature requires the missing information.

## HOST-SETUP-02: Resume setup

If setup is incomplete, Host Center exposes Continue Host Setup.

The user resumes at the first incomplete setup area rather than restarting the introduction.

## HOST-SETUP-03: Event defaults

Host Center can store defaults for future event creation:

- Default city.
- Default state.
- Default visibility.
- Default attendee reminder schedule.
- Default cancellation/refund note.
- Default waiver preference.

Defaults are starting values only. The host may override them per event.

## HOST-SETUP-04: Team orientation

The setup flow asks whether the host works with other people.

V1 records that Team setup was reviewed. Permanent reusable team creation remains handled by the Teams roadmap.

## HOST-SETUP-05: Notification orientation

The setup flow distinguishes operational Host notifications from community notifications.

Operational categories include:

- Tasks due.
- Blocked tasks.
- Registrations.
- Capacity warnings.
- Vendor activity.
- Event changes.
- Weather review.
- Team activity.

V1 records the review state. Detailed notification preferences continue to use the existing notification system until Host-specific preference controls are connected.

## HOST-SETUP-06: Replay introduction

Route: `/host/setup`

Host Settings or Help should provide Replay Host Introduction.

Replaying the introduction does not clear setup data or AI privacy preferences.

## HOST-DATA-01: Host Center profile record

Create one `host_center_profiles` row per approved host.

Fields:

- `profile_id`
- `organization_name`
- `host_display_name`
- `city`
- `state`
- `contact_email`
- `website_url`
- `public_description`
- `public_profile_enabled`
- `working_areas`
- `intro_started_at`
- `intro_completed_at`
- `intro_last_step`
- checklist review timestamps
- event defaults
- `last_host_destination`
- created/updated timestamps

## HOST-DATA-02: Security

`host_center_profiles` is user-scoped through RLS.

A host can read and update only their own record unless an existing platform-admin policy grants administrative access.

Host access itself remains controlled by the authoritative `outing_hosts` status and existing host RPCs.

The profile row does not grant Host Center permission.

## HOST-DATA-03: Role separation

Working preferences are not permissions.

Organization role, event access and finance permissions must remain independently enforceable at the data layer.

V1 does not replace existing authorization rules.

## HOST-UX-01: Existing hosts

Existing approved hosts entering Host Center after this release receive the Host introduction once.

They can skip optional fields and continue to Host Center.

Existing event data is not modified by the introduction.

## HOST-UX-02: Host context

Host-specific screens must clearly identify the user as operating inside Host Center.

The user should not need to infer context from the URL or back button.

## HOST-UX-03: Empty dashboard

A host with no events should see useful first actions rather than a blank dashboard:

- Plan with AI.
- Build manually.
- Import event.
- Browse templates.

## HOST-UX-04: Continue where you left off

When possible, Host Center remembers the last safe Host Center destination.

Login may offer Continue where you left off. V1 stores the destination, while richer recent-work cards can be added later.

## Acceptance criteria

V1 is complete when:

- `/host-login` authenticates against the existing Go Melanated account.
- Approved hosts bypass the member product after Host login.
- Non-approved accounts receive a host-specific access state.
- First-time approved hosts enter `/host/intro`.
- Host introduction progress persists.
- Completing or skipping the intro never repeats member onboarding.
- Host setup progress persists separately from intro progress.
- AI privacy remains explicit opt-in.
- `/host/*` routes do not show member navigation.
- Host Center includes a setup entry and Exit Host Center action.
- A safe `/host/*` return destination survives login.
- No new table can grant host access on its own.
- Mobile lint, typecheck and bundle validation pass.
