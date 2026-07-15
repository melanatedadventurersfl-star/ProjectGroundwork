# MA Release 0.1 UX Screen Specification v0.1

Status: Design-ready specification  
Implements: PRO-17 planning and handoff  
Figma status: Blocked by current view-only team seat

## 1. Design outcome

The Release 0.1 experience must allow a first-time attendee to say:

> I knew what to do, someone was expecting me, I connected with people, and I want to come back.

The design must serve two connected journeys:

- **Member journey:** discover, understand, choose, prepare, connect, arrive, participate, continue.
- **Operator journey:** publish, prepare, assign, monitor, welcome, resolve, follow up, learn.

The member interface is mobile-first. Operator interfaces must remain usable on phones during events and scale to desktop for preparation and review.

## 2. Design principles

1. Show the next meaningful action, not the entire system.
2. Use plain language and explain outdoor terms when unavoidable.
3. Never make a newcomer prove they belong before receiving clarity.
4. Keep one canonical source for event information.
5. Make human ownership visible by name and role.
6. Distinguish sent, acknowledged, and completed states.
7. Distinguish check-in, welcome, orientation, and connection.
8. Surface exceptions without publicly labeling people.
9. Present privacy choices before requesting sensitive information.
10. Design manual fallback for critical event operations.

## 3. Information architecture

### Member navigation

- Home / orientation
- Experiences
- My experience
- Messages and support
- Reflection and next steps

### Operator navigation

- Experiences
- Registrations
- Welcome desk
- Arrival board
- Follow-up
- Outcomes
- Exceptions

## 4. Member screens

## M01. MA newcomer landing

Purpose: Explain MA, establish cultural and beginner relevance, and provide a clear next action.

Content:

- MA promise
- Who the community is centered around
- What participation feels like
- Beginner and solo-attendee reassurance
- Brief explanation of curated experiences
- Primary action: Explore experiences
- Secondary action: How it works

Required states:

- Upcoming experiences available
- No upcoming experiences
- Returning visitor
- Accessibility text-size and reduced-motion support

Success event: `OrientationStarted`

## M02. How MA works

Five-part orientation:

1. Choose an experience that fits
2. See exactly what to expect
3. Prepare with one trusted guide
4. Meet a welcome contact before arrival
5. Leave with a next step, not a dead end

Actions:

- Continue to experiences
- Ask a question

Success event: `OrientationCompleted`

## M03. Experience discovery

Each experience card shows:

- Title and date
- Activity type
- Physical intensity
- Experience level
- Social format
- Preparation burden
- Cost starting point or free status
- Availability state

Filters remain simple and optional.

Required states:

- Results
- No matches
- Waitlist only
- Canceled or changed experience
- Poor connectivity skeleton and retry

## M04. Experience fit details

Purpose: Help someone judge fit without decoding outdoor jargon.

Sections:

- What you will do
- Who this is a good fit for
- What may feel challenging
- Experience and fitness expectations
- Solo-attendee expectation
- What is provided
- What you bring
- Accessibility summary

Action: View full experience brief

## M05. Canonical experience brief

Sticky metadata:

- Version / last updated
- Status
- Date, time, and place
- Contact

Sections:

- Overview
- Suitability
- Cost and inclusions
- Gear needed versus provided
- Transportation
- Accessibility
- Arrival
- Schedule
- Expectations and policies
- Changes and cancellation

Material change state:

- Visible banner
- Plain-language change summary
- Acknowledge update action when required

Offline behavior:

- Allow printable or saved fallback where feasible
- Show last synchronized timestamp

## M06. Registration

Steps:

1. Identity and contact preference
2. Newcomer status
3. Preparation and comfort questions
4. Accessibility or operational needs
5. Communication and introduction consent
6. Review and submit

Trust controls:

- Explain why each non-obvious field is requested
- Separate required from optional
- Do not imply that submitting equals agreeing to unrelated policies
- Link controlling terms and brief version

Required states:

- Saved draft
- Validation errors
- Capacity reached
- Waitlist
- Consent declined with supported alternative path

## M07. Registration confirmation

Shows:

- Confirmed or waitlist state
- Canonical brief link and version
- Preparation checklist
- Expected welcome-contact timeline
- Communication preferences
- Add to calendar
- Change or cancel registration

## M08. My experience dashboard

Timeline:

- Registered
- Brief reviewed
- Preparation check
- Welcome contact assigned
- Introduction acknowledged
- Arrival instructions ready
- Experience completed
- Reflection and next step

The design shows current state and next action, not internal workflow jargon.

## M09. Welcome-contact introduction

Shows:

- Welcome contact name and role
- Why they are contacting the newcomer
- Approved contact channel
- Backup support route
- Acknowledge introduction
- Ask a question
- Opt out of direct contact while keeping support

Required states:

- Assignment pending
- Introduction sent
- Acknowledged
- Question open
- Reassignment in progress
- Contact unavailable

## M10. Preparation confidence check

Question:

- How prepared do you feel right now?

Response options use a short labeled scale.

Follow-up actions depend on response:

- Review brief
- Ask welcome contact
- Request transportation or gear guidance
- Contact organizer

No response triggers punishment or public labeling.

## M11. Arrival card

Optimized for event-day use:

- Location and wayfinding
- Arrival window
- What to look for
- Named welcome or check-in contact
- Backup phone or channel
- Late-arrival action
- Accessibility arrival notes
- Saved brief status

## M12. Post-experience reflection

Questions:

- Were you personally welcomed?
- Did you make at least one meaningful connection?
- Did the experience match what you expected?
- Would you attend another MA experience?
- Is there anything we should follow up on privately?

Actions:

- Submit
- Request follow-up
- Skip optional questions

## M13. Continue with MA

Shows one or two intentional options:

- Next appropriate experience
- Reconnect through an approved shared channel
- Help at a future event
- Explore contributor pathway

Avoid infinite feed behavior and pressure-heavy engagement tactics.

## 5. Operator screens

## O01. Experience workspace

Shows:

- Experience status
- Publish-readiness progress
- Registration count
- Newcomer count
- Welcome assignment progress
- Open exceptions
- Arrival readiness
- Follow-up readiness

## O02. Experience editor

Structured editor matching the canonical brief sections.

Controls:

- Required-field validation
- Preview participant view
- Save draft
- Submit for review
- Publish
- Publish material change
- Cancel experience

Material changes require:

- Change summary
- Effective time
- Notification audience
- Acknowledgment requirement decision

## O03. Registration roster

Columns or cards:

- Participant name
- Registration state
- Newcomer state
- Preparation confidence
- Welcome assignment
- Introduction acknowledgment
- Operational needs indicator
- Arrival state
- Exception indicator

Privacy:

- Sensitive details appear only on authorized drill-down
- Export honors role restrictions

## O04. Welcome assignment board

Views:

- Unassigned newcomers
- Assigned, introduction not sent
- Introduction sent, awaiting acknowledgment
- Question open
- Reassignment needed
- Ready for arrival handoff

Actions:

- Assign contact and backup
- Record manual introduction
- Reassign
- Open exception
- Mark resolved

## O05. Welcome-contact personal queue

Shows only assigned newcomers.

For each assignment:

- Name
- Experience
- Approved contact route
- Introduction deadline
- Preparation question indicator
- Acknowledge assignment
- Record contact
- Request reassignment
- Escalate unresolved issue

## O06. Pre-event exception queue

Categories:

- No welcome contact
- Introduction overdue
- Unanswered question
- Material brief update not acknowledged
- Accessibility or transportation need unresolved
- Communication delivery failure

Each exception shows owner, due time, observed facts, and next approved action.

## O07. Arrival board

Mobile-first live board grouped by:

- Expected
- Checked in, not greeted
- Greeted, not oriented
- Oriented, not connected
- Connected
- Late or exception
- No-show

Actions are one-tap where safe:

- Check in
- Record greeting
- Record orientation
- Record first connection
- Assign backup
- Open exception

Timers:

- 15-minute review
- 45-minute unresolved review

## O08. Newcomer arrival detail

Shows only event-relevant data:

- Name
- Welcome contact and backup
- Arrival status
- Operational accommodations
- Introduction and preparation state
- Arrival actions
- Exception history

Confidential recovery or unrelated historical records are excluded.

## O09. Follow-up queue

Groups:

- Due within 48 hours
- Sent, reflection pending
- Recovery requested
- Next step offered
- Follow-up complete

Actions:

- Send or record thank-you
- Review reflection
- Assign recovery owner
- Offer next experience
- Offer helper path

## O10. Recovery intake and routing

Shows:

- Factual intake summary
- Source
- Privacy classification
- Conflict-of-interest check
- Owner
- Interim action
- Routing status

The interface clearly separates:

- Report or allegation
- Supporting evidence
- Finding
- Decision

## O11. Outcomes dashboard

Experience-level measures:

- Activation
- Preparation confidence
- Personal welcome completion
- Meaningful connection
- Intent to return
- Actual return
- Progression

Supporting diagnostics:

- Welcome assignment completion
- Material change acknowledgment
- Exception categories
- Follow-up completion

Rules:

- Label small samples
- Keep attendance and belonging distinct
- Show comments only to authorized reviewers
- Link metric definitions

## O12. Learning review

Sections:

- What worked
- What created friction
- Participant evidence
- Operator observations
- Exceptions and recoveries
- Process versus individual factors
- Preserve, change, test, or stop decisions
- Follow-up Linear issues

## 6. Cross-cutting components

Required reusable components:

- Experience suitability badge
- Status stepper
- Canonical-record banner
- Version and last-updated chip
- Material-change alert
- Consent explanation panel
- Named-owner card
- Acknowledgment control
- Exception card
- Privacy-level indicator
- Timeline event
- Metric definition tooltip
- Offline/synchronization banner

## 7. Error and edge states

Design all of the following before handoff:

- No upcoming experiences
- Experience full or waitlisted
- Experience canceled
- Material change after registration
- Registration started but incomplete
- Duplicate person or registration resolution
- No welcome contact available
- Welcome contact does not respond
- Member opts out of direct introduction
- Message delivery fails
- Late arrival
- Walk-in newcomer
- Participant appears without registration
- Offline check-in
- Accessibility need discovered at arrival
- Newcomer leaves before connection
- Follow-up message fails
- Negative reflection or recovery request
- Role conflict prevents assigned reviewer from handling a case

## 8. Accessibility requirements

- WCAG-aligned contrast and focus visibility
- Keyboard-complete desktop workflows
- Screen-reader labels and state announcements
- Text scaling without clipped actions
- Plain-language errors
- No color-only status meaning
- Reduced-motion support
- Touch targets appropriate for event-day mobile use
- Printable fallback for arrival and roster operations

## 9. Prototype flow map

### Member prototype path

M01 → M02 → M03 → M04 → M05 → M06 → M07 → M08 → M09 → M10 → M11 → M12 → M13

### Operator prototype path

O01 → O02 → O03 → O04 → O05/O06 → O07 → O08 → O09 → O10 → O11 → O12

### Exception prototype path

Material change → acknowledgment pending → operator queue → member acknowledgment → resolved

No welcome contact → overdue exception → backup assignment → introduction → arrival handoff

Late arrival → arrival exception → backup greeter → orientation → first connection

Negative reflection → recovery intake → conflict check → assigned review → outcome

## 10. Figma file structure

When edit access becomes available, create a design file named:

**MA Release 0.1 — Member & Operator Experience**

Pages:

1. `00 Cover & Flow Map`
2. `01 Foundations`
3. `02 Components`
4. `03 Member Mobile`
5. `04 Operator Mobile`
6. `05 Operator Desktop`
7. `06 Edge & Failure States`
8. `07 Prototype Paths`
9. `08 Handoff Notes`

Frames should be named using the IDs in this document, for example:

- `M05 Canonical Experience Brief`
- `O07 Arrival Board`

## 11. Design completion criteria

PRO-17 can move to review only when:

- All listed member and operator surfaces exist in Figma
- The prototype covers happy, exception, and recovery paths
- Mobile member and arrival workflows are interactive
- Permissions and privacy boundaries are visible in the design
- Design states match the PRO-18 domain model
- Critical accessibility annotations are included
- Figma file is linked in Linear and GitHub

Until a writable Figma seat is available, this specification is the authoritative design handoff, not a substitute for the required prototype.
