# Melanated Adventurers Core Domain Model

## Purpose

This document defines the shared product language for design, engineering, content, and operations. It is a conceptual model, not yet a database schema.

## Core domains

### Member
The person at the center of the platform.

Key concepts:
- Identity and profile
- Roles and permissions
- Interests and Adventure DNA
- Accessibility and support needs
- Emergency contacts and relevant medical notes
- Transportation and gear profile
- Friends, groups, chapters, and organizations

### Adventure
A hosted real-world experience with its own lifecycle.

Key concepts:
- Overview, category, difficulty, duration, capacity, and pricing
- Host organization and staff
- Location and logistics
- Schedule, meals, equipment, maps, parking, weather, and safety
- Attendees, groups, volunteers, and waitlist
- Lifecycle: idea, planning, published, registration, preparing, travel, live, reflection, archived

### Registration
The relationship between a member and an adventure.

Key concepts:
- Pending, confirmed, cancelled, refunded, transferred, checked-in, and completed states
- Ticket and guests
- Payments and add-ons
- Waivers and forms
- Meal, transportation, lodging, and equipment selections

### Adventure Readiness
A personalized collection of required and recommended preparation tasks.

Possible tasks:
- Complete payment
- Sign waiver
- Submit emergency contact
- Confirm transportation
- Select meals
- Complete packing checklist
- Confirm campsite or lodging
- Reserve or bring gear
- Download offline information
- Review weather, directions, and arrival guidance

Each task should have status, priority, due date, requirement level, source, and completion evidence where applicable.

### Adventure Queue
A member-specific prioritized view of all adventure commitments.

Queue sections:
- Primary Adventure
- Current Adventure
- Upcoming Adventures
- Recently Completed
- Reflection Queue
- Archived Adventures

The Primary Adventure is selected by relevance and urgency, not date alone.

### Experience
The member's lived perspective of an Adventure.

One Adventure can create many different Experiences, such as attendee, family, volunteer, first-time camper, or host experiences.

Key concepts:
- Personal role
- Memories and photos
- People met
- Activities completed
- Reflection and journal
- Personal outcomes and sentiment

### Community
Purposeful connection among members.

Subdomains:
- Chapters
- Groups
- Friends and connections
- Discussions
- Ride shares
- Gear exchange
- Volunteer opportunities
- Event-specific cohorts

### Campfire
The cross-app activity center.

It aggregates meaningful activity such as:
- Host announcements
- Event changes
- New photos and comments
- Friends joining an adventure
- Weather updates
- Community activity
- Passport milestones

Campfire is not direct messaging and is not the same as actionable notifications.

### Passport
The member's record of progress and accomplishment.

Key concepts:
- Stamps
- Badges
- Challenges
- Parks, states, countries, and locations visited
- Activities and skills completed
- Volunteer hours
- Milestones

Passport answers: What have I accomplished?

### Journey
The chronological story of the member's outdoor life.

Key concepts:
- Adventures attended
- Experiences
- Photos
- Reflections
- People met
- Places visited
- Significant milestones

Journey answers: What have I experienced?

### Location
A reusable place record for campgrounds, parks, trails, breweries, venues, and meeting points.

Key concepts:
- Coordinates and address
- Amenities and camping types
- Accessibility
- Maps and photos
- Reviews and host notes
- Difficulty and terrain
- Nearby attractions
- Weather region

### Organization
A brand, branch, chapter, partner, or host entity.

Examples:
- Melanated Adventurers
- MANA
- Build-A-Camp
- Chapters
- Partner organizations

Organizations can host adventures, manage members and staff, own content, and operate under distinct permissions.

## Key relationships

- A Member may have many Registrations.
- A Registration connects one Member to one Adventure.
- An Adventure may occur at one or more Locations.
- An Adventure belongs to or is hosted by an Organization.
- A Registration produces personalized Readiness tasks.
- A completed Registration may produce an Experience.
- Experiences populate Journey and can award Passport progress.
- Members participate in Community through Chapters, Groups, and event cohorts.
- Campfire aggregates activity generated across these domains.
- Adventure Queue prioritizes a Member's Registrations and related tasks.

## Modeling principle

The platform should store both operational truth and human meaning. Registration records that someone attended. Experience records what that participation meant to them.