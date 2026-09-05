# Event Analytics Pipeline V2

## Purpose

Every hosted event uses one analytics pipeline. Go Melanated member activity and connected external sources feed the same event record while preserving where each action originated.

The Host Center must answer four different questions without mixing them together:

1. How many people discovered or viewed the event?
2. How many people showed intent?
3. How many people registered, paid, cancelled, refunded or attended?
4. Which source, promotion or Go Melanated surface produced the result?

## Source of truth

`host_campaigns.adventure_id` links the member-facing Adventure to the Host Center event workspace.

Analytics are stored in:

- `host_event_connections` for Go Melanated and external services
- `host_event_promotions` for individual campaigns and tracked promotions
- `host_event_analytics_events` for append-only activity
- `host_event_ticket_sources` for ticket and revenue reconciliation by source and ticket class

Go Melanated is a first-party source named `go_melanated`.

## Event journey

The event journey supports these stages:

### Discovery

- event discovered
- event page viewed
- search impression
- search selected
- notification opened
- message opened or clicked
- promotion impression, view or click

### Intent

- Interested
- Going
- Saved
- Shared
- Invite sent or opened
- Calendar added
- Host followed
- Waitlist joined

### Conversion

- Checkout started
- Checkout abandoned
- Ticket ordered
- Ticket cancelled
- Ticket refunded
- Waitlist converted

### Attendance

- Attendee checked in

### Retention and post-event activity

- Review/reflection submitted with a rating
- Event photo uploaded

Events without an implemented product action remain valid analytics event names but must not appear as measured activity until the actual user action exists.

## First-party Go Melanated instrumentation

V2 wires existing product actions directly to the shared analytics system.

### Event detail views

Opening a member event detail records `event_page_view` through `record_go_melanated_event`.

Repeated loads in the same app session use a 15-minute dedupe window so RSVP refreshes and quick revisits do not inflate views.

### RSVP

Changes to `adventure_rsvps` generate:

- `event_interested`
- `event_going`
- `event_not_going`

Host analytics also query the live RSVP source of truth for current Interested and Going counts. Historical RSVP events describe movement. Current RSVP counts describe the state now.

### Saved events

Insert and delete operations on `saved_adventures` generate `event_saved` and `event_unsaved`.

The Host Center queries the current saved count separately so an unsave never leaves a stale current total.

### Checkout

Opening checkout records `checkout_started` with a 30-minute session dedupe window.

Orders store first-party source, attribution code and analytics session key. A held order is not counted as a ticket sale.

### Paid orders and tickets

The order lifecycle is recorded from the database, not from a client success screen.

A transition to `paid` records `ticket_ordered` and updates Go Melanated ticket-source totals by ticket type.

A transition to `refunded` records a refund and updates refunded ticket and revenue totals.

A paid order that is later cancelled records a cancellation separately.

An unpaid held or payment-pending order that expires or is cancelled records checkout abandonment.

This makes payment retries and client reloads unable to create duplicate ticket sales.

### Check-in

The first transition of `ticket_credentials.checked_in_at` from null to a timestamp records `attendee_checked_in`.

### Waitlist

Waitlist status changes generate:

- waiting -> `waitlist_joined`
- offered -> `waitlist_offered`
- claimed -> `waitlist_converted`
- expired or removed -> `waitlist_left`

### Post-event engagement

A rated event memory records `review_submitted`.

An event memory photo records `photo_uploaded`.

## Unique audience

Total page views and unique viewers are different metrics.

A unique viewer uses:

1. authenticated profile ID when available
2. analytics session key for an anonymous visitor

Anonymous uniqueness is session-based in V2. It does not attempt cross-device identity matching.

## Host and staff exclusion

Authenticated users who can access the Host Center campaign are marked `is_internal = true` when their member-facing activity is recorded.

Audience metrics exclude internal activity. Hosts can open, refresh and test their own event without inflating public engagement.

Operational changes such as ticket lifecycle updates are not discarded because a host performs the operation. Only audience-behavior metrics use the internal flag for exclusion.

## Idempotency and duplicate protection

`host_event_analytics_events` supports a per-campaign `dedupe_key` with a unique partial index.

Stable dedupe keys are required for business events that must occur once, including:

- paid order
- refund
- cancellation
- check-in
- waitlist state transition when a stable state key is available
- review
- photo upload

Page and checkout views use time-window dedupe keys.

## Attribution

Each analytics event can retain:

- source
- promotion ID
- connection ID
- surface
- attribution code
- actor profile ID
- session key
- order ID
- ticket type ID
- event-specific metadata

This lets Host Center distinguish Go Melanated, Eventbrite, Facebook, Instagram, email, SMS and other sources without combining them into an unattributed total.

Go Melanated surfaces can include Home, Explore, Search, Trail Guide, host profile, notification, message, event detail and shared link as those entry points are instrumented.

## Ticket and revenue semantics

The dashboard separates:

- tickets sold
- active tickets
- refunded tickets
- cancelled tickets
- gross revenue
- refunded amount
- net revenue

`active tickets = sold - refunded tickets - cancelled tickets`

`net revenue = gross revenue - refunded amount`

External sources must reconcile their source totals. A sync replaces or reconciles a source snapshot according to the provider integration. It must not blindly append an entire provider total on every sync.

## Host Center metrics

The analytics screen can show:

### Audience

- unique viewers
- page views
- Interested
- Going
- Saves
- Shares
- Waitlist

### Conversion

- checkout starts
- abandoned checkout
- completed orders
- tickets sold
- active tickets

### Revenue

- gross revenue
- refunds
- net revenue

### Attendance

- checked in
- no-show can be derived after the event from active tickets minus check-ins

### Source performance

Per source:

- impressions
- page views
- clicks
- interest
- checkout starts
- orders
- tickets
- revenue

### Time trend

Daily activity retains page views, interest events, checkout starts, orders, tickets and check-ins so the UI can show recent momentum and ticket velocity.

## Metrics that require a real product action or provider connection

The schema supports shares, invitations, calendar adds, host follows, notification activity and post-event engagement. The system must not manufacture these values.

If the corresponding action is not yet present in the member app, or an external provider is not connected, Host Center shows zero, not configured or no data as appropriate.

## External integrations

External connectors should map provider data into the same vocabulary rather than creating a second analytics dashboard.

Examples:

- Facebook or Instagram impressions -> promotion impressions or reach
- tracked Meta link click -> promotion click
- Eventbrite order -> ticket order plus ticket-source reconciliation
- email delivery/open/click -> message delivery/open/click

Provider IDs belong in `external_id`, connection metadata or promotion tracking fields so repeated syncs can be reconciled.

## Privacy

Operational event analytics are separate from optional AI product-improvement analytics.

The event system stores only the identifiers needed for event operations, attribution, dedupe and host reporting. Anonymous visitors use a session key rather than an invented member identity.

Host analytics should present aggregated operational metrics. It should not expose individual browsing history as a member surveillance view.

## V2 acceptance criteria

- Go Melanated event page views reach Host Center analytics.
- RSVP Interested and Going states are available as live counts.
- Saves are available as a live count.
- Checkout starts are recorded without blocking checkout if analytics fails.
- Held orders are not counted as sales.
- Paid orders populate Go Melanated ticket and revenue totals.
- Refunds, paid cancellations and abandoned checkout are distinguishable.
- Check-ins are recorded once.
- Waitlist status movement is recorded when waitlist support is present.
- Hosts and event staff do not inflate audience views.
- Business events use stable dedupe keys.
- Go Melanated appears as its own analytics source.
- Host Center preserves external source attribution.
- The analytics UI can show unique viewers, intent, conversion, active tickets, net revenue, source performance and recent activity.
- Unsupported or disconnected metrics are never fabricated.
