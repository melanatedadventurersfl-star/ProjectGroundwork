# MA Release 0.1 Domain Model and Service Contracts v0.1

Status: Draft for review  
Implements: PRO-18  
Depends on: PRO-7, PRO-9, PRO-11 through PRO-16, and Groundwork Trust & Operating Resilience v0.1

## 1. Purpose

This document defines the implementation-ready shared model for the Melanated Adventurers Release 0.1 first-time member journey.

The contract supports a manual-first operating model and later automation without changing the meaning of the underlying records. It separates shared Groundwork entities from MA-owned presentation, language, rituals, and operating judgment.

The product outcome is:

> A first-time attendee knew what to do, someone was expecting them, they connected with people, and they want to return.

## 2. Architectural principles

1. **A person is not a registration.** Identity, participation, attendance, and roles are separate records.
2. **A relationship is not implied by contact.** Welcome assignments, introductions, consent, and connection outcomes are explicit.
3. **Check-in is not welcome.** Arrival, greeting, orientation, and first connection are distinct states.
4. **Receipt is not agreement.** Sent, delivered, acknowledged, understood, and agreed are separate communication states.
5. **Published information is versioned.** Material changes do not silently replace what participants previously received.
6. **Manual actions remain first-class.** Every workflow can be performed and recorded without automation.
7. **Sensitive notes are minimized.** Store operational needs, not speculation or personality judgments.
8. **No irreversible decision is made solely by an automated rule.** Exceptions and consequential actions require human review.
9. **Records remain reconstructable.** State changes identify actor, timestamp, source, reason, and prior state.
10. **MA owns the experience expression.** Groundwork supplies structure, permissions, events, and workflow contracts.

## 3. Bounded contexts

### 3.1 Identity and relationships

Owns people, contact methods, consent, organization membership, roles, and relationships.

### 3.2 Experience publishing

Owns experiences, suitability signals, canonical briefs, publication versions, material changes, and cancellation state.

### 3.3 Participation

Owns registrations, newcomer responses, preparation status, attendance, no-shows, cancellations, and accommodations.

### 3.4 Welcome and connection

Owns welcome-contact assignments, introductions, acknowledgment, arrival handoff, greeting, orientation, first connection, and exceptions.

### 3.5 Continuation and progression

Owns reflections, return intent, follow-up, next-experience recommendations, helper interest, contributor pathways, and recovery cases.

### 3.6 Measurement and learning

Owns metric events, derived measures, review periods, comments, exception diagnostics, and privacy-safe learning records.

## 4. Core entities

## 4.1 Person

Represents a human being across Groundwork products.

Required fields:

- `person_id`
- `display_name`
- `status`: active, limited, inactive, deleted
- `created_at`
- `updated_at`

Optional fields:

- preferred name
- pronouns
- age-band or adult/minor status where operationally required
- accessibility preferences
- emergency contact reference where appropriate

Rules:

- A person may have multiple roles simultaneously.
- A person record is not deleted merely because one relationship ends.
- Sensitive attributes require a defined purpose, access rule, and retention period.

## 4.2 Contact Method

Represents an address or channel through which a person may be contacted.

Fields:

- `contact_method_id`
- `person_id`
- type: email, phone, SMS, messaging platform, other
- value
- verified status
- preferred flag
- communication categories allowed
- consent source and timestamp
- revoked timestamp

Rules:

- Direct contact between participants requires explicit permission or an approved shared-channel introduction.
- Revocation does not erase the historical fact that consent previously existed.

## 4.3 Organization Relationship

Represents a person's relationship to MA or another Groundwork organization.

Fields:

- `organization_relationship_id`
- `person_id`
- `organization_id`
- relationship type: participant, member, volunteer, host, welcome contact, operator, leader, vendor, contractor, employee, partner
- start and end dates
- status
- agreement or policy acknowledgment references

Rules:

- Multiple relationship types must not be collapsed into one generic member status.
- Authority and access derive from active roles, not familiarity or informal trust.

## 4.4 Role Assignment

Represents a time-bounded responsibility.

Fields:

- `role_assignment_id`
- `person_id`
- role type
- scope: organization, experience, registration, case, or workflow
- authority boundaries
- start and end timestamps
- assigned by
- backup person

Examples:

- Experience owner
- Registration operator
- Welcome contact
- Backup welcome contact
- Arrival greeter
- Recovery owner
- Outcome reviewer

## 4.5 Experience

Represents a curated MA gathering or activity.

Fields:

- `experience_id`
- organization
- title
- summary
- status: draft, review, published, updated, canceled, completed, archived
- start and end times
- place reference
- capacity
- experience owner
- publication version reference

Suitability fields:

- activity type
- physical intensity
- experience level
- social format
- preparation burden

Rules:

- Suitability signals use approved vocabularies and plain-language explanations.
- An experience cannot be published without a complete canonical brief.

## 4.6 Experience Brief Version

Represents the authoritative participant-facing information at a point in time.

Fields:

- `brief_version_id`
- `experience_id`
- version number
- status: draft, published, superseded, canceled
- effective timestamp
- published by
- change summary
- material-change flag
- source version

Required content sections:

- what the experience is
- audience and suitability
- cost and inclusions
- gear needed and provided
- transportation
- accessibility
- arrival instructions
- schedule and expectations
- contacts
- cancellation or change guidance

Rules:

- Published versions are immutable.
- Corrections create a new version.
- Material changes create a notification obligation.

## 4.7 Registration

Represents one person's intent to participate in one experience.

Fields:

- `registration_id`
- `experience_id`
- `person_id`
- status: started, submitted, confirmed, waitlisted, canceled, transferred, attended, no-show
- registration source
- registered at
- party or household reference where relevant
- newcomer status at registration
- newcomer responses
- preparation-confidence response
- accommodations or operational needs
- consent and communication preferences

Rules:

- Newcomer status is determined for the specific organization and journey, not guessed from familiarity.
- Operational notes must be factual, necessary, and access-controlled.

## 4.8 Attendance

Represents actual presence and participation.

Fields:

- `attendance_id`
- `registration_id`
- arrival timestamp
- departure timestamp where used
- check-in actor
- attendance status
- late-arrival flag
- manual/offline source

Rules:

- Attendance does not imply personal welcome or meaningful connection.
- Offline records must later identify who reconciled them and when.

## 4.9 Welcome Assignment

Represents the responsibility for a named person to welcome a newcomer.

Fields:

- `welcome_assignment_id`
- `registration_id`
- assigned person
- backup person
- status: proposed, assigned, introduction sent, acknowledged, question open, resolved, reassignment needed, handed off, completed, canceled
- assigned by and timestamp
- response due timestamp
- introduction channel
- member opt-out status
- unresolved-question summary

Rules:

- A newcomer may opt out of direct contact while retaining access to support.
- Missed response windows surface an exception rather than silently continuing.

## 4.10 Communication Record

Represents an operationally meaningful communication event.

Fields:

- `communication_record_id`
- related entity references
- category: informal, operational, official, urgent, confidential
- sender and recipients
- channel
- template or content reference
- sent, delivered, acknowledged, understood, agreed timestamps where applicable
- source link or evidence reference

Rules:

- Acknowledgment and agreement are never inferred from each other.
- Casual channels may reference an official record but do not replace it.

## 4.11 Arrival Connection State

Represents the newcomer journey after check-in.

Fields:

- `arrival_connection_id`
- `attendance_id`
- welcome assignment
- greeting completed at/by
- orientation completed at/by
- first connection completed at/by
- connection type: individual, pair, small group, activity-based
- 15-minute review status
- 45-minute review status
- exception status

Rules:

- Each state is recorded independently.
- Hosts can identify checked-in newcomers who remain unwelcomed or unconnected.

## 4.12 Exception

Represents a condition requiring review outside the normal path.

Fields:

- `exception_id`
- category
- related entity
- detected source
- observed facts
- severity: routine, elevated, urgent
- owner and backup
- status
- response due
- resolution
- closed by and timestamp

Examples:

- No welcome contact assigned
- Introduction not acknowledged
- Material brief change not confirmed
- Late arrival
- Accessibility need unresolved
- Participant reports poor treatment
- Follow-up delivery failure

Rules:

- Exceptions describe process conditions and facts, not character.
- Consequential action requires human review.

## 4.13 Reflection

Represents participant feedback after an experience.

Fields:

- `reflection_id`
- registration or attendance reference
- submitted timestamp
- personally welcomed response
- meaningful connection response
- preparation confidence result
- intent to return
- optional comment
- recovery requested flag
- consent for follow-up

Rules:

- A negative reflection may open a recovery case but is not itself a finding of misconduct.

## 4.14 Continuation Action

Represents the next step offered or taken.

Fields:

- `continuation_action_id`
- person and source experience
- type: next experience, reconnect, volunteer interest, helper role, contributor path, recovery conversation
- offered at
- accepted at
- completed at
- owner
- status

## 4.15 Progression Record

Represents movement into deeper participation.

Fields:

- `progression_record_id`
- person
- from state
- to state
- trigger or source
- effective date
- role assignment reference where applicable

Examples:

- First-time attendee to returning attendee
- Returning attendee to helper
- Helper to volunteer or contributor

## 4.16 Recovery Case

Represents an owned response to a poor or unresolved experience.

Fields:

- `recovery_case_id`
- person and experience references
- intake source
- factual summary
- privacy level
- owner and conflict-of-interest check
- interim action
- status
- outcome
- closure timestamp

Rules:

- Allegations, evidence, findings, and decisions are stored distinctly.
- Access is need-to-know.
- Serious matters route to the approved Groundwork resilience process.

## 4.17 Metric Event

Represents a source event used to calculate approved measures.

Fields:

- `metric_event_id`
- event type
- person, registration, experience, and organization references as allowed
- occurred at
- recorded at
- source
- privacy classification

Approved metric events include:

- registration submitted
- attendance recorded
- preparation confidence captured
- personal welcome completed
- meaningful connection reported
- return intent captured
- return attendance recorded
- progression recorded

## 5. State machines

## 5.1 Experience

`draft → review → published → updated → completed → archived`

Alternate paths:

- draft or review → canceled
- published or updated → canceled

A published update creates a new brief version and may create notification obligations.

## 5.2 Registration

`started → submitted → confirmed → attended`

Alternate paths:

- submitted → waitlisted → confirmed
- submitted or confirmed → canceled
- confirmed → no-show
- confirmed → transferred, where policy permits

## 5.3 Welcome assignment

`proposed → assigned → introduction sent → acknowledged → handed off → completed`

Exception paths:

- assigned → reassignment needed
- introduction sent → question open → resolved
- any active state → canceled

## 5.4 Arrival connection

`checked in → greeted → oriented → connected → completed`

Each transition is independent and attributable. A person may leave before completion, creating an unresolved exception.

## 5.5 Recovery case

`received → triaged → assigned → reviewing → action planned → resolved → closed`

Urgent cases may bypass ordinary progression and invoke interim safeguards.

## 6. Service contracts

Contracts describe stable capabilities, not a required technology stack.

## 6.1 Identity Service

Responsibilities:

- Create and resolve person identities
- Manage contact methods and consent
- Return active organization relationships and scoped roles
- Apply access and deletion rules

Key operations:

- `resolvePerson(identityInput)`
- `updateContactPreference(personId, preference, source)`
- `grantRole(personId, role, scope, authority, effectivePeriod)`
- `endRole(roleAssignmentId, reason)`

## 6.2 Experience Service

Responsibilities:

- Create and update experiences
- Validate suitability and required brief sections
- Publish immutable brief versions
- Record material changes and cancellation

Key operations:

- `createExperience(draft)`
- `validatePublishReadiness(experienceId)`
- `publishBrief(experienceId, draftVersion, actor)`
- `publishMaterialChange(experienceId, changes, actor)`
- `cancelExperience(experienceId, reason, actor)`

## 6.3 Registration Service

Responsibilities:

- Register a person
- Capture newcomer and preparation information
- Manage confirmation, waitlist, cancellation, and transfer
- Emit participation events

Key operations:

- `submitRegistration(personId, experienceId, responses, consents)`
- `changeRegistrationStatus(registrationId, newStatus, reason, actor)`
- `recordPreparationConfidence(registrationId, response, source)`

## 6.4 Welcome Service

Responsibilities:

- Identify newcomers needing support
- Assign welcome contacts and backups
- Record introductions, acknowledgments, questions, and reassignment
- Produce exception queues

Key operations:

- `assignWelcomeContact(registrationId, contactId, backupId, actor)`
- `recordIntroduction(assignmentId, channel, communicationRecordId)`
- `acknowledgeAssignment(assignmentId, actor)`
- `openWelcomeException(assignmentId, category, facts)`
- `reassignWelcomeContact(assignmentId, replacementId, reason, actor)`

## 6.5 Arrival Service

Responsibilities:

- Record attendance
- Surface newcomer and welcome assignment context
- Record greeting, orientation, and connection states
- Support offline reconciliation and exception timers

Key operations:

- `checkIn(registrationId, source, actor)`
- `recordGreeting(attendanceId, actor)`
- `recordOrientation(attendanceId, actor)`
- `recordFirstConnection(attendanceId, connectionType, actor)`
- `listUnresolvedNewcomers(experienceId, threshold)`
- `reconcileOfflineAttendance(experienceId, records, actor)`

## 6.6 Continuation Service

Responsibilities:

- Send or record follow-up
- Capture reflections
- Offer next steps
- Open recovery cases
- Record progression

Key operations:

- `createFollowUp(attendanceId, dueAt)`
- `recordReflection(attendanceId, reflection)`
- `offerContinuation(personId, sourceExperienceId, options)`
- `openRecoveryCase(source, facts, owner)`
- `recordProgression(personId, fromState, toState, source)`

## 6.7 Measurement Service

Responsibilities:

- Accept approved metric events
- Calculate measures using versioned definitions
- Enforce privacy and small-sample rules
- Produce experience and aggregate review views

Key operations:

- `recordMetricEvent(type, references, source)`
- `calculateExperienceMeasures(experienceId, definitionVersion)`
- `calculateCohortReturn(cohort, window)`
- `createLearningReview(experienceId, measures, comments, exceptions)`

## 6.8 Notification Adapter

Responsibilities:

- Deliver messages through approved channels
- Return delivery status
- Never decide policy or consent

Key operations:

- `send(templateId, recipients, channel, variables)`
- `getDeliveryStatus(messageId)`

Manual operation may create the same communication record without invoking an adapter.

## 7. Permissions

Minimum roles:

### Participant

Can view published briefs, manage own registration and preferences, submit reflections, and view their offered next steps.

### Welcome Contact

Can view assigned newcomer name, approved contact method, relevant preparation questions, and assignment state. Cannot view unrelated participant records or private recovery notes.

### Arrival Operator

Can view the event roster, newcomer indicator, welcome assignment, operational accommodations, and arrival states. Cannot view full reflections or confidential case records.

### Experience Owner

Can create and publish experience records, manage roster workflows, assign operational roles, and review experience-level outcomes.

### Recovery Owner

Can access assigned recovery cases and necessary source records, subject to conflict checks and need-to-know restrictions.

### Outcome Reviewer

Can view approved metrics and privacy-safe comments. Person-level access requires a defined operational purpose.

### Groundwork Administrator

Can manage system configuration and role grants. Administrative access does not automatically grant access to confidential content.

## 8. Audit and evidence contract

Every material state change records:

- entity and entity ID
- prior state
- new state
- actor
- timestamp
- source channel or interface
- reason or change summary
- related communication, approval, or evidence reference

Rules:

- Audit entries are append-only.
- Corrections append a correcting record.
- Published briefs, official notices, consent changes, assignments, exceptions, findings, and access removals are preserved according to approved retention rules.

## 9. Privacy and retention

### Data minimization

Collect only data needed to deliver the experience, protect participants, operate safely, or evaluate approved outcomes.

### Access

Use scoped roles and need-to-know rules. Sensitive notes are never exposed merely because someone is an event volunteer or system administrator.

### Retention classes

1. Transactional participation records
2. Communication and consent records
3. Operational exception records
4. Confidential recovery or review records
5. Aggregated learning and metric records

Exact periods require policy and professional review. Deletion requests preserve records that must remain for legal, safety, financial, or audit purposes.

## 10. Integration events

The following domain events may be published for adapters or later automation:

- `ExperiencePublished`
- `ExperienceBriefMateriallyChanged`
- `RegistrationSubmitted`
- `NewcomerRegistered`
- `WelcomeContactAssigned`
- `WelcomeIntroductionOverdue`
- `ParticipantCheckedIn`
- `NewcomerGreetingOverdue`
- `FirstConnectionCompleted`
- `ExperienceCompleted`
- `FollowUpDue`
- `ReflectionSubmitted`
- `RecoveryRequested`
- `ReturnAttendanceRecorded`
- `ProgressionRecorded`

Events describe facts that occurred. They do not authorize consequential action by themselves.

## 11. Manual-first implementation

Release 0.1 may use forms, tables, email or messaging templates, checklists, and operator dashboards before introducing a full application.

Manual implementation must still maintain:

- Stable IDs
- Canonical records
- Version history
- Explicit state changes
- Role-based access
- Auditability
- Consent-aware communication
- Exception ownership

The service contracts therefore apply to both human-operated workflows and software implementations.

## 12. Non-goals

Release 0.1 does not include:

- Public social feed
- Broad member directory
- Automated trust or personality scoring
- Complex recommendation engine
- Gamification
- Universal identity verification
- Automated disciplinary decisions
- Replacement of specialized ticketing, accounting, legal, HR, or emergency systems

## 13. Acceptance checklist

PRO-18 is ready for approval when:

- Every Release 0.1 screen maps to an entity and state defined here
- Every sensitive field has a purpose and access rule
- Published information is versioned
- Welcome and arrival workflows distinguish check-in, greeting, orientation, and connection
- Manual and automated actions create equivalent records
- Trust-framework controls are represented in permissions, audit, communication, exceptions, and recovery
- Technology selection can proceed without redefining the member journey
