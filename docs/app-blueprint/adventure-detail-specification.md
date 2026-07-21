# Adventure Detail Specification

## Purpose

The Adventure Detail experience is the lifecycle command center for a single adventure. It changes as the member moves from discovery to preparation, travel, live participation, reflection, and long-term memory.

The screen must not remain static. Its content, hierarchy, calls to action, and urgency should adapt to the adventure phase and the member's relationship to that adventure.

## Core Principle

An adventure is not only an event listing. It is a living experience that begins before registration and remains part of the member's story after completion.

## Lifecycle

1. Idea
2. Published
3. Registration
4. Preparation
5. Travel
6. Live Experience
7. Reflection
8. Legacy

## Phase 1: Discovery

### Member state

The member is not registered.

### Questions the page must answer

- What is this adventure?
- Why should I care?
- Is it right for me?
- What will I experience?
- What does it cost?
- What do I need to know before committing?

### Primary content

- Hero image or video
- Adventure story and summary
- Date and duration
- Location
- Difficulty
- Capacity and availability
- Price and inclusions
- Host and organization
- Highlights
- Requirements
- Accessibility information
- Frequently asked questions

### Primary action

Register

### Secondary actions

- Save adventure
- Share
- Ask a question
- View location
- View host

## Phase 2: Registration

### Member state

The member has started or completed registration.

### Page behavior

The page shifts from selling the adventure to preparing the member.

### Primary content

- Registration status
- Adventure Readiness score
- Payment status
- Waiver status
- Transportation selection
- Meal preferences
- Guest details
- Add-ons
- Important deadlines

### Primary action

Complete next required step

## Phase 3: Preparation

### Member state

The member is confirmed and the event is approaching.

### Adaptive timing examples

#### More than 60 days away

- General preparation
- Optional introductions
- Gear planning
- Save-the-date reminders

#### 30 to 60 days away

- Packing guidance
- Transportation planning
- Lodging or campsite details
- Group introductions
- Meal selections

#### 7 to 30 days away

- Final schedule
- Host announcements
- Weather outlook
- Missing readiness tasks
- Maps and arrival details

#### Less than 7 days away

- Check-in credentials
- Offline maps
- Emergency contacts
- Final packing review
- Exact arrival instructions

## Phase 4: Travel

### Member state

The member is traveling or preparing to leave.

### Page behavior

The interface simplifies. Nonessential sections collapse behind secondary navigation.

### Priority modules

- Navigation
- Meeting point
- Arrival window
- Check-in QR code
- Weather
- Host contact
- Emergency help
- Transportation status
- Offline information

### Primary goal

Help the member arrive safely and confidently.

## Phase 5: Live Experience

### Member state

The adventure is actively occurring.

### Page behavior

The page becomes an on-site experience companion.

### Priority modules

- Current activity
- Today's schedule
- Camp or venue map
- Meal times
- Announcements
- Weather alerts
- Group or assignment information
- Photo challenges
- Campfire activity
- Help and emergency support

### Hidden or reduced modules

- Registration sales content
- Payment prompts already resolved
- Early packing guidance
- Marketing copy

## Phase 6: Reflection

### Member state

The adventure has recently ended.

### Page behavior

The page celebrates completion and invites the member to preserve the experience.

### Primary content

- Adventure complete state
- Passport stamp
- Badges earned
- Photo upload
- Journal entry
- Review
- Friend and group connections
- Volunteer hours
- Personal milestones

### Primary actions

- Add memories
- Complete reflection
- View experience record

## Phase 7: Legacy

### Member state

The adventure is part of the member's history.

### Purpose

The page becomes a durable memory rather than a dead past-event page.

### Content

- Gallery
- Journal
- Route or map
- Attendees, subject to privacy rules
- Badges and stamps
- Activities completed
- Volunteer contribution
- Host recap
- Personal notes
- Related future adventures

## Adventure Readiness

Adventure Readiness is a weighted, personalized preparation score.

### Required categories

- Registration
- Payment
- Waiver
- Emergency contact
- Transportation

### Recommended categories

- Packing
- Meal preferences
- Group introductions
- Offline map download
- Weather review
- Gear rental
- Lodging or campsite assignment

### Task states

- Complete
- In progress
- Action needed
- Blocked
- Not applicable

### Scoring rules

- Required tasks carry more weight than recommended tasks.
- Blocked required tasks prevent a full readiness score.
- Tasks marked not applicable do not reduce the score.
- Time-sensitive tasks gain priority as deadlines approach.
- Readiness should explain the next best action, not merely display a percentage.

## Modular Adventure Structure

Not every adventure requires every module. Adventures are assembled from reusable modules.

### Available modules

- Overview
- Itinerary
- Readiness
- Packing
- Transportation
- Lodging
- Campsites
- Gear rental
- Meals
- Volunteer assignments
- Weather
- Maps
- Accessibility
- FAQs
- Campfire
- Photo challenges
- Reviews
- Reflection
- Emergency support

### Module rules

- Modules are enabled by adventure type and host configuration.
- Module visibility changes by lifecycle phase.
- Critical modules may move to the top automatically.
- Empty modules should not be shown.

## Host View

Hosts use the same adventure object with expanded controls.

### Additional host capabilities

- Check-in dashboard
- Attendance roster
- Meal counts
- Announcements
- Emergency broadcast
- Volunteer assignments
- Readiness summary
- Missing requirement report
- Capacity and waitlist management
- Incident notes

The member and host experience should share the same source of truth.

## Experience Record

When an adventure is completed, the system generates an Experience Record for each member.

### Experience Record contents

- Source adventure
- Member role
- Photos
- Journal
- Passport stamp
- Badges
- Activities completed
- Friends connected
- Volunteer hours
- Personal milestones
- Reflection responses

The Experience Record connects Adventure, Journey, and Passport.

## Offline Requirements

Critical travel and live-event information must be available offline when possible.

Minimum offline content:

- Event title and dates
- Address and coordinates
- Arrival instructions
- Schedule
- Venue or camp map
- Host contact
- Emergency instructions
- Check-in credential

## Privacy and Safety

- Attendee visibility is controlled by member privacy settings and adventure policy.
- Medical details are only visible to authorized roles.
- Emergency actions remain accessible during travel and live phases.
- Location sharing is opt-in unless required for a clearly disclosed operational purpose.

## Initial Release Scope

The first release should support:

- Discovery
- Registration state
- Readiness checklist
- Preparation modules
- Travel essentials
- Live schedule and announcements
- Reflection prompts
- Experience Record creation

Advanced host operations, live location, sophisticated recommendations, and deep social features may follow later.
