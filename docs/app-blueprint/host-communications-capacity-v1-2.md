# Host Communications + Capacity V1.2

## Goal
Turn the approved-host platform from a publishing tool into an operational system for real groups of people.

## Scope

### Attendee communication
Hosts can compose a message for one of three audiences:
- Registered attendees
- Checked-in attendees
- Waitlisted members

V1.2 stores the message, audience, subject, body, host, outing, and send timestamp. It intentionally does not pretend that push/email delivery has occurred. Delivery fan-out should connect this message record to the production notification/email layer in a later integration.

### Waitlist
Members can join an outing waitlist. Hosts can view the ordered queue and offer a spot to the next member. Offers receive a 24-hour claim window. Statuses support waiting, offered, claimed, expired, and removed.

### Registration questions
Hosts can add outing-specific registration questions and activate/deactivate them without deleting historical configuration. The first UI supports text questions; the schema is ready for yes/no and choice questions.

### Check-in
Existing host credential verification remains the source of truth. V1.2 documents the flow as scanner-ready. Camera QR scanning is intentionally deferred because the current Expo mobile package does not include a camera/barcode dependency, and adding one would require a new native binary rather than an OTA-only update.

## Guardrails
- Hosts only read/manage waitlists for outings they created.
- Hosts only create messages for outings they created.
- Registration questions are managed only by the outing owner.
- Published/sold-out outings expose active registration questions to members.
- Waitlist entries are unique per member per outing.
- Messaging persistence and delivery are treated as separate concerns to avoid false delivery claims.

## Next integration
1. Wire host_outing_messages into push/email delivery and delivery receipts.
2. Add checkout rendering/validation for adventure_registration_questions.
3. Add claim flow for offered waitlist positions and automatic next-person promotion.
4. Add expo-camera/barcode scanner during the next native build and feed scans into the existing credential verification function.
5. Add host communication templates for weather, meeting-point change, cancellation, and final reminders.
