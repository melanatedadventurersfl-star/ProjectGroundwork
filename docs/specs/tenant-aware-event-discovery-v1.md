# Tenant-aware event discovery V1

## Goal

An organization that adopts the Experience Platform must get an event discovery surface scoped to its own Public Experience instead of inheriting Go Melanated's outdoor-specific Explore experience.

## Variants

### `outdoor_adventure`

Preserves the existing Go Melanated Explore experience, including:

- outdoor activity categories
- location and distance tools
- adventure-oriented language
- Go Melanated local outings
- existing outdoor discovery behavior

Go Melanated is explicitly configured to use this variant.

### `community`

Reusable organization-branded event discovery.

It reads the active organization's:

- Public Experience ID
- brand name
- brand colors
- Events terminology

It queries `public.adventures` with `public_experience_id = active experience` and published/sold-out status. It does not load the legacy shared `local_event_discovery` feed.

The first reusable Community version includes:

- organization-scoped events
- dynamic categories based on that organization's events
- text search
- featured event treatment
- upcoming event list
- saved-event state
- organization-specific empty states and language

## Isolation rule

A branded organization event catalog must never rely on a client-side result set containing every organization's events and then merely hide other tenants after rendering.

The database query includes the Public Experience boundary before records are returned to the screen.

## Current compatibility rule

If `navigation.events_variant` is absent:

- an `outdoor_adventure` Home implies the outdoor Explore variant
- all other experiences resolve to the reusable Community variant

This protects existing Go Melanated behavior while making new Community experiences reusable by default.

## Deferred

- platform-wide opt-in discovery across organizations
- partner cross-promotion
- tenant-scoped local/community-created events
- organization-defined advanced filters
- custom event taxonomy editor

Those should be explicit distribution capabilities rather than accidental cross-tenant visibility.
