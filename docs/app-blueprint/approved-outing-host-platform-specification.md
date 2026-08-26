# Approved Outing Host Platform Specification

## Product intent

Go Melanated should let trusted community members create and operate outings inside the same adventure system used by Explore, registration, attendance, memories, TrailMates, and Your Trail. This is not a separate events product. It is a host-facing layer over Adventures.

The product loop is:

Explore → discover → register → prepare → attend → check in → share memories → add to Your Trail → discover the next outing.

The host loop is:

Apply → get approved → create → configure tickets → publish → promote → manage attendees → check in → close out → build host reputation.

## Roles

### Member
- Can discover and register for published outings.
- Can apply to become an approved outing host.
- Cannot create public outings until approved.

### Approved Community Host
- Can create draft outings.
- Can publish free outings.
- Can manage ticket inventory, attendee rosters, waivers, promotion, and check-in for outings they own.
- May create paid tickets only when `can_create_paid_outings` is granted.
- Cannot feature their own outing or alter platform-wide discovery controls.

### Organization Host
Future tier for approved partner organizations with multiple staff members, shared payout accounts, branded pages, and reporting.

### Official Host
Used for Melanated Adventurers / Go Melanated operated outings. Official outings receive a distinct visual label and may use platform-managed payment and promotion privileges.

### Platform Admin
- Can approve, pause, or revoke hosts.
- Can grant paid-outing privileges.
- Can review high-risk outing plans.
- Can manage official outings.

## Host approval states

- `pending`: application submitted; no hosting access.
- `approved`: hosting access active.
- `paused`: temporary suspension; existing data remains available to admins.
- `revoked`: host access removed.

Host type:
- `community`
- `organization`
- `official`

Risk tier:
- `standard`
- `enhanced`

Paid-outing capability is independent from general host approval.

## Host application

Entry point: Menu → Host an Outing.

Pending applicants see an application state screen rather than a broken create button.

Initial application fields:
- Why the member wants to host.
- Types of outings they expect to lead.
- Home area.
- Experience summary.
- Community standards acknowledgement.
- Safety responsibility acknowledgement.
- Host terms acknowledgement.

V1 stores a concise application note and terms timestamp. The schema leaves room for a fuller application workflow later.

## Host home

Approved hosts see a dedicated Host Hub.

Primary elements:
- Create outing CTA.
- Upcoming outings.
- Draft outings.
- Completed outings.
- Paid-outing eligibility status.
- Payout readiness state.
- High-level totals: outings, registrations, checked-in attendees, gross sales.

Each outing card shows:
- title
- date
- city/state
- status
- capacity / spots remaining
- registrations
- gross sales when applicable
- quick actions

## Create outing flow

V1 fields:
- title
- short summary
- full description
- category
- difficulty
- start date/time
- end date/time
- venue name
- city
- state
- capacity
- meeting instructions

Later enhancements:
- map picker / coordinates
- hero image upload
- accessibility details
- age restrictions
- weather policy
- cancellation policy
- equipment provided
- what to bring
- structured safety plan
- co-hosts
- recurring outings

The outing begins in `draft` state.

## Tickets and pricing

Every published outing must have at least one active ticket type.

Supported structures already in the core platform:
- free ticket
- paid ticket
- multiple ticket tiers
- ticket capacity
- minimum / maximum per order
- add-ons
- waivers

Example:
- General Admission: $35
- Go+ Member: $30
- Kayak Rental: +$15

V1 security rule:
- An approved host may create $0 tickets.
- A host may create tickets or add-ons with price > 0 only when paid-outing permission is enabled.

Publishing a paid outing also checks that paid-outing permission remains active.

## Payments

The existing order model remains the source of truth for purchases, order items, attendees, credentials, payment intent IDs, refunds, and totals.

The host system must never let hosts edit payment records directly.

Target architecture for marketplace payouts:
- Stripe Connect Express or an equivalent marketplace account model.
- Go Melanated owns the checkout experience.
- Each paid community host has a connected payout account.
- Gross amount, processing cost, Go Melanated platform fee, host net, refunds, and payout status are tracked independently.
- The host cannot publish paid inventory if payout verification is restricted.

V1 includes host permission and payout readiness fields, but does not fabricate payout processing before the Connect backend exists.

## Promotion

Every published host outing should expose a promotion surface.

V1 direction:
- native share sheet
- copy outing link
- share card support
- share to messaging / social apps via OS share

Future in-app promotion:
- nearby members
- TrailMates
- community members
- members who previously joined the host
- interest-category audiences

Promotion safeguards:
- frequency limits
- audience minimums where necessary for privacy
- opt-out respect
- anti-spam rate limits
- platform review for paid boosted placement

## Attendee management

Hosts can see attendees only for outings they own.

Host roster states:
- registered
- checked in
- cancelled
- waitlisted, when waitlist support lands

Host-visible attendee data should be limited to information needed to operate the outing.

V1 data access includes:
- attendee name
- registration answers
- ticket credential
- check-in state
- order state / amount at outing aggregate level

Future actions:
- message attendees
- refund within policy
- ticket transfer
- move from waitlist
- export roster

## Check-in

Each paid or free registration can receive a ticket credential.

Hosts can:
- scan a QR / credential code in a future camera workflow
- manually enter a credential code
- mark the credential checked in

Security boundary:
- a host may only check in credentials whose orders belong to an adventure they created.

Attendance, not merely RSVP, should feed the completed outing lifecycle and Your Trail.

## Before / During / After lifecycle

### Before
- countdown
- meeting instructions
- weather note
- gear / preparation reminders
- host updates
- ticket / credential access

### During
- check-in
- host contact
- directions / meeting point
- outing updates
- optional photo sharing

### After
- mark participation complete
- add photos
- add memory
- tag TrailMates
- host feedback
- add outing to Your Trail

This lifecycle aligns with the Emotional Journey architecture already established for the product.

## Host reputation

Do not launch with a raw five-star score as the primary reputation signal.

Preferred feedback dimensions:
- safe and organized
- welcoming
- description was accurate
- communication was clear
- would adventure with this host again

Possible public summary later:
- 23 outings hosted
- 184 adventurers joined
- 92% would adventure again

## Official vs community outing presentation

Published adventure cards and detail pages should eventually expose a host badge.

Community outing:
- COMMUNITY OUTING
- Hosted by [name]
- Approved Host

Official outing:
- GO MELANATED OFFICIAL
- Organized by Melanated Adventurers / Go Melanated

A community outing must never visually imply that Go Melanated is the direct operator.

## Safety and trust

The UI is not the security boundary. Supabase RLS and security-definer functions must independently enforce authorization.

V1 rules:
- only approved hosts or platform admins can create adventures
- hosts can operate only adventures they own
- community hosts cannot self-feature
- paid inventory requires paid-host authorization
- publishing requires at least one active ticket type
- attendee and credential access is scoped to the host's own outings
- check-in is scoped to the host's own outings

Future enhanced-risk review may be required for activities such as:
- overnight camping
- paddling
- climbing
- remote backcountry activity
- motorized activity
- activities involving minors without guardians

## Analytics

Host-facing:
- page views
- registrations
- registration conversion
- tickets sold
- gross sales
- refunds
- attendance rate
- repeat attendee rate

Platform-facing:
- host application conversion
- approval rate
- time to first outing
- outing cancellation rate
- safety incidents
- member reports
- paid GMV
- platform revenue
- repeat-host rate

## Notifications

Future automated host lifecycle messages:
- application received
- host approved
- paid hosting enabled
- outing published
- first registration
- 75% capacity
- sold out
- attendee cancellation
- waitlist opening
- outing starts tomorrow
- check-in opens
- post-outing follow-up

## V1 build acceptance criteria

### Authorization
- A normal member cannot insert a host-created adventure through the client.
- A pending host cannot create an adventure.
- An approved host can create an adventure they own.
- A host cannot update another host's adventure.
- A host cannot mark their outing featured.

### Paid permission
- An approved free-only host can configure $0 tickets.
- A free-only host cannot configure a ticket or add-on with a positive price.
- A paid-enabled host can configure positive-price inventory.

### Publishing
- Publishing fails with no ticket type.
- Publishing a paid outing fails when paid permission is absent.
- Valid host-owned outings can be published.

### Host Hub
- Pending members see application status.
- Approved hosts see create controls and owned outings.
- Paid permission and payout readiness are visible.

### Creation
- Host can create a draft outing from mobile.
- Required fields are validated client-side and database-side.
- Draft is visible in Host Hub but not Explore.

### Attendee security
- Hosts can read attendee/credential data only for their own outings.
- Hosts can check in only credentials tied to their own outings.

## V1.1
- ticket editor
- add-on editor
- waiver editor
- attendee roster UI
- manual check-in UI
- native share / promotion panel
- host analytics cards
- admin host approval UI

## V1.2
- Stripe Connect onboarding and payouts
- platform fees
- refund controls
- QR scanner
- waitlist
- attendee messaging
- promotion audiences
- host reputation feedback

## V1.3
- organization accounts
- co-host roles
- recurring outings
- enhanced-risk review workflows
- creator analytics
- seasonal host insights
- richer Before / During / After automation
