# Host Management V1.1

## Goal
Turn the approved outing host foundation into a complete pilot-ready management workflow without adding marketplace payouts yet.

## Scope

### Outing details
Hosts can edit their own outing title, summary, description, category, difficulty, schedule, venue, city/state, capacity, and meeting instructions while the outing is not completed or cancelled.

### Ticket tiers
Hosts can add additional ticket types, update existing ticket types, deactivate ticket types, set capacity, price, and per-order limits. Paid ticket creation remains subject to paid-host permission.

### Add-ons
Hosts can create optional outing add-ons with name, description, price, capacity, max-per-order, and active state. Paid add-ons remain subject to paid-host permission.

### Attendee operations
Hosts can view attendee name, email, registration answers, ticket type, and check-in state. Manual credential check-in remains available.

### Outing lifecycle
Hosts can publish, cancel, and complete their own outings. Cancelled outings are no longer promoted. Completed outings remain available in host history and become eligible for post-outing memory/reputation workflows.

### Guardrails
- Hosts may only manage outings they created.
- Completed and cancelled outings are read-only except for post-outing workflows.
- Paid inventory requires paid-host permission.
- Cancellation does not automatically issue refunds in V1.1. Refund handling belongs to the payments milestone.
- Existing registrations are preserved when an outing is cancelled or completed.

## Pilot acceptance criteria
- Approved host can create and edit an outing.
- Host can add free ticket tiers.
- Paid-enabled host can add paid ticket tiers and add-ons.
- Host can deactivate inventory without deleting historical order references.
- Host can see attendee details and registration answers.
- Host can manually check in attendees.
- Host can cancel an outing with an explicit warning.
- Host can mark an outing completed.
- Host dashboard reflects draft, upcoming, cancelled, and completed state correctly.
