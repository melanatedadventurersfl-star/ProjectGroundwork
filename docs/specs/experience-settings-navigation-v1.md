# Experience Settings and Member Navigation V1

## Goal

Make the reusable Community Experience configurable from the organization workspace and begin letting the member shell consume that configuration.

This is the second extraction step after `community-experience-foundation-v1`.

## Organization controls

Organization users with `organization.settings.manage` can edit the active public experience from Host Center.

Editable identity settings:

- public experience name
- brand name
- public slug
- primary color
- accent color
- surface color
- text color

Editable terminology:

- Home
- Events
- Community
- Directory
- Journey
- Member
- Host

Editable module state:

- enable or disable each configured experience module
- core module labels follow the matching terminology setting

The client writes through the existing tenant-scoped RLS policies on `organization_experiences` and `organization_experience_modules`.

No privileged client RPC is introduced.

## Member shell behavior

The member tab shell now reads the active organization's primary experience after authentication.

V1 effects:

- Home title comes from organization experience terminology
- Events title comes from organization experience terminology
- Community title comes from organization experience terminology
- Journey title comes from organization experience terminology
- disabled Events and Community modules are removed from the Expo Router tab link surface

If experience configuration cannot be loaded, Go Melanated's current labels remain the fallback so this change does not block app startup.

## Tenant behavior

The active organization remains the selector for which experience configuration is loaded.

Example:

- Go Melanated can use Trailhead, Explore, Outpost, Trail Guide and Passport
- a second organization can use Home, Events, Network, Business Directory and Profile without forking the application code

## Current limits

This V1 does not yet:

- rebuild every existing hard-coded member screen label
- reorder Home sections
- provide a visual page builder
- provision new organizations
- create custom domains
- expose public web pages without authentication
- separate Outdoor & Adventure modules into their own installation pack

Those remain subsequent extraction steps.

## Next sequence

1. Make Home sections read `home_layout`
2. Replace hard-coded member menu branding with active experience branding
3. Separate outdoor-specific modules into the Outdoor & Adventure pack
4. Add an internal organization provisioning flow
5. Provision a controlled second organization and run tenant-isolation tests
