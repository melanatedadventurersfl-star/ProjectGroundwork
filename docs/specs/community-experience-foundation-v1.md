# Community Experience Foundation V1

## Goal

Make Go Melanated the first configured implementation of a reusable public community experience instead of the parent product that every future organization must inherit.

The platform model is now:

```text
Experience Platform
  -> Organization
      -> Internal operations workspace
      -> Public experience
          -> Blueprint
          -> Branding
          -> Terminology
          -> Modules
          -> Home layout
          -> Membership settings
          -> Published events
```

Go Melanated is Organization #1 and Community Experience implementation #1.

A future organization such as JaxBlack should use the same platform infrastructure while owning its own public experience, branding, terminology, modules, events and data.

## New platform objects

### `experience_blueprints`

Platform-level reusable experience definitions.

V1 seeds:

- `community`

The Community Experience blueprint is intentionally generic. It supports home, events, community, profiles, groups, directory, calendar, notifications, memberships, search and saved content.

### `organization_experiences`

Organization-owned public product configuration.

Each experience stores:

- organization ownership
- stable experience key
- public slug
- blueprint
- lifecycle status
- branding
- navigation settings
- terminology
- home layout
- membership settings
- public settings

V1 creates one `primary` experience for Go Melanated.

### `organization_experience_modules`

Configures which capabilities appear in a specific public experience and what the organization calls them.

Go Melanated currently maps:

- `home` -> Trailhead
- `events` -> Explore
- `community` -> Outpost
- `directory` -> Trail Guide
- `journey` -> Passport
- `memberships` -> Go+

Outdoor-specific modules carry pack metadata rather than becoming part of the generic Community blueprint.

## Event publishing relationship

`adventures.public_experience_id` now records the public experience an event belongs to.

The database automatically assigns an organization's primary experience when an event has organization ownership and no public experience was selected.

A trigger rejects any event whose `platform_organization_id` does not match the selected public experience's organization.

This separates two concepts:

- organization ownership
- public distribution target

V1 does not create cross-organization distribution. Partner publishing, shared discovery and external distribution remain separate later work.

## Security

The new public-schema tables use RLS and explicit grants.

- authenticated organization members can read their organization's experience configuration
- organization admins with `organization.settings.manage` can manage organization experience configuration
- platform operators can manage blueprints and support tenant configuration
- anonymous access is intentionally not enabled yet
- event-to-experience organization matching is enforced in the database

Public anonymous rendering will get a deliberately limited publication surface rather than opening the internal configuration tables.

## Go Melanated migration

The migration creates the Go Melanated `primary` Community Experience with the current product language and palette so current behavior remains intact.

All existing events are linked to that experience.

The migration does not rename current member screens or remove outdoor features.

## Mobile foundation

`src/platform/experience.ts` provides organization-aware access to:

- the active public experience
- branding
- terminology
- enabled modules
- publishing target

Host Center now uses the active organization's name instead of a hard-coded `GO MELANATED` header.

Host Center also includes a `Public Experience` screen so the active organization's current blueprint, branding, language, modules and publishing target can be inspected.

## Hard-coded extraction audit

The first audit found organization-specific assumptions in several classes of code.

### Brand identity

Examples include:

- Host Center headers
- release notes
- login and onboarding copy
- app configuration comments and assets
- privacy and product documentation

These must be separated into platform identity versus organization experience identity. Native app-store identity is a later white-label layer and should not be confused with runtime organization branding.

### Product terminology

Current product labels include:

- Trailhead
- Explore
- Outpost
- Trail Guide
- Passport
- Go+

These are valid Go Melanated terms. They should remain as configuration for Go Melanated rather than becoming required platform vocabulary.

### Outdoor-specific capabilities

Current outdoor-specific areas include:

- Trail Guide
- Passport and adventure journey
- outdoor ranks
- camping and readiness concepts
- outdoor-specific recommendations and AI context

These belong in an Outdoor & Adventure pack or Go Melanated configuration, not the reusable Community Experience core.

## Next implementation sequence

1. Add editable organization experience setup controls for branding, terminology and modules.
2. Make member-facing navigation read organization experience configuration.
3. Convert the member home surface into configurable sections.
4. Separate Outdoor & Adventure capabilities from the Community Experience core.
5. Add public publishing visibility and a safe anonymous/public rendering surface.
6. Provision a second controlled organization and validate tenant isolation with different roles.
7. Add internal organization provisioning so a second tenant can be created without direct SQL.

## Non-goals for V1

- billing
- custom domains
- dedicated app binaries
- full customer self-service setup
- cross-organization marketplace discovery
- public anonymous configuration access
- custom role builder
- arbitrary customer code forks
