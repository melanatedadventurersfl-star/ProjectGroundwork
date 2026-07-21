# Adaptive Trailhead Specification

## Purpose

Trailhead is the member's adaptive home screen. It is not a static dashboard and not a generic event feed. Its purpose is to answer one question:

> What is the most helpful thing for this member right now?

Trailhead changes based on the member's registrations, unfinished tasks, time until departure, active-event status, recent activity, and completed adventures awaiting reflection.

## Core Principles

1. Support real-world adventure rather than maximize screen time.
2. Prioritize action, safety, clarity, and preparation.
3. Never hide a member's other booked adventures.
4. Show the most relevant adventure prominently without treating it as the member's only adventure.
5. Keep urgent notifications separate from Campfire activity.
6. Use dense, Metro-inspired tiles with minimal unused space.
7. Let members override automated choices when appropriate.

## Adventure Queue

Every member with registrations has an Adventure Queue containing:

- **Current Adventure:** an adventure happening now.
- **Primary Adventure:** the adventure requiring the most attention.
- **Upcoming Adventures:** all other confirmed future adventures.
- **Reflection Queue:** recently completed adventures with unfinished post-event actions.
- **Waitlisted Adventures:** registrations that are not yet confirmed.

The Current Adventure and Primary Adventure may be the same, but they are not synonymous.

## Primary Adventure Selection

Trailhead calculates a priority score for each eligible adventure. The scoring model should be configurable rather than permanently hard-coded.

### Priority Inputs

- Event is currently live.
- Travel begins today.
- Event begins soon.
- Required task is overdue.
- Required task is due soon.
- Host issued a critical update.
- Weather or safety condition requires review.
- Payment, waiver, transportation, meal, campsite, or emergency information is incomplete.
- Registration was recently changed.
- Member manually pinned the adventure.

### Suggested Priority Order

1. Active safety or emergency issue.
2. Adventure currently live.
3. Travel-day adventure.
4. Adventure with an overdue required task.
5. Adventure beginning within seven days.
6. Adventure with a time-sensitive host update.
7. Closest confirmed adventure.
8. Most recently joined adventure.

### Manual Override

Members may pin an upcoming adventure as their preferred Primary Adventure. Safety alerts, live-event status, and critical overdue tasks may temporarily override the pin.

## Trailhead States

## 1. Discover State

Triggered when the member has no confirmed upcoming adventures and no unfinished reflection actions.

Primary content:

- Featured adventure
- Explore nearby
- Upcoming experiences
- Beginner-friendly options
- Community stories
- Bucket List
- Passport preview

Primary goal: help the member find and register for an adventure.

## 2. Plan State

Triggered when the member has one or more confirmed upcoming adventures and none are in travel or live status.

Primary content:

- Primary Adventure card
- Adventure Readiness summary
- Next required action
- Upcoming Adventures strip
- Recent host updates
- Explore, Community, Passport, and Journey tiles

Primary goal: help the member prepare without forgetting other bookings.

## 3. Travel State

Triggered on the configured travel day or when the member marks travel as started.

Primary content:

- Directions
- Departure details
- Check-in information
- Weather
- Parking or meeting point
- Emergency contacts
- Downloaded maps
- Group or transportation updates

Primary goal: reduce friction between home and arrival.

## 4. Live Adventure State

Triggered from the adventure's live start time until its configured end time, with optional host control.

Primary content:

- Current activity
- Today's schedule
- Camp or venue map
- Meal times
- Check-in status
- Need Help
- Emergency information
- Event Campfire
- Photo challenge

Secondary navigation remains available, but unrelated discovery content is removed from the first screen.

Primary goal: help the member participate, navigate, and stay safe while spending as little time on the phone as possible.

## 5. Reflection State

Triggered after an adventure ends and while reflection actions remain open.

Primary content:

- Passport stamp
- Journey entry
- Add photos
- Leave review
- Journal or reflection prompt
- Reconnect with people met
- Lost-and-found or follow-up information
- Similar future adventures

Primary goal: capture memories and complete the experience loop.

## 6. Inspire State

Triggered after reflection is complete and no nearer preparation task has priority.

Primary content:

- Journey highlights
- Passport progress
- Recommended experiences
- Seasonal challenges
- Friends' upcoming adventures
- Volunteer opportunities

Primary goal: encourage the next adventure naturally rather than through aggressive promotion.

## Primary Adventure Card

The same Adventure Card evolves throughout the adventure lifecycle.

### Registration Phase

- Hero image
- Date and location
- Registration status
- View details

### Preparing Phase

- Countdown
- Readiness percentage
- Next required task
- Recent update

### Final Week

- Weather
- Packing status
- Arrival guide
- Transportation
- Map download

### Travel Day

- Directions
- Departure time
- Check-in QR
- Parking or meeting point

### Live Phase

- Current activity
- Next activity
- Map
- Help
- Event updates

### Completed Phase

- Photos
- Passport stamp
- Journey entry
- Review

## Upcoming Adventures

Other booked adventures must remain visible beneath the Primary Adventure as compact cards.

Each compact card should show:

- Adventure title
- Date or countdown
- Status
- Readiness indicator
- Critical-task badge, when applicable

The default Trailhead shows up to three compact cards, followed by **View All Adventures**.

## Adventure Readiness

Readiness is calculated from event-specific requirements rather than a universal packing percentage.

Possible readiness tasks include:

- Registration complete
- Payment complete
- Waiver signed
- Emergency contact added
- Medical or accessibility form completed
- Transportation confirmed
- Campsite or room assigned
- Meal selection completed
- Packing checklist reviewed
- Gear rental confirmed
- Offline map downloaded
- Arrival guide reviewed

Each task includes:

- Required or optional status
- Completion status
- Due date
- Priority
- Blocking status
- Responsible party

### Readiness Display

Show:

- Percentage complete
- Completed required tasks
- Outstanding required tasks
- Next recommended action

Optional tasks should not unfairly lower the readiness score unless the member has selected them as relevant.

## Tile Priority Rules

Trailhead is composed of reusable tiles ranked into display zones.

### Zone A: Immediate Attention

Maximum one large tile.

Examples:

- Safety alert
- Current Adventure
- Travel-day instructions
- Overdue required action
- Primary Adventure

### Zone B: Next Actions

Two to four compact tiles.

Examples:

- Sign waiver
- Confirm transportation
- Review weather
- Download map
- Complete meal selection

### Zone C: Adventure Queue

Compact cards for other booked adventures.

### Zone D: Ongoing Member Life

Examples:

- Community
- Passport
- Journey
- Campfire
- Explore
- Bucket List

### Zone E: Reflection

Appears when completed adventures require follow-up.

## Conflict Rules

When multiple conditions are true:

1. Safety overrides all other content.
2. A live adventure overrides preparation for future adventures in Zone A.
3. Future adventures remain accessible in the queue.
4. Overdue required tasks may appear in Zone B during a live adventure only when they concern the live adventure.
5. Reflection content cannot displace travel-day or live-event content.
6. Promotional content never outranks a required member action.

## Campfire and Notifications

### Notifications

Notifications are reserved for items requiring attention or timely awareness:

- Safety changes
- Schedule or location changes
- Payment or waiver deadlines
- Transportation updates
- Direct responses involving the member

### Campfire

Campfire is the cross-app activity center:

- Host announcements
- Photos
- Comments
- Friends joining adventures
- Passport achievements
- Community updates
- Recaps

A notification may point into Campfire, but Campfire is not represented by an unexplained flame icon. The global control should use a familiar activity or inbox pattern with a badge.

## Empty and Edge States

### No Upcoming Adventures

Use Discover State.

### One Upcoming Adventure

Show the evolving Primary Adventure card without an Upcoming Adventures strip.

### Multiple Adventures on the Same Date

Flag the conflict and ask the member to review registrations. Do not silently choose one as the only visible adventure.

### Two Simultaneous Live Adventures

Show a conflict screen with both adventures and require member selection, unless one registration is marked staff-only, virtual, or non-attending.

### Cancelled Primary Adventure

Remove it from primary status immediately, preserve cancellation details, and promote the next eligible adventure.

### Waitlist Only

Do not treat a waitlisted adventure as confirmed. Show it in a separate waitlist section with status and next steps.

### Offline Mode

Cache live-event essentials:

- Schedule
- Map
- Emergency information
- Check-in details
- Host announcements
- Transportation information

## Member Controls

Members may:

- Pin a preferred Primary Adventure
- Dismiss noncritical tiles
- Snooze optional preparation reminders
- Rearrange Zone D tiles
- Hide sensitive readiness information from shared screens
- Turn personalization categories on or off

Members may not dismiss unresolved safety alerts without acknowledging them.

## Success Measures

The Adaptive Trailhead succeeds when it reduces uncertainty and missed actions.

Suggested measures:

- Required tasks completed on time
- Waiver and payment completion rate
- Check-in success rate
- Map and arrival-guide access before travel
- Reduction in repeated logistics questions
- Reflection completion rate
- Member-reported preparedness
- Time required to find critical live-event information

Screen time is not a primary success measure.

## Initial Release Scope

For the first release, implement:

- Discover State
- Plan State
- Travel State
- Live Adventure State
- Reflection State
- Adventure Queue
- Primary Adventure selection
- Event-specific Readiness
- Compact Upcoming Adventure cards
- Basic Campfire activity
- Separate notifications
- Manual Primary Adventure pinning

Defer advanced behavioral personalization, predictive recommendations, and complex Adventure DNA scoring until sufficient member data exists.

## Product Test

Every Trailhead tile must answer at least one of these questions:

- Does this help the member prepare?
- Does this help the member travel?
- Does this help the member participate?
- Does this help the member stay safe?
- Does this help the member remember or reflect?
- Does this help the member find their next meaningful experience?

If it answers none of them, it does not belong on Trailhead.
