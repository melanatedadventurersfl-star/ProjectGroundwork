# 05. Information Architecture

## Document Status

- **Version:** 1.0
- **Milestone:** 1 — Product Foundation
- **Status:** Approved working architecture

## Purpose

This document defines the major areas of the Melanated Adventurers platform, how members move between them, and where future capabilities belong.

## Architecture Goals

The information architecture should:

- make the next adventure immediately visible;
- reduce the number of steps required to prepare and participate;
- distinguish community activity from operational updates;
- give each member a meaningful personal history;
- remain understandable as chapters, MANA, and Build-A-Camp are added;
- avoid turning the app into a maze of disconnected features.

## Primary Member Navigation

The recommended launch navigation contains five destinations:

1. **Trailhead** — personalized home and live tile dashboard.
2. **Explore** — discover and browse Adventures.
3. **Community** — stories, photos, questions, and experience-centered discussion.
4. **Journey** — upcoming, completed, saved, and remembered experiences.
5. **More** — account, settings, support, policies, and secondary tools.

The **Passport** is a major destination accessible from Trailhead, Journey, and the member identity area. It may replace Journey as a primary tab after prototyping, but the first architecture treats Journey as the action-oriented area and Passport as the identity and history experience.

The **Campfire** is the activity and updates center. It should be accessible globally through a visible icon or tile rather than occupying a permanent bottom-navigation position at launch.

## Top-Level Platform Map

```text
Melanated Adventurers Platform
├── Public Website
│   ├── Home
│   ├── About
│   ├── Adventures Preview
│   ├── Early Access / Join
│   ├── Stories
│   └── Policies and Contact
│
├── Member App
│   ├── Trailhead
│   ├── Explore
│   ├── Adventure Detail
│   ├── Registration and Preparation
│   ├── Community
│   ├── Journey
│   ├── Passport
│   ├── Campfire
│   └── More
│
├── Admin Portal — Future
│   ├── Operations Dashboard
│   ├── Adventures
│   ├── Members
│   ├── Check-In
│   ├── Communications
│   ├── Volunteers
│   ├── Content and Moderation
│   └── Reporting
│
└── Connected Modules — Future
    ├── MANA
    ├── Chapters
    ├── Build-A-Camp
    ├── Event Host Tools
    ├── Marketplace
    └── AI Trail Guide
```

## Trailhead

Trailhead is the member's personalized entry point. It should answer within seconds:

- What is happening next?
- What requires my attention?
- What is new in my community?
- How am I progressing?

### Core Trailhead Tiles

- Next Adventure
- Discover
- Community
- Passport
- Campfire
- Weather or Preparation
- Featured Experience
- My Journey

Tiles may rotate through useful states, but critical information must remain accessible without waiting for animation.

## Explore

Explore helps members find experiences by intent rather than forcing them through one chronological list.

### Explore Structure

```text
Explore
├── Featured
├── Upcoming
├── Near Me
├── Categories
│   ├── Camping
│   ├── Water
│   ├── Hiking
│   ├── Travel
│   ├── Family
│   ├── Skills and Workshops
│   ├── Service / MANA
│   └── Social Outdoor Experiences
├── Skill Level
├── Date
├── Location
├── Price
├── Accessibility
└── Bucket List
```

## Adventure Detail

Adventure Detail is the operational heart of the platform.

```text
Adventure Detail
├── Overview
├── Date, Time, and Location
├── Price and Availability
├── What Is Included
├── Experience Level
├── Physical and Accessibility Notes
├── Schedule
├── Transportation
├── Packing and Preparation
├── Host / Organizer
├── Participant Preview
├── Policies and Waivers
├── Questions
└── Register / Join
```

After registration, the same page should transform into a participant hub rather than sending the member to an unrelated area.

## Registration and Preparation

```text
Registration
├── Ticket or Participation Option
├── Participant Details
├── Add-Ons
├── Transportation
├── Waivers and Agreements
├── Payment
└── Confirmation

Preparation Hub
├── Countdown
├── Required Actions
├── Packing List
├── Weather
├── Directions and Meeting Point
├── Schedule
├── Attendee Updates
├── Organizer Messages
├── Check-In
└── Emergency Information
```

## Community

Community content should remain connected to experiences and outdoor life.

```text
Community
├── Adventure Stories
├── Photos
├── Campfire Discussions
├── Questions
├── Gear and Preparation
├── Trail / Destination Reports
├── Member Spotlights
└── Chapter Updates — Future
```

Direct messaging is excluded from launch.

## Journey

Journey organizes what the member plans, does, and remembers.

```text
Journey
├── Upcoming
├── In Preparation
├── Completed
├── Bucket List
├── Draft Memories
└── Calendar / Timeline
```

## Passport

Passport is the member's identity and progress experience.

```text
Passport
├── Identity Page
├── Pathfinder Level
├── Adventure Stamps
├── Trail Marks
├── Statistics
├── Places Visited
├── Skills and Certifications — Future
├── Volunteer and Leadership History — Future
├── Photo and Story Highlights
└── Privacy Controls
```

## Campfire

Campfire combines notifications, operational updates, and meaningful activity without copying a generic notification list.

```text
Campfire
├── Needs Attention
├── Adventure Updates
├── Community Activity
├── Mentions and Replies
├── Passport and Trail Marks
├── Weather and Preparation Alerts
└── Archived Activity
```

Items should identify why they matter and provide a direct action.

## More

```text
More
├── Account
├── Membership
├── Preferences
├── Privacy
├── Accessibility
├── Payment Methods
├── Notifications
├── Saved Information
├── Help and Support
├── Safety and Reporting
├── Policies
├── About
└── Sign Out
```

## Future Role-Based Areas

Roles may unlock additional navigation without changing the core member experience:

- Volunteer Center
- Host Tools
- Chapter Leadership
- Check-In Mode
- Admin Portal
- Build-A-Camp Worker Tools

Role tools should remain clearly separated from the member-facing experience.

## Content Ownership

Each object has one primary home:

| Object | Primary Home |
|---|---|
| Adventure | Explore / Adventure Detail |
| Registration | Adventure Detail / Journey |
| Preparation task | Preparation Hub |
| Story or photo | Community, linked to an Adventure |
| Operational update | Campfire, linked to an Adventure |
| Stamp or Trail Mark | Passport |
| Saved Adventure | Journey / Bucket List |
| Member settings | More |

Objects may appear in several places, but they should not have competing sources of truth.

## Launch Architecture

The launch-ready member journey should support:

```text
Sign Up
→ Onboarding
→ Trailhead
→ Explore
→ Adventure Detail
→ Register
→ Prepare
→ Check In
→ Complete
→ Add Memory / Stamp
→ Discover the Next Adventure
```

## Current Decisions

- Trailhead uses a distinctive live tile system.
- Explore is centered on Adventures.
- Community posting is experience-oriented.
- Direct messaging is excluded from launch.
- Passport and Journey are distinct but tightly connected.
- Campfire replaces the conventional notification-center concept.

## Open Questions

- Should Passport or Journey occupy the fourth bottom-navigation position?
- Should Campfire use a global icon, a persistent tile, or both?
- How much participant information is visible before registration?
- Should MANA appear as an Explore category or a separate branded area?
- Which preparation features require offline access at launch?

## Decision History

- **v1.0:** Defined the five-part member navigation, supporting destinations, object ownership, and the complete launch journey.
