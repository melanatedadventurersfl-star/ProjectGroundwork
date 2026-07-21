# 10 — Wireframes

## Purpose

Define the structure, hierarchy, and behavior of the launch experience before visual polish or production code.

## Wireframe Principles

1. Every screen must answer a clear member question.
2. The most important action appears without scrolling whenever possible.
3. Navigation remains predictable even when the visual language is distinctive.
4. Critical logistics outrank decorative content.
5. Empty, loading, offline, and error states are designed alongside ideal states.

## Mobile Frame

- Primary target: mobile portrait.
- Bottom navigation remains persistent on core member screens.
- Safe areas are respected.
- Content uses an 8-point spacing system.
- Primary actions remain thumb reachable.

## Core Navigation

```text
Trailhead | Explore | Community | Passport | More
```

Campfire is accessible from the Trailhead header and notification indicators.

## 1. Onboarding

```text
[Brand mark]
Welcome to Melanated Adventurers
Short promise

[Continue]
[Sign in]
```

Sequence:

1. Welcome
2. Interests
3. Experience level
4. Home location
5. Safety and accessibility preferences
6. Notification preferences
7. Trailhead reveal

## 2. Trailhead

```text
[Greeting]                         [Campfire]
[Next Adventure — large live tile          ]
[Community tile] [Passport tile]
[Weather tile  ] [Featured tile]
[My Journey — wide tile                    ]
[Bottom navigation]
```

Required behavior:

- Next Adventure receives strongest visual priority.
- Tiles may rotate useful information but never hide urgent updates.
- First-use state explains what each area does.
- No infinite feed.

## 3. Explore

```text
[Search adventures]
[Filter chips]
[Featured adventure card]
[Category rail]
[Upcoming near you]
[Bucket List suggestions]
```

Filters include date, distance, activity, experience level, accessibility, lodging, transportation, and availability.

## 4. Adventure Detail

```text
[Hero image]
[Title]
[Date • location • difficulty]
[Price / seats]
[Join Adventure]

Overview
What is included
Schedule
Preparation
Accessibility
Host
Community preview
Policies
```

A sticky registration action remains visible until registration is complete.

## 5. Registration

```text
[Progress indicator]
Ticket / package selection
Attendee details
Add-ons
Waivers
Payment summary
[Confirm]
```

The user sees the full price before payment. Errors stay attached to the field that caused them.

## 6. Adventure Hub / Preparation

```text
[Countdown]
[Status and critical update]
Packing checklist
Meetup details
Transportation
Weather
Attendees
Host updates
[Check in when available]
```

This becomes the primary screen after registration.

## 7. Check-In and Adventure Mode

```text
[Adventure title]
[QR / confirmation]
[Check in]

After check-in:
Schedule
Map / meeting point
Emergency details
Host announcements
Quick photo capture
```

Adventure Mode minimizes nonessential interaction and supports offline access to saved logistics.

## 8. Community

```text
[Create post]
[Adventure stories]
[Photos]
[Questions]
[Trail reports]
[Gear discussions]
```

Content is organized around shared experiences rather than engagement bait.

## 9. Campfire

```text
[Campfire]
Critical
Upcoming
Community
Achievements

[Activity card]
[Activity card]
```

Critical operational updates remain pinned above social activity.

## 10. Passport

```text
[Passport cover / identity page]
Photo • name • member since
Pathfinder rank
Home chapter

[Stats]
[Stamps]
[Trail Marks]
[Journey]
[Memories]
```

The Passport should feel collectible and personal without sacrificing readability.

## 11. Journey

```text
[Year / month filter]
Timeline line
Adventure entry
Memory entry
Badge milestone
Upcoming entry
```

Past experiences and future plans are visually distinct.

## 12. Profile and Settings

Sections:

- Account
- Privacy
- Safety and accessibility
- Notifications
- Payments
- Saved travelers
- Data export and deletion
- Help and reporting

## Required States

Every core screen must include:

- first-use state;
- empty state;
- loading state;
- partial-data state;
- offline state;
- recoverable error;
- permission-denied state;
- deleted or unavailable content state.

## Prototype Route

The first clickable prototype must support:

```text
Trailhead
→ Explore
→ Adventure Detail
→ Registration
→ Confirmation
→ Adventure Hub
→ Check-In
→ Passport Stamp
→ Journey Entry
```

## Current Decisions

- Mobile-first design.
- Five-item bottom navigation.
- Trailhead uses tiles, not a feed.
- Preparation moves into an Adventure Hub after registration.
- Passport contains profile, history, progress, and memories.

## Open Questions

- Whether Community or Passport should occupy the center navigation position.
- Whether Campfire needs its own bottom-navigation destination after launch.
- How much dashboard customization belongs in the first release.

## Decision History

- Version 1.0 establishes the launch wireframe system and prototype route.