# MA Release 0.1 — Remaining Workflows, QA, Pilot, and Review v0.1

Status: Draft for review
Linear: PRO-22 through PRO-27

## Purpose

Complete the operational and measurement layer for the first-time member journey after orientation, canonical briefing, and welcome-contact assignment. This document defines build-ready contracts for arrival, continuation, outcomes, and pre-pilot QA, plus the executable pilot and seven-day evaluation playbooks.

The system remains manual-first. Automation may assist, but every critical state must remain visible, reversible, auditable, and operable through a fallback process.

---

# PRO-22 — Arrival, Welcome, and First-Connection Operations

## Goal

Give event operators one shared arrival view that helps every participant check in efficiently while ensuring newcomers receive an intentional welcome and at least one appropriate connection opportunity.

## Core roles

- Arrival lead: owns the check-in station and queue.
- Welcome coordinator: monitors newcomer welcome states and backup coverage.
- Welcome contact: provides personal greeting and first connection.
- Backup contact: takes over when the primary is unavailable.
- Recovery owner: handles unresolved arrival exceptions.
- Viewer: may see operational counts but not restricted participant details.

## Arrival roster

Each row includes:

- Participant display name
- Registration status
- Newcomer indicator
- Check-in state
- Welcome-contact state
- Arrival window or late-arrival note
- Accessibility-support indicator without unnecessary details
- Unresolved operational question indicator
- Last updated time and updater

Restricted notes open only for authorized roles.

## Check-in states

- expected
- arrived
- checked_in
- late_expected
- no_show
- departed_early
- canceled
- needs_review

Transitions require actor and timestamp. Corrections preserve the prior value.

## Welcome states

- not_required
- contact_assigned
- greeting_pending
- greeted
- orientation_complete
- first_connection_pending
- first_connection_complete
- participant_declined
- recovery_needed
- closed

A participant can decline a direct introduction without being marked unsuccessful. Operators may still offer general orientation and support.

## Standard arrival flow

1. Find participant by name, email fragment, registration code, or manual roster.
2. Confirm identity using the minimum needed information.
3. Mark arrival and check-in.
4. Surface only relevant preparation or accessibility indicators.
5. Confirm newcomer and welcome-contact state.
6. Route the participant to the primary or backup welcome contact.
7. Record greeting, orientation, and first-connection completion separately.
8. Keep unresolved states visible until closed or intentionally deferred.

## First-connection definition

A first connection is a participant-appropriate interaction that helps the newcomer know at least one person or group they can approach during the experience. It is not forced friendship, a guaranteed emotional outcome, or proof of belonging.

Valid completion methods:

- Introduced to another participant with mutual consent
- Introduced to a small group or activity host
- Joined a structured welcome circle
- Participant confirms they are comfortable proceeding independently

## Exception routes

### Primary contact absent

- Notify backup.
- Reassign visibly.
- Preserve original assignment history.
- Escalate when no backup responds within the configured threshold.

### Newcomer arrives before contact

- Arrival lead completes immediate orientation.
- Participant is placed in the backup queue.
- Recovery owner receives the case if unresolved after the threshold.

### Late arrival

- Mark late_expected when known.
- Provide simplified check-in and orientation.
- Do not mark the participant as failed because the standard welcome window passed.

### Participant not on roster

- Search alternate registrations.
- Permit authorized manual registration lookup or exception entry.
- Do not expose the full roster publicly.

### Poor connectivity

- Use the latest encrypted or access-controlled cached roster.
- Record offline actions locally with actor and device timestamp.
- Sync idempotently and flag conflicts for review.
- Printed fallback contains only minimum operational fields.

## Operator views

- Arrival dashboard: expected, arrived, checked in, late, unresolved.
- Newcomer queue: greeting and connection states.
- Recovery queue: missing assignment, failed handoff, unresolved question, accessibility support, roster issue.
- Event closeout: incomplete states and required reconciliation.

## Privacy and permissions

- Arrival volunteers see only the information needed for check-in.
- Welcome contacts see only assigned participants and approved preferences.
- Restricted notes are never printed in full.
- Export and print actions are audited.
- Temporary offline copies expire and require deletion confirmation.

## Analytics

- participant_arrived
- participant_checked_in
- greeting_completed
- orientation_completed
- first_connection_completed
- first_connection_declined
- arrival_exception_opened
- arrival_exception_resolved
- arrival_offline_mode_used

Events contain identifiers, timestamps, method, and actor role, not free-text sensitive notes.

## Testing

Automated:

- Valid and invalid state transitions
- Duplicate check-in idempotency
- Assignment and backup fallback
- Offline sync conflict handling
- Permission boundaries

Manual:

- Name lookup with spelling variation
- Keyboard and screen-reader check-in
- Large text and mobile layout
- Late arrival
- No roster connectivity
- Printed fallback and reconciliation

---

# PRO-23 — Post-Experience Follow-Up, Connection, and Progression

## Goal

Continue the relationship within 48 hours without turning community participation into spam, surveillance, or pressure.

## Trigger

A follow-up case is created after the experience closes for each eligible attendee. Eligibility respects attendance state, consent, communication preference, and suppression rules.

## Member flow

1. Thank-you message with experience name and date.
2. Lightweight reflection with optional questions:
   - Did you feel personally welcomed?
   - Did you make at least one useful connection?
   - How prepared did you feel?
   - Would you consider attending again?
   - Is there anything the team should follow up on?
3. One or two relevant next experiences.
4. Optional reconnection request.
5. Optional pathway to help, host, learn, or contribute.

All questions permit skip and prefer-not-to-answer responses.

## Follow-up states

- pending
- eligible
- suppressed
- queued
- sent
- delivered
- opened
- reflection_started
- reflection_completed
- follow_up_requested
- closed
- delivery_failed

## Next-experience recommendations

Recommendations use published suitability signals and explicit member preferences. They must explain why an experience may fit and must not infer protected or sensitive traits.

## Reconnection

A participant may request:

- Contact from the welcome contact
- Help connecting with a group or activity
- General organizer follow-up
- No further contact

Direct participant-to-participant sharing requires consent from both sides.

## Progression options

- Attend another experience
- Join an orientation or learning session
- Volunteer for a defined task
- Express interest in hosting or supporting
- Join a recurring community channel

Progression is optional and does not change member standing when declined.

## Operator workflow

- Follow-up eligibility queue
- Delivery and failure queue
- Requested-contact queue
- Concern/recovery queue
- Progression-interest queue
- Closed and suppressed records

## Content governance

Editable templates include version, owner, approved channels, active dates, and fallback text. Operators can update event-specific details without code changes.

## Privacy and retention

- Reflection answers are restricted by role.
- Free text is not copied into analytics.
- Contact requests are retained only as long as operationally necessary.
- A member can withdraw future communication consent.

## Analytics

- follow_up_eligible
- follow_up_sent
- follow_up_delivered
- reflection_started
- reflection_completed
- return_intent_recorded
- next_experience_selected
- reconnection_requested
- progression_interest_recorded
- follow_up_suppressed

## Testing

- Eligible and suppressed cases
- Failed delivery and retry
- Consent withdrawal
- Reflection partial save
- No next experiences available
- Duplicate trigger prevention
- Screen-reader and mobile completion

---

# PRO-24 — Outcome Dashboard and Review Workflow

## Goal

Provide a small, consent-aware evidence set that helps MA improve the first-time member journey without pretending community outcomes can be reduced to a single score.

## Primary measures

### Activation

Eligible newcomers who register and attend divided by eligible newcomers who register.

### Preparation confidence

Distribution of participant-reported preparation confidence, including no-response rate.

### Personal welcome

Participants with greeting completed divided by checked-in newcomers, displayed alongside participant self-report when available.

### Meaningful connection

Participants who report or operationally confirm one appropriate connection opportunity. Operator completion and participant perception remain separate fields.

### Return intent

Distribution of yes, maybe, no, and prefer not to answer.

### Actual return

Attendance at another MA experience within 90 days, where identity matching and consent permit.

### Progression

Optional movement into helper, contributor, learning, or host-interest pathways.

## Diagnostic measures

- Unassigned newcomers
- Failed introductions
- Late arrivals
- Arrival exceptions
- Follow-up delivery failures
- Open recovery cases
- Offline fallback usage
- Data completeness and consent coverage

Diagnostics are not participant performance scores.

## Dashboard views

- Release summary
- Experience comparison
- Journey funnel
- Exception and recovery trends
- Accessibility and reliability checks
- Manual workload
- Data quality and consent coverage

Small groups are suppressed or combined to reduce re-identification risk.

## Review workflow

1. Data steward checks completeness and anomalies.
2. Operations owner validates event context.
3. Privacy reviewer checks suppression and access.
4. Product owner reviews measures and exceptions.
5. Team records findings, decisions, owners, and due dates.
6. Changes are linked to evidence without exposing participant details.

## Decision rules

- Do not declare success solely from completion metrics.
- Interpret low response rates explicitly.
- Separate operational failure from participant preference.
- Review differences by experience context before comparing teams.
- Do not use protected traits for targeting or ranking.
- Do not publish participant-level data.

## Exports

Exports are role-controlled, watermarked or logged where practical, and default to aggregated data.

## Analytics quality checks

- Duplicate events
- Impossible state order
- Missing consent basis
- Missing experience or registration reference
- Late-arriving events
- Manual correction rate

## Testing

- Metric formulas with known fixtures
- Suppression thresholds
- Role access
- Time-window calculations
- Consent withdrawal effects
- Missing and partial data
- Export audit trail

---

# PRO-25 — Accessibility, Privacy, Security, and Resilience QA

## Goal

Prevent the pilot from becoming the first meaningful test of basic accessibility, privacy, security, and recovery behavior.

## QA gates

### Accessibility

- Keyboard completion for all operator and member critical paths
- Screen-reader names, roles, states, errors, and live updates
- Logical focus order and visible focus
- Text scaling without loss of function
- Contrast checks
- Plain-language review
- Touch target review
- Reduced-motion behavior
- No color-only meaning

### Mobile and connectivity

- Common mobile viewport checks
- Slow network and intermittent network
- Cached brief availability
- Offline arrival workflow
- Retry without duplicate actions
- Printable fallback legibility

### Privacy

- Consent recorded with purpose and version
- Contact preferences enforced
- Participant data minimized by role
- Restricted notes excluded from broad views and exports
- Withdrawal, correction, export, and deletion paths tested
- Small-group dashboard suppression verified

### Security

- Authentication and session expiry
- Role-based authorization
- Unauthorized direct-object access attempts
- Audit coverage for sensitive reads and writes
- Export and print controls
- Rate limiting and abuse handling where exposed publicly
- Secrets excluded from client and logs
- Dependency and configuration review

### Resilience

- Messaging failure
- Duplicate webhook or event delivery
- Assignment service unavailable
- Check-in service unavailable
- Analytics delayed or unavailable
- Partial sync and conflicting offline actions
- Manual fallback activation and reconciliation
- Recovery owner notification

## Severity

- Blocker: unsafe, inaccessible critical path, unauthorized disclosure, corrupted canonical record, unrecoverable pilot workflow.
- High: critical workflow failure with workaround, material consent failure, repeated data inconsistency.
- Medium: degraded workflow, confusing but recoverable state, noncritical accessibility defect.
- Low: polish, minor copy, or low-impact inconsistency.

Pilot requires zero open blockers and documented acceptance for any remaining high-severity issue.

## Test evidence

Each test records:

- Requirement
- Environment and version
- Steps
- Expected and actual result
- Evidence link
- Severity
- Owner
- Resolution or accepted risk
- Retest result

## Pre-pilot sign-off

Required sign-offs:

- Product owner
- Operations owner
- Accessibility reviewer
- Privacy/security reviewer
- Pilot event lead

---

# PRO-26 — MA Release 0.1 Pilot Playbook

## Goal

Run one controlled real-world experience to test the full journey, manual operations, and recovery behavior before wider rollout.

## Pilot selection criteria

Choose an experience with:

- Manageable attendance
- At least several identifiable newcomers without intentionally excluding others
- Stable venue and arrival process
- A published canonical brief
- Adequate operator coverage
- A realistic but not unusually complex risk profile
- Time for training and rehearsal

Avoid using a flagship, unusually large, or operationally fragile event as the first pilot.

## Required roles

- Pilot owner
- Event lead
- Brief publisher
- Welcome coordinator
- Welcome contacts and backups
- Arrival lead and check-in staff
- Recovery owner
- Data steward
- Privacy/accessibility observer

One person may hold multiple roles only when workload and conflicts are reviewed.

## Readiness checklist

- Figma and implementation requirements reviewed
- PRO-22 through PRO-25 build and QA gates passed
- Canonical brief published
- Participants and roles loaded
- Consent language confirmed
- Communication templates approved
- Welcome assignments prepared
- Backup coverage confirmed
- Arrival roster cached and printed fallback prepared
- Follow-up scheduled
- Dashboard and measurement events validated
- Support channel active
- Incident and exception forms available
- Go/no-go meeting completed

## Rehearsal

Run a tabletop rehearsal covering:

- Newcomer registration
- Assignment and introduction
- Failed contact
- Material brief update
- On-time arrival
- Late arrival
- Participant not on roster
- Connectivity loss
- Follow-up and requested contact
- Data correction

## Go/no-go rules

No-go when:

- Canonical brief is incomplete or inaccurate
- Critical participant contact data is broadly exposed
- Arrival cannot operate offline or manually
- Welcome coverage is insufficient
- Open blocker defects remain
- Consent or communication purpose is unclear
- Recovery ownership is missing

A no-go decision is documented without blame and may convert the event to a non-instrumented operational rehearsal.

## Pilot-day timeline

### Before arrival

- Confirm systems and fallback materials
- Recheck assignments and backups
- Review exceptions
- Start event log

### During arrival

- Monitor queue, check-in, greeting, orientation, and connection states
- Record exceptions as they occur
- Use recovery owner rather than informal side channels
- Avoid collecting unnecessary narrative detail

### During experience

- Observe whether newcomers know where to go and whom to approach
- Track operational workload and manual workarounds
- Do not interrupt participants solely to improve metrics

### Closeout

- Reconcile roster and offline actions
- Close or assign all unresolved cases
- Confirm follow-up eligibility
- Record operator observations
- Secure or destroy printed materials

### Within 48 hours

- Send follow-up
- Route requested support
- Review delivery failures

### Within seven days

- Complete PRO-27 review

## Pilot evidence package

- Event and brief version
- Role roster
- Readiness and go/no-go record
- QA sign-off
- Aggregated journey measures
- Exception and recovery summary
- Manual workload notes
- Participant feedback summary
- Privacy and accessibility observations
- Data-quality report

## Current execution status

The playbook is complete. The actual pilot remains open until an event is selected, the build is available, QA passes, and real participant activity occurs.

---

# PRO-27 — Seven-Day Pilot Review and Release Decision

## Goal

Turn pilot evidence into an explicit decision rather than a vague sense that the event went well.

## Review participants

- Pilot owner
- Product owner
- Event and operations leads
- Welcome coordinator
- Data steward
- Accessibility/privacy observer
- At least one person who did not operate the pilot, when practical

## Review inputs

- Activation and attendance
- Preparation confidence
- Operational and participant welcome evidence
- First-connection evidence
- Return intent
- Follow-up and progression activity
- Exceptions, incidents, and recovery
- Accessibility, privacy, and reliability findings
- Manual workload and workarounds
- Participant and operator reflections
- Data quality and missingness

## Seven-day agenda

1. Restate the pilot hypothesis and scope.
2. Review facts and data quality before interpretation.
3. Walk the journey stage by stage.
4. Review exception and recovery patterns.
5. Identify participant-impacting failures.
6. Separate design, implementation, training, capacity, and unavoidable-context causes.
7. Decide what remains manual.
8. Decide what should be automated later.
9. Record release decision and conditions.

## Decision options

### Proceed

Release 0.1 may move to a broader but controlled rollout with listed monitoring conditions.

### Proceed with conditions

Pilot evidence supports continuation after specified fixes, training, or operating constraints are completed.

### Repeat pilot

The system is promising, but evidence is insufficient or the pilot context was not representative.

### Pause and redesign

Material participant, operational, accessibility, privacy, or reliability issues require redesign before another pilot.

### Stop scope

A feature or workflow should be removed from Release 0.1 because it adds more burden or risk than value.

## Required outputs

- What worked
- What failed
- What was confusing
- What was missing
- What participants declined or did not use
- What required excessive manual work
- What should remain manual
- What can safely be automated
- Required fixes with owners
- Accepted risks and expiration dates
- Release decision
- Proposed Release 0.2 scope

## Evidence rules

- Do not infer participant sentiment from operator completion alone.
- Report missing and declined responses.
- Do not publish identifiable stories without permission.
- Preserve contrary evidence.
- Record uncertainty explicitly.
- Avoid redesigning the entire platform around one unusual event.

## Release decision record

The record includes:

- Decision
- Date
- Decision makers
- Evidence reviewed
- Conditions
- Required fixes
- Monitoring plan
- Next review date
- Approved next-release scope

## Current execution status

The evaluation framework is complete. The decision cannot be completed until PRO-26 produces real pilot evidence.

---

# Dependency and Completion Map

- PRO-22 specification: ready for review
- PRO-23 specification: ready for review
- PRO-24 specification: ready for review
- PRO-25 QA plan and gates: ready for review
- PRO-26 pilot preparation playbook: ready for review; real event execution pending
- PRO-27 evaluation and decision framework: ready for review; decision pending pilot evidence

# Shared Definition of Done

A workflow specification is review-ready when:

- States and transitions are explicit
- Roles and permissions are explicit
- Manual fallback exists
- Audit and correction behavior exists
- Accessibility, privacy, and poor-connectivity behavior is defined
- Analytics avoid sensitive free text
- Failure and recovery paths are testable
- The workflow traces to the approved Figma prototype and domain model
