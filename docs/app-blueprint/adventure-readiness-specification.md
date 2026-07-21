# Adventure Readiness Specification

## Purpose

Adventure Readiness is the preparation system that helps each member understand what must be completed before an adventure and what action matters most right now.

It is not a decorative progress bar. It is an operational model shared by Trailhead, Adventure Detail, notifications, host tools, check-in, and live-event support.

The system should answer three questions:

1. Am I ready?
2. What is still missing?
3. What should I do next?

## Product Principles

### Personalized, not generic

Readiness is calculated from the tasks that apply to the member, their registration, their role, and the adventure.

### Actionable

Every readiness display must include a clear next step when incomplete.

### Honest

The system must not show a reassuring score while a critical requirement remains unresolved.

### Progressive

Tasks should appear when they become relevant instead of exposing an intimidating wall of preparation on day one.

### Lifecycle-aware

Readiness changes meaning as the adventure moves from registration to preparation, travel, live experience, and completion.

### Resilient

Critical information must remain accessible when connectivity is poor.

## Core Readiness Record

Each registration has one readiness record.

Recommended fields:

- readiness_id
- registration_id
- member_id
- adventure_id
- role
- overall_score
- readiness_state
- critical_blocker_count
- required_incomplete_count
- recommended_incomplete_count
- next_best_action_id
- last_calculated_at
- calculation_version
- manually_reviewed_at
- manually_reviewed_by

## Readiness States

### Not started

No applicable preparation work has been completed.

### In progress

At least one task is complete, but preparation remains.

### Action needed

A required task is incomplete, approaching a deadline, or needs correction.

### Blocked

The member cannot proceed because a critical dependency is unresolved.

Examples:

- failed or missing payment
- required waiver rejected
- registration requires host review
- transportation option cancelled with no replacement
- required medical or accessibility response awaiting follow-up

### Ready

All required tasks are complete and no critical blockers remain.

### Ready with recommendations

All requirements are complete, but optional preparation tasks remain.

### Checked in

The member has arrived and completed the event check-in requirements.

### Completed

The live adventure has ended and all required closeout tasks are satisfied.

## Task Model

Each readiness task should support:

- task_id
- adventure_id or template_id
- registration_id when instantiated
- category
- title
- description
- reason
- requirement_level
- lifecycle_phase
- start_at
- due_at
- expires_at
- status
- weight
- blocking
- member_visible
- host_visible
- completion_method
- completion_source
- completed_at
- completed_by
- verification_required
- verified_at
- verified_by
- dependency_task_ids
- assigned_role
- offline_required
- deep_link_destination

## Requirement Levels

### Critical

Failure prevents registration, travel, check-in, participation, or safe operation.

### Required

Must be completed for the member to be considered ready.

### Recommended

Improves preparedness but does not prevent participation.

### Optional

Useful enrichment or convenience.

Optional tasks should not lower the core readiness percentage.

## Task Statuses

- Not available
- Not started
- In progress
- Submitted
- Under review
- Complete
- Needs correction
- Blocked
- Waived
- Not applicable
- Expired

## Readiness Categories

### Registration

Examples:

- confirm attendee information
- select ticket options
- assign guest names
- verify membership eligibility

### Payment

Examples:

- pay balance
- resolve failed payment
- confirm installment
- acknowledge refund or credit

### Documents and consent

Examples:

- sign waiver
- guardian consent
- photo release
- trip-specific acknowledgment

### Emergency and health

Examples:

- emergency contact
- allergy information
- medication or medical notes
- accessibility needs
- swimming ability or activity-specific safety information

Sensitive information must follow strict privacy controls.

### Transportation

Examples:

- choose self-drive or group transport
- reserve shuttle seat
- provide pickup point
- confirm ride share
- acknowledge departure time

### Lodging and campsite

Examples:

- select campsite or room
- confirm tent package
- assign sleeping arrangement
- provide roommate or household details

### Meals

Examples:

- choose meal option
- submit dietary restrictions
- confirm self-cook or provided meal plan
- acknowledge meal schedule

### Packing and gear

Examples:

- review packing list
- reserve rental gear
- confirm required personal equipment
- download weather-adjusted recommendations

### Travel preparation

Examples:

- download offline map
- save meeting point
- review parking instructions
- confirm arrival window
- review weather

### Community preparation

Examples:

- join adventure Campfire
- review group norms
- introduce yourself
- identify assigned group or team

These should normally be recommended, not required.

### Check-in

Examples:

- display QR code
- verify identity where required
- receive wristband or campsite assignment
- acknowledge live safety briefing

### Reflection and closeout

Examples:

- check out equipment
- return rental gear
- report incident or lost item
- add reflection
- claim Passport stamp

Reflection tasks should not retroactively reduce pre-event readiness.

## Task Templates

Hosts should create reusable readiness templates by adventure type.

Examples:

### Day outing

- registration confirmed
- payment complete
- waiver signed
- emergency contact complete
- meeting point saved

### Group transportation event

Adds:

- transportation selection
- pickup location
- departure acknowledgment
- return-trip acknowledgment

### Campout

Adds:

- lodging or campsite selection
- tent package selection
- meal preferences
- packing review
- gear reservation
- weather review
- offline map

### Water activity

Adds:

- swimming ability
- flotation acknowledgment
- water-safety waiver
- required equipment

### International travel

Adds later-phase support for:

- passport validity
- visa requirements
- insurance
- flight information
- emergency travel documentation

## Applicability Rules

Tasks may be assigned based on:

- adventure type
- ticket type
- attendee role
- age
- guest status
- transportation choice
- lodging choice
- meal choice
- gear rental
- accessibility response
- host configuration
- organization policy
- legal jurisdiction

A task marked not applicable must be excluded from scoring and from incomplete counts.

## Dependencies

Tasks may depend on other tasks.

Examples:

- campsite assignment becomes available after payment
- pickup selection becomes available after shuttle reservation
- check-in QR appears after required documents are complete
- gear pickup appears after rental confirmation

The interface should explain why a task is unavailable instead of presenting a dead control.

## Scoring Model

### Goals

The score should summarize preparation without hiding critical risk.

### Recommended calculation

Only applicable critical, required, and recommended tasks contribute to the displayed score.

Suggested default weights:

- Critical: 5
- Required: 3
- Recommended: 1
- Optional: 0

Completed, verified, waived, and not-applicable tasks receive full eligible weight.

Submitted tasks awaiting required verification may receive partial credit but cannot satisfy a blocker.

### Score formula

`completed eligible weight / total eligible weight × 100`

Round to a whole percentage for member-facing displays.

### Guardrails

- A member cannot show Ready while any blocking task is unresolved.
- A member cannot show Ready while a critical task is incomplete.
- A high percentage must not visually overpower an urgent blocker.
- Optional tasks never reduce the score.
- Reflection tasks do not affect pre-event readiness.
- Hosts may override a task status, but overrides require an audit record.

### Example

A member may have a score of 86 percent but still show Blocked because a required waiver needs correction.

The primary display should therefore read:

> Action needed: Correct your waiver

The percentage remains supporting information.

## Next Best Action

The system should select one next action for prominent placement.

Priority order:

1. Active safety or operational blocker
2. Critical overdue task
3. Required overdue task
4. Critical task due soon
5. Required task due soon
6. Task blocking another task
7. In-progress task closest to completion
8. Recommended time-sensitive task
9. First logical preparation task

Tie breakers:

- earlier due date
- greater downstream dependency
- shorter estimated completion time when urgency is equal
- host priority override

The member should normally see one dominant action, not five competing alarms.

## Deadline Logic

Suggested urgency bands:

- Overdue
- Due today
- Due within 48 hours
- Due within 7 days
- Upcoming
- No deadline

Adventure-relative timing may be used when a fixed date is unnecessary.

Examples:

- available 30 days before departure
- due 72 hours before check-in
- expires when check-in closes

If an adventure is rescheduled, relative deadlines should recalculate automatically. Hosts must review fixed-date tasks.

## Trailhead Presentation

### Primary Adventure Tile

Show:

- readiness score or state
- blocker count when present
- one next best action
- due date or urgency
- concise progress language

Example:

> 72% ready
> Complete your waiver by Friday

Blocked example:

> Action needed
> Payment failed. Update your payment method.

### Upcoming Adventure Tile

Show a compact indicator and only the most important status.

### Adventure Queue

The urgency of readiness work contributes to selecting the Primary Adventure.

A later adventure with a critical deadline may outrank a nearer adventure with no missing tasks.

## Adventure Detail Presentation

The readiness section should include:

- overall state
- progress indicator
- next best action
- critical alerts
- grouped task list
- required versus recommended distinction
- deadlines
- blocked-task explanations
- completion confirmation

Recommended task grouping:

- Action needed
- In progress
- Coming up
- Complete

Do not organize only by backend category when urgency is more useful to the member.

## Notifications

Readiness may create notifications for:

- newly available required task
- upcoming deadline
- overdue task
- submitted item rejected or needing correction
- blocker created
- blocker resolved
- readiness achieved
- schedule change affecting preparation

Avoid sending repetitive notices for the same unresolved task.

Recommended controls:

- deduplication window
- escalation threshold
- quiet hours except critical safety notices
- digest support for nonurgent recommendations

Campfire may show preparation updates, but urgent readiness requirements belong in notifications.

## Host Operations

Hosts need aggregate readiness views without unnecessary exposure of private information.

### Dashboard metrics

- registered attendees
- ready attendees
- action-needed attendees
- blocked attendees
- missing waivers
- unpaid balances
- unresolved transportation
- meal response counts
- accessibility follow-up count
- check-in readiness

### Host actions

- filter attendees by readiness state
- send targeted reminder
- review submitted items
- verify task
- waive requirement
- add attendee-specific task
- change deadline
- mark task not applicable
- export operational summary

### Privacy principle

A host may need to know that an accessibility follow-up is required without exposing the full medical or personal response in a broad dashboard.

## Roles

### Primary attendee

Owns personal preparation tasks.

### Purchaser

May own payment and guest-assignment tasks for multiple attendees.

### Guest

May need a claim link or limited account flow to complete personal waivers and emergency details.

### Minor attendee

Tasks may be assigned to a guardian or require dual completion.

### Volunteer

May receive role-specific briefing, arrival, uniform, training, or shift-confirmation tasks.

### Host or staff attendee

May receive operational readiness tasks separate from customer preparation.

One person may hold multiple roles. Tasks must show which role they belong to.

## Multiple Attendees in One Order

A purchaser should see household or group readiness without being allowed to complete private tasks improperly for another adult.

Recommended structure:

- Order readiness summary
- Individual attendee readiness
- Shared tasks
- Person-specific tasks

Shared examples:

- payment
- campsite reservation
- transportation booking

Individual examples:

- waiver
- emergency contact
- dietary response
- accessibility response

## Check-In Gate

Each adventure may configure check-in rules.

Possible outcomes:

- Ready to check in
- Check in with staff
- Conditional check-in
- Check-in blocked

The app must not prevent emergency or staff-assisted resolution merely because an automated check fails.

Staff should see the reason and permitted resolution path.

## Offline Behavior

Before the adventure, the app should cache:

- current readiness state
- incomplete critical tasks
- check-in eligibility
- QR code when safe to do so
- meeting point
- arrival instructions
- emergency information
- completed task receipts where useful

Tasks requiring an online transaction should clearly state that connectivity is required.

Offline completion may be queued only for low-risk tasks that do not require server verification.

## Changes After Registration

Readiness must recalculate when:

- ticket type changes
- guest is transferred
- transportation changes
- lodging changes
- meal selection changes
- gear is added or removed
- adventure schedule changes
- host adds or removes a requirement
- payment status changes
- a document expires

New requirements should not appear silently. Explain what changed and why.

## Cancellation, Transfer, and Refunds

### Adventure cancelled

Freeze preparation tasks, preserve completion history, and replace next actions with cancellation and refund guidance.

### Registration cancelled

Stop readiness reminders and retain the audit record.

### Transfer

Reassign shared and personal tasks carefully. Personal documents should not transfer to a new attendee unless legally and operationally valid.

### Postponement

Recalculate relative deadlines and require review of time-sensitive items such as transport, lodging, and medical information.

## Audit and Trust

Record important readiness changes:

- status before and after
- actor
- source
- timestamp
- override reason
- verification result
- notification sent

Members should be able to see receipts for high-value completions such as payment, waiver submission, and check-in.

## Permissions

### Member

May view and complete their applicable tasks.

### Purchaser

May manage shared booking tasks and designated guest tasks.

### Guardian

May complete permitted tasks for a minor.

### Host

May view operational status and perform configured reviews.

### Organization administrator

May manage templates, policies, and overrides.

### Restricted reviewer

May review sensitive responses without broader host access.

Use least-privilege access throughout.

## Analytics Events

Recommended events:

- readiness_viewed
- readiness_task_opened
- readiness_task_started
- readiness_task_submitted
- readiness_task_completed
- readiness_task_failed
- readiness_task_needs_correction
- readiness_blocker_created
- readiness_blocker_resolved
- readiness_next_action_selected
- readiness_notification_opened
- readiness_achieved
- checkin_gate_evaluated
- host_readiness_filter_used
- host_reminder_sent

Useful properties:

- adventure_id
- registration_id
- task_category
- requirement_level
- lifecycle_phase
- days_until_adventure
- readiness_state
- score_band
- completion_source

Do not place sensitive health or accessibility details in analytics payloads.

## MVP Scope

The first release should support:

- per-registration readiness record
- required, recommended, and optional tasks
- task categories
- deadlines
- dependencies
- overall score
- blockers
- next best action
- Trailhead summary
- Adventure Detail checklist
- payment, waiver, emergency contact, transportation, meal, and packing tasks
- member notifications
- basic host aggregate dashboard
- manual host verification and override
- audit history
- offline display of critical preparation information

## Later Phases

Potential additions:

- predictive preparation recommendations
- weather-triggered task changes
- automated gear suggestions
- passport or skill prerequisites
- travel-document validation
- multi-organization policy inheritance
- intelligent reminder timing
- attendee readiness messaging templates
- readiness benchmarks by adventure type
- worker and vendor operational readiness

## Acceptance Criteria

The feature is ready for implementation when:

1. Every registered attendee receives only applicable tasks.
2. Required and recommended work are visibly distinct.
3. The score excludes optional and not-applicable tasks.
4. An unresolved blocker prevents the Ready state.
5. Every incomplete display identifies a next action.
6. Trailhead and Adventure Detail use the same readiness source.
7. Host views summarize readiness without exposing unnecessary private data.
8. Changes to registration or adventure configuration trigger recalculation.
9. Critical information remains available offline.
10. Overrides and verification actions are auditable.
11. Reflection tasks do not reduce pre-event readiness.
12. A member can understand their status and next step within three seconds.

## Product Rule

Adventure Readiness is successful when members arrive prepared without needing to hunt through email, social posts, payment receipts, packing documents, and scattered messages.

The score is the dashboard light. The real product is the confidence underneath it.