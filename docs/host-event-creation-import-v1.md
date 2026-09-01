# Host Event Creation and Import V1

## Goal

Give approved hosts four clear ways to start an event from Host Center:

1. Create from Scratch
2. Start from Template
3. Import Files
4. Import from Event Site

All four paths must end in the same review-first workflow. No imported or templated data may silently change live event data.

## Product rules

- Event is the user-facing object. Campaign remains an internal implementation detail.
- Every imported field keeps source provenance.
- Imported values are proposals until the host approves them.
- Imported ticket prices, dates, policies, capacity, and guest-facing copy never publish automatically.
- Duplicate event sources should be detectable from prior import records.
- Template tasks start as Not Started.
- Template assignees default to roles, not copied profile IDs.
- Templates never copy guests, payments, incidents, check-ins, or old completion state.
- Source updates never overwrite local edits automatically.

## Host Center creation sheet

The floating plus button opens a bottom sheet with:

### Create from Scratch
Routes to the existing manual Create Adventure screen.

### Start from Template
Opens the Template Library filtered to event templates. The host selects a template, enters title, dates, location, capacity, and optional modules, then reviews the generated workspace before creation.

### Import Files
V1 supports:

- Public PDF, DOCX, TXT, HTML, image, and ZIP package URLs
- Pasted source text
- ZIP packages containing supported documents and images

The extraction service returns proposed event details, schedule, meals, ticket information, policies, images, and confidence notes.

Local native document selection is a follow-up because the mobile project does not currently include Expo DocumentPicker. The V1 import architecture is designed so native-selected files can feed the same extraction endpoint after that dependency is added.

### Import from Event Site
The host pastes a public event URL. The importer fetches public page content, extracts metadata and event details, then returns an editable preview.

Target sources include Eventbrite, Meetup, TicketTailor, Humanitix, venue pages, campground pages, festival pages, and other public event pages where the information is accessible.

## Normalized event draft

Every creation source resolves into the same draft shape:

- title
- summary
- description
- category
- difficulty
- startsAt
- endsAt
- venueName
- address
- city
- state
- capacity
- meetingInstructions
- heroImageUrl
- tickets
- schedule
- meals
- policies
- photos
- confidenceNotes

## Import preview

The preview must show:

- Source label and source URL
- Event Details section
- Schedule count
- Ticket count
- Meal count
- Policy count
- Media count
- Missing or uncertain information
- Confidence notes

The host can edit core event fields before creating the draft.

## Provenance

Each import session is stored in `host_event_imports` with:

- owner profile
- source type
- source label
- source URL
- source template ID when applicable
- extracted payload
- approved payload
- resulting adventure ID
- status
- timestamps

This supports future source refresh and field-level conflict review without changing local event data silently.

## Template instantiation

A template can contain:

- modules
- milestones
- tasks
- relative task due dates

Relative task dates use `days_before` and are calculated against event start.

Example:

- Confirm venue and rules: 120 days before event
- Finalize ticket structure: 90 days before event
- Lock meal plan: 30 days before event
- Send final guest details: 3 days before event
- Pack event equipment: 1 day before event

Creating from a template creates:

1. Draft adventure
2. General Admission ticket shell
3. Host campaign workspace
4. Milestones
5. Template tasks

## Reusable Library integration

Library items can later be applied to existing events through a review screen. V1 creation uses template items directly and preserves the same normalized draft pattern so meal plans, gear lists, policies, marketing sequences, guest messages, vendors, and ticket structures can use the same review engine.

## Security

- `host_event_imports` uses RLS.
- Hosts can read and modify only their own import records unless they are platform admin or master account.
- Creation requires approved host access.
- Import Edge Function requires JWT verification and checks approved host access.
- Event-site fetching accepts only HTTPS URLs and rejects localhost and private-network IP literals.
- External source content is treated as untrusted data.

## Acceptance criteria

- Host Center plus button exposes all four creation paths.
- Template path creates a real draft event and real internal workspace.
- Event Site path returns a reviewable normalized event draft from a public URL.
- File URL and pasted text paths return the same normalized review draft.
- Import records persist source provenance.
- Creating from an import stores the approved payload and resulting event ID.
- No imported data publishes automatically.
- Mobile lint, TypeScript validation, and production bundle smoke test pass before merge.
