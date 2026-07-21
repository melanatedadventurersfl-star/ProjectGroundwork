# Design System and Component Library

## Purpose

This document defines the shared visual and interaction language for the Melanated Adventurers app. It translates the product architecture into a reusable system that designers and developers can apply consistently across Trailhead, Explore, Community, Passport, Adventure Detail, Campfire, and supporting flows.

The system should feel energetic, grounded, culturally intentional, and built for movement. It draws inspiration from the clarity and density of Metro-style interfaces without copying them literally.

## Design Principles

### 1. Experience first

The interface supports the outdoor experience rather than competing with it.

### 2. Dense, not crowded

Members should see useful information quickly, but hierarchy must remain obvious.

### 3. Adaptive by context

Components may change emphasis based on lifecycle, urgency, and member state.

### 4. Outdoor confidence

The system should feel capable in sunlight, motion, low connectivity, and time-sensitive situations.

### 5. Cultural warmth

Photography, language, illustration, and visual rhythm should center Black and brown outdoor experiences without reducing the brand to a decorative motif.

## Layout System

### Base grid

Use a 4-point spacing system.

Core spacing tokens:

- 4: micro spacing
- 8: compact spacing
- 12: related content spacing
- 16: standard component padding
- 24: section spacing
- 32: major separation
- 48: page-level separation

### Mobile page structure

- Edge margin: 16
- Compact edge margin option: 12 for dense dashboards
- Standard vertical rhythm: 16 to 24
- Minimum touch target: 44 by 44

### Tile grid

Trailhead and selected dashboard surfaces use a flexible tile grid.

Recommended structure:

- Two-column base grid
- One-column full-width tiles for primary actions or critical information
- Small tiles may span one column
- Medium tiles may span two columns horizontally or two rows vertically
- Tiles should align to a consistent rhythm rather than float independently

### Density modes

- Standard: default for most screens
- Compact: Trailhead, live event, and operational dashboards
- Focused: travel, emergency, checkout, and forms

## Color System

Exact production values should be validated for contrast and brand alignment before implementation.

### Functional roles

- Brand primary: core identity and high-value actions
- Brand secondary: supporting identity and section differentiation
- Accent: highlights, progress, badges, and selected states
- Surface base: page background
- Surface raised: cards and tiles
- Text primary: main content
- Text secondary: supporting content
- Border subtle: dividers and low-emphasis boundaries

### Status colors

- Success: complete, confirmed, ready
- Warning: approaching deadline, incomplete recommendation
- Danger: blocked, urgent, emergency
- Information: neutral update, host announcement, weather notice
- Inactive: unavailable, disabled, archived

Color must never be the only status indicator. Pair it with iconography, text, shape, or pattern.

## Typography

### Voice

Typography should feel clear, modern, and sturdy rather than delicate.

### Type roles

- Display: major moments, campaign pages, and adventure storytelling
- Heading 1: page title
- Heading 2: major section title
- Heading 3: component title
- Body: primary reading text
- Body compact: dashboard metadata
- Label: controls, chips, and field labels
- Caption: timestamps, helper text, and secondary metadata
- Numeric display: readiness, countdowns, scores, and milestones

### Typography rules

- Avoid excessive all-caps text.
- Use strong scale differences rather than many font weights.
- Keep important travel and live-event text readable at a glance.
- Support dynamic type and text enlargement.
- Avoid truncating critical safety or location information.

## Iconography

Icons should be simple, bold, and readable at small sizes.

### Core icon categories

- Navigation
- Adventure type
- Transportation
- Weather
- Readiness
- Community
- Passport
- Safety
- Accessibility
- Media

### Rules

- Use familiar icons for universal actions such as search, alerts, maps, and settings.
- Pair unfamiliar icons with labels.
- Maintain consistent stroke weight and optical size.
- Do not use the flame icon alone to represent Campfire without a text label during initial adoption.

## Navigation Components

### Bottom navigation

Primary destinations:

- Trailhead
- Explore
- Community
- Passport
- Menu

Rules:

- Always show labels.
- Use a clear selected state.
- Avoid notification badges on multiple tabs simultaneously unless necessary.
- Preserve state when switching tabs.

### Global actions

Campfire, search, and notifications may appear in the top app bar or a consistent global action area.

### App bar

Possible elements:

- Page title
- Back action
- Global search
- Notification bell
- Campfire entry
- Context menu

Do not overload the app bar with more than three competing actions.

## Tile Components

### Primary Adventure Tile

Purpose:

Show the adventure that most needs the member's attention.

Contents:

- Adventure title
- Date or countdown
- Location
- Lifecycle state
- Readiness score
- Next best action
- Critical alert, if applicable

Behavior:

- Full-width by default
- Highest visual priority on Trailhead
- Changes content by lifecycle phase

### Upcoming Adventure Tile

Contents:

- Title
- Date
- Compact readiness indicator
- One important status

### Reflection Tile

Contents:

- Completed adventure
- Missing reflection actions
- Passport or photo prompt

### Discovery Tile

Contents:

- Adventure image
- Title
- Date
- Category
- Short reason for recommendation

### Utility Tile

Examples:

- Weather
- Packing
- Ride share
- Offline map
- Saved adventures
- Passport progress

## Cards

Cards are used for structured content where the Metro-style tile metaphor is not necessary.

### Standard card

- Optional image
- Title
- Supporting text
- Metadata
- Optional action

### Action card

- Clear single purpose
- Strong call to action
- State or deadline

### Alert card

- Severity icon
- Plain-language headline
- Explanation
- Required action
- Timestamp when relevant

### Memory card

- Photo or journal content
- Adventure reference
- Date
- Passport or milestone marker

## Status Components

### Status chip

Use for compact state labels such as:

- Confirmed
- Waitlisted
- Live
- Action needed
- Complete
- Cancelled

### Readiness indicator

Supported forms:

- Circular progress for compact tiles
- Horizontal progress for detail screens
- Checklist summary for action surfaces

A readiness display must include a textual next step.

### Countdown

Use only when time is meaningful.

Examples:

- Registration closes in 2 days
- Departure in 3 hours
- Check-in opens at 4:00 PM

Avoid decorative countdowns that create false urgency.

## Buttons and Actions

### Primary button

One dominant action per focused region.

Examples:

- Register
- Complete waiver
- Start navigation
- Check in
- Add memories

### Secondary button

Used for supporting actions.

### Tertiary action

Text or icon action for low-emphasis tasks.

### Destructive action

Must be visually distinct and require confirmation when consequences are significant.

### Button rules

- Use verbs.
- Keep labels specific.
- Avoid generic labels such as Submit when a clearer action exists.
- Preserve minimum touch target size.

## Forms

### Field structure

- Label above field
- Optional helper text
- Error message below field
- Clear required indicator

### Form principles

- Break long registration into logical steps.
- Save progress automatically when possible.
- Show completion and remaining effort.
- Do not request information before it is needed.
- Use appropriate keyboards and input types.

## Campfire Components

Campfire is an activity center, not a direct-message product.

### Activity item types

- Host announcement
- Photo upload
- Comment activity
- Schedule change
- Weather update
- Adventure milestone
- Community update

### Visual treatment

Each item should clearly show:

- Source
- Adventure or community context
- Activity type
- Time
- Relevant action

Urgent items should also create notifications rather than relying on Campfire visibility alone.

## Notification Components

Notifications communicate information the member needs to know or act upon.

### Notification anatomy

- Type icon
- Plain-language title
- Short explanation
- Time
- Direct destination
- Read or unread state

### Priority levels

- Critical
- Action required
- Important update
- Informational

## Passport Components

### Stamp

Represents a completed place, activity, or adventure.

### Badge

Represents an achievement, skill, challenge, or milestone.

### Progress trail

Shows progress toward a challenge or collection.

### Journey entry

Chronological memory unit combining adventure, photos, reflection, and milestones.

The visual language should distinguish earned achievements from decorative graphics.

## Maps and Location

### Map cards

Include:

- Place name
- Distance
- Accessibility summary
- Save action
- Adventure association

### Offline state

Clearly indicate whether map information is downloaded and when it was last updated.

### Safety

Emergency and arrival information must not depend solely on an interactive map.

## Motion and Transitions

Motion should clarify state changes rather than decorate every action.

Recommended uses:

- Tile expansion into detail
- Readiness progress update
- Lifecycle phase transition
- Successful check-in
- Passport stamp award

Rules:

- Keep motion short and purposeful.
- Respect reduced-motion settings.
- Avoid motion that delays urgent information.

## Imagery

### Photography

- Center Black and brown people in authentic outdoor settings.
- Show a range of ages, body types, abilities, group sizes, and experience levels.
- Favor lived moments over overly staged stock poses.
- Avoid duplicate people within a single composition.

### Image treatment

- Preserve legibility when text overlays images.
- Use consistent crops for adventure cards.
- Do not rely on photography to convey required operational information.

## Accessibility

Minimum expectations:

- WCAG-aligned contrast
- Dynamic text support
- Screen-reader labels
- Logical focus order
- Keyboard support where applicable
- Reduced-motion support
- Non-color status indicators
- Captions for video
- Alt text for meaningful imagery
- Large touch targets

Accessibility information for adventures should be visible early, not buried in FAQs.

## Content Style

### Tone

- Welcoming
- Direct
- Capable
- Encouraging
- Never patronizing

### Microcopy rules

- Tell members what happened.
- Tell them what to do next.
- Explain why information is required.
- Use concrete time and location language.
- Avoid unexplained internal terminology.

## Component States

Every interactive component should account for:

- Default
- Pressed
- Focused
- Selected
- Disabled
- Loading
- Empty
- Error
- Offline
- Completed

## Initial Component Library

The first implementation should include:

- App bar
- Bottom navigation
- Tile grid
- Primary Adventure Tile
- Upcoming Adventure Tile
- Reflection Tile
- Standard card
- Alert card
- Status chip
- Readiness indicator
- Buttons
- Form fields
- Notification item
- Campfire activity item
- Passport stamp
- Badge
- Journey entry
- Map card
- Empty state
- Offline banner
- Loading skeleton

## Governance

- Components should be documented before one-off variants are introduced.
- New variants require a clear repeated use case.
- Design tokens should be shared between design files and code.
- Accessibility testing is part of component completion.
- Deprecated components should remain documented until removed from all active screens.

## Next Implementation Step

Create low-fidelity wireframes using only components defined here. Start with:

1. Trailhead with no booked adventures
2. Trailhead with multiple upcoming adventures
3. Trailhead during a live adventure
4. Adventure Detail before registration
5. Adventure Detail during preparation
6. Adventure Detail during the live experience
7. Reflection and Experience Record
