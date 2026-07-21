# 15. Data Model

## Purpose

This chapter defines the core records and relationships required to support the Melanated Adventurers member platform. The model is intentionally modular so the launch app can remain focused while later modules such as chapters, MANA, Build-A-Camp, host tools, and rentals can be added without rebuilding the foundation.

## Modeling Principles

1. Members own their identity, privacy, memories, and preferences.
2. Adventures are the central operational object.
3. Attendance and registration are different records.
4. Passport progress is derived from verified participation.
5. Campfire entries are generated from meaningful events, not copied blindly from every database change.
6. Sensitive safety and payment data must be isolated from public community data.
7. Historical records should be preserved through status changes rather than destructive deletion whenever practical.

## Core Entities

### Member

Represents a person with access to the platform.

Key fields:
- `id`
- `email`
- `phone`
- `display_name`
- `legal_name`
- `profile_photo_url`
- `bio`
- `home_city`
- `home_state`
- `home_chapter_id`
- `experience_level`
- `member_status`
- `onboarding_status`
- `created_at`
- `updated_at`

Sensitive fields should be stored separately where practical.

### Member Preferences

Stores settings that should not clutter the Member record.

Includes:
- notification preferences
- dietary preferences
- accessibility needs
- outdoor interests
- preferred trip distance
- privacy settings
- emergency-contact consent status

### Role Assignment

Supports permissions without hard-coding one role into the Member record.

Examples:
- Member
- Volunteer
- Host
- Chapter Leader
- Staff
- Administrator
- Safety Moderator

### Chapter

Represents a local Melanated Adventurers community.

Key fields:
- name
- region
- city/state
- status
- chapter lead
- public description
- launch date

### Adventure

Represents an event, trip, workshop, service activity, or shared outdoor experience.

Key fields:
- `id`
- `title`
- `slug`
- `summary`
- `description`
- `adventure_type`
- `difficulty_level`
- `experience_level_required`
- `start_at`
- `end_at`
- `timezone`
- `venue_id`
- `meeting_location`
- `capacity`
- `registration_open_at`
- `registration_close_at`
- `status`
- `visibility`
- `chapter_id`
- `host_member_id`
- `featured_image_url`
- `weather_location`
- `created_at`
- `updated_at`

### Adventure Schedule Item

Stores itinerary blocks such as departure, meals, workshops, check-in, and return.

### Adventure Requirement

Stores packing requirements, age limits, waivers, skill requirements, transportation notes, and accessibility information.

### Ticket Type

Defines purchasable or reservable options for an adventure.

Examples:
- Full Experience
- Day Pass
- Transportation Add-On
- Tent Package
- Meet There
- Volunteer

### Registration

Represents a member's intent and financial reservation.

Key fields:
- member
- adventure
- ticket type
- quantity
- total price
- registration status
- payment status
- waiver status
- special requests
- cancellation reason

### Payment Record

Stores provider references and accounting status. Raw card data must never be stored.

### Attendance

Represents actual presence at an adventure.

Key fields:
- member
- adventure
- registration
- check-in time
- check-out time
- verification method
- attendance status
- verified by

### Passport

One Passport belongs to one member and acts as the root of their adventure history.

### Passport Stamp

A verified record that a member completed an eligible adventure.

Key fields:
- member
- adventure
- stamp type
- issued at
- verification source
- visibility
- artwork version

### Trail Mark

Defines an achievement that can be earned.

Examples:
- First Campout
- Campfire Keeper
- Volunteer Trail
- Five Adventures
- First National Park

### Member Trail Mark

Connects a member to an earned Trail Mark and stores progress, issuance, and revocation history.

### Journey Entry

A timeline item reflecting an adventure, memory, achievement, milestone, or personal reflection.

### Memory

Member-created content linked to an adventure or Journey entry.

Possible types:
- photo
- video
- caption
- journal entry
- shared story

### Community Post

A community contribution that may contain text, media, questions, gear reviews, trail reports, or stories.

### Comment and Reaction

Comments remain threaded only to a limited depth at launch. Reactions use a controlled vocabulary rather than unlimited custom emoji.

### Campfire Activity

A member-facing update generated from a system, adventure, community, or Passport event.

Key fields:
- recipient member
- source type
- source id
- activity category
- priority
- title
- body
- action URL
- read state
- delivery state
- expires at

### Notification Delivery

Tracks push, email, SMS, and in-app delivery independently from the Campfire record.

### Bucket List Item

Connects a member to a saved adventure, destination, category, or future idea.

### Venue

Stores reusable location data, access notes, map coordinates, facilities, and operational contacts.

### Safety Report

A restricted record for incidents, conduct concerns, harassment, injuries, hazards, or emergency follow-up.

Access must be tightly controlled and audited.

### Waiver

Stores versioned waiver templates and member acknowledgements.

### Media Asset

Centralizes uploaded file metadata, ownership, moderation status, accessibility text, and storage references.

## Relationship Summary

```text
Member
├── Member Preferences
├── Role Assignments
├── Registrations ── Adventure ── Ticket Types
├── Attendance ───── Adventure
├── Passport
│   ├── Passport Stamps ── Adventure
│   ├── Member Trail Marks ── Trail Marks
│   └── Journey Entries ── Memories
├── Community Posts ── Comments / Reactions
├── Campfire Activities
├── Bucket List Items
└── Safety Reports

Adventure
├── Chapter
├── Host Member
├── Venue
├── Schedule Items
├── Requirements
├── Ticket Types
├── Registrations
├── Attendance
└── Memories
```

## Status Design

Important records use explicit statuses.

Examples:

Adventure:
- draft
- scheduled
- registration_open
- sold_out
- registration_closed
- in_progress
- completed
- cancelled
- archived

Registration:
- pending
- confirmed
- waitlisted
- cancelled
- refunded
- transferred

Member:
- invited
- active
- suspended
- deactivated
- archived

## Audit Requirements

Audit history is required for:
- role changes
- payment status changes
- attendance verification
- Passport stamp issuance or removal
- safety-report access and updates
- adventure cancellations
- moderation decisions

## Data Retention

- Financial records follow legal and accounting retention needs.
- Safety records follow a defined restricted retention policy.
- Deleted community content may be soft-deleted for moderation and legal review.
- Members may request account deletion, subject to records that must legally remain.
- Public profile data should be removable without erasing operational attendance history.

## Launch Scope

Required at launch:
- Member
- Member Preferences
- Role Assignment
- Adventure
- Venue
- Ticket Type
- Registration
- Payment Record
- Attendance
- Passport
- Passport Stamp
- Trail Mark
- Member Trail Mark
- Journey Entry
- Memory
- Community Post
- Comment
- Reaction
- Campfire Activity
- Notification Delivery
- Bucket List Item
- Media Asset
- Waiver
- Safety Report

Deferred extensions:
- equipment inventory
- rental orders
- worker scheduling
- chapter finance
- vendor management
- shared expense tracking
- AI recommendations

## Current Decisions

- Attendance, not payment, unlocks Passport completion.
- A registration may exist without attendance.
- Members may hold multiple roles.
- Campfire and external notification delivery are separate records.
- Safety data is isolated from ordinary community moderation data.
- Adventures remain the central object connecting operations, community, and Passport history.

## Open Questions

- Which adventure types automatically qualify for Passport stamps?
- Can hosts issue manual attendance corrections without staff approval?
- How long should expired Campfire items remain searchable?
- Should Journey entries be fully editable after publication?
- Which profile fields are visible by default?
