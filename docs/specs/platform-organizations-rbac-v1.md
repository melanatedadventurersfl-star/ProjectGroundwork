# Platform Organizations + RBAC V1

## Purpose

Turn the current single-brand application into an organization-aware platform without breaking Go Melanated, Host Center, Vendor Center, or Founder Overwatch.

## V1 goals

1. Make Organization the top-level tenant boundary.
2. Make Go Melanated the first/default organization.
3. Let one profile belong to multiple organizations.
4. Let one profile hold multiple roles per organization.
5. Persist an active organization for workspace switching.
6. Resolve capability access through organization permissions.
7. Add organization ownership to the main operational records already in production.
8. Preserve the existing `host_organizations` model during migration.

## Non-goals

V1 does not build:

- custom organization roles
- SaaS billing
- organization self-service signup
- workforce profiles or job marketplace
- white-label domains
- enterprise SSO
- organization invitation UI
- a full platform-admin organization console

The data model is designed so those can follow without replacing the V1 tenant boundary.

## Core model

```text
profiles
   │
   ├── organization_memberships ── organizations
   │          │
   │          └── organization_member_roles
   │                        │
   │                        └── organization_system_roles
   │                                  │
   │                                  └── organization_role_permissions
   │                                                   │
   │                                                   └── organization_permissions
   │
   └── profile_workspace_preferences
                │
                └── active_organization_id
```

A profile is global. Organization membership determines where that person participates. Organization roles determine what the person can do there.

## Organization

Required properties:

- `id`
- `name`
- `slug`
- `kind`
- `status`
- `visibility`
- branding assets/settings
- creator
- platform-default marker
- timestamps

Organization status:

- active
- suspended
- archived

V1 organization kinds:

- community
- company
- nonprofit
- brand
- team
- other

## Organization membership

Membership is separate from role.

A member can be:

- invited
- active
- suspended
- removed

Only active membership participates in normal organization authorization.

## Role model

| Role | Main purpose |
| --- | --- |
| Organization Owner | Full control and ownership-sensitive actions |
| Organization Admin | Full day-to-day administration |
| Event Manager | Event operations and staffing |
| Marketing | Campaigns, promotions, communication |
| Finance | Financial records and reporting |
| Host | Hosted experiences and event operations |
| Team Member | Assigned operational work |
| Worker | Assigned shifts/tasks and worker-facing information |
| Vendor | Vendor-facing event relationships |
| Member / Attendee | Community and event participation |
| Viewer | Read-only operational access |

A profile can hold more than one role in the same organization.

## Permission model

V1 permission families:

- organization
- members
- roles
- events
- tasks
- vendors
- workers
- communications
- marketing
- finance
- analytics
- files
- integrations
- AI
- audit

Representative permission codes:

```text
organization.view
organization.settings.manage
organization.branding.manage
members.view
members.manage
roles.manage
events.view
events.manage
events.publish
tasks.view
tasks.manage
tasks.assign
vendors.view
vendors.manage
workers.view
workers.manage
communications.view
communications.send
marketing.view
marketing.manage
finance.view
finance.manage
analytics.view
files.view
files.manage
integrations.view
integrations.manage
ai.use
ai.manage
audit.view
```

Clients should ask whether the current profile has a permission instead of duplicating role matrices in UI code.

## Platform admin boundary

`profiles.platform_role` remains the platform-level authority source for the current system.

Organization roles do not grant platform administration.

Founder Overwatch remains governed by the existing master-account protection and is not changed by this release.

## Go Melanated migration

The migration creates:

```text
Organization: Go Melanated
slug: go-melanated
kind: community
visibility: public
platform default: true
```

Existing profiles are added as active Go Melanated members.

Existing founder/admin status maps to organization Owner/Admin in addition to remaining a platform role.

Existing approved host and vendor status is reflected as organization Host/Vendor roles.

New profiles are automatically added to the platform-default organization until self-service organization onboarding is introduced.

## Legacy host-organization bridge

The current `host_organizations` table remains intact because current host pages and event relationships rely on it.

It gains `platform_organization_id`.

Current Melanated Adventurers public host identities point to Go Melanated.

Other legacy host organizations receive a platform Organization and retain their existing public identity record.

New host organizations create or connect to a platform Organization through a compatibility trigger.

`host_organization_members` continues to work. Membership changes are mirrored into platform organization membership/roles during the transition.

## Active organization

`profile_workspace_preferences.active_organization_id` stores the organization context.

The platform exposes:

- `list_my_organizations()`
- `set_active_organization(organization_id)`
- `organization_has_permission(organization_id, permission_code)`

A user may only activate an organization where they have active membership.

The mobile client exposes a shared organization service and an organization switcher inside Host Center V1.

## Existing resource ownership

The first migration adds tenant context to existing operational roots.

### Events

`adventures.platform_organization_id`

The existing `adventures.organization_id` remains because it currently points to `host_organizations` and is part of the public-host identity system.

### Event operations

Organization context is added to:

- `host_campaigns`
- `host_campaign_tasks`
- `host_event_communications`
- `host_event_finance_entries`
- `host_event_analytics_events`
- `host_event_vendors`

Campaign child records inherit organization context from the parent campaign.

### Shared business records

Organization context is added to:

- `host_vendor_profiles`
- `host_library_items`
- `host_communication_templates`
- `host_opportunities`
- `host_event_imports`
- `host_event_import_files`

Records without an event/campaign parent use the owner's active organization, with the platform-default organization as the compatibility fallback for migrated Go Melanated data.

### Users

Profiles remain global. `organization_memberships` is the tenant relationship.

### Workers

The `worker` role and worker permissions are established now. Worker profile, verification, jobs, shifts, attendance, reliability, and payment records are part of the Workforce Network build and do not exist in this migration.

## Security

All new public tables enable RLS.

Rules:

- organization membership controls tenant access
- permission checks use database-owned records
- role assignment is limited to users with `roles.manage`
- only owners or platform operators can assign/remove the Owner role
- platform admin is separate from organization roles
- private RLS helpers use fixed search paths
- new tables receive explicit Data API grants
- no authorization depends on user-editable metadata

V1 deliberately avoids immediately rewriting every legacy Host Center RLS policy. Organization IDs are added and backfilled first. Individual legacy tables can move to tenant-enforced RLS as their client reads/writes become organization-aware, reducing regression risk.

## Client behavior

`src/platform/organizations.ts` is the shared organization access layer.

Host Center shows the active organization and any additional organizations the signed-in profile can access.

Switching organization updates server-side preference and refreshes organization context without creating a new login.

The existing Member App / Host Center / Vendor Center navigation remains a separate product-mode switch. Organization switching changes **whose workspace/data** is active. Product-mode switching changes **which experience** the person is currently using.

## Acceptance criteria

- Go Melanated exists as the platform-default organization.
- Existing profiles remain able to use Go Melanated.
- Existing Host Center public host identities are not deleted or renamed.
- Existing Melanated Adventurers host identities resolve to Go Melanated tenant context.
- A profile can belong to multiple organizations.
- A profile can hold multiple roles inside one organization.
- Organization roles never grant Founder Overwatch.
- Active organization can be listed and changed through authenticated APIs.
- A user cannot activate an organization they do not belong to.
- Permission checks are evaluated server-side.
- Event, task, communication, finance, analytics, vendor, and business-library roots have organization context.
- New campaign child records inherit organization context.
- Host Center exposes an organization switcher when the user has organization access.
- Existing Member / Host / Vendor workspace switching remains available.
