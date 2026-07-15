# MA Member Web v0.1

This is the first production-oriented application slice for the Melanated Adventurers member experience.

## Included

- Public early-access waitlist
- Consistent prospective-member and access-status terminology
- Local duplicate detection for prototype review
- Operator waitlist and cohort-status preview
- Castaway Island Preserve pilot experience shell
- Supabase schema for people, roles, experiences, registrations, and status history
- Environment placeholders for Supabase and Stripe

## Current data mode

The UI currently uses browser localStorage so it can be reviewed without credentials. The production schema is in `supabase/schema.sql`. The next implementation step is replacing the local adapter with Supabase server actions, authentication, operator authorization, and auditable writes.

## Run locally

```bash
cd apps/member-web
npm install
npm run dev
```

Open `http://localhost:3000`.

## Terminology

- Waitlist registrant: person who submitted the public early-access form
- Prospective member: interested person without approved app access
- Invited member: approved person who received an activation invitation
- Active member: person with an activated account
- Participant: person registered for an experience
- Attendee: participant who checked in
- Newcomer: participant attending their first MA experience
- Operator: authorized administrative user
- Welcome contact: person assigned to support a newcomer
- Cohort: group granted app access together

Access status and member role are deliberately separate.

## Next build slice

1. Create Supabase project and apply the schema.
2. Implement public waitlist server action with rate limiting and consent versioning.
3. Add operator authentication and role-based access.
4. Add approve, invite, activate, pause, and decline mutations with status history.
5. Add email invitation delivery.
6. Implement Castaway registration, optional lunch checkout, optional donation, and no-show tracking.
7. Add automated tests and accessibility validation.
