# Organization Provisioning V1

## Goal

Create a complete tenant through one controlled platform-admin operation instead of allowing partial organization records to be created directly.

## Entry point

Platform administrators use:

`Admin -> Organizations -> Create Organization`

The mobile client calls `public.provision_organization(...)`.

## Authorization

- The provisioning RPC is `SECURITY INVOKER`.
- Only active platform operators may provision organizations.
- Anonymous users cannot execute the RPC.
- Standard authenticated members cannot execute the RPC.
- The direct `organizations` INSERT policy is restricted to active platform operators whose `created_by` value matches their authenticated profile.
- Legacy `host_organizations` synchronization remains handled by its existing privileged trigger path.

## Atomic provisioning result

One RPC call creates:

1. Organization
2. Active creator membership
3. Creator Owner role through the existing organization owner bootstrap trigger
4. Primary organization Public Experience
5. Blueprint-derived experience configuration
6. Blueprint-derived experience module rows
7. Optional active-workspace preference update

Postgres executes the function call transactionally. A failure prevents a half-configured tenant from being committed.

## Default Community tenant state

The organization record starts `active` so administrators can manage it immediately.

The primary Public Experience starts `draft`. It is not published to the public until an administrator explicitly activates it.

Default member variants:

- Home: `community`
- Events: `community`

Default enabled modules:

- Home
- Events
- Saved
- Menu

Modules that remain disabled in V1 because their current underlying surfaces are not fully tenant-isolated:

- Community
- Profiles
- Groups
- Directory
- Calendar
- Notifications
- Memberships
- Search

Those modules carry `requires_tenant_isolation: true` in their blueprint settings so future work can identify the guardrail explicitly.

## Branding starter

Provisioning accepts optional primary and accent colors. The Community blueprint supplies default surface and text colors plus generic Community terminology.

Administrators can refine the experience later through the existing organization experience configuration tools.

## Active workspace behavior

`p_make_active` defaults to `false`.

Provisioning therefore does not move the platform administrator away from their current organization unless they explicitly request it.

## V1 limitations

### Creator becomes owner

The platform operator who provisions the organization becomes its first Owner through the existing owner bootstrap trigger.

V1 does not yet support selecting a different customer owner during creation or transferring ownership as part of the provisioning transaction. Customer owner handoff and invitations belong in a later organization onboarding slice.

### No self-service organization creation

V1 intentionally removes general authenticated self-service organization inserts. External customer self-service onboarding needs a dedicated flow that validates billing, ownership, tenant configuration, and invitation state before it is enabled.

### New-profile default membership remains Go Melanated

The current profile bootstrap still joins newly created profiles to the platform-default Go Melanated organization. That behavior predates this provisioning flow and must be replaced before tenant-specific public signup can be considered complete.

### Deferred tenant surfaces

Community feed, member profiles, groups, directory, calendar, notifications, memberships, and shared search still need organization ownership or organization-aware filtering before they can be enabled safely for arbitrary tenants.

## Validation

The migration was smoke-tested under a simulated active founder session inside a transaction that was rolled back.

Validated outcomes:

- primary experience status was `draft`
- provisioning creator had Owner role
- enabled modules were exactly Home, Events, Saved, and Menu
- existing Go Melanated active workspace remained unchanged when `p_make_active=false`
- a normal active member was denied by the provisioning RPC
- a normal active member was denied from a bare organization insert by RLS
