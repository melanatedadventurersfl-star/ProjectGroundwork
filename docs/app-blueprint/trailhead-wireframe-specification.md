# Trailhead Wireframe Specification

## Purpose

Trailhead is the adaptive home screen for the Melanated Adventurers app. It is not a static dashboard. Its job is to identify the member's most important next action and arrange the screen around that priority.

This document defines the low-fidelity structure for the three highest-value Trailhead states:

1. Explorer: no booked adventures
2. Planner: multiple upcoming adventures
3. Live Adventure: an adventure is currently active

The wireframes should feel dense, useful, and Metro-inspired without becoming visually noisy.

---

## Shared Mobile Frame

### Header

The persistent top area contains:

- Melanated Adventurers wordmark or compact mark
- Contextual greeting or state label
- Search
- Notifications
- Campfire activity shortcut

Campfire and Notifications must remain visually distinct.

- Notifications communicate urgent or actionable items.
- Campfire aggregates updates, activity, announcements, comments, and photos.

### Bottom Navigation

Persistent navigation:

- Trailhead
- Explore
- Community
- Passport
- Menu

Trailhead is selected in all screens defined here.

### Grid

Use a two-column modular tile grid.

Recommended low-fidelity rules:

- Mobile frame width: 390 px
- Outer margin: 16 px
- Gutter: 8 px
- Minimum tap target: 44 x 44 px
- Tiles should align to a repeatable two-column rhythm
- Hero modules may span both columns
- Quick actions may use one-column square tiles

---

# State 1: Explorer

## Trigger

Show this state when the member has:

- no confirmed upcoming adventures
- no currently active adventure
- no urgent incomplete registration

## Primary Job

Help the member discover an experience that feels relevant and approachable.

## Tile Order

### 1. Greeting and Orientation Strip

Content:

- Greeting
- Short prompt such as “Where will your next story begin?”
- Optional location context

Action:

- Tap location to change discovery region

### 2. Featured Adventure Hero Tile

Full-width hero.

Content:

- Adventure image placeholder
- Title
- Date
- Location
- Price or starting price
- Short category label
- Primary action: View Adventure

The hero should not rotate automatically in the first release.

### 3. Explore Quick Actions

Two square tiles:

- Nearby
- Calendar

Optional later tiles:

- Map
- Categories

### 4. Recommended for You

Wide tile or compact horizontal cards.

Content:

- Three recommendations maximum on initial viewport
- Recommendation reason, such as “Because you like water adventures”
- Save action

### 5. Community Pulse

Wide tile.

Content examples:

- New photos from a recent event
- Chapter activity
- Member milestone
- Host announcement

Primary action:

- Open Campfire

### 6. Passport Nudge

Square tile.

Content:

- Current stamp count
- Next suggested milestone

### 7. Build-A-Camp or MANA Feature

Square tile chosen contextually.

Examples:

- Reserve camping equipment
- Join a service day
- Learn a new outdoor skill

## Low-Fidelity Layout

```text
┌──────────────────────────────────┐
│ Logo     Search   Bell   Campfire│
│ Good morning, Jonathan           │
│ Where will your next story begin?│
├──────────────────────────────────┤
│                                  │
│ FEATURED ADVENTURE               │
│ Hero image                       │
│ Title · Date · Location          │
│ [View Adventure]                 │
│                                  │
├────────────────┬─────────────────┤
│ Nearby         │ Calendar        │
├────────────────┴─────────────────┤
│ Recommended for You              │
│ Card 1   Card 2   Card 3         │
├──────────────────────────────────┤
│ Community Pulse                  │
│ Latest activity                  │
├────────────────┬─────────────────┤
│ Passport       │ MANA / BAC      │
├────────────────┴─────────────────┤
│ Trail Explore Community Pass Menu│
└──────────────────────────────────┘
```

---

# State 2: Planner

## Trigger

Show this state when the member has one or more confirmed upcoming adventures and no adventure is currently live.

## Primary Job

Prepare the member for the adventure that requires the most attention while preserving visibility into all other booked adventures.

## Primary Adventure Selection

The Primary Adventure is selected using this priority order:

1. Active blocking issue
2. Overdue required task
3. Adventure beginning soonest
4. Lowest readiness among near-term adventures
5. Most recently updated by host

The member may manually pin a different upcoming adventure, but urgent blocking issues must still surface.

## Tile Order

### 1. Primary Adventure Hero

Full-width tile.

Content:

- Adventure title
- Countdown
- Location
- Readiness percentage
- Current phase
- One primary action

Primary action examples:

- Complete waiver
- Finish payment
- Review packing list
- View arrival instructions

### 2. Action Needed Tile

Full-width or visually dominant alert tile.

Only shown when a required item needs attention.

Content:

- Task name
- Due date
- Why it matters
- Action button

Do not show multiple competing alerts at once. Show the highest-priority action and provide a link to all tasks.

### 3. Readiness Breakdown

Wide tile.

Categories:

- Registration
- Payment
- Waiver
- Transportation
- Packing
- Meals
- Emergency information

Each category uses a status marker:

- Complete
- In progress
- Action needed
- Blocked

### 4. Upcoming Adventures Queue

Horizontal stack or list.

Each card contains:

- Title
- Date
- Location
- Readiness percentage
- Status marker

The Primary Adventure remains visually distinct.

### 5. Host Update

Wide tile.

Content:

- Latest announcement
- Timestamp
- Host identity

Action:

- Open adventure Campfire

### 6. Weather and Travel

Two square tiles when relevant:

- Weather
- Transportation

Before weather is useful, substitute:

- Packing
- Meet the Group

### 7. Reflection Queue

Only shown when the member also has recently completed adventures awaiting reflection.

Content:

- Adventure title
- Add photos
- Claim stamp
- Write reflection

## Low-Fidelity Layout

```text
┌──────────────────────────────────┐
│ Logo     Search   Bell   Campfire│
│ Your next adventure              │
├──────────────────────────────────┤
│ PRIMARY ADVENTURE                │
│ Camp of Horrors                  │
│ 18 days · Brooksville            │
│ Readiness 68%                    │
│ [Complete Waiver]                │
├──────────────────────────────────┤
│ ACTION NEEDED                    │
│ Waiver due Friday                │
├──────────────────────────────────┤
│ Readiness Breakdown              │
│ ✓ Pay  ! Waiver  • Pack  ✓ Meals │
├──────────────────────────────────┤
│ Upcoming Adventures              │
│ EPCOT        Splash After Dark   │
├────────────────┬─────────────────┤
│ Weather       │ Transportation  │
├────────────────┴─────────────────┤
│ Latest Host Update               │
├──────────────────────────────────┤
│ Reflection Queue, when applicable│
├──────────────────────────────────┤
│ Trail Explore Community Pass Menu│
└──────────────────────────────────┘
```

---

# State 3: Live Adventure

## Trigger

Show this state when the member is inside the defined live window for a confirmed adventure.

The live window may begin before the official event start when travel or check-in support is needed.

Example:

- Day trip: two hours before departure
- Campout: morning of arrival day
- Multi-day trip: at the start of official travel activity

## Primary Job

Help the member arrive, orient themselves, participate, and get assistance with the least possible screen friction.

## Live Mode Principles

- Remove discovery clutter
- Suppress completed preparation tasks
- Prioritize current time and location
- Keep emergency help persistent
- Support weak or absent cellular service
- Use large tap targets
- Avoid deep navigation

## Tile Order

### 1. Live Status Banner

Full-width.

Content:

- Live label
- Adventure title
- Current day
- Connection or offline status

### 2. Current Activity

Dominant tile.

Content:

- Current activity
- Start and end time
- Location
- Directions

When no activity is underway, show the next scheduled activity.

### 3. Immediate Actions

Four square tiles:

- Check In or My QR
- Schedule
- Map
- Need Help

Need Help remains visible at all times in live mode.

### 4. Next Up

Wide tile.

Content:

- Next activity
- Countdown
- Location
- What to bring

### 5. Meal and Weather

Two square tiles:

- Next meal
- Current weather

### 6. Campfire Live Feed

Wide tile.

Content:

- Host alert
- Photo update
- Schedule change
- Group message

Critical host broadcasts also appear as notifications.

### 7. Group and Participation

Two square tiles:

- Find My Group
- Photo Challenge or Activity Challenge

### 8. Offline Essentials

Accessible from the live screen and cached locally:

- Schedule
- Maps
- Meeting points
- Emergency contacts
- Host phone number
- Medical and safety instructions
- Member QR code

## Low-Fidelity Layout

```text
┌──────────────────────────────────┐
│ LIVE · Camp of Horrors   Offline │
│ Day 2                             │
├──────────────────────────────────┤
│ CURRENT ACTIVITY                 │
│ Costume Trail                    │
│ 8:00–9:30 PM · North Field       │
│ [Directions]                     │
├───────────────┬──────────────────┤
│ My QR         │ Schedule         │
├───────────────┼──────────────────┤
│ Map           │ Need Help        │
├───────────────┴──────────────────┤
│ NEXT UP                          │
│ Campfire Stories in 42 min       │
├───────────────┬──────────────────┤
│ Next Meal     │ Weather          │
├───────────────┴──────────────────┤
│ Campfire Live Feed               │
├───────────────┬──────────────────┤
│ Find My Group │ Photo Challenge  │
├───────────────┴──────────────────┤
│ Trail Explore Community Pass Menu│
└──────────────────────────────────┘
```

---

# State Transitions

## Explorer to Planner

Occurs when:

- registration becomes confirmed
- a waitlist converts to confirmed
- a host assigns the member to an adventure

The new adventure should immediately appear as the Primary Adventure unless another adventure has a more urgent blocking issue.

## Planner to Live

Occurs when:

- the live window begins
- the member checks in early
- a host activates the adventure manually

## Live to Reflection

Occurs when:

- the event's live window closes
- the host marks the event complete
- the member checks out and no live activities remain

The live layout should not disappear abruptly. It should transition into a completion card with access to photos, reflection, Passport, and Journey.

---

# Wireframe Acceptance Criteria

The low-fidelity wireframes are successful when:

- A user can identify the most important action within three seconds.
- Multiple booked adventures remain understandable without competing for dominance.
- Live mode can be operated with one hand and minimal scrolling.
- Campfire and Notifications are never visually confused.
- The interface remains useful when some information is unavailable.
- Required tasks are visually distinct from optional recommendations.
- Every screen preserves access to Trailhead, Explore, Community, Passport, and Menu.
- No screen encourages unnecessary screen time during an active outdoor experience.

---

# Next Design Deliverable

Create low-fidelity mobile frames for:

1. Explorer Trailhead
2. Planner Trailhead with three upcoming adventures
3. Planner Trailhead with an overdue waiver
4. Live Adventure before check-in
5. Live Adventure during an active activity
6. Post-adventure completion transition

These six frames will validate the adaptive logic before color, imagery, and high-fidelity styling are applied.
