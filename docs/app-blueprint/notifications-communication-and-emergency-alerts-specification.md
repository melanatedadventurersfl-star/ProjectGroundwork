# Notifications, Communication, and Emergency Alerts Specification

## Purpose

This document defines how the Melanated Adventurers app communicates with members before, during, and after adventures. It establishes one shared system for in-app notifications, push notifications, email, SMS, Campfire activity, host announcements, and emergency alerts.

The goal is to make important information difficult to miss without turning every update into a siren. Communication should be timely, relevant, understandable, and proportional to the consequence of ignoring it.

## Product Principles

1. **Urgency must be earned**
   - Critical treatment is reserved for safety, major travel disruption, event cancellation, immediate location changes, and other consequences that require rapid action.

2. **One source, several delivery paths**
   - A communication is created once as a canonical message, then routed to appropriate channels based on severity, member preferences, legal requirements, and delivery success.

3. **Actionable over noisy**
   - Every high-priority message should clearly explain what changed, what the member must do, and when they must do it.

4. **Adventure context is mandatory**
   - Members with multiple upcoming adventures must always know which adventure a message concerns.

5. **Campfire is not an emergency channel**
   - Campfire may display updates, but urgent and critical information must also use direct notification channels.

6. **Offline and weak-signal conditions are normal**
   - Essential event information should remain available after delivery, and the system must track failed or delayed delivery where possible.

## Communication Objects

### Canonical Communication

A canonical communication is the source record from which channel-specific deliveries are generated.

Required fields:

- Communication ID
- Organization ID
- Adventure ID, when applicable
- Audience definition
- Communication type
- Priority level
- Title
- Plain-language body
- Required action, when applicable
- Effective date and time
- Expiration date and time, when applicable
- Sender identity
- Created timestamp
- Published timestamp
- Revision history
- Acknowledgment requirement
- Delivery-channel policy
- Related destination inside the app

### Delivery Record

Each attempted delivery creates a record containing:

- Communication ID
- Recipient ID
- Channel
- Delivery status
- Provider status, when available
- Attempt timestamp
- Delivered timestamp
- Opened or viewed timestamp, when available
- Acknowledged timestamp, when applicable
- Failure reason
- Retry count

## Communication Types

Supported communication types include:

- Readiness reminder
- Registration reminder
- Payment reminder
- Waiver reminder
- Transportation update
- Schedule update
- Location update
- Weather update
- Host announcement
- Packing recommendation
- Check-in instruction
- Live activity update
- Safety advisory
- Emergency alert
- Event cancellation
- Refund or credit update
- Waitlist update
- Community moderation notice
- Passport or reflection prompt
- General organization update

Communication type and priority are separate. A weather update may be informational, important, action required, or critical depending on its consequences.

## Priority Levels

### Informational

Use when the member benefits from knowing something but no action is required.

Examples:

- New adventure photos are available
- A packing recommendation was added
- A Passport stamp was awarded
- A host posted a recap

Default channels:

- In-app notification center
- Campfire, when socially relevant
- Optional push based on user preferences

### Important Update

Use when information materially affects planning or expectations but does not require immediate action.

Examples:

- The meal menu changed
- Parking instructions were updated several days in advance
- A noncritical activity changed time

Default channels:

- In-app notification
- Push notification
- Email when the information is detailed or durable

### Action Required

Use when a member must complete a task by a deadline or risk losing access, readiness, or part of the experience.

Examples:

- Complete waiver by Thursday
- Remaining balance is due
- Confirm transportation selection
- Submit guest information

Default channels:

- In-app notification
- Push notification
- Email
- SMS only when enabled by the organization, consented to by the member, and justified by timing

### Critical

Use only when delay could create a safety risk, severe disruption, missed departure, or inability to attend.

Examples:

- Event cancelled due to severe weather
- Evacuate the activity area
- Departure moved earlier with limited notice
- Meeting location changed during active travel
- Missing participant or medical emergency instruction

Default channels:

- Persistent in-app alert
- Push notification
- SMS when legally and operationally available
- Email as a durable record
- Host dashboard delivery monitoring
- Optional voice or external emergency tooling in future phases

Critical messages bypass quiet hours but must still be concise and relevant.

## Channel Responsibilities

### In-App Notification Center

The notification center is the durable record of messages a member needs to know or act upon.

Each item shows:

- Priority indicator
- Adventure or organization context
- Title
- Short explanation
- Timestamp
- Read or unread state
- Required action, when applicable
- Direct destination

Items may be filtered by:

- All
- Action required
- Adventures
- Community
- Payments
- Safety

### Push Notifications

Push is used for timely awareness.

Rules:

- Keep copy concise
- Include adventure identity when applicable
- Deep-link directly to the relevant screen
- Do not place sensitive personal or medical information in lock-screen text
- Collapse superseded updates where supported
- Avoid repeated push alerts for the same unresolved task unless reminder policy allows it

### Email

Email is used for durable, detailed, and transactional communication.

Appropriate uses:

- Registration confirmation
- Receipts
- Policy changes
- Detailed travel instructions
- Balance notices
- Cancellation and refund notices
- Summaries containing several related updates

Email should not be the only channel for time-critical changes.

### SMS

SMS is reserved for high-value, time-sensitive communication.

Requirements:

- Explicit member consent except where applicable law permits emergency use
- Clear sender identity
- Adventure context
- Concise action language
- Opt-out handling for nonemergency messages
- Delivery-status monitoring where available

Marketing messages must never share the emergency-alert pathway.

### Campfire

Campfire displays social and operational activity but does not replace direct delivery.

Suitable Campfire items:

- Host announcements
- Photo uploads
- Schedule updates
- Weather updates
- Community milestones
- Adventure recaps

Urgent Campfire items must also create a direct notification.

### Adventure Detail and Trailhead

Important active communications should remain visible in context after the original notification is opened.

Examples:

- Alert banner on Adventure Detail
- Updated departure tile on Trailhead
- Readiness task generated from a required action
- Live Adventure instruction card

A notification should not become a disappearing doorway to information that can no longer be found.

## Audience Targeting

Hosts may target communication to:

- All organization members
- All registered attendees
- Confirmed attendees only
- Waitlisted members
- Ticket purchasers
- Individual guests
- Group leaders
- Guardians
- Volunteers or staff
- Transportation participants
- Meal-plan participants
- Lodging or campsite groups
- Members with incomplete requirements
- Members currently checked in
- Members assigned to a specific activity, route, or meeting point

The system must preview the resolved audience count before sending.

Sensitive segmentation criteria must not be exposed to recipients.

## Notification Preferences

Members may control noncritical communications by category and channel.

Configurable categories may include:

- Adventure recommendations
- Community activity
- Comments and mentions
- Readiness reminders
- Payment reminders
- Organization news
- Passport and reflection prompts

Members cannot disable:

- Transactional receipts
- Material registration changes
- Required legal notices
- Critical safety alerts for an adventure they are attending

Preferences must distinguish push, email, and SMS where applicable.

## Quiet Hours and Timing

Members may set quiet hours for noncritical push and SMS delivery.

Rules:

- Informational messages should queue until quiet hours end
- Important updates may queue unless a deadline makes delay harmful
- Action-required messages may be delivered during quiet hours only when the remaining response window is genuinely limited
- Critical alerts bypass quiet hours
- The app should use the member's local time zone when known
- Adventure-local time must be displayed for travel and event instructions

Scheduled messages must show the sender which time zone controls delivery.

## Reminder Engine

The system may generate reminders from:

- Readiness task deadlines
- Registration expiration
- Payment due dates
- Waiver deadlines
- Waitlist offer expiration
- Departure time
- Check-in opening
- Reflection windows

Reminder rules should include:

- Initial notice
- Optional follow-up cadence
- Stop condition
- Escalation threshold
- Maximum reminder count
- Channel sequence

A reminder stops when the underlying task is completed, cancelled, waived, or no longer applicable.

## Acknowledgments

Some communications require explicit acknowledgment.

Examples:

- Major location change
- Emergency instruction
- Transportation departure change
- Material policy update

Acknowledgment options:

- Confirmed
- I need help
- I am no longer attending
- Other context-specific response

Acknowledgment does not replace completion of a separate required task.

Hosts may view:

- Delivered
- Viewed
- Acknowledged
- Failed
- No response

The product must avoid implying that lack of digital acknowledgment proves a person did not receive information through another channel.

## Failed Delivery and Escalation

When a direct channel fails:

1. Record the failure reason
2. Retry according to channel policy
3. Attempt an approved fallback channel
4. Surface unresolved delivery failures to authorized host staff
5. Preserve the message in the in-app notification center

For critical alerts, the host dashboard should identify recipients with no confirmed delivery or acknowledgment.

Future escalation options may include:

- Staff call lists
- Emergency-contact outreach
- On-site roster checks
- Third-party emergency notification providers

## Message Revision and Supersession

Hosts may correct or supersede a communication.

Rules:

- Preserve revision history
- Clearly label corrected information
- Notify recipients again when the correction materially affects their action
- Link the old item to the current version
- Prevent contradictory active banners
- Avoid silently editing critical instructions after delivery

A cancellation reversal or restored activity must be sent as a new communication, not hidden inside the original cancellation.

## Host Composer

The host communication composer should include:

- Communication type
- Priority level
- Adventure context
- Audience selector
- Channel recommendations
- Title and body
- Required action
- Deep-link destination
- Schedule or send-now option
- Expiration
- Acknowledgment setting
- Preview for each channel
- Recipient count
- Warning when message severity and content appear mismatched

Critical alerts require an additional confirmation step and may require elevated permissions.

## Templates

Organizations may create approved templates for recurring messages.

Examples:

- Registration confirmation
- Balance due
- Waiver reminder
- Departure reminder
- Weather watch
- Location change
- Event cancellation
- Check-in open
- Reflection prompt

Templates may contain controlled variables such as:

- Member name
- Adventure title
- Date
- Meeting point
- Balance amount
- Deadline
- Host contact

The system must prevent unresolved variables from being sent.

## Emergency Alert Workflow

### Emergency Categories

- Medical emergency
- Severe weather
- Fire
- Missing participant
- Security threat
- Transportation incident
- Evacuation
- Shelter-in-place
- Infrastructure failure
- Other immediate hazard

### Required Emergency Message Anatomy

- What happened
- Where it applies
- What recipients must do now
- Where to go or what to avoid
- How updates will follow
- Emergency contact or official authority when appropriate
- Timestamp

### Emergency Controls

- Limited to authorized roles
- Confirmation before send
- Audience preview
- Automatic multi-channel routing
- Persistent active-alert banner
- Delivery monitoring
- Acknowledgment option where useful
- Clear close or all-clear process
- Audit log

The app must not present itself as a replacement for 911, emergency services, weather authorities, park rangers, or venue emergency systems.

## Weather Communication

Weather information may come from host input or integrated providers.

Weather states:

- Advisory
- Watch
- Operational change
- Delay
- Cancellation
- Emergency

A weather card should distinguish forecast information from an official host decision.

Example:

- Forecast: thunderstorms possible after 3:00 PM
- Host decision: water activity moved to 11:00 AM

## Travel and Departure Alerts

Travel alerts may include:

- Departure reminder
- Bus assignment
- Driver or vehicle update
- Meeting-point change
- Delayed departure
- Missed-departure instructions
- Arrival update

During the travel phase, Trailhead should prioritize the newest valid departure instruction and suppress obsolete versions.

## Minor and Guardian Communication

For minors:

- Required communications route to the authorized guardian
- The system may also show age-appropriate information to the minor account when permitted
- Sensitive incident details should be restricted to authorized recipients
- Emergency contacts must be accessible to authorized staff without exposing them to general members

## Privacy and Security

- Do not expose recipient lists to other recipients
- Use least-privilege access for host communication tools
- Restrict medical and emergency-contact data
- Maintain audit logs for high-priority sends
- Encrypt sensitive data in transit and at rest
- Respect consent requirements for SMS and marketing email
- Support data-retention policies

## Accessibility

Communications must:

- Use plain language
- Avoid color-only severity indicators
- Support screen readers
- Preserve dynamic text sizing
- Provide meaningful link labels
- Avoid flashing emergency treatments
- Offer captions or transcripts for media updates
- Keep critical instructions available as text

## Offline Behavior

Previously delivered essential messages should remain available offline.

The app should cache:

- Active critical alerts
- Latest location and departure instructions
- Check-in instructions
- Emergency contacts
- Relevant maps or meeting-point details when already downloaded

When connectivity returns, the app synchronizes read and acknowledgment states.

## Analytics and Operational Metrics

Track:

- Messages sent by type and priority
- Delivery success by channel
- Open and acknowledgment rates
- Failed-delivery rate
- Reminder-to-completion conversion
- Time from critical send to acknowledgment
- Notification opt-out patterns
- Duplicate or excessive-message indicators
- Host correction frequency

Analytics should measure communication effectiveness without creating surveillance theater.

## MVP Scope

Launch should include:

- In-app notification center
- Push notifications
- Transactional email
- Priority levels
- Adventure-scoped targeting
- Read and unread state
- Deep links
- Readiness and payment reminders
- Host announcements
- Schedule, location, and weather updates
- Critical alert workflow
- Basic delivery status
- Quiet hours for noncritical push
- Notification preferences
- Persistent Adventure Detail alerts

SMS, advanced acknowledgment escalation, automated emergency-contact calling, and third-party emergency-provider integration may follow after launch.

## Acceptance Criteria

The system is ready for implementation when:

1. Every communication has a defined type, priority, audience, and canonical record.
2. Critical messages route through direct channels and do not rely on Campfire alone.
3. Members can control noncritical preferences without disabling required operational communication.
4. Quiet hours apply correctly and never suppress critical alerts.
5. Notifications deep-link to durable in-app information.
6. Required-action reminders stop when the underlying task is resolved.
7. Hosts can preview audiences and channel output before sending.
8. Failed delivery is recorded and visible to authorized staff.
9. Corrections preserve history and clearly supersede outdated instructions.
10. Emergency messages remain visible until formally closed or replaced by an all-clear.
11. Offline users retain access to previously delivered essential instructions.
12. Minor, guardian, privacy, and accessibility requirements are enforced.
