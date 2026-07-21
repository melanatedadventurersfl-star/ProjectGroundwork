# 17. Authentication and Permissions

## Purpose

This chapter defines how people enter the platform, how access is granted, and how sensitive actions remain protected as members become volunteers, hosts, chapter leaders, staff, and administrators.

## Authentication Goals

- Make account creation simple.
- Protect member identity and payment-related actions.
- Support mobile sessions without forcing constant sign-in.
- Allow roles to evolve over time.
- Keep administrative and safety access narrow and auditable.
- Provide a clear recovery path when credentials are lost.

## Supported Sign-In Methods

Launch options should include:
- Email and password
- Email magic link or one-time code
- Apple Sign In
- Google Sign In

Phone-number sign-in may be added later if operational need justifies the added complexity.

## Account Lifecycle

```text
Invited or Self-Registered
→ Email Verified
→ Onboarding Incomplete
→ Active Member
→ Optional Elevated Role
→ Suspended, Deactivated, or Archived
```

### Registration

Minimum account creation fields:
- email
- display name
- password or federated identity
- age confirmation
- agreement to terms and privacy policy

Additional profile details belong in onboarding rather than the initial gate.

### Verification

Email verification is required before:
- paid registration
- posting publicly
- receiving a persistent Passport
- becoming a volunteer or host

### Session Management

- Use short-lived access tokens.
- Rotate refresh tokens.
- Allow users to view and revoke active sessions.
- Require reauthentication for sensitive changes.
- Expire inactive sessions according to risk and device trust.

## Authorization Model

Use role-based access control combined with resource-level checks.

A role grants a category of capability. Resource checks determine whether the member may act on a particular adventure, chapter, post, report, or record.

## Launch Roles

### Guest

May:
- browse public adventures
- view public organization information
- begin registration

May not:
- post
- join private community spaces
- view member profiles beyond public previews
- access Passport features

### Member

May:
- manage their own account
- register for adventures
- complete preparation steps
- check in
- access Passport and Journey
- create community content
- control privacy settings
- report or block content and members

### Volunteer

Includes all Member permissions plus event-specific access assigned by staff or hosts.

Possible permissions:
- view volunteer assignment
- access operational schedule
- scan check-ins
- update assigned task status

Volunteer access should expire after the relevant adventure unless explicitly renewed.

### Host

Includes Member permissions plus access to adventures they are assigned to manage.

Possible permissions:
- update adventure operational content
- view registrant information needed for delivery
- communicate with registrants
- manage check-in
- record attendance corrections
- initiate incident documentation

Hosts should not automatically access full member histories, unrelated adventures, raw payment data, or unrestricted safety records.

### Chapter Leader

May manage chapter-scoped adventures, chapter content, volunteers, and approved chapter communications.

Chapter access is limited to assigned chapters.

### Staff

May manage organization-wide operational records according to assigned scopes.

Staff permissions should be separated into practical groups such as:
- events
- membership
- finance and refunds
- content moderation
- communications
- reporting

### Safety Moderator

May access safety reports and restricted incident workflows.

This role must not be implied by general staff status.

### Administrator

May manage roles, system configuration, integrations, and broad organization settings.

Administrator access should be rare, protected by multifactor authentication, and fully audited.

## Permission Matrix

| Capability | Guest | Member | Volunteer | Host | Chapter Lead | Staff | Safety | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Browse public adventures | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Register for adventure | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Post in community | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View own Passport | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Scan event check-ins | No | No | Assigned | Assigned | Scoped | Scoped | No | Yes |
| Edit adventure | No | No | No | Assigned | Chapter | Scoped | No | Yes |
| View registrant operational data | No | Own | Assigned minimum | Assigned | Chapter | Scoped | No | Yes |
| Moderate ordinary content | No | No | No | Limited own event | Chapter | Scoped | Limited | Yes |
| Access safety reports | No | Own receipt | No | Limited submitted | Limited submitted | Only if scoped | Yes | Yes |
| Manage roles | No | No | No | No | No | Limited | No | Yes |

## Sensitive Actions Requiring Reauthentication

- change primary email
- change password
- add or remove federated sign-in
- view recovery codes
- change payout or financial configuration
- export member data
- assign privileged roles
- access high-severity safety reports
- permanently delete an account

## Multifactor Authentication

Required for:
- administrators
- safety moderators
- staff with financial or export access

Strongly recommended for hosts and chapter leaders.

## Privacy Boundaries

A host may need to know:
- attendee name
- ticket type
- waiver completion
- dietary or accessibility information relevant to the adventure
- emergency contact access during the operational window

A host does not need:
- unrelated attendance history
- private Journey entries
- direct access to payment credentials
- private messages or blocked-member lists
- unrelated safety reports

## Emergency Access

Emergency information access should:
- be limited to active operational windows
- require a stated reason where practical
- be logged
- show only necessary information
- automatically expire

## Suspensions and Restrictions

Possible controls:
- full account suspension
- community posting restriction
- event registration restriction
- host privilege removal
- chapter privilege removal
- communication restriction

Restrictions should store:
- reason category
- start and end time
- approving staff member
- member notification status
- appeal or review status

## Account Recovery

Recovery should support:
- verified email reset
- federated provider recovery guidance
- support-assisted recovery with identity checks
- revocation of old sessions after successful recovery

Support staff should never be able to view a member's password.

## Audit Logging

Log:
- privileged sign-ins
- role grants and removals
- member suspensions
- sensitive exports
- safety record access
- emergency data access
- attendance overrides
- refund decisions
- account deletion actions

## Current Decisions

- Members may have multiple roles.
- Elevated access is scoped by adventure or chapter wherever possible.
- Safety access is a separate role.
- MFA is mandatory for the highest-risk roles.
- Emergency contact access is temporary and audited.
- Public profiles and private operational records are separate views.

## Open Questions

- Should all hosts be required to use MFA at launch?
- How long should emergency information remain available after an adventure ends?
- Which staff roles may approve manual Passport corrections?
- What identity verification is required for support-assisted recovery?
