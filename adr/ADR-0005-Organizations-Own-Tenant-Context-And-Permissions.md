# ADR-0005: Organizations Own Tenant Context and Permissions

- **Status:** Accepted
- **Date:** 2026-09-11
- **Authors:** Jonathan Carr, Project Groundwork

---

# Context

Groundwork is expanding from a single Go Melanated product into a platform that can serve multiple companies and communities.

The existing application already has member identity, Host Center, public host organizations, Vendor Center, events, campaigns, tasks, communications, finance, analytics, and platform administration. The current `host_organizations` model represents a host or business identity, but it was not designed to be the security and ownership boundary for the entire platform.

A company-level tenant boundary is required before adding outside customers, workforce functionality, billing, or deeper white-label support.

The platform also needs a role model that lets one person participate in several organizations with different responsibilities without creating separate user accounts.

---

# Decision

Groundwork will introduce **Organization** as the top-level tenant and ownership boundary.

The internal architecture remains:

```text
Organization
    ↓
Systems
    ↓
Workspaces
    ↓
Capabilities
    ↓
Objects
```

Workspaces remain the primary user-facing work concept defined in ADR-0001. Organization provides the company or community context that owns those workspaces.

## One identity, many relationships

A person keeps one platform profile.

That profile may belong to multiple organizations and may hold multiple roles inside each organization.

Example:

```text
Jonathan
├── Go Melanated
│   ├── Owner
│   └── Host
└── Example Festival Company
    ├── Event Manager
    └── Vendor
```

The active organization is a durable profile preference so the same account can switch organization context without signing out.

## Platform roles remain separate

Platform authority and organization authority are different concepts.

`profiles.platform_role` continues to control platform-wide administration such as Founder Overwatch and platform administration.

Organization roles never grant Founder Overwatch or other platform-wide privileges.

## V1 organization roles

The system roles are:

- Organization Owner
- Organization Admin
- Event Manager
- Marketing
- Finance
- Host
- Team Member
- Worker
- Vendor
- Member / Attendee
- Viewer

Custom organization roles are deferred. V1 stores permissions separately from roles so custom roles can be added later without redesigning authorization.

## Permissions over role-name checks

Business capabilities should authorize against permission codes rather than scattering role-name comparisons throughout the client.

Examples:

- `events.manage`
- `tasks.assign`
- `vendors.manage`
- `workers.manage`
- `communications.send`
- `finance.view`
- `integrations.manage`
- `ai.use`

Role definitions map to these permissions in the database.

## Database-enforced tenant authorization

Organization membership, roles, and permissions live in Postgres.

Row Level Security protects organization records. Authorization does not rely on user-editable auth metadata.

Security helper functions that must bypass membership-table RLS live in the private schema with explicit execution grants and a fixed search path.

## Go Melanated becomes tenant one

The migration creates Go Melanated as the platform-default organization and assigns existing Go Melanated profiles to it.

Existing Melanated Adventurers host identities are bridged into this organization rather than treated as separate SaaS customers.

## Existing host organizations remain compatible

`host_organizations` remains the public host/business identity model for the current Host Center.

A bridge field connects a host organization to its platform Organization. This lets existing screens continue to function while the broader application moves to organization-scoped data.

The platform model may eventually replace parts of the legacy host model, but this ADR does not require a breaking migration now.

---

# Resource ownership

Organization context is added first to the operational roots that already exist:

- events / adventures
- host campaigns
- campaign tasks
- event communications
- event finance entries
- event analytics
- event vendors
- vendor profiles
- host library records
- communication templates
- opportunities
- event imports and imported files

Nested records may inherit their organization from an event or campaign.

Member identity remains global. Membership connects that person to an organization.

The worker role exists in V1 authorization so the later Workforce Network can use the same tenant model. Worker-specific records are deferred until the Workforce Network build.

---

# Consequences

## Positive

- Go Melanated can run on the same platform offered to other companies.
- One person can work across organizations without duplicate accounts.
- Organization data has an explicit tenant boundary.
- Role checks can become permission checks.
- Host, vendor, worker, member, and staff contexts can coexist on one identity.
- Billing, provisioning, white-label settings, and enterprise controls now have a stable parent object.

## Costs

- Existing tables need staged migration to organization-scoped reads and writes.
- Legacy host organization logic must remain bridged during transition.
- Client screens need to adopt active-organization context instead of assuming Go Melanated.
- Cross-organization reporting will require explicit platform-level privileges.

---

# Security rules

1. Platform authority and organization authority stay separate.
2. An organization role never implies platform admin access.
3. Organization records are protected by RLS.
4. Permission checks are evaluated from database-owned membership and role records.
5. User-editable auth metadata is not an authorization source.
6. Organization Owners receive additional protection for ownership-sensitive role changes.
7. New organization-scoped capabilities must include `organization_id` or inherit it from an organization-owned parent.

---

# Migration strategy

1. Create platform Organization, membership, role, permission, and active-context tables.
2. Seed Go Melanated.
3. Bridge existing Melanated Adventurers host identities to Go Melanated.
4. Bridge other legacy host organizations into platform organizations.
5. Backfill organization context onto existing operational roots.
6. Keep legacy Host Center behavior working during the transition.
7. Move new features to organization-aware APIs by default.
8. Tighten RLS on legacy operational tables incrementally after their clients are organization-aware.

---

# Related documents

- ADR-0001: Workspaces Are the Primary User Concept
- ADR-0002: Capabilities Over Modules
- ADR-0003: Experience Is a Workspace Type
- `docs/specs/platform-organizations-rbac-v1.md`
