# MA Release 0.1 Canonical Experience Brief Publishing Workflow v0.1

Status: Draft for review  
Linear: PRO-20  
Depends on: PRO-12, PRO-17, PRO-18, PRO-19  
Unblocks: PRO-21, PRO-25

## 1. Purpose

Create one authoritative experience record that operators maintain and every participant-facing channel references.

The brief must answer, in plain language:

- What is this experience?
- Is it likely to fit me?
- What does it cost?
- What is included and excluded?
- What do I bring?
- How do I get there?
- What happens when I arrive?
- What should I know about accessibility, comfort, weather, food, bathrooms, and safety?
- Who can answer questions?
- When was this information last confirmed?

The system must reduce contradictory posts, buried updates, stale screenshots, and side-channel knowledge.

## 2. Product promise

A participant should be able to say:

> I found one page with the current facts, I can see what changed, and I know what to do next.

An operator should be able to say:

> I update the experience once, the system checks what is missing, and the published record shows who changed what and when.

## 3. Core principles

1. One experience has one canonical brief.
2. The public URL remains stable across updates.
3. Published facts are versioned, never silently overwritten.
4. Draft work is not participant-visible.
5. Material changes require a notification decision and audit record.
6. External channels summarize and link back. They do not become alternate sources of truth.
7. Operational notes and sensitive participant data never appear in the public brief.
8. Poor connectivity must not make essential arrival information disappear.
9. Cancellation and postponement remain visible at the same permanent URL.
10. Human owners remain accountable for factual accuracy.

## 4. Actors and permissions

### Experience owner

Can create and edit drafts, submit for review, view validation issues, and propose updates.

### Operations reviewer

Can review logistics, approve publication, classify changes, and confirm operational readiness.

### Communications publisher

Can prepare channel summaries from approved content and trigger approved notices. Cannot alter controlling facts unless also granted editor rights.

### Administrator

Can manage permissions, restore prior versions, correct ownership, and perform emergency publication actions.

### Welcome contact and event staff

Can read the latest published brief and staff-only arrival supplement. They cannot edit the public record by default.

### Participant or public visitor

Can read the latest published version, view the change summary, save or print key information, and use the stable link.

## 5. Permission rules

| Action | Owner | Reviewer | Publisher | Admin | Staff | Public |
|---|---:|---:|---:|---:|---:|---:|
| Create draft | Yes | Yes | No | Yes | No | No |
| Edit draft | Yes | Yes | Limited copy fields | Yes | No | No |
| Submit for review | Yes | Yes | No | Yes | No | No |
| Approve and publish | No | Yes | No | Yes | No | No |
| Classify material change | Propose | Confirm | No | Yes | No | No |
| Send approved notice | No | Yes | Yes | Yes | No | No |
| View public brief | Yes | Yes | Yes | Yes | Yes | Yes |
| View staff supplement | Yes | Yes | Limited | Yes | Yes | No |
| Restore prior version | No | No | No | Yes | No | No |

No person should approve their own high-risk change when a second reviewer is available.

## 6. Canonical data model

### Experience

- `experience_id`
- `brand_id`
- `public_slug`
- `title`
- `experience_type`
- `lifecycle_state`
- `owner_person_id`
- `operations_reviewer_person_id`
- `timezone`
- `created_at`
- `updated_at`

### Brief version

- `brief_version_id`
- `experience_id`
- `version_number`
- `status`
- `content_snapshot`
- `created_by`
- `created_at`
- `submitted_at`
- `approved_by`
- `approved_at`
- `published_at`
- `supersedes_version_id`
- `change_classification`
- `change_summary`
- `notification_decision`
- `notification_completed_at`

### Brief section

Each section stores:

- structured values where comparison, validation, or filtering matters
- plain-language display content
- source or confirmation owner
- last-confirmed timestamp
- optional internal verification note

### Change notice

- `notice_id`
- `experience_id`
- `brief_version_id`
- `audience`
- `channels`
- `reason`
- `message_summary`
- `approved_by`
- `sent_by`
- `sent_at`
- `delivery_status`
- `manual_completion_reference`

### Public cache package

A lightweight snapshot containing essential mobile and offline-readable information:

- title
- status
- date and arrival window
- location and directions
- contact method
- what to bring
- critical changes
- last updated

## 7. Required brief sections

### 7.1 Identity and promise

Required:

- Experience title
- One-sentence promise
- Activity or experience type
- MA audience statement
- Primary host or owning team

Validation:

- Title is specific and not promotional fog
- Promise describes what a participant will actually do or receive
- No unsupported guarantee of belonging, safety, weather, outcomes, or personal connection

### 7.2 Suitability snapshot

Required structured signals:

- Physical intensity
- Experience level
- Social format
- Preparation burden
- Expected duration
- Indoor, outdoor, or mixed setting

Optional signals:

- Water exposure
- Heights
- Overnight stay
- Driving distance
- Heat, cold, rain, or low-light exposure
- Age or legal eligibility restrictions

Every signal must include a plain-language explanation.

### 7.3 Date, time, and location

Required:

- Start date and time
- End date and time or expected duration
- Timezone
- Arrival window
- Location disclosure level
- Map or directions reference

Location disclosure modes:

- Public exact address
- Public general area with exact details after registration
- Private location disclosed only to confirmed participants

The public view must explain why exact details may be withheld and when they will be provided.

### 7.4 Cost and payment

Required:

- Base cost
- Currency
- What the base price includes
- What it excludes
- Required external purchases
- Optional add-ons
- Refund, transfer, and cancellation summary
- Payment deadline where applicable

Validation:

- A participant can identify total minimum required spending
- Admission, transportation, lodging, equipment, meals, fees, and deposits are not ambiguously blended
- “Starting at” language identifies what changes the price

### 7.5 What MA provides

Structured list with quantity or limit where relevant:

- Equipment
- Meals or refreshments
- Instruction or facilitation
- Transportation
- Campsite or lodging
- Tickets or admissions
- Safety equipment
- Setup or support

### 7.6 What participants bring

Required categories where applicable:

- Clothing and footwear
- Water and food
- Personal medication
- Identification
- Equipment
- Weather protection
- Bedding or toiletries
- Spending money

Items must be labeled:

- Required
- Strongly recommended
- Optional comfort item

### 7.7 Transportation and parking

Required:

- Meet-up or departure point
- Departure and return expectations
- Parking instructions
- Carpool or rideshare availability
- What happens if a participant misses departure
- Accessibility-related transport limitations

### 7.8 Arrival and check-in

Required:

- Arrival window
- Check-in location or visual landmark
- Welcome-contact model
- Late-arrival procedure
- Contact method on the day
- What happens during the first 15 minutes

### 7.9 Schedule and experience rhythm

Use a participant-readable sequence rather than an internal production run sheet.

Required:

- Major phases
- Meal or rest windows where relevant
- Fixed-time commitments
- Approximate end or return time
- Flexible or weather-dependent segments

### 7.10 Accessibility and comfort

Required response fields, including “not yet confirmed” where facts are unavailable:

- Mobility and terrain
- Seating and rest opportunities
- Bathroom access
- Shade or indoor shelter
- Temperature exposure
- Noise and sensory conditions
- Dietary accommodation process
- Service-animal or support-person information where relevant
- Participant contact for accommodation questions

Unknown facts must produce a publish warning and visible uncertainty language, not invented certainty.

### 7.11 Weather and contingency

Required for weather-exposed experiences:

- Expected exposure
- Rain-or-shine policy
- Heat, cold, storm, water, or wind thresholds where operationally defined
- Decision time for postponement or cancellation
- Where updates will appear

### 7.12 Conduct, consent, and boundaries

Required link or summary:

- Community expectations
- Photo or media consent approach
- Personal-space and participation choice
- Alcohol or substance rules where relevant
- Participant responsibility to follow safety instructions
- How to raise a concern

The public brief links to controlling policies rather than reproducing lengthy policy text.

### 7.13 Contact and support

Required:

- Pre-event question channel
- Day-of contact method
- Response expectation
- Emergency instruction appropriate to the experience

Do not expose personal phone numbers publicly unless intentionally approved.

### 7.14 Version and source-of-truth block

Always visible:

- Current status
- Version number
- Published date
- Last updated date and time
- Plain-language change summary
- Permanent URL
- “This page is the current source of truth” statement

## 8. Brief lifecycle

### Draft

Editable and not public.

Entry conditions:

- Experience created
- Owner assigned

Exit conditions:

- Required fields complete enough for review

### In review

Locked for ordinary editing except reviewer comments or returned changes.

Review areas:

- Factual completeness
- Operational feasibility
- Cost clarity
- Accessibility uncertainty
- Legal, insurance, or venue review triggers
- Content tone and plain language

### Ready to publish

Approved but not yet public. Used when publication is scheduled.

### Published

Public and canonical.

Publication creates:

- immutable version snapshot
- stable public URL
- audit event
- search and channel-ready summary
- offline cache package

### Update in progress

The published version remains live while a new draft is edited.

### Updated

A new version replaces the prior public version. Prior versions remain auditable but are not the default public view.

### Postponed

The stable page remains public and prominently shows the postponement, known next step, and update timing.

### Canceled

The stable page remains public and prominently shows cancellation, financial handling, and contact instructions.

### Completed

The page remains accessible as a historical participant reference, with registration actions removed.

### Archived

Removed from ordinary discovery while retained according to policy.

## 9. State transition rules

| From | To | Required action |
|---|---|---|
| Draft | In review | Run validation and assign reviewer |
| In review | Draft | Return with required corrections |
| In review | Ready to publish | Reviewer approval |
| Ready to publish | Published | Publish action and audit record |
| Published | Update in progress | Create new draft from current version |
| Update in progress | Updated | Review, classify change, publish version |
| Published or Updated | Postponed | Confirm owner, reason, notice action |
| Published or Updated | Canceled | Confirm authority, participant action, notice action |
| Published or Updated | Completed | Event completion confirmation |
| Completed | Archived | Retention and discoverability decision |

Invalid transitions return a clear operator explanation and preserve the current state.

## 10. Publish readiness validation

### Blocking errors

Publication is blocked when:

- date, time, timezone, or arrival window is missing
- no responsible owner is assigned
- cost is ambiguous or required external costs are omitted
- location disclosure method is undefined
- required participant equipment is missing
- day-of contact method is missing
- cancellation or refund summary is missing for paid experiences
- suitability signals are incomplete
- exact claims conflict across fields
- critical accessibility facts are falsely represented as confirmed

### Warnings requiring acknowledgment

Publication may continue after documented acknowledgment when:

- some comfort or accessibility facts remain unconfirmed
- weather forecast is not yet available
- detailed schedule is intentionally approximate
- exact location is intentionally withheld
- transportation capacity is provisional
- optional add-ons are still being finalized but not required for participation

### Informational suggestions

- shorten dense paragraphs
- replace jargon
- add a packing checklist
- clarify who the experience is not suitable for
- add a printable summary

## 11. Material change classification

### Non-material

Examples:

- spelling correction
- formatting improvement
- added photo
- expanded explanation without changing obligation or expectation

Action:

- create new version or correction record according to implementation choice
- no participant notice required

### Important

Examples:

- schedule shift that does not change the date
- updated packing recommendation
- transportation clarification
- location instructions refined
- host or contact changed

Action:

- publish new version
- show change summary
- notify affected participants when operationally useful

### Material

Examples:

- date or location changed
- price or included service changed
- required gear changed
- transportation removed or substantially changed
- major accessibility condition changed
- experience intensity or risk profile changed
- cancellation, postponement, or shortened duration

Action:

- second-person approval where practical
- required participant notice decision
- reason and audience recorded
- delivery status tracked
- registration decision reviewed when the change affects informed choice

### Emergency

Examples:

- immediate weather or venue closure
- same-day transportation failure
- urgent safety-related change

Action:

- authorized operator may publish immediately
- audit record cannot be skipped
- retrospective review required
- visible timestamp and next update time required

## 12. Change comparison experience

Before publishing an update, the operator sees:

- changed fields
- old and new values
- likely participant impact
- proposed classification
- notification recommendation
- unresolved validation warnings

The operator must write a short human-readable summary:

> What changed, why it changed, and what participants need to do.

Raw field diffs do not replace the summary.

## 13. Participant notification workflow

1. New version approved.
2. Change classified.
3. System identifies affected audience.
4. Reviewer chooses notification requirement and channels.
5. Publisher reviews generated summary.
6. Notice sent automatically or recorded as manually sent.
7. Delivery status and failures recorded.
8. Failed delivery creates an operator exception.
9. Public brief displays the current change summary regardless of delivery status.

Possible audiences:

- all public visitors
- all registered participants
- paid participants
- transportation riders
- overnight participants
- participants selecting a changed add-on
- staff and welcome contacts

## 14. External channel rules

Facebook, Instagram, Meetup, Eventbrite, email, GroupMe, Discord, and other channels may contain:

- brief promotional summary
- key date and location area
- cost starting point
- one or two suitability signals
- call to action
- canonical link

They must not become the controlling location for:

- packing requirements
- arrival changes
- refund rules
- accessibility details
- transportation commitments
- day-of contact information

Material social posts must include the permanent brief link.

## 15. Operator workflow

### Create

- choose experience type or copy prior experience
- assign owner and reviewer
- set location disclosure mode
- complete structured sections
- save draft continuously

### Review

- run validation
- inspect warnings
- compare against source documents or venue facts
- confirm permissions and contact privacy
- submit for approval

### Publish

- preview mobile and printable views
- confirm permanent URL
- confirm publication timing
- publish immutable version
- receive publication receipt

### Update

- start from current published version
- edit only changed facts
- review field comparison
- classify impact
- publish and notify

### Cancel or postpone

- choose state
- record reason and authority
- specify participant action and financial handling
- publish visible status banner
- send or record notices

## 16. Participant experience

The mobile view prioritizes:

1. Current status and critical change banner
2. Title and one-sentence promise
3. Date, arrival window, and location disclosure
4. Suitability snapshot
5. Cost and inclusion summary
6. Primary action
7. What to bring and what MA provides
8. Transportation and arrival
9. Schedule
10. Accessibility and comfort
11. Weather and contingency
12. Conduct and contact
13. Version and change history

Essential sections support:

- anchor navigation
- copyable address or directions
- add-to-calendar action
- print or save summary
- readable cached snapshot after a successful load

## 17. Poor-connectivity behavior

When the latest version cannot be fetched:

- show the last successfully loaded snapshot
- label it with the saved timestamp
- warn that updates may exist
- keep day-of contact and directions available
- allow retry
- do not show stale registration availability as current

For staff:

- printable arrival roster and brief summary act as manual fallback
- critical changes are timestamped
- staff are trained not to rely on screenshots with no version information

## 18. Service contracts

### Create draft

`createExperienceBriefDraft(experienceId, templateId?, sourceVersionId?)`

Returns:

- draft ID
- initial section set
- owner
- validation status

### Update section

`updateBriefSection(draftId, sectionKey, payload, expectedRevision)`

Requirements:

- optimistic concurrency check
- audit record
- no silent overwrite

### Validate

`validateBrief(draftId)`

Returns:

- blocking errors
- warnings
- suggestions
- affected sections
- publish readiness

### Submit for review

`submitBriefForReview(draftId, reviewerId)`

### Approve

`approveBrief(draftId, reviewerId, acknowledgments)`

### Publish

`publishBrief(draftId, publishAt?, changeSummary?, classification?)`

Returns:

- version ID
- version number
- permanent URL
- publication timestamp
- notification requirement

### Compare versions

`compareBriefVersions(oldVersionId, newDraftId)`

### Record notification decision

`recordBriefNotificationDecision(versionId, decision, audience, channels, reason)`

### Record manual delivery

`recordManualNoticeDelivery(noticeId, channel, completedBy, completedAt, reference?)`

### Read public brief

`getPublishedExperienceBrief(publicSlug, locale?)`

### Read cached package

`getExperienceBriefCachePackage(publicSlug)`

## 19. Integration events

- `experience_brief.draft_created`
- `experience_brief.review_submitted`
- `experience_brief.review_returned`
- `experience_brief.approved`
- `experience_brief.published`
- `experience_brief.updated`
- `experience_brief.postponed`
- `experience_brief.canceled`
- `experience_brief.notice_required`
- `experience_brief.notice_sent`
- `experience_brief.notice_failed`
- `experience_brief.viewed`
- `experience_brief.saved_offline`
- `experience_brief.registration_started`

Events must not expose private operational notes or participant-specific sensitive information.

## 20. Audit and evidence rules

Record:

- actor
- action
- object and version
- before and after references
- timestamp
- reason where required
- approval and notification decision

Corrections append history. They do not erase the original published state.

The evidence record must support reconstruction of:

- what participants could see at a specific time
- which version a registration referenced
- when a material change was published
- what notification action was taken

## 21. Privacy and security

- Public briefs contain no participant roster or personal accommodation details.
- Staff supplements use role-based access.
- Personal contact information is masked unless explicitly approved for publication.
- Draft links are not guessable public URLs.
- Publication and cancellation permissions are restricted.
- Rate limiting and abuse protection apply to public endpoints.
- Logs avoid storing unnecessary query text or sensitive form values.

## 22. Accessibility requirements

- Correct heading structure
- Keyboard-operable navigation and controls
- Screen-reader labels for status, suitability signals, and change indicators
- Text alternatives for meaningful images
- No color-only status communication
- Sufficient contrast
- Responsive text scaling
- Plain-language section titles
- Printable view with logical reading order
- Accessible error summary linked to fields
- Focus moves to validation summary after failed publication attempt

## 23. Content governance

Each content field identifies:

- owning role
- source of fact
- review cadence
- whether it is structured or free text
- whether it is participant-facing or staff-only
- whether a change is likely material

Brand voice may shape headings and explanations, but controlling facts remain structured and comparable.

## 24. Analytics

Measure:

- brief views
- unique participant views
- section expansion where used
- save or print actions
- add-to-calendar actions
- registration starts from brief
- validation failures by section
- time from draft creation to publication
- number and class of updates
- notice delivery success
- participant questions that indicate missing information

Avoid vanity metrics that reward page views without preparation confidence or successful arrival.

## 25. Testing strategy

### Automated tests

- required-field validation
- invalid lifecycle transitions
- permissions
- concurrent edit conflict
- version creation
- permanent URL stability
- material-change detection suggestions
- cancellation and postponement rendering
- public cache generation
- stale-cache labeling
- notification task creation
- audit event creation

### Accessibility tests

- keyboard workflow
- screen-reader reading order
- error association
- zoom and text scaling
- contrast
- print view

### Manual scenarios

1. Publish a simple free day experience.
2. Publish a paid overnight camping experience with add-ons.
3. Withhold exact location until registration.
4. Update arrival time without changing the date.
5. Change the venue after registrations exist.
6. Remove included transportation.
7. Cancel and document refund handling.
8. Load the brief, lose connectivity, and reopen the cached summary.
9. Attempt unauthorized edit and publication.
10. Reconstruct what a participant saw before a material update.

## 26. Acceptance criteria mapping

- One published record is canonical: stable slug and immutable versions.
- Draft, published, updated, postponed, canceled, completed, and archived states are supported.
- Material changes create a reviewable notification action.
- Existing MA events can be represented through structured and plain-language sections.
- Participant view supports cached essential information after successful load.
- Permissions prevent unauthorized creation, approval, publication, and sensitive access.
- External channels reference the permanent brief rather than recreating full logistics.

## 27. Implementation sequence

1. Brief schema and lifecycle
2. Permission model
3. Operator editor and validation
4. Review and approval workflow
5. Publication and permanent URL
6. Participant mobile view
7. Version comparison and change classification
8. Notification action tracking
9. Offline cache and printable summary
10. Analytics, audit, and QA

## 28. Out of scope for Release 0.1

- Full social publishing automation to every platform
- AI-written controlling facts without human confirmation
- Dynamic pricing engine
- Complex inventory reservation
- Automated legal determination of materiality
- Full venue-management system
- Public participant comments
- Personalized recommendations beyond the PRO-19 suitability flow

## 29. Definition of done

PRO-20 is ready for implementation review when:

- data and state contracts are approved
- required sections and validation rules are approved
- participant and operator flows match the Figma prototype
- permission and audit rules are accepted
- material-change and notice workflows are testable
- poor-connectivity behavior is defined
- handoff to PRO-21 is explicit
