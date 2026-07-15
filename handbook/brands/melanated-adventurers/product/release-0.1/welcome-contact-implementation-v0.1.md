# MA Release 0.1 Welcome-Contact Workflow v0.1

Status: Draft for review
Linear: PRO-21
Depends on: PRO-13, PRO-17, PRO-18, PRO-20
Feeds: PRO-22

## Purpose

Ensure every newcomer who wants personal support has a named welcome contact, backup coverage, a clear introduction, and a visible path into arrival operations. The workflow must also work manually before any messaging automation exists.

## Outcomes

A successful workflow means:

- newcomers are identified from registration;
- contact preferences are respected;
- a primary and backup contact are assigned;
- introductions are sent or recorded;
- acknowledgments and unanswered questions are visible;
- missed contacts are reassigned before arrival;
- arrival staff receive the right handoff information;
- every meaningful state change is auditable.

## Core principles

1. Support is offered, not imposed.
2. Opting out of direct contact does not remove access to help.
3. Assignment is based on availability, capacity, suitability, and conflicts, not popularity.
4. Sensitive details are shared only when necessary and permitted.
5. No newcomer should silently fall through a queue.
6. Manual operation is the authoritative fallback.
7. Automation may assist but cannot make irreversible decisions without review.

## Actors

### Newcomer

A registered participant who has not previously completed an MA experience, or who is explicitly flagged as needing first-time support.

### Welcome contact

The primary person responsible for making the introduction, answering basic questions, and completing the arrival handoff.

### Backup contact

A second person who can take over if the primary is unavailable, unresponsive, conflicted, or overloaded.

### Coordinator

The operator who owns assignment quality, exception resolution, reassignment, and pre-arrival readiness.

### Arrival lead

The operator who receives the final handoff and oversees on-site welcome completion.

### Administrator

The role that manages permissions, retention, templates, and audit access.

## Eligibility and consent

A registration enters the workflow when all are true:

- registration is active;
- participant is marked newcomer or support-requested;
- experience is published and not canceled;
- participant has not declined all direct contact.

Supported contact choices:

- shared introduction with named contact;
- coordinator-only support;
- event-day support only;
- no direct introduction;
- contact channel preference;
- accessibility or communication preference where voluntarily supplied.

Consent must be recorded with source, timestamp, scope, and latest revision.

## State model

### Registration support state

- `not_evaluated`
- `not_required`
- `newcomer_identified`
- `contact_opted_out`
- `assignment_pending`
- `assigned`
- `introduction_pending`
- `introduction_sent`
- `acknowledged`
- `question_open`
- `ready_for_arrival`
- `exception_open`
- `reassignment_pending`
- `handed_off`
- `closed`

### Assignment state

- `proposed`
- `active`
- `declined`
- `expired`
- `replaced`
- `completed`

### Introduction state

- `not_started`
- `prepared`
- `sent`
- `delivered`
- `acknowledged`
- `failed`
- `waived`

### Exception state

- `open`
- `triaged`
- `in_progress`
- `resolved`
- `deferred_to_arrival`
- `closed`

## Required records

### Welcome assignment

- assignment ID;
- registration ID;
- experience ID;
- newcomer person ID;
- primary contact person ID;
- backup contact person ID;
- assignment reason;
- capacity snapshot;
- assigned by;
- assigned at;
- target introduction deadline;
- status;
- replacement assignment ID when applicable.

### Contact preference

- participant ID;
- allowed channels;
- preferred channel;
- direct-introduction choice;
- event-day support choice;
- accessibility communication note;
- consent source and timestamp;
- effective version.

### Introduction record

- assignment ID;
- template version;
- channel;
- sender;
- recipients;
- sent timestamp;
- delivery status;
- acknowledgment timestamp;
- participant questions;
- next action and owner.

### Exception record

- type;
- severity;
- source;
- factual description;
- owner;
- target resolution time;
- related records;
- action history;
- resolution;
- arrival impact.

## Assignment rules

### Required checks

Before activation, confirm:

- primary is active and available;
- backup is active and available;
- neither exceeds configured capacity;
- no known conflict of interest exists;
- participant preferences can be honored;
- language, accessibility, transportation, or experience-specific needs are considered where relevant;
- assignment does not expose restricted information.

### Capacity

Release 0.1 default:

- target maximum of five active newcomer assignments per contact;
- coordinator may override with a documented reason;
- workload includes unresolved questions and active exceptions, not only headcount.

### Assignment priority

1. Availability through the experience date.
2. No conflict or inappropriate prior relationship.
3. Participant communication preference.
4. Relevant experience familiarity.
5. Balanced workload.
6. Continuity when the participant already knows an appropriate contact.

No assignment should be generated from personality scoring or opaque matching.

## Workflow

### 1. Identify newcomers

Trigger after registration creation or update.

The system or coordinator evaluates:

- prior completed attendance;
- explicit newcomer response;
- support request;
- direct-contact preference.

Result is recorded, not inferred repeatedly on each screen.

### 2. Create assignment candidate

Coordinator sees all unassigned newcomers with:

- experience;
- registration date;
- contact preference;
- introduction deadline;
- relevant operational notes;
- assignment capacity summary.

Candidate assignment remains proposed until an authorized operator activates it.

### 3. Activate primary and backup

Activation creates one authoritative assignment record. Both contacts receive only the information required to fulfill the role.

The primary must acknowledge assignment within the configured window. Default: 24 hours, shortened when the experience is near.

### 4. Prepare introduction

The introduction must include:

- participant name as they supplied it;
- welcome contact name;
- contact purpose and boundaries;
- approved contact channel;
- link to canonical experience brief;
- invitation to share questions;
- coordinator fallback;
- reminder that replying is optional.

### 5. Send or record introduction

Manual-first options:

- operator sends an approved message and records it;
- welcome contact sends through an approved channel and records completion;
- coordinator conducts a shared introduction;
- introduction is waived because the participant opted out.

Automation may send only after template, recipient, consent, and current brief version are validated.

### 6. Track acknowledgment

Acknowledgment means the participant or contact confirms receipt. It does not mean agreement with unrelated terms.

Accepted acknowledgment evidence:

- reply;
- explicit confirmation action;
- operator-recorded phone confirmation;
- in-person confirmation where necessary.

No response remains visible as pending and triggers a review rather than repeated uncontrolled messaging.

### 7. Resolve questions

Questions are categorized:

- brief clarification;
- registration or payment;
- transportation;
- accessibility or accommodation;
- equipment or preparation;
- arrival logistics;
- personal support boundary;
- operator-only matter.

The welcome contact answers only within the role. Questions requiring authority or sensitive handling are routed to the coordinator or appropriate owner.

### 8. Determine readiness

A newcomer becomes `ready_for_arrival` when:

- assignment is active or direct contact was declined;
- introduction is acknowledged, waived, or explicitly deferred;
- material open questions have owners;
- arrival-relevant preferences are recorded;
- no blocking exception remains.

### 9. Handoff to arrival

The handoff includes:

- newcomer indicator;
- primary and backup names;
- whether introduction was acknowledged;
- open operational question summary;
- arrival support preference;
- late-arrival expectation if known;
- accessibility information limited to what arrival staff need;
- exception status.

Private conversation content is not copied wholesale into arrival records.

### 10. Close

Workflow closes after arrival handoff or registration cancellation. Records remain available according to retention rules.

## Exception catalog

### No available contact

- severity: high when experience is within 72 hours;
- action: coordinator assigns self, activates event-day support, or recruits approved backup;
- member impact: never hide the absence of a personal contact; provide coordinator path.

### Primary does not acknowledge

- reminder after configured window;
- backup may be promoted;
- primary assignment is marked replaced, not silently overwritten.

### Introduction delivery fails

- verify contact details and consent;
- attempt another approved channel only when permitted;
- otherwise route to event-day support.

### Participant does not respond

- do not classify as noncooperation;
- send at most one appropriate reminder;
- preserve event participation;
- mark arrival team to offer support without pressure.

### Participant opts out after assignment

- stop direct messages;
- limit retained data to operational and audit needs;
- preserve coordinator and event-day support options.

### Contact conflict or boundary concern

- remove access to participant details as appropriate;
- preserve records before reassignment;
- coordinator reviews and assigns a new contact;
- route separate conduct concerns through the relevant Groundwork process.

### Material experience change

- use PRO-20 notification decision;
- ensure contact has current brief version;
- reopen readiness when the change affects preparation or arrival.

### Registration cancellation

- close active assignment;
- stop scheduled messages;
- retain the minimum required audit history.

## Operator views

### Assignment queue

Shows:

- unassigned newcomers;
- assignment deadline;
- opt-out status;
- candidate primary and backup;
- capacity and availability;
- blocking exceptions.

### Assignment detail

Shows:

- assignment history;
- current contacts;
- introduction status;
- acknowledgment;
- questions and owners;
- exception history;
- arrival readiness.

### Exception queue

Filters by:

- no contact;
- no contact acknowledgment;
- delivery failure;
- open question;
- reassignment;
- privacy or preference conflict;
- arrival blocker;
- overdue action.

### Contact workload

Shows active assignments, unresolved questions, exception count, and availability. It must not rank contacts socially.

### Arrival handoff view

Read-only snapshot generated from current authoritative records with last-updated time.

## Member views

### Welcome contact card

Includes:

- contact first name and role;
- why they are contacting the participant;
- approved way to reply;
- canonical brief link;
- coordinator fallback;
- privacy and opt-out control.

### Pending-contact state

Explains that support is being arranged, provides the experience brief, and gives a coordinator contact path.

### Opt-out state

Confirms that no personal introduction will be sent and explains how to request help later.

### Reassignment state

Communicates the new contact without disclosing internal reasons unnecessarily.

## Permissions

### Participant

Can view their own assignment-facing information, update contact preference, opt out, acknowledge, and submit questions.

### Welcome contact

Can view assigned participants only, record introduction activity, answer or route questions, and complete handoff tasks.

### Backup contact

Can see limited assignment information before activation; expanded access begins only when needed.

### Coordinator

Can assign, reassign, resolve exceptions, view operational notes, and generate handoffs.

### Arrival staff

Can view arrival-relevant handoff details, not unrestricted conversation history.

### Administrator

Can manage permissions, templates, retention, and audit export.

All reads of restricted contact data should be logged where feasible.

## Privacy and data minimization

- Do not expose personal phone numbers or email addresses when an approved shared channel can work.
- Do not store diagnoses or unnecessary personal histories.
- Separate participant-supplied facts from operator interpretation.
- Do not copy private message threads into general event notes.
- Remove or restrict access promptly after replacement or closure.
- Preserve only the minimum audit evidence required.

## Service contracts

### Evaluate newcomer support

Input: registration ID.

Output: support requirement, consent state, preferred channel, deadline.

### List eligible contacts

Input: experience ID and participant requirements.

Output: eligible contacts with availability, capacity, relevant capabilities, and conflict flags.

### Activate assignment

Input: registration ID, primary ID, backup ID, operator ID, reason.

Validates authorization, capacity, conflicts, and consent.

### Record introduction

Input: assignment ID, channel, template version, sender, sent timestamp, delivery result.

### Record acknowledgment

Input: assignment ID, actor, source, timestamp.

### Create or resolve exception

Input: assignment ID, type, facts, severity, owner, target time, resolution.

### Reassign contact

Input: active assignment ID, replacement contacts, reason, operator.

Creates a new assignment and marks the old one replaced. History is immutable.

### Generate arrival handoff

Input: registration ID.

Output: minimum arrival-ready support snapshot with source timestamps.

## Events

- `newcomer.identified`
- `welcome.assignment.proposed`
- `welcome.assignment.activated`
- `welcome.assignment.acknowledged_by_contact`
- `welcome.introduction.sent`
- `welcome.introduction.failed`
- `welcome.introduction.acknowledged`
- `welcome.question.opened`
- `welcome.question.routed`
- `welcome.exception.opened`
- `welcome.exception.resolved`
- `welcome.assignment.replaced`
- `welcome.arrival_ready`
- `welcome.handoff.generated`
- `welcome.workflow.closed`

Analytics must not expose message contents or unnecessary personal information.

## Timing defaults

- Assignment target: within 24 hours of registration when the event is more than seven days away.
- Contact acknowledgment: within 24 hours of assignment.
- Introduction target: within 48 hours of registration and no later than 72 hours before the experience when possible.
- Exception review: same business day for events within seven days.
- Final readiness review: 24 hours before experience start.

Operators may adjust these values by experience type with documented configuration.

## Manual-first operation

The workflow can run using:

- a controlled roster;
- assignment and backup columns;
- approved message templates;
- timestamped status fields;
- an exception register;
- an arrival handoff export.

Manual records must use stable IDs and the same state names as later software. Automation cannot create a second competing source of truth.

## Accessibility

- All status states require text, not color alone.
- Tables must have accessible card or list alternatives on narrow screens.
- Actions must be keyboard reachable.
- Participant controls use plain language.
- Contact choices must not be preselected deceptively.
- Time windows must display timezone and absolute dates.

## Tests

### Critical path

1. New participant registers and requests contact.
2. Coordinator assigns primary and backup.
3. Primary acknowledges.
4. Introduction is sent and participant replies.
5. Question is resolved.
6. Arrival readiness is reached.
7. Handoff is generated.

### Required scenarios

- participant opts out before assignment;
- participant opts out after introduction;
- no contact is available;
- primary never acknowledges;
- delivery fails;
- participant does not reply;
- open question requires coordinator authority;
- material brief change reopens readiness;
- registration is canceled;
- assignment is replaced without losing history;
- unauthorized role attempts to view contact information;
- poor-connectivity operator uses manual fallback;
- duplicate event delivery is idempotent;
- arrival handoff excludes private message content.

## Acceptance checklist

- Manual operation works end to end.
- Every newcomer is either supported, opted out, or visibly excepted.
- Primary and backup assignments are explicit.
- Assignment and reassignment history is immutable.
- Contact and communication preferences are enforced.
- Operators can filter all missing-contact and missing-acknowledgment cases.
- Members retain support when declining direct introduction.
- Arrival receives a minimum, current, privacy-safe handoff.
- Permissions and audit behavior are tested.
- Failure and recovery paths are documented and testable.

## Handoff to PRO-22

PRO-22 consumes:

- current registration and attendance status;
- newcomer flag;
- primary and backup contact;
- introduction and acknowledgment state;
- arrival preference;
- late-arrival note;
- open operational questions;
- unresolved arrival exceptions;
- generated handoff timestamp and source versions.

PRO-22 becomes responsible for check-in, visible welcome, orientation, connection completion, late-arrival handling, and on-site recovery.