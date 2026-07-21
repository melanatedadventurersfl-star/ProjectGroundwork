# 08. User Flows

## Purpose

This document defines the primary end-to-end journeys members take through the Melanated Adventurers platform. These flows are the bridge between strategy and interface design. They ensure each screen exists for a reason, each action has a clear next step, and the app consistently guides members toward real-world outdoor participation.

The core product loop is:

```text
Discover → Join → Prepare → Attend → Remember → Return
```

The platform succeeds when this loop feels natural, welcoming, and repeatable.

---

## Flow Design Principles

All user flows should follow these rules:

1. **Real-world action comes first.** The app should move members toward attending, participating, and connecting offline.
2. **Every flow should make the next step obvious.** Members should not have to hunt for what to do next.
3. **Preparation reduces anxiety.** Clear expectations, packing guidance, timing, and updates should make adventure feel approachable.
4. **Progress should feel earned.** Passport stamps, Trail Marks, and milestones must reflect meaningful participation.
5. **Community should feel supportive, not noisy.** Social actions should add belonging and usefulness rather than endless scrolling.
6. **Important information must survive weak connectivity.** Tickets, check-in details, directions, and preparation notes should remain accessible when possible.
7. **New members require more reassurance than experienced members.** Flows should adapt to confidence, skill level, and prior participation.
8. **No dead ends.** Every completion state should point toward a useful next action.

---

# 1. First-Time Member Onboarding

## Goal

Help a new member understand the platform, create a basic profile, identify relevant interests, and reach the Trailhead without feeling buried in setup.

## Primary Flow

```text
Landing Page / Invitation
    ↓
Create Account
    ↓
Verify Email or Phone
    ↓
Welcome to Melanated Adventurers
    ↓
Choose Interests
    ↓
Set Experience Level
    ↓
Select Home Area or Chapter
    ↓
Create Basic Passport
    ↓
Notification Preferences
    ↓
Trailhead
```

## Required Inputs

- Name
- Email or phone
- Password or supported sign-in provider
- City and state
- Outdoor interests
- Experience level
- Basic safety and community agreement

## Optional Inputs

- Profile photo
- Pronouns
- Accessibility needs
- Dietary preferences
- Emergency contact
- Preferred chapter
- Short introduction

## Experience Levels

- **Curious:** New to outdoor recreation
- **Explorer:** Has participated a few times
- **Adventurer:** Comfortable with several activity types
- **Pathfinder:** Experienced and willing to guide others

## Key Experience Notes

- Explain why personal information is requested.
- Allow members to skip nonessential fields.
- Do not force a long profile before showing value.
- Show a progress indicator during onboarding.
- End with recommended adventures based on interests and location.

## Completion State

The Trailhead should greet the member and surface:

- a recommended first adventure;
- a Passport setup prompt;
- a community introduction prompt;
- a short explanation of Campfire updates.

---

# 2. Returning Member App Entry

## Goal

Immediately answer three questions:

1. What is happening next?
2. What needs my attention?
3. What can I explore today?

## Primary Flow

```text
Open App
    ↓
Authentication Check
    ↓
Trailhead Loads
    ↓
Personalized Live Tiles
    ├── Next Adventure
    ├── Campfire Updates
    ├── Passport Progress
    ├── Weather or Preparation
    ├── Featured Adventure
    └── Community Activity
```

## Priority Logic

Trailhead content should prioritize:

1. urgent event changes;
2. next registered adventure;
3. incomplete preparation tasks;
4. check-in availability;
5. newly earned Passport items;
6. relevant Campfire activity;
7. recommended adventures.

## Empty State

A member with no upcoming adventure should see:

- nearby adventures;
- beginner-friendly options;
- saved Bucket List items;
- a prompt to explore categories.

---

# 3. Discover an Adventure

## Goal

Help members find an experience that matches their interests, schedule, confidence, location, and budget.

## Entry Points

- Trailhead featured tile
- Explore tab
- Search
- Category tile
- Map view
- Community recommendation
- Shared link
- Chapter page
- Campfire announcement

## Primary Flow

```text
Open Explore
    ↓
Browse Featured or Search
    ↓
Apply Filters
    ↓
Review Adventure Cards
    ↓
Open Adventure Details
    ↓
Evaluate Fit
    ├── Save to Bucket List
    ├── Share
    ├── Ask a Question
    └── Join Adventure
```

## Filters

- Date
- Distance
- Activity type
- Skill level
- Price
- Duration
- Overnight or day trip
- Family-friendly
- Accessibility
- Gear provided
- Transportation available
- Meals included
- Chapter
- Available seats

## Adventure Card Minimum Content

- Title
- Hero image
- Date
- Location
- Starting price
- Skill level
- Duration
- Seat availability
- Transportation indicator
- Hosted by

## Success State

The member reaches the Adventure Detail screen with enough information to decide whether the experience is right for them.

---

# 4. Evaluate Adventure Fit

## Goal

Reduce uncertainty before registration.

## Adventure Detail Information Order

```text
Hero Image + Title
    ↓
Date, Time, Location, Price
    ↓
Primary Call to Action
    ↓
What This Experience Is
    ↓
Who It Is For
    ↓
What Is Included
    ↓
What You Need to Bring
    ↓
Schedule / Itinerary
    ↓
Transportation
    ↓
Meals and Dietary Notes
    ↓
Accessibility and Physical Expectations
    ↓
Weather and Conditions
    ↓
Host Information
    ↓
Cancellation and Safety Policies
    ↓
Questions and Community Discussion
```

## Confidence Signals

- Beginner-friendly indicator
- Verified host
- Member photos from prior events
- Clear physical difficulty statement
- Gear availability
- Transportation details
- Reviews or post-adventure reflections
- Safety plan summary

## Branches

### Member Is Ready

```text
Tap Join
    ↓
Registration Flow
```

### Member Is Interested but Not Ready

```text
Save to Bucket List
    ↓
Optional Reminder
    ↓
Return to Explore
```

### Member Has a Question

```text
Open Q&A
    ↓
Review Existing Answers
    ↓
Post Question
    ↓
Receive Campfire Update When Answered
```

---

# 5. Register for an Adventure

## Goal

Complete registration with minimal friction while collecting the information required to operate the event safely.

## Primary Flow

```text
Tap Join Adventure
    ↓
Choose Ticket or Package
    ↓
Select Quantity / Attendees
    ↓
Review Included Items and Add-Ons
    ↓
Enter Attendee Details
    ↓
Answer Event-Specific Questions
    ↓
Review Waivers and Policies
    ↓
Choose Transportation if Applicable
    ↓
Payment
    ↓
Confirmation
    ↓
Adventure Added to My Journey
```

## Event-Specific Information May Include

- legal name;
- age requirement confirmation;
- emergency contact;
- dietary restrictions;
- allergies;
- accessibility needs;
- tent or lodging selection;
- equipment rental;
- transportation pickup location;
- roommate or group request;
- waiver acceptance.

## Confirmation Screen

The confirmation screen should include:

- registration status;
- ticket or reservation details;
- calendar add option;
- preparation checklist;
- transportation summary;
- event discussion access;
- share option;
- cancellation policy;
- contact or help action.

## Failure States

- payment declined;
- seat sold during checkout;
- incomplete required fields;
- ticket limit reached;
- event requires approval;
- registration closes during checkout.

Each failure state must explain what happened and provide a next action.

---

# 6. Prepare for an Adventure

## Goal

Turn registration into confidence.

## Primary Flow

```text
Registration Confirmed
    ↓
Adventure Added to My Journey
    ↓
Preparation Hub Opens
    ├── Checklist
    ├── Packing List
    ├── Transportation
    ├── Weather
    ├── Schedule
    ├── Group Updates
    ├── Required Forms
    └── Questions
```

## Preparation Timeline

### Immediately After Registration

- confirmation;
- calendar option;
- high-level packing expectations;
- required forms;
- transportation selection;
- event discussion access.

### One Week Before

- detailed packing list;
- weather outlook;
- arrival instructions;
- final balance reminder if applicable;
- attendee preparation update.

### Twenty-Four Hours Before

- confirmed weather;
- exact meeting location;
- departure time;
- check-in instructions;
- emergency contact;
- last-minute changes.

### Day of Adventure

- ticket or QR code;
- offline directions;
- host contact;
- current update banner;
- check-in button when available.

## Checklist Behavior

Members should be able to:

- mark items complete;
- add personal items;
- view required versus recommended items;
- see which gear is provided;
- request or rent eligible equipment;
- share a checklist with a household or group.

## Live Tile Behavior

The Next Adventure tile may rotate through:

- countdown;
- packing status;
- weather changes;
- meetup updates;
- check-in availability;
- remaining required actions.

---

# 7. Receive an Adventure Update

## Goal

Ensure members notice meaningful changes without creating notification fatigue.

## Primary Flow

```text
Host Publishes Update
    ↓
System Assigns Priority
    ├── Critical
    ├── Important
    └── Informational
    ↓
Campfire Entry Created
    ↓
Push / Email / SMS Based on Priority and Preferences
    ↓
Member Opens Update
    ↓
Acknowledges if Required
```

## Critical Updates

Examples:

- event cancellation;
- location change;
- departure time change;
- severe weather action;
- transportation disruption;
- safety instruction.

Critical updates should not rely solely on passive Campfire visibility.

## Important Updates

Examples:

- packing requirement;
- final itinerary;
- form deadline;
- meal selection deadline;
- remaining balance.

## Informational Updates

Examples:

- new attendee joined;
- photos added;
- discussion reply;
- reminder to introduce yourself.

---

# 8. Check In to an Adventure

## Goal

Confirm attendance quickly and reliably while giving event staff a clear roster.

## Check-In Methods

- member QR code scanned by staff;
- staff searches member name;
- member self-check-in when enabled;
- offline roster synced later;
- manual exception handling.

## Member Flow

```text
Open My Journey or Next Adventure Tile
    ↓
Tap Check In
    ↓
Display QR Code or Confirm Location
    ↓
Staff Verification
    ↓
Check-In Confirmed
    ↓
Welcome Screen + Immediate Instructions
```

## Staff Flow

```text
Open Event Roster
    ↓
Scan QR or Search Member
    ↓
Verify Ticket / Package
    ↓
Resolve Outstanding Items
    ↓
Mark Present
    ↓
Issue Wristband, Gear, or Assignment
```

## Exception States

- no registration found;
- unpaid balance;
- wrong ticket type;
- guest name mismatch;
- duplicate check-in;
- waiver incomplete;
- no connectivity.

## Completion State

The member receives:

- check-in confirmation;
- immediate event instructions;
- schedule shortcut;
- group or campsite assignment if applicable;
- emergency and host contact access.

---

# 9. Participate During an Adventure

## Goal

Support the experience without encouraging excessive screen use.

## Available Functions

- view schedule;
- receive urgent updates;
- access map and meeting points;
- identify host or staff;
- find emergency information;
- upload photos later or in batches;
- participate in optional scavenger hunts or Trail Mark activities;
- view transportation return details.

## Product Rule

During active adventure hours, the interface should become simpler. The platform should prioritize only what members need in the moment.

## Adventure Mode

Potential Adventure Mode includes:

- larger text and buttons;
- offline essentials;
- simplified navigation;
- battery-conscious behavior;
- reduced nonessential notifications;
- high-visibility emergency action.

---

# 10. Complete an Adventure

## Goal

Close the event loop and transition the member from participation to reflection.

## Primary Flow

```text
Adventure Ends
    ↓
Attendance Confirmed
    ↓
Completion Processing
    ↓
Passport Stamp Awarded
    ↓
Eligible Trail Marks Evaluated
    ↓
Welcome Back Prompt
    ↓
Reflection and Photo Sharing
    ↓
Journey Entry Created
```

## Completion Requirements

A completed adventure may require one or more of the following:

- verified check-in;
- host confirmation;
- completed activity checkpoint;
- attendance duration threshold;
- manual staff approval.

## Completion Screen

- congratulatory message;
- Passport stamp reveal;
- newly earned Trail Marks;
- updated stats;
- share memory action;
- photo upload;
- private feedback;
- next recommended adventure.

---

# 11. Add an Adventure to the Passport

## Goal

Turn participation into a meaningful record of growth and memory.

## Primary Flow

```text
Adventure Completion Verified
    ↓
Stamp Reveal
    ↓
Stamp Added to Passport
    ↓
Stats Updated
    ↓
Member Adds Optional Memory
    ├── Caption
    ├── Favorite Moment
    ├── Photos
    ├── Travel Companions
    └── Personal Notes
```

## Passport Entry Includes

- adventure name;
- date;
- location;
- activity category;
- official stamp;
- completion status;
- optional photos;
- optional reflection;
- Trail Marks earned;
- related community story.

## Privacy Options

- public;
- visible to Adventure Circle;
- visible to event attendees;
- private.

---

# 12. Earn a Trail Mark

## Goal

Recognize meaningful participation, confidence, contribution, and growth.

## Primary Flow

```text
Qualifying Action Occurs
    ↓
System Evaluates Criteria
    ↓
Trail Mark Earned
    ↓
Reveal Animation
    ↓
Added to Passport
    ↓
Progress Toward Next Mark Displayed
```

## Trail Mark Categories

- first experiences;
- activity milestones;
- distance and frequency;
- community contribution;
- volunteering;
- leadership;
- outdoor skills;
- conservation and service;
- chapter participation;
- seasonal or special events.

## Rules

- Avoid rewards for meaningless screen activity.
- Clearly explain earning criteria.
- Do not use manipulative streak pressure.
- Recognize consistency without punishing healthy breaks.
- Include hidden surprise marks sparingly.
- Ensure achievements remain attainable for members with different abilities.

---

# 13. Share a Memory

## Goal

Allow members to preserve and share the human story of an adventure.

## Primary Flow

```text
Open Completed Adventure
    ↓
Tap Add Memory
    ↓
Choose Photos or Video
    ↓
Add Caption or Reflection
    ↓
Tag Adventure and Optional Attendees
    ↓
Choose Visibility
    ↓
Publish
    ↓
Community Story Created
```

## Story Prompts

- What was your favorite moment?
- What surprised you?
- What did you learn?
- Who made the experience memorable?
- What would you tell someone attending next time?

## Moderation and Consent

- Members must control visibility.
- Photo tagging must respect member preferences.
- Members should be able to request removal from photos.
- Event media releases must be clearly distinguished from community posting consent.

---

# 14. Engage with Community

## Goal

Help members build relationships around shared experiences without recreating a generic social network.

## Primary Flow

```text
Open Community
    ↓
Choose Context
    ├── Adventure Stories
    ├── Questions
    ├── Photos
    ├── Gear and Skills
    ├── Chapter Activity
    └── Upcoming Adventure Discussion
    ↓
View or Contribute
    ↓
Relevant Follow-Up Appears in Campfire
```

## Supported Actions

- post a story;
- ask a question;
- comment;
- react;
- save useful content;
- follow a discussion;
- report content;
- visit a member Passport based on privacy settings.

## Launch Boundary

Direct messaging is excluded from the initial launch. Community interaction should remain attached to shared contexts such as adventures, chapters, stories, and discussions.

---

# 15. Use Campfire

## Goal

Centralize meaningful activity, reminders, and updates in a branded, useful hub.

## Primary Flow

```text
Open Campfire
    ↓
View Prioritized Activity
    ├── Requires Action
    ├── Adventure Updates
    ├── Community Replies
    ├── Passport Progress
    └── Recommendations
    ↓
Open Item
    ↓
Complete Action or Mark Read
```

## Campfire Categories

- Action Needed
- Adventure Updates
- Community
- Passport
- Chapter
- System

## Management Actions

- mark read;
- mark all read;
- mute a discussion;
- adjust category preferences;
- archive older items;
- jump directly to related content.

---

# 16. Save to Bucket List

## Goal

Capture interest without forcing immediate registration.

## Primary Flow

```text
View Adventure
    ↓
Tap Save
    ↓
Choose Bucket List or Collection
    ↓
Optional Reminder or Price Alert
    ↓
Adventure Saved
```

## Follow-Up Opportunities

- registration closing soon;
- seats running low;
- price changes;
- new date announced;
- similar nearby adventure;
- friend or Circle member joined.

Notifications must respect member preferences and avoid artificial urgency.

---

# 17. Cancel or Modify a Registration

## Goal

Make policies clear and reduce support friction.

## Primary Flow

```text
Open Registered Adventure
    ↓
Manage Registration
    ↓
Choose Action
    ├── Update Attendee Information
    ├── Change Add-Ons
    ├── Change Transportation
    ├── Transfer if Allowed
    └── Cancel
    ↓
Review Policy and Financial Impact
    ↓
Confirm
    ↓
Updated Confirmation
```

## Cancellation State Must Show

- refund amount;
- credit amount if applicable;
- nonrefundable items;
- cancellation deadline;
- processing timeframe;
- impact on gear, lodging, transportation, or group reservations.

---

# 18. Volunteer for an Adventure

## Goal

Create a clear path from member participation to community contribution.

## Primary Flow

```text
Open Adventure or Volunteer Hub
    ↓
View Available Roles
    ↓
Review Responsibilities and Time Commitment
    ↓
Apply or Claim Role
    ↓
Host Approval if Required
    ↓
Assignment Added to My Journey
    ↓
Preparation and Check-In Instructions
    ↓
Service Completion Recorded
```

## Potential Roles

- setup crew;
- check-in;
- meal service;
- transportation support;
- activity assistant;
- photographer;
- safety support;
- cleanup crew;
- community host.

## Recognition

Verified volunteer service may contribute to:

- Trail Marks;
- service hours;
- Pathfinder progression;
- future host eligibility.

---

# 19. Become a Host or Leader

## Goal

Support the member growth path from attendee to organizer while protecting safety and quality.

## Primary Flow

```text
Passport Shows Eligibility
    ↓
Member Opens Leadership Path
    ↓
Review Requirements
    ↓
Complete Training and Verification
    ↓
Submit Host Application
    ↓
Review
    ↓
Approved, Deferred, or Additional Steps Required
    ↓
Host Tools Activated
```

## Eligibility Signals

- participation history;
- community standing;
- safety training;
- volunteer experience;
- chapter involvement;
- required background checks where appropriate;
- completed host education.

## Future Host Flow

```text
Create Adventure Draft
    ↓
Define Experience
    ↓
Set Capacity, Requirements, and Logistics
    ↓
Submit for Review
    ↓
Publish
    ↓
Manage Attendees and Updates
    ↓
Operate Check-In
    ↓
Close Adventure and Confirm Completion
```

---

# 20. Request Build-A-Camp Services

## Goal

Allow eligible members or hosts to request equipment, setup, and experience support without confusing it with the core MA adventure experience.

## Primary Flow

```text
Open Adventure Support or Build-A-Camp Module
    ↓
Choose Service Type
    ↓
Enter Event Details
    ↓
Select Package and Add-Ons
    ↓
Review Capacity and Site Requirements
    ↓
Request Quote or Book
    ↓
Availability Review
    ↓
Confirmation and Service Timeline
```

## Service Types

- tent setup;
- social camp setup;
- kitchen module;
- lounge and games;
- power;
- meal service;
- equipment rental;
- custom event support.

## Boundary

Build-A-Camp should remain a distinct module and brand experience. It can connect to MA events, but it should not blur the core identity of the member community platform.

---

# 21. Report a Safety or Community Concern

## Goal

Provide a trustworthy, direct path for members to report urgent and nonurgent concerns.

## Primary Flow

```text
Open Safety or Report Action
    ↓
Choose Concern Type
    ├── Immediate Safety Risk
    ├── Harassment or Conduct
    ├── Event Operations
    ├── Content or Photo
    ├── Accessibility
    └── Other
    ↓
Provide Details
    ↓
Choose Whether to Attach Evidence
    ↓
Submit
    ↓
Confirmation and Expected Response
```

## Immediate Risk

The app must clearly distinguish platform reporting from emergency services. Immediate danger messaging should direct members to local emergency resources and event safety contacts.

## Trust Requirements

- explain confidentiality limits;
- provide a case reference;
- allow status updates where appropriate;
- avoid exposing the reporter to the reported member;
- preserve evidence and timestamps.

---

# 22. Manage Passport and Profile

## Goal

Let members control their identity, preferences, history, and privacy.

## Primary Flow

```text
Open Passport
    ↓
View Public-Facing Passport
    ↓
Open Edit or Settings
    ├── Personal Information
    ├── Interests
    ├── Experience Level
    ├── Accessibility
    ├── Dietary Preferences
    ├── Emergency Contact
    ├── Privacy
    ├── Notifications
    └── Account Security
```

## Privacy Controls

Members should control visibility for:

- profile photo;
- home area;
- Passport stamps;
- Trail Marks;
- Journey entries;
- community posts;
- tagged photos;
- Adventure Circle connections;
- participation history.

---

# 23. Search the Platform

## Goal

Provide a single, predictable way to find adventures, chapters, members, stories, and resources.

## Primary Flow

```text
Tap Search
    ↓
Enter Query
    ↓
View Grouped Results
    ├── Adventures
    ├── Chapters
    ├── Community
    ├── Members
    └── Resources
    ↓
Apply Type-Specific Filters
    ↓
Open Result
```

## Search Priorities

- local relevance;
- upcoming availability;
- direct title matches;
- member interests;
- chapter affiliation;
- verified and current information.

---

# 24. Offline and Weak-Connection Flow

## Goal

Preserve critical functionality when members are outdoors with poor service.

## Offline Essentials

- registered adventure summary;
- ticket or QR code;
- meeting point and directions;
- itinerary;
- host contact;
- emergency information;
- packing list;
- transportation information;
- latest downloaded critical update.

## Primary Flow

```text
Connection Lost
    ↓
Offline Banner Appears
    ↓
Cached Adventure Essentials Remain Available
    ↓
Actions Queue When Safe
    ↓
Sync Occurs After Reconnection
```

The platform must clearly distinguish saved information from live information.

---

# 25. Error, Empty, and Recovery Flows

Every major flow must include:

## Loading State

- communicate progress;
- use skeletons where helpful;
- avoid blocking the entire app unnecessarily.

## Empty State

- explain why the area is empty;
- offer a meaningful next action;
- use encouraging language without pretending activity exists.

## Error State

- explain what failed in plain language;
- preserve entered information where possible;
- provide retry, save, or contact options;
- avoid blaming the member.

## Permission State

- explain why access is useful;
- allow members to continue with reduced functionality when possible;
- provide a direct path to device settings.

---

# Primary Launch Flow Map

```text
FIRST VISIT
Create Account
    ↓
Onboarding
    ↓
Trailhead

CORE ADVENTURE LOOP
Trailhead
    ↓
Explore
    ↓
Adventure Detail
    ↓
Register
    ↓
Prepare
    ↓
Check In
    ↓
Participate
    ↓
Complete
    ↓
Passport + Memory
    ↓
Recommended Next Adventure

COMMUNITY LOOP
Adventure or Passport
    ↓
Share Memory / Ask Question
    ↓
Community Interaction
    ↓
Campfire Update
    ↓
Return to Relevant Context

GROWTH LOOP
Attend Adventures
    ↓
Earn Stamps and Trail Marks
    ↓
Volunteer
    ↓
Develop Skills
    ↓
Host or Lead
    ↓
Welcome New Members
```

---

# Launch-Critical Flows

The following flows must be designed and tested before initial launch:

1. Account creation and onboarding
2. Returning member entry
3. Explore and search
4. Adventure details
5. Registration and payment
6. Preparation hub
7. Critical updates
8. Ticket and check-in
9. Completion and Passport stamp
10. Community posting and comments
11. Campfire activity
12. Profile, privacy, and notification management
13. Cancellation and refund visibility
14. Safety reporting
15. Offline adventure essentials

---

# Post-Launch Flows

These may follow after the core member experience is stable:

- volunteer assignments;
- host applications;
- chapter leadership;
- Build-A-Camp booking;
- advanced Passport collections;
- Adventure Circle management;
- group planning;
- shared expenses;
- equipment marketplace;
- AI Trail Guide;
- direct messaging, only if community need and safety design justify it.

---

# Flow Success Measures

## Onboarding

- completion rate;
- time to Trailhead;
- percentage who view an adventure during first session;
- percentage who save or join an adventure.

## Discovery

- search-to-detail rate;
- detail-to-registration rate;
- save-to-registration conversion;
- filter usage and abandonment.

## Registration

- checkout completion;
- payment failure recovery;
- time to complete;
- support requests per registration.

## Preparation

- checklist completion;
- required form completion;
- update acknowledgment;
- day-of support questions.

## Attendance

- check-in success rate;
- average check-in time;
- offline check-in recovery;
- registration-to-attendance rate.

## Retention

- Passport completion interaction;
- memory-sharing rate;
- second-adventure registration;
- volunteer progression;
- chapter participation.

---

# Decisions Established by This Document

1. The primary product loop is Discover, Join, Prepare, Attend, Remember, Return.
2. Trailhead prioritizes urgent and upcoming adventure information over general content.
3. Preparation is a first-class product area, not a confirmation email afterthought.
4. Check-in must support QR, search, manual, and offline exceptions.
5. Passport progress is earned through verified participation.
6. Direct messaging is excluded from launch.
7. Campfire is the central activity and update hub.
8. Community interaction is organized around shared adventure contexts.
9. Build-A-Camp remains a distinct future module.
10. Safety reporting, accessibility, privacy, and offline access are launch architecture concerns rather than later add-ons.

---

# Open Questions

- Which authentication methods will be supported at launch?
- Will event payments occur natively or through an external provider?
- Which check-in method should be the default for small versus large events?
- What information must be cached automatically for offline use?
- How will host verification and training be administered?
- Which Trail Marks require staff verification?
- How will minors and family accounts be handled?
- Should Adventure Circle connections exist at launch or later?
- What level of chapter functionality belongs in the first public release?
- Which event updates require explicit acknowledgment?

---

# Next Design Artifact

The next artifact should translate these flows into low-fidelity wireframes, beginning with the core adventure loop:

```text
Trailhead → Explore → Adventure Detail → Registration → Preparation → Check-In → Passport
```

This sequence will become the first clickable prototype and the first production development slice.