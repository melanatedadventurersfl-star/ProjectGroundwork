# Host Operations and Adventure Management Specification

## Purpose

This specification defines the operational system hosts use to create, prepare, run, monitor, and close out adventures. It connects event setup, staffing, participant readiness, rosters, check-in, schedules, inventory, communications, incident handling, and post-event reconciliation.

The goal is to give hosts one reliable operational command center without forcing them to stitch together spreadsheets, messaging apps, payment exports, and paper lists during live events.

## Product Principles

1. Operations must be usable under pressure.
2. Critical information must remain available offline.
3. Hosts should see exceptions before totals.
4. Every sensitive action must be permission-based and auditable.
5. Live-event tools must favor speed, clarity, and large touch targets.
6. Member-facing and staff-facing information must remain intentionally separated.
7. The system should reduce duplicate entry across registration, readiness, communications, and check-in.

## Core Operational Objects

### Adventure

The organization-created event or experience being managed.

### Adventure Session

A scheduled unit within an adventure, such as departure, breakfast, workshop, float launch, hike, check-in window, or checkout.

### Operational Task

A staff-assigned preparation or live-event responsibility.

### Staff Assignment

A role granted to a person for a specific adventure or session.

### Participant Record

The operational representation of a registered attendee, guest, dependent, volunteer, or staff member.

### Check-In Record

A timestamped attendance event tied to a participant and, when relevant, a session or transportation leg.

### Inventory Allocation

The assignment of organizational equipment, supplies, meals, vehicles, accommodations, or add-ons to an adventure or participant.

### Incident Record

A controlled operational record for safety, medical, behavioral, logistical, property, or communication incidents.

### Closeout Record

The final operational summary used to reconcile attendance, finances, inventory, incidents, feedback, and follow-up work.

## Host Operations Home

The host operations home should prioritize the adventure requiring the most immediate attention.

Recommended sections:

- Live now
- Starting soon
- Preparation required
- Registration or payment exceptions
- Readiness blockers
- Staffing gaps
- Inventory conflicts
- Unresolved incidents
- Closeout pending

Each adventure summary should show:

- Title and date
- Lifecycle phase
- Confirmed attendance
- Capacity status
- Readiness summary
- Staff coverage
- Open operational tasks
- Critical alerts
- Next operational action

## Adventure Lifecycle

Supported operational phases:

1. Draft
2. Internal planning
3. Registration scheduled
4. Registration open
5. Registration closed
6. Final preparation
7. Travel or arrival
8. Live
9. Checkout or departure
10. Closeout
11. Archived
12. Cancelled

Phase changes may trigger:

- Member-facing visibility changes
- Registration availability
- Readiness task generation
- Staff task generation
- Communication templates
- Live-mode screens
- Check-in access
- Reflection prompts
- Financial and inventory reconciliation

Manual phase overrides require appropriate permission and an audit note when they conflict with automatic timing.

## Adventure Creation

Adventure creation should support templates and guided setup.

Required setup areas:

- Title and summary
- Category and experience type
- Dates, times, and time zone
- Venue and meeting points
- Capacity
- Registration rules
- Ticket types
- Add-ons
- Transportation
- Meals
- Lodging or campsite information
- Accessibility details
- Age restrictions
- Waivers and required questions
- Readiness requirements
- Communication schedule
- Staffing plan
- Inventory needs
- Emergency plan
- Cancellation and refund policy

The system should identify incomplete operational dependencies before publication.

Examples:

- Transportation ticket exists but no departure point is configured.
- Meal choice is required but no meal options exist.
- A minor may attend but guardian requirements are missing.
- A water activity is configured without waiver requirements.
- Capacity exceeds transportation inventory.

## Templates

Hosts may create reusable templates for recurring formats.

Examples:

- Day trip
- Weekend campout
- Bus excursion
- Water activity
- Workshop
- Community service event
- Build-A-Camp client activation
- MANA educational session

Templates may include:

- Standard readiness tasks
- Default staffing roles
- Session structure
- Packing guidance
- Registration questions
- Communication cadence
- Inventory categories
- Emergency checklists
- Closeout tasks

Using a template creates editable copies rather than a permanent dependency on the original.

## Staffing and Assignments

Adventure-scoped staff roles may include:

- Lead host
- Operations lead
- Check-in lead
- Transportation lead
- Food lead
- Setup lead
- Safety lead
- Activity lead
- Volunteer
- Photographer or media lead
- Moderator
- Inventory manager
- Finance reviewer

Each role must map to explicit permissions.

Assignments should include:

- Person
- Role
- Adventure or session scope
- Start and end time
- Responsibilities
- Contact method
- Backup person
- Status

Supported assignment statuses:

- Invited
- Accepted
- Declined
- Tentative
- Checked in
- Completed
- Removed

The system should surface staffing gaps and overlapping assignments.

## Operational Tasks

Tasks may be generated from templates, readiness dependencies, or manual entry.

Task fields:

- Title
- Description
- Owner
- Backup owner
- Due date and time
- Adventure or session
- Priority
- Dependencies
- Proof or attachment requirement
- Completion state
- Notes

Task states:

- Not started
- In progress
- Blocked
- Complete
- Not applicable
- Cancelled

Critical blocked tasks should appear on the host operations home and may prevent phase transitions.

## Roster Management

The operational roster should consolidate:

- Registered members
- Guests
- Dependents
- Staff
- Volunteers
- Waitlisted participants
- Cancelled participants
- Transfers
- Manual additions with reason and permission

Roster views should support grouping by:

- Ticket type
- Household or order
- Transportation group
- Campsite or lodging assignment
- Meal choice
- Age category
- Readiness status
- Check-in status
- Accessibility need
- Emergency-contact completion
- Add-on selection

Sensitive details must only appear to authorized staff.

## Participant Status

Participant operational states may include:

- Registered
- Payment pending
- Balance due
- Waitlisted
- Confirmed
- Readiness incomplete
- Ready
- Checked in
- No-show
- Checked out
- Cancelled
- Removed

Status changes should preserve history and source.

## Check-In

Check-in must support:

- QR scan
- Name search
- Order lookup
- Household check-in
- Manual check-in
- Session check-in
- Transportation boarding
- Re-entry
- Checkout or departure confirmation

Check-in should display only the minimum information needed for the staff role.

Before completion, the system should flag:

- Missing waiver
- Unpaid required balance
- Required guardian approval missing
- Critical readiness blocker
- Ticket mismatch
- Duplicate check-in
- Cancelled registration

Authorized staff may override a gate only when the configured policy allows it. Overrides require a reason and audit record.

## Offline Check-In

The app should cache:

- Eligible roster
- Ticket identifiers
- Essential readiness blockers
- Emergency contacts where authorized
- Session assignments
- Check-in state

Offline actions should be timestamped locally and synchronized when connectivity returns.

Conflict rules:

- Preserve all check-in attempts.
- Do not silently overwrite a newer server action.
- Surface duplicates for review.
- Allow authorized staff to resolve conflicts.

## Schedule and Run of Show

The operational schedule should support:

- Public sessions
- Staff-only sessions
- Setup and teardown
- Transportation legs
- Meal windows
- Check-in windows
- Safety briefings
- Activities
- Quiet hours
- Contingency sessions

Session fields:

- Title
- Start and end time
- Location
- Audience
- Assigned staff
- Capacity
- Dependencies
- Member visibility
- Status
- Notes

Session status:

- Scheduled
- Starting soon
- Active
- Delayed
- Moved
- Cancelled
- Complete

A schedule change may trigger member communication according to urgency and audience.

## Live Operations Mode

Live mode should emphasize:

- Current session
- Next session
- Attendance gaps
- Staff assignments
- Active alerts
- Open incidents
- Transportation status
- Inventory exceptions
- Quick broadcast
- Emergency actions

The interface should avoid deep navigation and offer large, role-specific actions.

## Transportation Operations

Transportation management should support:

- Vehicles
- Drivers
- Capacity
- Departure points
- Passenger assignments
- Boarding status
- Departure confirmation
- Arrival confirmation
- Return-trip status
- Alternate transportation notes

The system should detect:

- Over-capacity assignments
- Missing driver
- Missing vehicle
- Participant assigned to conflicting routes
- Minor without required guardian or authorized arrangement
- Unchecked passenger near departure

## Lodging, Campsite, and Group Assignments

Where applicable, hosts may assign participants to:

- Campsites
- Tents
- Cabins
- Rooms
- RV sites
- Tables
- Activity groups
- Transportation groups

Assignment records should support:

- Capacity
- Occupants
- Accessibility constraints
- Household grouping
- Privacy notes
- Equipment included
- Check-in status

Adult participants should not be placed together based on assumptions about relationships or preferences.

## Meal Operations

Meal management should support:

- Meal schedule
- Menu
- Dietary selections
- Allergen warnings
- Serving counts
- Staff assignments
- Preparation state
- Distribution confirmation

Sensitive health information should be limited to staff who need it.

The system should show aggregate counts without unnecessarily exposing individual dietary details.

## Inventory and Equipment

Inventory operations should support:

- Equipment catalog
- Quantity available
- Condition
- Storage location
- Adventure allocation
- Participant assignment
- Checkout and return
- Damage or loss
- Maintenance state

Examples:

- Tents
- Air mattresses
- Chairs
- Floats
- Coolers
- Grills
- Power equipment
- Safety equipment
- Wristbands
- Meal-service equipment
- Signage
- Transportation assets

Allocation warnings should include:

- Quantity exceeded
- Same item assigned to overlapping adventures
- Required item unavailable
- Item marked damaged or under maintenance
- Return overdue

## Supplies and Consumables

Consumables should track planned versus actual quantities where useful.

Examples:

- Food
- Water
- Fuel
- Wristbands
- Paper goods
- Ice
- Cleaning supplies
- First-aid consumables

Exact stock control is optional for MVP, but critical shortages and purchase tasks must be supported.

## Incident Management

Incident categories may include:

- Medical
- Safety
- Missing participant
- Behavioral
- Harassment
- Transportation
- Property damage
- Lost item
- Weather
- Venue
- Food or allergen
- Technology
- Communication failure
- Other

Incident fields:

- Category
- Severity
- Date and time
- Location
- Reporter
- People involved
- Description
- Immediate actions
- Emergency services involvement
- Guardian notification
- Follow-up owner
- Attachments
- Resolution status
- Restricted notes

Severity levels:

- Observation
- Minor
- Significant
- Critical

Incident access must be tightly permissioned. Sensitive details must not appear in general staff feeds.

## Emergency Actions

Authorized staff should have fast access to:

- Call emergency services
- View venue emergency information
- Access authorized emergency contacts
- Send targeted emergency alert
- Mark participant accounted for
- Start missing-person workflow
- Record evacuation or shelter status

The app must not imply that it replaces emergency services or professional medical judgment.

## Accountability and Headcounts

Hosts should be able to run headcounts by:

- Entire adventure
- Session
- Vehicle
- Lodging group
- Activity group
- Staff team

Participant accountability states:

- Accounted for
- Expected elsewhere
- Not yet confirmed
- Missing
- Departed
- Exempt

Changes should be timestamped and attributable.

## Host Communications

From the operational workspace, authorized staff may send:

- Routine update
- Action-required message
- Schedule change
- Transportation message
- Weather notice
- Emergency alert
- Staff-only broadcast

Every message must use the communication rules defined in the notification specification.

The system should show:

- Intended audience
- Delivery channels
- Estimated recipient count
- Required acknowledgment
- Send status
- Delivery failures

## Financial Operations Summary

Hosts with finance permission may view:

- Gross sales
- Refunds
- Credits
- Outstanding balances
- Ticket counts
- Add-on counts
- Manual adjustments
- Payment exceptions

The operational view should not expose full payment-card data.

Detailed accounting remains outside the MVP unless a payment provider integration supplies it.

## Closeout

Closeout begins after the adventure ends and should include:

- Final attendance
- No-shows
- Staff completion
- Incident review
- Inventory return
- Damage and loss
- Refund or credit follow-up
- Expense capture
- Member communication
- Reflection release
- Passport award verification
- Photo and consent review
- Feedback review
- Lessons learned
- Archive readiness

Closeout status:

- Not started
- In progress
- Blocked
- Ready for review
- Complete

An adventure should not be fully archived while critical incidents, unresolved financial exceptions, or missing inventory remain open unless an administrator approves the exception.

## Post-Event Review

The post-event review should summarize:

- Registration versus attendance
- Readiness completion
- Check-in performance
- Communication performance
- Schedule changes
- Incidents
- Inventory variance
- Member feedback
- Staff feedback
- Financial summary
- Recommended template updates

The review should produce concrete follow-up tasks rather than a decorative dashboard graveyard.

## Audit History

Audit records should capture sensitive operational actions, including:

- Adventure publication
- Capacity changes
- Roster additions or removals
- Check-in overrides
- Role grants and removals
- Emergency-contact access
- Incident access and updates
- Broadcast sends
- Refund or balance adjustments
- Inventory loss decisions
- Archive overrides

Audit records should include actor, action, target, time, and reason where required.

## Permissions

Example permissions:

- adventure.create
- adventure.edit
- adventure.publish
- adventure.cancel
- roster.view
- roster.manage
- readiness.view
- readiness.override
- checkin.perform
- checkin.override
- schedule.manage
- staff.assign
- inventory.view
- inventory.manage
- incident.create
- incident.view_sensitive
- incident.manage
- emergency_contact.access
- communication.send
- communication.send_emergency
- finance.view
- finance.adjust
- closeout.manage
- adventure.archive

Permissions should be adventure-scoped whenever possible.

## Privacy and Data Minimization

Operational interfaces should:

- Show only information needed for the current role.
- Mask sensitive information by default.
- Avoid displaying medical or guardian details in general rosters.
- Log access to emergency information.
- Remove temporary operational access after the assignment ends.
- Respect member photo and profile privacy settings.

## Accessibility

Host tools should support:

- Large touch targets
- High contrast
- Screen-reader labels
- Keyboard navigation where applicable
- Dynamic text
- Non-color status indicators
- Outdoor readability
- Reduced motion
- Clear offline state

## Analytics

Operational analytics may include:

- Adventure setup completion time
- Registration conversion
- Readiness completion
- Staff assignment coverage
- Check-in duration
- No-show rate
- Departure delays
- Schedule-change frequency
- Communication acknowledgment
- Incident frequency and resolution time
- Inventory variance
- Closeout completion time

Analytics must not reward unsafe speed or discourage incident reporting.

## MVP Scope

MVP should include:

- Adventure lifecycle management
- Guided adventure setup
- Staff assignments
- Operational tasks
- Consolidated roster
- QR and manual check-in
- Offline roster and check-in
- Schedule management
- Live operations dashboard
- Transportation assignments
- Basic inventory allocation
- Incident records
- Host broadcasts
- Closeout checklist
- Permission controls and audit history

Deferred capabilities may include:

- Advanced procurement
- Full expense accounting
- Automated staffing optimization
- Predictive inventory planning
- Venue integrations
- Driver telematics
- Advanced lodging optimization
- Cross-organization staffing marketplace

## Acceptance Criteria

The system is ready for initial implementation when:

1. A host can create and publish an adventure with required dependencies validated.
2. Staff can be assigned adventure-scoped roles with explicit permissions.
3. Hosts can view a consolidated roster with readiness and payment exceptions.
4. Authorized staff can check in participants online or offline.
5. Check-in gates and overrides are auditable.
6. Hosts can manage the run of show and communicate schedule changes.
7. Live mode presents current operational priorities without deep navigation.
8. Transportation, lodging groups, meals, and inventory can be assigned where relevant.
9. Sensitive incidents and emergency information are permission-restricted.
10. Hosts can complete a structured post-event closeout and archive process.
11. Member-facing systems receive verified attendance and completion data.
12. All critical operational changes preserve history and attribution.
