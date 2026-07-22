# Melanated Adventurers MVP Launch Hardening Runbook

## Purpose

This runbook turns the implemented MVP architecture into a deployable, testable release. Feature code is not considered production-ready until the external services, database migrations, security checks, field tests, and store builds below are complete.

## 1. Repository bootstrap

1. Install Node 22 or newer.
2. Run `npm install` from the repository root.
3. Commit the generated `package-lock.json`.
4. Run `npm run mobile:lint`.
5. Run `npm run mobile:typecheck`.
6. Do not merge a release candidate while either command fails.

The current GitHub-only build process could not generate the lockfile. CI using `npm ci` will remain blocked until a development environment installs dependencies and commits it.

## 2. Supabase environment

Create separate development, preview, and production Supabase projects.

Apply every migration in timestamp order. Then run:

- database linting
- the pgTAP suite in `supabase/tests/mvp_smoke.sql`
- RLS verification with authenticated member, host, moderator, and service-role test accounts

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or current publishable key
- `SUPABASE_SERVICE_ROLE_KEY`, server-side only
- `STRIPE_SECRET_KEY`, Edge Functions only
- `STRIPE_WEBHOOK_SECRET`, webhook function only

Never place service-role or Stripe secret keys in Expo public environment variables.

## 3. Stripe completion

1. Install the supported Stripe React Native package through Expo.
2. Add the publishable key to the mobile environment.
3. Deploy the payment-intent and webhook Edge Functions.
4. Register the Stripe webhook endpoint.
5. Verify signatures before processing events.
6. Test successful, failed, cancelled, duplicated, and delayed webhook events.
7. Confirm credentials are issued only after server-confirmed payment.
8. Confirm expired holds return inventory.
9. Test refunds and cancelled adventures before public launch.

## 4. Push, email, and SMS

Push delivery requires Expo notification credentials and real device testing. Email and SMS providers must be selected and connected to the delivery queue.

Emergency alerts must:

- ignore normal marketing preferences when legally and operationally appropriate
- remain narrowly scoped to booked or active adventures
- record every delivery attempt
- provide an in-app fallback
- avoid exposing private member or incident information

## 5. QR and offline field mode

Install and configure the Expo camera/barcode package. QR contents should carry only an opaque credential code, never private attendee details.

Offline field mode must cache:

- event roster
- credential codes
- readiness blockers needed at check-in
- schedule
- emergency contacts and procedures allowed for the staff role
- staff assignments

Queued offline writes require idempotency keys, device timestamps, sync status, conflict handling, and an audit trail. Test airplane-mode check-in and later reconciliation with duplicate scans.

## 6. Security and privacy review

Before launch:

- test every RLS policy with positive and negative cases
- verify members cannot elevate roles
- verify household managers cannot access unrelated households
- verify hosts only access assigned adventures
- verify moderators do not receive payment or sensitive health data
- verify support records remain private
- review accessibility, dietary, emergency-contact, and incident-data retention
- document account deletion and export procedures
- add Terms, Privacy Policy, Community Guidelines, waiver text, refund policy, and emergency disclaimers

## 7. Product acceptance loop

The release candidate must pass this complete journey on iOS and Android:

Account → email verification → onboarding → Explore → adventure detail → tickets → attendees → waiver → add-ons → payment → confirmation → credential → Adventure Queue → readiness task → announcement → check-in → community post → reflection → Passport.

Also test:

- free adventure
- sold-out adventure
- household/dependent registration
- expired reservation
- payment failure
- cancelled adventure
- unread critical alert
- reported community content
- no-network event check-in

## 8. Accessibility and quality

Validate screen-reader labels, keyboard behavior, dynamic text, contrast, touch targets, loading states, error recovery, empty states, and reduced-motion expectations. Test small and large phones. Verify dates, currencies, and time zones around daylight-saving changes.

## 9. EAS release process

Use `apps/mobile/eas.json` profiles:

- development for local device work
- preview for internal acceptance testing
- production for store builds

Set environment-specific Expo public variables in EAS rather than committing `.env` files. Complete app icons, splash assets, bundle identifiers, permissions copy, privacy manifests, store metadata, screenshots, and support URLs before submission.

## 10. Launch gate

Launch only when:

- migrations apply cleanly to an empty database
- smoke tests pass
- lint and type checking pass
- the dependency lockfile is committed
- payment webhooks are verified
- RLS tests pass
- QR and offline reconciliation pass on physical devices
- critical alerts reach physical devices
- the complete product acceptance loop passes on iOS and Android
- backups, monitoring, incident ownership, and rollback steps are documented

## Known external blockers

The repository now contains the application contracts and release structure, but the following cannot be completed through source-code commits alone:

- creating and configuring the live Supabase projects
- applying migrations to those projects
- entering private service credentials
- generating the package lockfile without installing dependencies
- provisioning Apple and Google signing accounts
- configuring Stripe, Expo push, email, and SMS provider dashboards
- running physical-device and store-review testing
