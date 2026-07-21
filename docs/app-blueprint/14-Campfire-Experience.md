# 14 — Campfire Experience Specification

## Purpose

Define Campfire as the activity and updates hub for the platform, replacing a generic notification center with a clearer and more useful member experience.

## Product Role

Campfire gathers what is happening around a member without becoming a noisy engagement feed.

It should help members answer:

1. What changed?
2. What needs my attention?
3. What happened in my community?
4. What did I accomplish?

## Information Categories

### Critical

- schedule changes;
- location changes;
- cancellations;
- safety alerts;
- weather-related operational updates;
- payment or waiver problems affecting attendance.

### Upcoming

- packing reminders;
- check-in availability;
- transportation reminders;
- registration deadlines;
- waitlist movement;
- unfinished preparation tasks.

### Community

- comments and replies;
- photo additions;
- tagged memories;
- chapter announcements;
- participant introductions;
- questions from joined adventures.

### Progress

- Passport stamp ready;
- Trail Mark earned;
- rank progress;
- volunteer milestone;
- annual Journey recap.

## Activity Card Anatomy

Each card includes:

- category and icon;
- clear title;
- short explanation;
- relevant time;
- source adventure, chapter, or member;
- primary action;
- read/unread state;
- optional secondary action;
- accessibility summary.

## Priority Rules

Priority order:

1. immediate safety and cancellation information;
2. changes affecting a registered adventure;
3. actions with deadlines;
4. direct replies, tags, and personal progress;
5. general community activity.

Critical items cannot be displaced by social volume.

## Campfire Home

```text
[Campfire title] [Preferences]
[Critical banner, when present]
[Filter: All | Adventures | Community | Progress]

[Activity card]
[Activity card]
[Activity card]
```

A member can mark items read individually or by section. “Mark all read” never dismisses unresolved critical actions.

## Read and Resolution States

- Unread
- Read
- Action required
- Completed
- Expired
- Dismissed
- Archived

Reading an item is not the same as resolving it.

## Notification Delivery

Campfire is the in-app source of truth. External delivery may include:

- push notification;
- email;
- SMS for limited critical cases;
- calendar reminders where enabled.

Members control delivery by category, but safety and legally required communications may have restricted opt-out behavior.

## Bundling

Low-priority activity may be bundled:

- “12 new photos from Float Out”
- “3 people replied to your question”
- “5 chapter updates this week”

Critical and direct-action items are never hidden inside bundles.

## Quiet Hours

Members may define quiet hours. During quiet hours:

- routine activity is held;
- urgent safety and same-day operational changes may still be delivered;
- the in-app Campfire remains current.

## Deep Links

Every actionable item opens the exact relevant destination:

- Adventure Hub
- updated schedule section
- payment correction
- comment thread
- Passport stamp review
- Trail Mark detail
- chapter announcement

Campfire should not send members to generic home screens when a precise destination exists.

## Authoring Sources

Campfire items may originate from:

- system automation;
- adventure hosts;
- chapter leaders;
- administrators;
- community interaction;
- Passport and Trail Mark rules;
- payment, weather, and logistics integrations.

Every item records its source and creation reason for audit and troubleshooting.

## Safety and Trust

- impersonation-resistant sender labels;
- verified host and admin indicators;
- clear distinction between automated and human messages;
- report action for suspicious content;
- no sensitive personal information in push-notification previews by default;
- minors and protected groups receive stricter visibility rules.

## Empty State

The empty state should communicate calm, not abandonment:

> Your Campfire is quiet. Important adventure updates and community activity will appear here.

It may include a link to Explore, but should not fabricate activity.

## Offline Behavior

- cached recent items remain readable;
- unresolved critical items are stored when safe;
- stale data shows the last updated time;
- actions requiring connectivity are queued or clearly blocked;
- delivery acknowledgements sync when connectivity returns.

## Analytics

Track:

- delivery success;
- open rate by category;
- action completion;
- time to resolution for critical items;
- preference changes;
- muted categories;
- bundle engagement;
- false or duplicate alert reports.

Metrics should optimize usefulness, not compulsive opening.

## Accessibility

- category and urgency are announced in text;
- unread state is not color-only;
- timestamps are human-readable and available as absolute values;
- swipe actions have visible alternatives;
- critical updates do not rely on animation;
- push previews are concise and understandable.

## Current Decisions

- Campfire is the branded activity and update hub.
- Operational information outranks social activity.
- Read and resolved are separate states.
- Direct deep links are required.
- The system avoids engagement-driven notification spam.

## Open Questions

- Whether Campfire becomes a permanent bottom-navigation item after launch.
- Exact SMS rules for critical updates.
- How long archived activity remains available.
- Whether chapter leaders can customize routine reminder templates.

## Decision History

- Version 1.0 establishes Campfire categories, priority, delivery, safety, and interaction rules.