# Technical Architecture, Engineering Backlog, and Project Bootstrap

## 1. Architecture Decision

### Mobile application
- Expo SDK 57
- React Native
- TypeScript
- Expo Router for file-based navigation, deep links, tabs, and web compatibility
- React Query for server-state caching and retries
- Zustand for small local UI state only
- React Hook Form plus Zod for forms and validation
- Expo SecureStore for sensitive local tokens and device data
- Expo Notifications for push delivery
- Expo SQLite for offline event essentials and queued actions

### Backend
- Supabase
- PostgreSQL as the primary relational database
- Supabase Auth for identity and session management
- Row Level Security for member, guardian, household, host, and adventure-scoped permissions
- Supabase Storage for profile images, adventure media, waivers, and operational files
- Supabase Edge Functions for privileged workflows, payment orchestration, alerts, and webhooks
- Realtime reserved for operational updates and selected Campfire activity, not every screen

### Payments
- Stripe React Native SDK
- Stripe PaymentSheet for checkout
- PaymentIntents created only from trusted server-side functions
- Webhooks determine final payment state
- The app never treats a client-side success screen as the source of truth

### Host tools
- The first host interface will use the same universal Expo application with role-gated routes
- A separate web administration surface may be extracted later if operational complexity requires it
- No separate worker application in the Melanated Adventurers product

### Delivery and operations
- GitHub for source control and engineering backlog
- GitHub Actions for linting, type checks, tests, and migration validation
- Expo Application Services for native builds, preview releases, updates, and store submissions
- Sentry for production error monitoring
- PostHog or an equivalent privacy-conscious analytics provider after consent rules are finalized

## 2. Repository Structure

```text
apps/
  mobile/
    app/
      (auth)/
      (tabs)/
      adventures/
      checkout/
      host/
      _layout.tsx
    src/
      components/
      features/
      hooks/
      lib/
      services/
      state/
      theme/
      types/
      validation/
    assets/
packages/
  domain/
  ui/
  config/
supabase/
  migrations/
  functions/
  seed/
docs/
  app-blueprint/
  architecture/
  engineering/
.github/
  workflows/
```

The repository may begin with only `apps/mobile`, `supabase`, and documentation. Shared packages should be extracted only after duplication appears.

## 3. Engineering Principles

1. Use the blueprint as the product source of truth.
2. Keep domain logic outside route components.
3. Use database constraints and Row Level Security, not client trust, for authorization.
4. Build offline support narrowly around event-critical information.
5. Treat minors, guardianship, emergency information, and payment data as high-risk domains.
6. Avoid premature service splitting. Begin with a modular monolith backed by PostgreSQL and Edge Functions.
7. Each feature must include loading, empty, error, offline, and permission-denied behavior.
8. No direct messaging at launch.
9. Build-A-Camp and Beerded Empire remain outside this application.

## 4. MVP Engineering Backlog

### Milestone 0: Foundation
- Bootstrap Expo TypeScript application
- Configure Expo Router
- Add linting, formatting, type checking, and test commands
- Add environment variable validation
- Create theme tokens from the documented design system
- Add Supabase client configuration
- Establish database migration workflow
- Add CI checks

### Milestone 1: Identity and onboarding
- Email registration and verification
- Sign-in, sign-out, password recovery, and session restoration
- Member profile creation
- Interests, location, accessibility, and communication preferences
- Household creation and dependent records
- Guardian relationships and permissions
- First-time Trailhead state

### Milestone 2: Adventures and discovery
- Adventure data model
- Host adventure creation and publishing
- Explore feed
- Search and filters
- Adventure detail
- Save and unsave adventures
- Availability and ticket state display

### Milestone 3: Registration and payment
- Ticket types and inventory holds
- Registration questions
- Guests and dependents
- Waiver acceptance
- Add-ons
- Stripe PaymentSheet integration
- Payment webhook reconciliation
- Confirmation and QR credential generation

### Milestone 4: Readiness and communication
- Readiness requirement templates
- Member readiness tasks
- Readiness score and blockers
- Next Best Action
- In-app notification center
- Push and email delivery rules
- Host announcements
- Emergency alert workflow

### Milestone 5: Live adventure operations
- Host roster
- QR and manual check-in
- Offline participant essentials
- Live schedule
- Headcounts
- Staff assignments
- Incident records
- Operational announcements

### Milestone 6: Community and reflection
- Community posts
- Adventure-scoped Campfire activity
- Comments and reactions
- Reporting and moderation
- Experience records
- Reflection flow
- Journey timeline
- Basic Passport awards

### Milestone 7: Launch hardening
- Accessibility audit
- Security and Row Level Security audit
- Payment failure and refund testing
- Offline and synchronization testing
- Load and performance checks
- Privacy and consent review
- Store assets and release process
- Pilot event and production launch

## 5. Critical Build Order

The first usable vertical slice is:

1. Account creation
2. Member profile
3. Published adventure
4. Adventure detail
5. Registration
6. Payment confirmation
7. Readiness tasks
8. Host roster
9. Check-in
10. Reflection and Experience Record

This slice proves the full business loop before deeper community, awards, and operational tooling are expanded.

## 6. Initial Database Modules

- identity
- profiles
- households
- guardianship
- adventures
- ticketing
- registrations
- payments
- readiness
- communications
- check_in
- community
- experiences
- passport
- operations
- audit

Each module receives migrations, constraints, policies, and tests before its UI is considered complete.

## 7. Launch Decisions Locked by This Document

- Universal Expo application for iOS, Android, and a limited web surface
- Supabase modular backend
- PostgreSQL as the system of record
- Stripe for payments
- Role-gated host tools inside the same codebase for MVP
- GitHub Actions plus Expo Application Services for delivery
- Offline support focused on tickets, schedule, check-in, emergency details, and queued operational actions
- No direct messages
- No Build-A-Camp or Beerded Empire functionality

## 8. Immediate Implementation Sequence

1. Create the Expo application in `apps/mobile` using the current Expo Router TypeScript template.
2. Add the documented route groups and theme skeleton.
3. Create a Supabase development project and local migration directory.
4. Implement the first migration for profiles, households, and roles.
5. Build authentication and the first-time Trailhead shell.
6. Add CI before feature work expands.

Planning is now complete. New documentation should support an active engineering task, resolve an implementation decision, or record a change to the blueprint.