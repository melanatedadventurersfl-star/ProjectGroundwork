# 16. API and Integration Plan

## Purpose

This chapter defines how the member app, admin tools, external services, and future modules exchange data. The goal is a stable service layer that protects the product from becoming tangled as new features arrive.

## Architectural Direction

The launch platform should use a modular backend with a single public application API. Internally, functionality may be separated by domain, but the member app should not need to understand the boundaries between services.

Recommended domains:
- Identity and Membership
- Adventures and Registration
- Payments
- Attendance and Check-In
- Passport and Progress
- Community and Media
- Campfire and Notifications
- Safety and Moderation
- Administration and Reporting

## API Principles

1. Version all externally consumed endpoints.
2. Authorize every request at the resource level.
3. Keep payment credentials outside the platform.
4. Make writes idempotent where duplicate requests could cause harm.
5. Use pagination for growing collections.
6. Return stable error codes and human-readable messages.
7. Log sensitive administrative actions.
8. Design for intermittent mobile connectivity.
9. Separate synchronous user actions from background jobs.
10. Never expose internal database structure directly as the public contract.

## Core Endpoint Groups

### Authentication and Session

```text
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/logout
POST /v1/auth/refresh
POST /v1/auth/password/reset
GET  /v1/session
```

### Member

```text
GET   /v1/me
PATCH /v1/me
GET   /v1/me/preferences
PATCH /v1/me/preferences
GET   /v1/members/{memberId}
```

Private fields must never be returned by public profile endpoints.

### Trailhead

```text
GET   /v1/trailhead
GET   /v1/trailhead/layout
PUT   /v1/trailhead/layout
```

The Trailhead response should aggregate tile-ready summaries to prevent the app from making a flock of tiny requests every time it opens.

### Adventures

```text
GET  /v1/adventures
GET  /v1/adventures/{adventureId}
GET  /v1/adventures/{adventureId}/availability
POST /v1/adventures/{adventureId}/bucket-list
DELETE /v1/adventures/{adventureId}/bucket-list
```

Filters may include date, category, difficulty, location, chapter, availability, and experience level.

### Registration and Payment

```text
POST /v1/adventures/{adventureId}/registrations
GET  /v1/registrations/{registrationId}
POST /v1/registrations/{registrationId}/checkout-session
POST /v1/registrations/{registrationId}/cancel
POST /v1/registrations/{registrationId}/transfer-request
```

Payment provider webhooks update payment records asynchronously.

### Preparation

```text
GET   /v1/registrations/{registrationId}/preparation
PATCH /v1/registrations/{registrationId}/preparation/checklist
POST  /v1/registrations/{registrationId}/waivers
```

### Check-In and Attendance

```text
POST /v1/check-in/scan
POST /v1/check-in/code
GET  /v1/adventures/{adventureId}/attendance/me
```

Offline check-in actions should queue with a client-generated idempotency key and synchronize later.

### Passport

```text
GET /v1/passport
GET /v1/passport/stamps
GET /v1/passport/trail-marks
GET /v1/passport/journey
POST /v1/passport/journey
PATCH /v1/passport/journey/{entryId}
```

### Community

```text
GET    /v1/community/posts
POST   /v1/community/posts
GET    /v1/community/posts/{postId}
PATCH  /v1/community/posts/{postId}
DELETE /v1/community/posts/{postId}
POST   /v1/community/posts/{postId}/comments
POST   /v1/community/posts/{postId}/reactions
```

### Campfire

```text
GET  /v1/campfire
POST /v1/campfire/{activityId}/read
POST /v1/campfire/read-all
GET  /v1/campfire/preferences
PATCH /v1/campfire/preferences
```

### Media

Use signed upload URLs rather than routing large media files through ordinary API requests.

```text
POST /v1/media/upload-request
POST /v1/media/{mediaId}/complete
DELETE /v1/media/{mediaId}
```

### Safety and Reporting

```text
POST /v1/reports
GET  /v1/reports/{reportId}/receipt
POST /v1/content/{contentId}/report
POST /v1/members/{memberId}/block
```

Administrative safety endpoints must use separate scopes and audit logging.

## Background Jobs

Background processing is appropriate for:
- payment webhook reconciliation
- email, SMS, and push delivery
- image resizing and moderation scans
- Passport stamp issuance
- Trail Mark progress evaluation
- weather refreshes
- Campfire generation
- event reminders
- exports and analytics aggregation

## Webhooks

Expected inbound webhooks:
- payment provider
- email delivery provider
- SMS provider
- push notification provider
- optional ticketing partner during transition

Expected outbound webhooks later:
- chapter systems
- partner event tools
- Build-A-Camp operations

Every webhook must be signed, timestamp checked, replay protected, and idempotently processed.

## Integration Priorities

### Launch Critical

- Payment processor
- Transactional email
- Push notifications
- SMS for critical operational alerts
- Maps and geocoding
- Media storage and delivery
- Weather provider
- Error monitoring
- Product analytics

### Transitional

If existing events continue to use Eventbrite or another ticket platform, create an import/synchronization layer rather than forcing a risky all-at-once migration.

### Later

- Calendar export and subscriptions
- Chapter management tools
- Build-A-Camp inventory and staffing
- Volunteer systems
- AI trip planning
- campground and park data
- rental marketplace

## Error Contract

Every API error should include:

```json
{
  "code": "REGISTRATION_SOLD_OUT",
  "message": "This adventure has reached capacity.",
  "request_id": "...",
  "details": {}
}
```

The app must not infer business meaning from HTTP status alone.

## Offline Strategy

Cache:
- upcoming registered adventures
- preparation details
- QR check-in credential
- essential itinerary
- emergency contacts and venue directions
- recent Passport summary

Queue safely:
- checklist changes
- check-in attempts
- draft Journey notes
- read-state updates

Do not queue blindly:
- payments
- cancellations near deadlines
- ticket transfers
- safety reports requiring immediate delivery confirmation

## Security Controls

- TLS everywhere
- short-lived access tokens
- refresh-token rotation
- rate limiting
- input validation
- signed media URLs
- least-privilege service credentials
- secrets stored outside source control
- audit logs for administrative actions
- webhook signature verification

## Observability

Track:
- request latency
- error rate
- registration conversion failures
- payment reconciliation lag
- notification delivery failures
- check-in synchronization failures
- media processing failures
- Passport issuance delays

## Current Decisions

- Trailhead receives an aggregated payload.
- Payment processing is delegated to a compliant provider.
- Check-in supports offline queuing.
- Media uses direct signed uploads.
- Campfire records and external deliveries are separate.
- API contracts are versioned from launch.

## Open Questions

- Which payment and ticketing providers will be selected?
- Will launch use a REST-only API or add subscriptions for selected live updates?
- How long will Eventbrite synchronization remain necessary?
- Which weather data must be stored versus fetched on demand?
