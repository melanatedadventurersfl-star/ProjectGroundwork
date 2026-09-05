# Host Distribution Hub V1

Status: implemented foundation

## Purpose

Host Center is the management source of truth for an event. Go Melanated is the native first-party destination. Facebook, Instagram, Eventbrite, email, SMS and future apps attach through the same provider-neutral connection model.

## Event identity

A Host Center campaign maps to one Go Melanated adventure. New duplicate active Host Center campaigns for the same adventure are blocked. Existing duplicate workspaces are not deleted automatically because they may contain tasks or history that require an explicit merge decision.

Each destination keeps its own external event identifier through `host_event_connections`.

## Native Go Melanated connection

Every Host Center campaign automatically receives a `go_melanated` event connection. Native capabilities include:

- publish event
- publish member-facing event update
- RSVP state
- tickets
- waitlist
- analytics
- member feed

The native event identifier is the Go Melanated `adventure_id`.

## Connections & Apps

`/host/connections` is the Host Center distribution hub. It presents the normalized provider registry and current connection state.

Providers in V1:

- Go Melanated
- Facebook
- Instagram
- Eventbrite
- Email
- SMS

Go Melanated is always native. External providers remain unconnected until their authorization and publishing integrations are enabled.

## Marketing composer

The event Marketing screen is a destination-aware composer.

A host can:

- create content once
- choose one or more destinations
- write shared copy
- keep external destinations planned even when they are not connected yet
- publish an event listing to Go Melanated
- publish an event update to Go Melanated

A Go Melanated marketing publish is transactional. The database operation creates the member-facing community post, records the `host_event_promotions` publication, links it to the Go Melanated event connection and marks the marketing item Published.

A manual workflow status cannot create a fake Go Melanated publication. Published status in the UI is reserved for a recorded publication action.

## Future providers

A future destination should add or extend:

1. provider definition and capabilities
2. account authorization flow
3. event connection mapping
4. provider publisher
5. inbound analytics or webhook sync
6. source attribution into the existing event analytics model

The Host Center event, tasks, guests, operations and analytics remain shared. Provider-specific event records stay mappings, not separate Host Center events.
