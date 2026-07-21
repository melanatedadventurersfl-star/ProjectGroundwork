# Passport, Journey, and Reflection Specification

## Purpose

This document defines how the Melanated Adventurers app turns completed adventures into personal history, earned accomplishments, shared memories, and future motivation.

The system has three related but distinct concepts:

- **Passport** records earned places, activities, skills, challenges, and milestones.
- **Journey** presents the member's chronological outdoor history.
- **Reflection** captures the member's lived experience after an adventure.

These systems should reward participation without reducing the outdoors to points, streaks, or screen-driven competition.

## Product Principles

### Experience before gamification

Achievements should recognize real-world action rather than encourage hollow app activity.

### Earned, not decorative

Stamps and badges must represent a verifiable place, activity, milestone, or contribution.

### Private by default where appropriate

Members control which memories, reflections, and accomplishments are visible to others.

### Low-pressure reflection

Reflection should be inviting, brief when desired, and never block essential post-event access.

### Real continuity

The system should help members see how isolated outings become a larger personal journey.

## Core Concepts

### Experience Record

An Experience Record represents one member's lived participation in an adventure.

It may include:

- Adventure reference
- Attendance status
- Check-in and check-out timestamps
- Role, such as participant, volunteer, host, instructor, or guest
- Activities completed
- Photos and media
- Reflection responses
- Earned stamps and badges
- Skills practiced
- Accessibility notes retained for the member
- Private journal content

An Adventure is what the organization hosts. An Experience is what the member lived.

### Passport

Passport is the accomplishment view of the member's history.

It includes:

- Stamps
- Badges
- Challenge progress
- Collections
- Milestones
- Skills
- Contribution recognition

### Journey

Journey is the chronological view of the member's outdoor life.

It includes:

- Completed experiences
- Memories
- Reflections
- Earned accomplishments
- Important firsts
- Progress across time

### Reflection

Reflection is the member-authored response to an experience.

It can be private, shared with the adventure group, shared with the broader community, or used anonymously for host feedback where permitted.

## Completion Trigger

A post-adventure workflow begins when one of the following occurs:

- Host closes the adventure
- Scheduled end time passes and attendance records exist
- Member checks out
- Host marks the member attended
- Offline attendance data synchronizes

The workflow should not begin for members marked cancelled, no-show, refunded without attendance, or removed unless a host explicitly corrects the record.

## Post-Adventure Transition

After completion, Trailhead changes from live mode to reflection mode.

The transition may present:

1. A completion acknowledgment
2. Newly earned Passport items
3. Photo and memory prompts
4. Reflection prompt
5. Host feedback prompt
6. Suggested next adventure

The member should be able to dismiss and return later.

## Reflection Experience

### Reflection modes

The member may choose:

- Quick reflection
- Guided reflection
- Photo-first reflection
- Private journal entry
- Host feedback only
- Skip for now

### Quick reflection

Designed for completion in under one minute.

Suggested prompts:

- How did this adventure feel?
- What was your favorite moment?
- Would you do something like this again?

Responses may use:

- Mood selection
- Short text
- One featured photo
- Simple yes, maybe, or no response

### Guided reflection

Optional deeper prompts may include:

- What surprised you?
- What did you learn?
- What challenged you?
- What made you feel welcome or unwelcome?
- What would you bring or do differently next time?
- What moment do you want to remember?
- Did this experience change what you feel capable of doing outdoors?

### Host feedback

Host feedback is separate from public reflection.

It may ask about:

- Organization
- Communication
- Safety
- Food
- Transportation
- Accessibility
- Equipment
- Staff or volunteer support
- Value
- Likelihood of returning

Members must know whether feedback is identified, private to hosts, or anonymous.

### Draft behavior

Reflection drafts should save automatically.

Drafts may be completed offline and synchronized later.

## Reflection Visibility

Each reflection or memory item has an explicit audience:

- Private
- Adventure participants
- Members only
- Public community
- Anonymous host feedback

The app must never infer public visibility from a photo upload or social post.

Members may change visibility later unless content has been included in a host-curated publication requiring a separate consent flow.

## Memory Creation

A memory may include:

- Photo
- Video
- Caption
- Journal text
- Audio note in a future release
- Tagged adventure
- Tagged activity
- Date and place
- Mentioned members
- Passport item reference

Members should be able to create multiple memories for one experience.

## Photo Handling

### Sources

Members may:

- Upload from device
- Capture in app
- Select from adventure-shared media
- Save a host photo when permission allows

### Consent

Before a member publishes a photo containing other identifiable attendees, the interface should remind them to respect photo preferences.

Adventure-level media consent settings must be visible to hosts and authorized photographers.

A member may request removal of a photo in which they appear.

### Duplicate prevention

The system should detect obvious duplicate uploads where practical but should not delete media without confirmation.

## Journey Structure

### Chronological timeline

Journey displays experiences by date, newest first by default.

Each Journey Entry may show:

- Adventure title
- Date
- Location
- Activity type
- Role
- Featured memory
- Reflection excerpt
- Earned stamp or badge
- Attendance verification state

### Alternate views

Future views may include:

- Map
- Calendar
- Year in review
- Activity category
- Places visited
- Skills practiced

### Empty state

New members should see an encouraging explanation and a path to Explore, not an empty trophy cabinet.

## Passport Items

### Stamp

A Stamp represents participation connected to a place, adventure, or activity.

Examples:

- First Melanated Adventurers campout
- Juneteenth Float-Out 2026
- Ocala National Forest
- First kayaking experience

### Badge

A Badge represents an achievement, skill, challenge, contribution, or milestone.

Examples:

- First Night Outdoors
- Trail Starter
- Camp Kitchen Crew
- Community Volunteer
- Five Adventures Completed
- Water Explorer

### Milestone

A Milestone recognizes a meaningful count or first.

Examples:

- First adventure
- Tenth adventure
- First overnight trip
- First out-of-state adventure
- First volunteer shift

### Skill

A Skill represents learned or demonstrated outdoor knowledge.

Examples:

- Tent setup
- Fire safety
- Leave No Trace basics
- Kayak safety
- Camp cooking
- Trail navigation

Skills may require host or instructor verification.

### Challenge

A Challenge groups several requirements over time.

Examples:

- Complete three different water activities
- Visit five parks
- Attend four seasonal adventures
- Complete a MANA learning series

## Earning Rules

Passport items may be awarded through:

- Verified check-in
- Host attendance confirmation
- Completion of a required activity
- Instructor verification
- Volunteer service record
- Administrative correction
- Import of verified historical records

Self-reported accomplishments may exist but must be labeled as self-recorded when not verified.

A member should not earn an attendance-based item solely because they purchased a ticket.

## Award Timing

Awards may appear:

- Immediately after verified completion
- After host closes attendance
- After an instructor verifies a skill
- After all challenge requirements are met

Delayed awards should explain what is pending.

## Award Presentation

New awards may appear in a short celebratory moment that:

- Identifies what was earned
- Explains why it was earned
- Offers Share, View Passport, or Done
- Respects reduced-motion preferences
- Does not obstruct urgent post-event information

Celebration should feel meaningful, not slot-machine-like.

## Passport Collections

Collections organize related items.

Possible collections:

- Places
- Activities
- Skills
- Milestones
- Community contributions
- Seasonal challenges
- MANA learning

A collection shows:

- Earned items
- Available discoverable items
- Hidden surprise items where appropriate
- Progress
- Requirements

Hidden items must not conceal safety-critical or paid requirements.

## Progress Rules

Progress should be transparent.

A challenge should show:

- Requirements
- Completed requirements
- Remaining requirements
- Expiration date, if any
- Verification status
- Reward

No progress mechanic should pressure members into unsafe participation or unnecessary spending.

## Sharing Passport Items

Members may share:

- One stamp or badge
- A completed collection
- A Journey Entry
- A yearly summary
- A custom selection of achievements

Sharing should generate a privacy-safe preview.

Private reflections, exact home-related location data, emergency information, and hidden accessibility details must never appear in share cards.

## Profile Integration

A member profile may show selected Passport highlights.

The member chooses which items are featured.

Default public profile content should be conservative.

Potential profile elements:

- Featured stamps
- Featured badges
- Adventure count
- Volunteer contributions
- Favorite activity categories

Exact participation history should not automatically become public.

## Historical Imports

Hosts may import verified historical attendance from earlier systems.

Imported records should retain:

- Source
- Import date
- Verification status
- Original event reference where possible

Members should be able to report an incorrect historical record.

## Corrections and Revocation

Authorized hosts may correct attendance and awards.

Revocation should be rare and auditable.

Examples:

- Duplicate award
- Incorrect participant
- Reversed attendance record
- Fraudulent verification

Members should receive a plain-language explanation when an earned item is removed, except where safety or abuse investigations require temporary confidentiality.

## Guest and Minor Experiences

### Guests without accounts

A purchaser may initially manage a guest's Experience Record.

If the guest later creates an account and verifies identity, eligible records may be claimed.

### Minors

A guardian controls visibility for a minor's Journey and media according to policy and age.

Public sharing involving minors requires stricter defaults and explicit guardian authorization.

### Group registrations

Each attendee receives an individual Experience Record even when tickets were purchased together.

Passport awards belong to the participant, not the purchaser.

## Host Tools

Authorized hosts need tools to:

- Close an adventure
- Confirm attendance
- Correct check-in records
- Award or verify skills
- Review pending awards
- Configure event-specific stamps
- Create badge and challenge rules
- View reflection response summaries
- Export host feedback
- Moderate shared memories
- Handle photo removal requests

Hosts should not see private journal entries.

## Reflection Analytics

Permitted aggregate metrics may include:

- Reflection completion rate
- Host feedback completion rate
- Average satisfaction
- Accessibility issue themes
- Most-mentioned favorite moments
- Repeat-interest rate
- Photo upload rate
- Share rate

Private journal content must not be included in host analytics.

Free-text analysis should use privacy-conscious aggregation and access controls.

## Notifications

Members may receive reminders for:

- Reflection draft
- Newly earned item
- Pending skill verification
- Challenge nearly complete
- Annual Journey summary

Reflection reminders should be limited and easy to disable.

## Offline Behavior

Members should be able to:

- View cached recent Passport items
- View cached Journey Entries
- Draft reflection text
- Select photos for queued upload
- Review pending synchronization

The interface must clearly distinguish synchronized, queued, and failed content.

## Error and Edge States

The system must support:

- Adventure closed before attendance synchronization
- Duplicate check-ins
- Host correction after award
- Member account merge
- Guest record claim
- Missing media upload
- Failed reflection synchronization
- Cancelled award rule
- Challenge requirement changed mid-progress
- Deleted adventure with retained Experience Records

Deleting or archiving an Adventure should not erase legitimate member history.

## Accessibility

The system must support:

- Screen-reader descriptions for stamps and badges
- Text alternatives for decorative award artwork
- Reduced-motion award presentation
- Keyboard and switch-control navigation where applicable
- Non-color progress indicators
- Large touch targets
- Clear privacy labels
- Caption support for video memories

## Data Model Additions

### Experience

Suggested fields:

- id
- adventureId
- participantId
- registrationId
- attendanceStatus
- role
- checkedInAt
- checkedOutAt
- completedAt
- verificationSource
- visibility
- createdAt
- updatedAt

### Reflection

Suggested fields:

- id
- experienceId
- authorId
- reflectionType
- responses
- body
- mood
- visibility
- isDraft
- submittedAt
- createdAt
- updatedAt

### Memory

Suggested fields:

- id
- experienceId
- ownerId
- mediaIds
- caption
- visibility
- featured
- createdAt
- updatedAt

### PassportDefinition

Suggested fields:

- id
- type
- name
- description
- artwork
- requirements
- verificationMethod
- collectionId
- activeFrom
- activeUntil
- visibility

### PassportAward

Suggested fields:

- id
- definitionId
- participantId
- experienceId
- awardedAt
- verificationStatus
- awardedBy
- source
- revokedAt
- revocationReason

### ChallengeProgress

Suggested fields:

- id
- challengeId
- participantId
- completedRequirementIds
- progressValue
- status
- completedAt
- updatedAt

## MVP Scope

The first release should include:

- Experience Record creation from verified attendance
- Basic Journey timeline
- Quick reflection
- Private and adventure-participant visibility
- Photo memories
- Event stamp awards
- Basic milestone badges
- Passport collections
- Host attendance correction
- Offline reflection drafts
- Shareable single achievement cards

The first release should exclude:

- Competitive leaderboards
- Public achievement rankings
- Complex skill certification marketplace
- Automated image recognition
- Audio journals
- Fully customizable user-created challenges
- Streak systems designed to drive daily app use

## Acceptance Criteria

The system is ready for MVP when:

1. Verified attendance creates one Experience Record per participant.
2. Ticket purchase alone cannot award an attendance item.
3. Members can complete or dismiss a quick reflection.
4. Reflection visibility is explicit and defaults conservatively.
5. Members can add a photo memory to a completed experience.
6. Journey shows completed experiences chronologically.
7. Passport clearly distinguishes stamps, badges, milestones, and challenges.
8. Hosts can correct attendance without erasing the audit trail.
9. Guests and group attendees retain individual Experience Records.
10. Private journals remain inaccessible to hosts and other members.
11. Offline reflection drafts synchronize safely.
12. Shared achievement cards exclude private operational data.
13. Reduced-motion and non-color progress states are supported.
14. Archived adventures do not erase valid member history.

## Future Expansion

Possible later additions include:

- Annual Journey stories
- Printed or mailed Passport books
- Partner-location stamps
- MANA certifications
- Family Journey views
- Member-created private goals
- Audio reflections
- Collaborative adventure albums
- Curated community story collections
- Portable achievement exports

Any expansion should preserve the distinction between celebrating real experience and manufacturing app engagement.