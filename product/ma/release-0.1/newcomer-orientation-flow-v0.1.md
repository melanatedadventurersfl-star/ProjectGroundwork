# MA Release 0.1 Newcomer Orientation and Experience-Selection Flow v0.1

Status: Draft for review
Linear: PRO-19
Depends on: PRO-11, PRO-17, PRO-18

## 1. Purpose

Create a mobile-first first-touch experience that helps a newcomer answer four questions quickly:

1. What is Melanated Adventurers?
2. Is this community for someone like me?
3. Which experience is a reasonable fit for me right now?
4. What happens after I choose?

The flow must reduce uncertainty without making guarantees about comfort, friendship, weather, difficulty, or outcomes that MA cannot control.

## 2. Product outcome

A newcomer should finish the flow able to say:

> I understand what MA is, I can see myself here, and I know which next step makes sense for me.

## 3. Scope

Included:

- MA promise, audience, and participation model
- Beginner and solo-attendee reassurance
- Consistent experience suitability signals
- Lightweight preference capture
- Experience matching and sorting
- Canonical experience brief entry
- Empty, no-fit, and unavailable states
- Orientation completion and selection analytics
- Manual content maintenance

Excluded:

- Personalized recommendation engine
- Social feed
- Public member directory
- Automated personality matching
- Guaranteed buddy pairing
- Full ticketing replacement
- Gamification

## 4. Entry points

The flow may begin from:

- MA website or landing page
- Event listing
- Social profile link
- QR code
- Email or group message
- Direct invitation
- Returning visitor who has not completed orientation

Every entry point resolves to one canonical orientation route. Event-specific links may preserve the destination event while still presenting the essential orientation content.

## 5. Core flow

### Step 1: Welcome and promise

Required content:

- Melanated Adventurers is a Black-centered outdoor and adventure community.
- The community helps people reconnect with nature, try new experiences, and build real relationships.
- Beginners, solo attendees, and experienced adventurers are welcome.
- Each experience has its own requirements and suitability information.

Primary action: `Find an experience`
Secondary action: `How MA works`

Do not imply:

- Every event is beginner-friendly
- Every attendee will form a friendship
- Every activity is physically accessible to everyone
- Gear, transport, or costs are always included

### Step 2: How participation works

Explain the MA participation rhythm:

1. Choose an experience that fits your comfort and preparation level.
2. Read one trusted experience brief.
3. Register and answer a few newcomer questions.
4. Receive a welcome contact before arrival when the experience supports it.
5. Arrive, get oriented, and meet at least one person or group.
6. Receive a follow-up and an appropriate next step.

Primary action: `See upcoming experiences`

### Step 3: Lightweight preference capture

Preference questions are optional unless required to prevent a clearly unsuitable recommendation.

Fields:

- Experience level: first time, some experience, experienced, prefer not to say
- Physical intensity preference: low, moderate, high, flexible
- Social format: small group, larger social event, either
- Attendance mode: coming solo, with someone, not sure
- Preparation comfort: minimal preparation, some preparation, comfortable with detailed preparation
- Accessibility or support prompt: optional free-text or structured request

Rules:

- Do not infer ability, health, or identity from answers.
- Do not use preferences to exclude a person from browsing.
- Show why an experience is or is not a likely fit.
- Allow all answers to be skipped.
- Store only with consent and declared retention rules.

### Step 4: Experience results

Each experience card displays the same suitability signals:

- Activity type
- Physical intensity
- Experience level
- Social format
- Preparation burden
- Date and general location
- Starting price or `Free`
- Availability state

Optional fit explanation:

- `Strong fit based on your preferences`
- `May require more preparation`
- `Higher intensity than your preference`
- `Beginner guidance available`

Never display a hidden or unexplained score.

Sorting order:

1. Available experiences with strong stated fit
2. Available experiences with partial fit
3. Available experiences without enough preference data
4. Waitlisted experiences
5. Sold-out or closed experiences, only when useful for future interest

### Step 5: Canonical experience brief handoff

Selecting a card opens the canonical brief from PRO-20.

The handoff preserves:

- Orientation completion state
- Preference context, when consented
- Source campaign or invitation
- Selected experience ID

The brief remains the controlling source for logistics, price, inclusions, preparation, arrival, accessibility, and contact information.

### Step 6: Registration handoff

When the newcomer chooses `Register`, the flow passes:

- Person or anonymous session identifier
- Experience ID
- Orientation completion timestamp
- Newcomer status
- Consented preferences
- Referral source

Registration must not require the person to repeat information already captured unless confirmation is materially necessary.

## 6. Empty and exception states

### No upcoming experiences

Message:

> Nothing is open right now, but the trail is not closed. Join the interest list and we will let you know when the next experience is ready.

Actions:

- Join interest list
- Follow MA channels
- Review what to expect at a future experience

### No strong preference match

Message:

> We do not see a perfect match yet. You can still browse every experience and decide using the full suitability details.

Actions:

- Browse all experiences
- Adjust preferences
- Ask a human

### Experience becomes unavailable

Preserve the selection context and show:

- Waitlist, when available
- Similar current experiences
- Interest notification for a future edition
- Clear explanation that availability changed

### Incomplete or unavailable data

Do not invent suitability. Display `Details being confirmed` and prevent publication when required fields from PRO-20 are missing.

### Poor connectivity

Minimum offline or low-bandwidth behavior:

- Previously loaded experience summaries remain readable
- Canonical brief can be exported or printed
- Failed preference submission does not erase entered data
- Registration handoff clearly reports whether it succeeded

## 7. Content model

Orientation content must be maintainable without a code deployment where practical.

Content objects:

### OrientationSection

- id
- title
- body
- display_order
- status
- effective_at
- expires_at
- version
- owner
- last_reviewed_at

### SuitabilityDefinition

- signal_type
- label
- plain_language_definition
- allowed_values
- display_order
- required_for_publish
- version

### ReassuranceMessage

- audience_context
- message
- prohibited_claims
- review_owner
- effective_at

Changes follow the Groundwork change-control and acknowledgment standards.

## 8. State model

OrientationSession states:

- `started`
- `promise_viewed`
- `participation_model_viewed`
- `preferences_started`
- `preferences_saved`
- `results_viewed`
- `experience_selected`
- `brief_viewed`
- `registration_started`
- `completed`
- `abandoned`

Transitions are append-only events. A later completion does not erase earlier abandonment or retry events.

## 9. Service contracts

### GetOrientationContent

Input:

- locale
- channel
- effective_at

Output:

- active content version
- ordered sections
- suitability definitions
- reassurance messages

### SaveOrientationPreferences

Input:

- session_id
- person_id, optional
- preference values
- consent record

Output:

- saved preferences
- consent version
- timestamp

### ListSuitableExperiences

Input:

- active experience filters
- optional preference context
- location radius, optional
- date range, optional

Output per experience:

- canonical brief summary
- suitability signals
- transparent fit explanations
- availability

### RecordOrientationEvent

Input:

- session_id
- event_type
- experience_id, optional
- source
- timestamp
- content_version

Output:

- event_id
- accepted_at

## 10. Analytics contract

Required events:

- `orientation_started`
- `orientation_promise_viewed`
- `orientation_how_it_works_viewed`
- `orientation_preferences_started`
- `orientation_preferences_saved`
- `orientation_preferences_skipped`
- `orientation_results_viewed`
- `orientation_empty_state_viewed`
- `orientation_no_fit_state_viewed`
- `orientation_experience_selected`
- `orientation_brief_opened`
- `orientation_registration_started`
- `orientation_completed`

Required dimensions:

- anonymous or consented person identifier
- session ID
- source channel
- content version
- experience ID where relevant
- newcomer status
- device class
- accessibility preference only when explicitly consented and necessary

Do not use analytics to create hidden behavioral labels.

## 11. Accessibility requirements

- WCAG 2.2 AA target
- Keyboard-operable web flow
- Logical heading hierarchy
- Visible focus states
- Minimum 44 by 44 touch targets
- Text scaling without clipped controls
- Screen-reader labels for suitability signals and status chips
- Meaning does not depend on color
- Plain-language alternatives for outdoor terms
- Reduced-motion behavior
- Error summaries and field-level guidance
- Preferences are not required unless clearly marked and justified

## 12. Privacy and trust controls

- Browsing requires no account.
- Preference storage requires a disclosed purpose.
- Consent and communication preferences remain separate.
- Sensitive free text is access-restricted.
- A newcomer can request correction or deletion where applicable.
- Manual operator notes do not appear in member-facing results.
- Selection explanations use declared experience facts and stated preferences only.
- No automatic adverse decision is made from orientation data.

## 13. Testing strategy

### Automated tests

- Content version resolution
- Required suitability fields
- Sorting and transparent fit explanations
- Preference skip behavior
- Empty and no-fit states
- Unavailable-experience transition
- Registration handoff payload
- Analytics event emission
- Keyboard navigation and accessible names
- Failed save and retry behavior

### Manual tests

Test with:

- First-time solo attendee
- Beginner attending with a friend
- Experienced attendee
- Person who skips every preference
- Person using screen reader and keyboard
- Person on narrow mobile display
- Person with poor connectivity
- Person selecting an experience that closes during the session

### Critical-path acceptance test

Given a newcomer with no existing account,
when they review the MA promise, skip optional preferences, browse experiences, open a canonical brief, and begin registration,
then the system records orientation progress, does not require duplicate answers, provides transparent suitability details, and preserves a usable path when no event is available.

## 14. Operational ownership

MA content owner:

- Promise and voice
- Reassurance language
- Audience and participation explanation

Experience lead:

- Accurate suitability signals
- Availability and canonical brief

Product operations:

- Content publishing
- Exception monitoring
- Analytics review
- Manual fallback

Groundwork platform:

- Shared content, state, consent, audit, and event contracts

## 15. Definition of done

PRO-19 is ready for implementation review when:

- Every Figma member screen maps to a defined state
- Copy and prohibited claims are documented
- Content can be maintained without code changes where practical
- Service and analytics contracts are defined
- Empty, no-fit, unavailable, retry, and low-connectivity states are covered
- Accessibility and privacy requirements are testable
- Automated and manual critical-path tests are enumerated
- The handoff to PRO-20 and PRO-21 is explicit
