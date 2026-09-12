# Tenant-aware Signup V1

## Goal

Allow a new account to join the organization that invited it instead of automatically becoming a Go Melanated member.

The tenant decision is validated by the database. Signup metadata never receives a trusted organization ID.

## Organization join links

Organization member managers can create hashed join links through:

`public.create_organization_join_link(...)`

V1 links:

- grant only the organization `member` role
- expire after a configured number of days
- can optionally have a maximum use count
- can be revoked
- store only a SHA-256 hash of the token
- return the plaintext token once when created

The backing records live in the private schema and are not exposed as a public REST table.

## Signup metadata

The app reads `org_invite` from the signup route and submits it as:

`organization_join_token`

in Supabase Auth user metadata.

This token is separate from the existing Go Melanated member-referral code. Both can exist on the same signup without overloading either system.

## Profile organization bootstrap

When the new `profiles` row is inserted, `private.bootstrap_profile_default_organization()` checks the authenticated user's stored `organization_join_token`.

If the token is active and valid:

1. increment the link use count atomically
2. create or reactivate the organization membership
3. assign the organization `member` role
4. set that organization as the profile's active workspace
5. stop before the platform-default Go Melanated membership bootstrap

If no valid organization token is present, the existing Go Melanated default-membership behavior remains in place.

## Go Melanated social defaults

`public.handle_new_user()` now validates the organization token before seeding `private.default_connection_profiles`.

A valid tenant-link signup does not inherit Go Melanated's automatic social connections.

A standard signup without a valid tenant link keeps the existing Go Melanated behavior.

## Profile status and onboarding

This slice does not change global profile approval state.

Profiles still begin with the existing `pending` status. The existing onboarding completion flow changes a pending profile to `active` when onboarding completes.

Tenant placement and platform profile status therefore remain separate concerns.

## Security model

Public join-link management RPCs use `SECURITY INVOKER` and require `members.manage` for the target organization.

Private token resolution and consumption helpers are `SECURITY DEFINER`, live in the private schema, and are not executable by anonymous or authenticated API callers directly.

The raw token is never stored. The private table stores a 64-character SHA-256 hash.

## Controlled test tenant

A member join link was created for `Groundwork Test Company` with:

- 30-day expiration
- maximum 5 uses
- zero uses at validation time

Validation confirmed:

- the raw token is not stored
- the valid token resolves to Groundwork Test Company
- a random token resolves to no organization
- token consumption assigns active membership, the `member` role, and the target active workspace inside a rollback test
- token use count increments atomically inside that test
- a normal active member cannot create organization join links
- a revoked link resolves nowhere
- the revocation test was rolled back, leaving the controlled test link active

## V1 limitations

- the signup screen identifies that an organization invitation is attached, but does not yet resolve and render the organization's public branding before authentication
- organization join-link generation is available in the platform API layer, while a complete organization-member invitation management UI remains a later slice
- invalid or expired organization tokens currently fall back to the existing Go Melanated default signup behavior
- tenant-specific Community, Profiles, Groups, Directory, Calendar, Notifications, Memberships, and Search remain disabled until their underlying data is tenant-isolated
