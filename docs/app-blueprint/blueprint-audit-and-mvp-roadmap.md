# Blueprint Audit and MVP Roadmap

## Purpose

This document converts the Melanated Adventurers app blueprint into a build sequence. It identifies what is already sufficiently defined, what still needs a product decision, what belongs in the first release, and what should remain outside launch scope.

GitHub is the source of truth while Figma work is paused.

## Executive conclusion

The product concept is coherent and buildable. The strongest through-line is:

1. Discover an adventure.
2. Register and pay.
3. Prepare through Trailhead and Readiness.
4. Receive timely updates.
5. Attend and check in.
6. Reflect and preserve the experience.
7. Return for the next adventure.

The main launch risk is not missing features. It is attempting to ship every documented feature at once. The MVP should prove that this full loop works reliably for one member, one household, and one hosted adventure.

## Blueprint coverage audit

### Well defined

The following areas are sufficiently specified for implementation planning:

- Product vision and principles
- Information architecture
- Core domain model
- Adaptive Trailhead behavior
- Adventure detail
- Adventure readiness
- Explore and discovery
- Registration, checkout, and ticketing
- Community and Campfire
- Passport, Journey, and reflection
- Notifications and emergency alerts
- Profiles, roles, guardians, and households
- Host operations
- Authentication and onboarding
- Platform boundaries
- Design system foundations and deferred Figma handoff

### Areas with overlap that require one canonical owner

#### Announcements

Canonical owner: Notifications and Communication.

Community may display an announcement, but delivery priority, acknowledgment, channel selection, and emergency escalation must come from the notification system.

#### Attendance

Canonical owner: Host Operations.

Ticketing creates eligibility. Check-in records attendance. Passport awards and reflection eligibility consume the attendance record.

#### Adventure status

Canonical owner: Core Domain Model and Host Operations.

Explore, Trailhead, Ticketing, Community, and Passport must read the same lifecycle state rather than maintaining separate interpretations.

#### Readiness

Canonical owner: Adventure Readiness.

Ticketing, onboarding, household data, and host configuration may generate requirements, but the Readiness engine owns scoring, blockers, deadlines, and next actions.

#### Photos and consent

Canonical owner: Member Profiles and Permissions.

Community and Passport may use media, but consent and visibility rules must come from the member or dependent profile.

## Decisions still required before engineering begins

These are product decisions, not missing documentation defects.

1. Payment processor and whether launch supports deposits or full payment only.
2. Whether Eventbrite remains the initial checkout system or is replaced at launch.
3. Whether SMS is included at launch or reserved for emergency use only.
4. Whether members can create public posts at launch or only post inside attended adventures.
5. Whether the host dashboard ships in the same app, a responsive web admin, or a separate internal interface.
6. Whether guest checkout is allowed without an account.
7. Whether minors ever receive their own login in the MVP.
8. Whether map discovery is included in launch or deferred.
9. Whether the Passport launches with badges or only an attendance history.
10. The exact privacy and retention policy for medical, accessibility, and emergency-contact information.

## MVP definition

The MVP is complete when a new member can move from account creation to verified attendance without staff maintaining a second shadow system in spreadsheets.

### Member-facing MVP

- Create and verify an account
- Complete a lightweight profile
- Browse published adventures
- View adventure details
- Save an adventure
- Select a ticket or package
- Register self and permitted household members
- Complete required questions and waivers
- Pay or follow an external hosted checkout path
- Receive confirmation
- See the booked adventure on Trailhead
- Complete readiness tasks
- View schedule, location, packing information, and urgent updates
- Present a digital ticket or confirmation at check-in
- View attendance in Journey
- Complete a simple post-adventure reflection

### Host-facing MVP

- Create an adventure
- Publish and unpublish it
- Define capacity and ticket types
- Configure required questions, waivers, and readiness tasks
- View registrations and balances
- Export a roster
- Send an announcement
- Check participants in manually or by QR code
- Record attendance corrections
- Close the adventure
- Trigger reflection and attendance-history creation

### Required platform foundations

- Authentication
- Role-based authorization
- Audit logging for sensitive host actions
- Core data model
- Notification delivery abstraction
- Payment or external checkout integration
- Offline-tolerant access to tickets and essential adventure details
- Basic analytics and error monitoring

## Deferred from MVP

The following remain documented but should not block launch:

- Direct messaging
- Full social following system
- Advanced recommendation engine
- Interactive map discovery
- Complex badge challenges
- Multi-organization hosting
- Split payments between household adults
- Automated waitlist promotion with payment capture
- Deep inventory management
- Volunteer scheduling marketplace
- Full incident-command tooling
- Real-time bus or caravan tracking
- Advanced offline conflict resolution
- Cross-product identity with Build-A-Camp or Beerded Empire
- Native Figma component completion

## Recommended release sequence

### Phase 0: Product lock

- Resolve the ten open product decisions
- Confirm launch audience
- Confirm payment strategy
- Confirm host-admin surface
- Freeze MVP scope

Exit condition: no unresolved decision can change the core database shape or checkout architecture.

### Phase 1: Technical foundation

- Select application stack
- Establish environments
- Implement authentication
- Create the canonical domain model
- Implement roles and authorization
- Add audit and error logging
- Establish design tokens in code

Exit condition: authenticated users and authorized hosts can access separate protected areas.

### Phase 2: Adventure catalog

- Adventure creation
- Publishing workflow
- Explore list
- Search and basic filters
- Adventure detail
- Saved adventures

Exit condition: a host can publish an adventure and a member can find and understand it.

### Phase 3: Registration and payment

- Ticket inventory
- Household participant selection
- Required questions
- Waivers
- Checkout integration
- Confirmation
- Registration management

Exit condition: a member can secure a valid registration and hosts can see it.

### Phase 4: Trailhead and readiness

- Booked-adventure queue
- Primary Adventure logic
- Readiness requirements
- Next Best Action
- Schedule and packing information
- Offline essentials

Exit condition: the app reliably tells a registered member what to do next.

### Phase 5: Communication and live operations

- Notification center
- Host announcements
- Urgent updates
- QR and manual check-in
- Roster status
- Attendance record

Exit condition: hosts can operate a live event without relying on a separate attendance system.

### Phase 6: Reflection and retention

- Journey attendance history
- Simple reflection
- Photo attachment with consent checks
- Basic Passport recognition
- Suggested next adventure

Exit condition: completed adventures become durable member history and a pathway back into Explore.

### Phase 7: Community expansion

- Community posts
- Adventure-scoped discussions
- Comments and reactions
- Reporting and moderation
- Richer Passport and recommendation features

Exit condition: community growth does not compromise safety or launch reliability.

## Critical dependency chain

The build order must respect this chain:

Account -> Profile and permissions -> Adventure -> Ticket inventory -> Registration -> Payment -> Readiness -> Notification -> Check-in -> Attendance -> Journey and Passport

Community can be developed in parallel only after identity, permissions, reporting, and moderation foundations exist.

## Data entities required for MVP

- UserAccount
- MemberProfile
- Household
- HouseholdRelationship
- RoleAssignment
- Adventure
- AdventureScheduleItem
- TicketType
- Registration
- Participant
- RegistrationAnswer
- WaiverAcceptance
- PaymentRecord or ExternalOrderReference
- ReadinessRequirement
- ReadinessCompletion
- Announcement
- NotificationDelivery
- TicketCredential
- CheckInRecord
- AttendanceRecord
- Reflection
- SavedAdventure
- AuditEvent

## Quality gates

The MVP must not launch until these tests pass:

- A registration cannot exceed capacity.
- A minor cannot bypass guardian requirements.
- A host cannot access unrelated sensitive profile data.
- A failed payment cannot generate a valid ticket.
- A valid paid registration appears in the roster.
- A readiness blocker cannot be hidden by a percentage score.
- An urgent update reaches the in-app notification center even if push delivery fails.
- A ticket remains available with poor connectivity.
- Duplicate check-in does not create duplicate attendance.
- Attendance creates Journey history exactly once.
- Removing photo consent hides affected media from member-facing surfaces.
- Every privileged host action is auditable.

## Suggested implementation work products

Before coding begins, produce:

1. Architecture decision record for the application stack.
2. Canonical entity-relationship diagram.
3. API boundary specification.
4. Screen inventory tied to MVP phases.
5. Acceptance-test matrix.
6. Analytics event dictionary.
7. Privacy and data-retention matrix.
8. Migration plan for current member and event data.

## Figma pause handling

No implementation work should wait for Figma.

During the pause:

- Use the documented wireframe specifications.
- Treat code-based design tokens as canonical.
- Record any visual decisions in GitHub.
- Build accessible, responsive components from the design-system specification.
- Backfill Figma later from the implemented component inventory rather than redesigning the product from scratch.

## Next action

The next document should be the technical architecture decision record. It should compare practical stack options against the actual MVP requirements, operating budget, maintenance burden, offline needs, payment integration, push notifications, and the team's current skills.
