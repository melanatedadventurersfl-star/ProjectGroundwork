# 19. Release Roadmap

## Purpose

This roadmap turns the product blueprint into staged releases. It protects the team from trying to launch every future vision at once while preserving a clear path toward the larger platform.

## Roadmap Principles

1. Prove the core adventure loop first.
2. Release in slices that produce usable member value.
3. Separate member experience from operational complexity.
4. Validate risky assumptions through prototypes before full development.
5. Treat safety, accessibility, and reliability as release requirements.
6. Defer features that demand large moderation or support teams until those capabilities exist.

## Phase 0: Foundation and Prototype

### Goal

Confirm the experience before production development.

### Deliverables

- completed product blueprint
- low-fidelity wireframes
- design system baseline
- clickable prototype
- tested core flow:
  - Trailhead
  - Explore
  - Adventure Detail
  - Registration
  - Preparation
  - Check-In
  - Passport completion
- technical stack decision
- payment and ticketing strategy
- initial analytics plan

### Exit Criteria

- representative users understand the main navigation
- users can locate and join an adventure without assistance
- the Passport concept is understood and valued
- critical accessibility issues are identified
- launch scope is formally frozen

## Release 0.1: Internal Alpha

### Audience

Founders, staff, selected volunteers, and trusted testers.

### Core Capabilities

- account creation and sign-in
- basic onboarding
- Trailhead shell
- adventure list and detail
- test registration flow
- preparation checklist
- test check-in
- basic Passport
- Campfire activity feed
- error reporting and analytics

### Operational Conditions

- test data or limited real events
- no broad public promotion
- manual support available
- destructive actions closely monitored

### Exit Criteria

- critical flows complete successfully
- no unresolved high-severity security defects
- registration and check-in data reconcile correctly
- core screens meet accessibility baseline
- support team understands recovery procedures

## Release 0.2: Pathfinder Beta

### Audience

A limited invited group of Pathfinders.

### Core Capabilities

- real member profiles
- selected real adventures
- payment integration
- registration confirmation
- preparation and waiver tracking
- QR or code check-in
- verified Passport stamps
- Trail Marks baseline
- Campfire with push and email
- Bucket List
- limited Community posting
- reporting and blocking

### Beta Objectives

Measure:
- registration completion
- preparation completion
- successful check-in
- Passport engagement
- update comprehension
- community contribution quality
- support volume

### Exit Criteria

- payment reconciliation is reliable
- critical alerts reach members
- check-in works under weak connectivity
- safety-report workflow is operational
- beta users return after their first adventure
- no unresolved launch-blocking defects

## Release 1.0: Member App Launch

### Audience

The broader Melanated Adventurers community.

### Launch Scope

#### Trailhead
- live tiles
- next adventure
- preparation status
- Campfire summary
- Passport progress
- featured discovery

#### Explore
- categories
- search and filters
- adventure detail
- availability
- Bucket List

#### Registration
- ticket selection
- payment
- waiver acknowledgement
- confirmation
- cancellation according to policy

#### Adventure Support
- preparation checklist
- itinerary
- directions
- weather context
- critical updates
- offline essentials
- check-in

#### Passport
- stamps
- Journey
- Trail Marks
- rank or progress level
- privacy controls

#### Community
- stories
- photos
- questions
- comments
- reactions
- reporting and blocking

#### Campfire
- operational updates
- activity summaries
- priority handling
- delivery preferences

### Explicit Exclusions

- direct messaging
- full chapter administration
- Build-A-Camp fulfillment
- open marketplace
- worker app
- advanced AI planning
- unrestricted user-created groups
- complex social follower mechanics

## Release 1.1: Refinement

Focus:
- onboarding improvements
- better recommendations
- enhanced Passport presentation
- improved media handling
- event discussion improvements
- calendar integration
- waitlist and ticket transfer refinement
- host communication tools
- expanded analytics

## Release 1.2: Hosts and Volunteers

Capabilities:
- host dashboard
- volunteer assignments
- roster management
- operational checklists
- attendance correction workflows
- incident intake
- approved event communications
- post-event completion review

## Release 1.3: Chapters

Capabilities:
- chapter pages
- chapter adventure calendars
- chapter-scoped roles
- local volunteer management
- chapter announcements
- chapter reporting
- organizer approval workflows

## Release 2.0: Broader Experience Platform

Potential modules:
- MANA education and service tracks
- skills and certifications
- advanced trip planning
- family profiles
- partner experiences
- recurring membership benefits
- destination collections
- richer maps and trail data

## Build-A-Camp Module

Build-A-Camp should enter only after the member app's core operations are stable.

Potential staged capabilities:

### BAC 0.1
- service inquiry
- package discovery
- request form
- internal lead routing

### BAC 0.2
- quotes
- availability
- deposits
- customer status tracking

### BAC 1.0
- inventory
- staffing
- setup assignments
- fulfillment checklists
- worker ratings
- rental and service history

## Release Gates

A release cannot proceed without:
- product owner approval
- security review appropriate to scope
- accessibility review
- test evidence
- migration and rollback plan
- support documentation
- monitoring in place
- privacy and terms review when applicable

## Success Metrics by Stage

### Prototype
- task comprehension
- navigation success
- perceived value

### Alpha
- technical completion rate
- defect severity
- data accuracy

### Beta
- registration conversion
- preparation completion
- check-in success
- alert delivery
- return intent

### Launch
- monthly active members
- adventures joined
- repeat participation
- Passport completion
- member-created memories
- support and safety response time

## Current Decisions

- Launch centers on the member adventure loop.
- Hosts and chapters follow after member stability.
- Direct messaging remains excluded from 1.0.
- Build-A-Camp is staged separately.
- Pathfinder Beta uses real events but limited membership.

## Open Questions

- How many Pathfinders should participate in beta?
- Which real adventure should serve as the first live pilot?
- Will the first release be a progressive web app, native app, or hybrid?
- Which capabilities must coexist with Eventbrite during transition?
