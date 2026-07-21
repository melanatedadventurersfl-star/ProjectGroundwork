# Member Profiles, Roles, Permissions, Guardians, and Household Management Specification

## Purpose

This document defines how identity, relationships, roles, permissions, guardianship, and household management work across the Melanated Adventurers app.

The goal is to ensure that every action in the platform is performed by an authorized person, for the correct participant, with the minimum access necessary. This system supports individual members, guests, minors, guardians, households, volunteers, hosts, moderators, and administrators.

## Product Principles

1. Identity should be clear without making onboarding feel bureaucratic.
2. Permissions must be explicit, auditable, and revocable.
3. Guardianship and household access must not silently expose sensitive information.
4. A person may hold different roles in different contexts.
5. The system should support families and group bookings without forcing every participant to manage a full account.
6. Safety-critical information must be available to authorized event staff when needed.
7. Public profile data and operational profile data must remain separate.

## Core Identity Model

### User Account

A User Account is the authenticated login identity.

A User Account may:

- own one Member Profile
- manage one or more Dependent Profiles
- belong to one or more Households
- hold organization or event roles
- purchase registrations for other participants
- act as the primary contact for a booking

Authentication credentials belong to the User Account, not to individual dependent or guest profiles.

### Member Profile

A Member Profile represents a participant who can independently use the app.

Core fields:

- legal name
- display name
- pronouns, optional
- date of birth
- contact email
- phone number
- profile photo
- home region
- emergency contact
- accessibility preferences
- dietary preferences
- communication preferences
- privacy settings
- membership status
- profile verification status

Sensitive fields must not appear on the public-facing profile.

### Dependent Profile

A Dependent Profile represents a minor or another participant whose account is managed by an authorized adult.

A Dependent Profile may contain:

- legal name
- preferred name
- date of birth
- relationship to guardian
- emergency and medical information
- accessibility and dietary information
- waiver status
- registration history
- Passport and Journey history

A Dependent Profile does not require login credentials.

### Guest Profile

A Guest Profile represents a participant added during checkout who does not yet have an account relationship.

Guest Profiles are intentionally lightweight and may include:

- name
- email or phone when available
- age category
- ticket assignment
- waiver status
- emergency contact
- dietary or accessibility notes

A guest may later claim their profile through an invitation and identity-verification flow.

### Staff Profile

A Staff Profile extends a Member Profile with operational permissions.

Staff roles may be organization-wide or limited to specific adventures.

## Profile Layers

### Public Community Profile

Visible according to the member’s privacy settings.

May include:

- display name
- profile photo
- bio
- home region
- interests
- selected Passport achievements
- community posts
- mutual adventures when permitted

Must not include:

- legal name unless chosen as display name
- birth date
- emergency contacts
- payment history
- medical information
- private Journey entries
- household relationships unless explicitly shared

### Operational Participant Profile

Visible only to authorized staff for relevant adventures.

May include:

- legal name
- ticket status
- waiver status
- check-in state
- emergency contact
- dietary accommodations
- accessibility accommodations
- critical medical or safety notes explicitly provided for the event

Access should be limited by event, role, and time window.

### Account Administration Profile

Visible to the account holder and authorized administrators.

May include:

- login identity
- contact methods
- authentication status
- linked profiles
- household memberships
- permissions
- notification preferences
- account history

## Role Model

Roles are contextual and must not automatically grant broader access than required.

### Platform Roles

#### Visitor

A non-authenticated person.

May:

- view public adventure information
- access public marketing content
- begin account creation

May not:

- register when authentication is required
- post or comment
- view member-only content

#### Member

A standard authenticated user.

May:

- maintain their profile
- explore and register for adventures
- post according to community permissions
- manage their own readiness
- view their Passport and Journey

#### Guardian

An adult authorized to manage one or more dependent profiles.

May:

- register dependents
- complete guardian-authorized forms and waivers
- manage readiness tasks for dependents
- receive communications related to dependents
- control dependent privacy settings

#### Household Manager

A member authorized to manage selected household functions.

May:

- invite or remove household members when permitted
- manage shared contact or address information
- purchase for household participants
- view household-level readiness summaries

Household Manager does not automatically receive all private data for adult household members.

#### Volunteer

A person assigned operational tasks for one or more adventures.

Permissions are adventure-scoped and may include:

- check-in assistance
- activity roster access
- equipment distribution
- meal verification
- incident escalation

Volunteers should not see payment details or unrelated medical information.

#### Host

A person who manages adventures and member operations.

May:

- create or edit assigned adventures
- manage registration configuration
- view participant readiness summaries
- send approved communications
- manage check-in and attendance
- access relevant accommodation data

#### Moderator

A person responsible for community safety.

May:

- review reports
- hide or remove content
- warn or restrict accounts
- document moderation actions

Moderators do not automatically receive payment, medical, or full registration access.

#### Organization Administrator

A high-trust operational role.

May:

- assign staff roles
- manage organization settings
- configure policies
- review audit logs
- manage integrations
- access broader operational reporting

#### Platform Administrator

Reserved for technical platform operations.

Access must be tightly controlled, logged, and separated from routine event management.

## Contextual Roles

A person may hold a role only for a specific adventure.

Examples:

- Event Host
- Check-in Lead
- Activity Lead
- Meal Coordinator
- Transportation Coordinator
- Safety Lead
- Photographer
- Volunteer

Each contextual role should map to an explicit permission bundle.

## Permission Model

Permissions should use role-based access control with contextual constraints.

A permission decision should consider:

1. actor identity
2. actor role
3. target profile or resource
4. organization
5. adventure
6. relationship to target
7. time window
8. sensitivity level
9. explicit consent or delegation

### Permission Categories

#### Profile Permissions

- view public profile
- edit own profile
- view dependent profile
- edit dependent profile
- view operational participant data
- view emergency information
- export profile data
- deactivate profile

#### Registration Permissions

- purchase for self
- purchase for dependent
- purchase for guest
- transfer ticket
- cancel registration
- complete forms
- sign waiver
- assign add-ons

#### Community Permissions

- post
- comment
- react
- mention
- upload media
- moderate content
- view member-only posts
- view adventure-scoped posts

#### Adventure Operations Permissions

- view roster
- edit adventure
- view readiness summaries
- check in participants
- record attendance
- view accommodation notes
- send broadcasts
- manage incidents

#### Financial Permissions

- view own receipts
- view organization transactions
- issue refunds
- issue credits
- configure pricing
- export financial reports

Financial permissions must remain separate from general host access.

## Permission States

Permissions may be:

- granted
- denied
- pending verification
- expired
- suspended
- delegated
- revoked

Every privileged action should be evaluated at the time it is attempted rather than relying only on cached interface state.

## Household Model

A Household is an optional coordination group for people who regularly register or prepare together.

Examples:

- parent and children
- partners
- extended family
- caregiving group

A Household is not automatically a public social unit.

### Household Roles

- Owner
- Manager
- Adult Member
- Dependent
- Limited Participant

### Household Capabilities

A household may support:

- shared address
- shared emergency contact suggestions
- household participant selection during checkout
- combined readiness overview
- shared packing lists
- shared transportation planning
- household payment responsibility

### Adult Privacy

Adult members must control whether another household member may:

- register them
- view their readiness tasks
- view their ticket status
- view their accessibility or dietary information
- receive their communications

Joining a household does not automatically grant full management access.

## Household Invitations

An invitation should include:

- inviter identity
- household name
- requested relationship or role
- permissions being requested
- expiration date

The invited adult must explicitly accept.

For minors, a guardian creates or links the dependent profile according to verification requirements.

## Guardianship

### Guardian Relationship

A Guardian Relationship links an adult account to a dependent profile.

Fields:

- guardian user ID
- dependent profile ID
- relationship type
- authority level
- verification status
- effective date
- expiration date, when applicable
- legal or consent documentation status, when required

### Guardian Authority Levels

#### Primary Guardian

May manage all standard dependent functions.

#### Additional Guardian

May receive permissions granted by the Primary Guardian or organization policy.

#### Trip-Specific Authorized Adult

May act for the dependent only for a specified adventure or time window.

#### Emergency Contact Only

Receives emergency contact status but no account-management permissions.

### Guardian Actions

Depending on authority, guardians may:

- register the dependent
- complete forms
- sign eligible waivers
- manage accommodations
- control public visibility
- approve media consent
- receive notifications
- view Journey entries
- manage Passport visibility

### Guardian Disputes

The system must support restricting access when guardianship is disputed or legally constrained.

Actions may include:

- freezing profile changes
- requiring administrator review
- preserving audit logs
- limiting communications
- removing delegated access

The product should not attempt to adjudicate legal custody disputes automatically.

## Minor Experience

Minors may participate without having an independent login.

Future teen accounts may be supported with:

- guardian-linked authentication
- limited community access
- guardian-controlled privacy
- age-appropriate posting rules
- restricted location sharing

At launch, dependent profiles should not independently post, message, purchase, or change legal information.

## Delegated Management

An adult member may delegate specific functions to another trusted adult.

Examples:

- allow a partner to register them
- allow a trip organizer to manage readiness tasks
- allow a caregiver to receive event communications

Delegation must specify:

- delegate
- permissions granted
- target profile
- adventure scope, if any
- start and expiration
- revocation method

Delegation should never include password sharing.

## Group Booking Responsibility

A purchaser may book for several participants without becoming their permanent guardian or household manager.

The purchaser may:

- assign tickets
- provide provisional participant details
- receive payment confirmation
- manage the order until tickets are claimed or transferred

The purchaser may not automatically:

- access a claimed adult participant’s private profile
- sign legal waivers for another adult
- view private Journey entries
- modify long-term profile settings

## Profile Claiming

Guest or provisional participants may claim their profile.

Claim flow:

1. receive secure invitation
2. authenticate or create account
3. verify contact method
4. confirm identity details
5. review imported registration data
6. accept profile ownership
7. set privacy and communication preferences

After claim, the original purchaser retains only order-level permissions allowed by policy.

## Role Assignment

### Staff Assignment

Staff roles must include:

- assigning administrator
- target organization or adventure
- permission bundle
- effective date
- expiration date
- assignment reason

### High-Risk Roles

Administrator, refund, incident, and emergency-access roles should require stronger controls such as:

- multifactor authentication
- reauthentication
- approval by another administrator
- shorter session duration
- enhanced audit logging

## Role Revocation

Revocation should take effect promptly.

The system must:

- terminate active privileged sessions when appropriate
- remove hidden interface actions
- deny future API requests
- record who revoked access and why
- preserve historical audit records

## Sensitive Information Controls

Sensitive information includes:

- medical details
- accessibility accommodations
- emergency contacts
- birth dates
- legal names
- guardian relationships
- payment details
- incident records

Controls:

- least-privilege access
- encrypted storage and transmission
- field-level access where practical
- view logging for high-sensitivity records
- limited retention
- no exposure through public search

## Emergency Access

Authorized safety staff may receive temporary elevated access during an active incident.

Emergency access must:

- be limited to relevant participants
- require a stated reason
- be time-bound
- be fully audited
- trigger review after use

This should be a break-glass function, not a convenient shortcut.

## Profile Editing Rules

Members may edit non-critical fields directly.

Changes to identity-critical fields may require verification.

Examples:

- legal name
- date of birth
- guardian relationship
- primary email
- primary phone

Past registration records should preserve the historical values necessary for audit and compliance.

## Account Recovery

Recovery options may include:

- verified email
- verified phone
- backup codes
- administrator-assisted recovery

Recovery must not rely on public profile information alone.

Dependent profiles are recovered through the authorized guardian account rather than independent credentials.

## Account Deactivation and Deletion

Members may request account deactivation or deletion subject to legal, financial, safety, and record-retention requirements.

The system should distinguish:

- account login deactivation
- public profile removal
- content anonymization
- household unlinking
- dependent transfer to another verified guardian
- retention of transaction and incident records

## Audit Logging

Log high-impact actions, including:

- role assignments and revocations
- guardian relationship changes
- household invitations and removals
- sensitive profile views
- waiver actions
- emergency access
- profile ownership claims
- identity-critical edits
- account recovery
- exports and deletions

Audit entries should include actor, action, target, timestamp, context, and outcome.

## User Interface Requirements

### Profile Screen

Sections:

- public profile
- personal details
- preferences and accommodations
- emergency information
- privacy
- notifications
- household and dependents
- account security

### Household Screen

Should show:

- members and roles
- pending invitations
- dependents
- shared settings
- delegated permissions
- upcoming household adventures
- readiness summary

### Permission Explanations

When an action is unavailable, the interface should explain why when safe to do so.

Examples:

- Only the ticket holder can transfer this ticket.
- Guardian approval is still required.
- Your volunteer role does not include payment access.

Avoid exposing sensitive internal policy details that could help bypass controls.

## Notifications

Notify affected users when:

- they are invited to a household
- a guardian relationship is added or removed
- a delegation is granted or revoked
- a profile is claimed
- a role is assigned or removed
- critical contact information changes
- emergency access is used, when policy permits

## Offline Behavior

Public and self-profile information may be cached according to privacy rules.

Sensitive information should be cached only when operationally required, encrypted, and automatically expired.

Staff devices must not retain participant rosters or emergency details indefinitely.

## Accessibility

Profile and permission workflows must support:

- screen readers
- clear relationship labels
- accessible consent language
- large touch targets
- keyboard navigation where applicable
- non-color permission states
- understandable error messages

## Analytics

Track aggregate events such as:

- profile completion
- household creation
- dependent creation
- invitations accepted or expired
- profiles claimed
- delegation usage
- permission-denied events
- role assignment lifecycle

Do not place sensitive profile values in analytics payloads.

## MVP Scope

The launch version should include:

- authenticated User Accounts
- Member Profiles
- Dependent Profiles
- Guest Profiles
- basic Households
- Primary Guardian relationships
- member, guardian, host, volunteer, moderator, and administrator roles
- adventure-scoped staff permissions
- explicit adult household consent
- profile claiming
- basic audit logging
- public versus operational profile separation

## Deferred Features

Possible later additions:

- teen accounts
- multiple legal guardian verification workflows
- organization-to-organization staff federation
- advanced household payment sharing
- temporary caregiver credentials
- self-service identity verification
- granular field-by-field household sharing

## Acceptance Criteria

The system is ready for implementation when:

1. A user can maintain their own profile without exposing private operational data publicly.
2. A guardian can manage an authorized dependent without sharing credentials.
3. An adult can join a household without surrendering control of private information.
4. A purchaser can register guests without gaining permanent profile authority.
5. Staff access is limited by role, adventure, and time.
6. Community moderators cannot access unrelated payment or medical data.
7. Sensitive profile views and permission changes are auditable.
8. Roles can be revoked promptly.
9. Emergency access is time-bound and logged.
10. Profile ownership can move from a provisional guest record to a verified account safely.
