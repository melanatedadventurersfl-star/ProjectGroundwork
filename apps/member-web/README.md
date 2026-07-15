# MA Member Web v0.1

This is the first production-oriented application slice for the Melanated Adventurers member experience.

## Included

- Public early-access waitlist backed by Supabase
- Invitation-gated magic-link authentication
- Operator role checks, cohort controls, and auditable status history
- Operator-controlled invitation delivery
- Castaway pilot registration
- Optional lunch and support through Stripe Checkout
- Stripe webhook reconciliation
- Supabase schema for people, roles, experiences, registrations, payments, and access history
- GitHub Actions typecheck and build validation

## Required services

- Supabase project
- Stripe account
- Deployed Next.js environment
- Email delivery through Supabase Auth or configured SMTP

Copy `.env.example` to `.env.local`, apply `supabase/schema.sql`, and provide the required credentials before starting the app.

## Run locally

```bash
cd apps/member-web
npm install
npm run typecheck
npm run dev
```

Open `http://localhost:3000`.

## Payment flow

1. A participant submits the Castaway registration form.
2. The app creates a registration immediately.
3. Lunch or support selections create a Stripe Checkout Session.
4. Stripe returns the participant to the Castaway page.
5. The signed webhook marks the payment paid and the registration confirmed.

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

1. Create live Supabase and Stripe environments.
2. Deploy the schema and establish the first operator.
3. Add rate limiting, abuse protection, and consent-version records.
4. Add capacity enforcement, waitlisting, cancellation, and no-show operations.
5. Add refund handling and webhook idempotency tests.
6. Add welcome-contact assignments and event-day check-in.
7. Run accessibility and permission tests against the deployed environment.
