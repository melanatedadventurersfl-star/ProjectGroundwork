# Account Onboarding, Authentication, and First-Time Member Setup Specification

## Purpose

This document defines how a new or returning person creates, verifies, accesses, and configures a Melanated Adventurers account. The goal is to make first-time setup feel welcoming and useful without forcing members through a bureaucratic obstacle course before they can explore.

The onboarding system must establish enough information to personalize discovery, support safe event participation, configure communication preferences, and connect household or guardian relationships when needed.

## Product Principles

- Let people explore before requiring full account setup whenever practical.
- Ask for information only when it becomes useful.
- Explain why sensitive information is requested.
- Separate public profile information from operational and emergency information.
- Allow onboarding to pause and resume.
- Never block discovery because optional profile fields are incomplete.
- Require stronger verification only for actions that carry financial, safety, moderation, or legal consequences.
- Build trust before requesting high-sensitivity information.

## Account States

### Visitor

A person who has not signed in.

Visitors may:

- Browse public adventures
- Search and filter
- View public organization information
- View public community content where permitted
- Begin registration until account creation becomes necessary

Visitors may not:

- Purchase tickets
- Save adventures across devices
- Post or comment
- Access participant-only information
- Create a Passport or Journey record

### Pending Account

An account has been started but contact verification is incomplete.

Pending accounts may preserve:

- Registration progress
- Saved adventures on the current device
- Selected interests
- Draft profile details

Pending accounts may not complete payment, post publicly, or access protected participant information.

### Verified Member

The member has verified at least one approved authentication channel and accepted the current terms.

Verified members may use normal member features, subject to profile, guardian, payment, and event-specific requirements.

### Restricted Account

An account may be restricted because of:

- Unverified contact information
- Age or guardian requirements
- Policy violations
- Payment disputes
- Security concerns
- Incomplete legal consent

Restrictions must identify what is blocked and what action may resolve the restriction.

### Suspended or Closed Account

Suspended accounts retain controlled access to support, records, refunds, and appeal information where appropriate.

Closed accounts follow the data-retention and deletion policies defined elsewhere in the product architecture.

## Supported Authentication Methods

The initial release should support:

- Email and password
- Email verification code or link
- Password reset by verified email

The architecture should support later addition of:

- Phone number and one-time code
- Apple sign-in
- Google sign-in
- Passkeys
- Multi-factor authentication

Authentication methods must resolve to one underlying user identity rather than creating duplicate member accounts.

## Account Creation Flow

### Entry Points

Account creation may begin from:

- The welcome screen
- A purchase or registration flow
- Saving an adventure
- Attempting to post or comment
- Accepting a household or guardian invitation
- Claiming a guest registration
- Following an invitation to an adventure

The flow should remember the originating task and return the member to it after setup.

### Minimum Initial Fields

Required to create a basic account:

- First name
- Last name
- Email address
- Password
- Date of birth or age confirmation when required
- Acceptance of terms and privacy notice

Optional during initial account creation:

- Display name
- Profile photo
- City or general location
- Adventure interests
- Pronouns

### Password Requirements

Password rules should prioritize security and usability:

- Minimum length rather than excessive composition rules
- Support password managers and paste
- Show password requirements before submission
- Permit visibility toggle
- Detect commonly compromised passwords where technically feasible
- Rate-limit failed attempts

Passwords must never be displayed in administrative tools.

## Email Verification

Verification must be required before:

- Completing payment
- Posting or commenting
- Receiving account recovery links
- Becoming a household manager
- Accepting a staff or moderator role

Verification messages must include:

- Clear expiration information
- A resend option
- Protection against repeated resend abuse
- A path to correct a mistyped email address

A member who verifies after beginning registration must return to the preserved registration state.

## Returning Member Sign-In

The sign-in experience must support:

- Email and password
- Password reset
- Clear error states
- Account lockout protections
- Recognition of unverified accounts
- Recovery when an account already exists under the supplied email

Error messages must not reveal whether a specific email belongs to an account in contexts where that would create a privacy or security risk.

## Session Management

Members should remain signed in across ordinary app use unless:

- They explicitly sign out
- A high-risk security event occurs
- Their credentials are reset
- Their session expires under policy
- An administrator revokes access

Sensitive actions may require recent reauthentication, including:

- Changing email or password
- Viewing certain protected household information
- Editing guardian authority
- Accessing emergency records
- Issuing refunds or performing host financial actions

Members must be able to view and revoke active sessions in a later release.

## First-Time Setup Structure

Onboarding should be divided into short, understandable steps.

### Step 1: Welcome and Value

Explain what the app helps members do:

- Discover adventures
- Register and prepare
- Stay connected during events
- Track experiences and accomplishments
- Participate in the community

Avoid requiring decisions on this screen.

### Step 2: Basic Identity

Collect or confirm:

- Name
- Display name
- Profile photo, optional
- Pronouns, optional
- Date of birth or age band as required

Explain which fields are public, member-visible, or private.

### Step 3: Home Area

Collect a general location for discovery personalization.

Preferred options:

- City and state
- ZIP code
- Permission-based approximate device location
- Skip for now

The system should not require a precise home address for ordinary membership.

### Step 4: Adventure Interests

Members may select interests such as:

- Camping
- Hiking
- Water activities
- Road trips
- Theme parks
- Food and cultural experiences
- Family-friendly adventures
- Wellness and relaxation
- Educational or service activities
- Beginner outdoor experiences

Interest choices influence recommendations but must not permanently trap members inside a narrow recommendation bubble.

### Step 5: Experience and Comfort

Optional questions may include:

- New to outdoor activities
- Comfortable camping experience
- Preferred trip pace
- Interest in beginner guidance
- Typical transportation needs
- Family or household participation

These answers support recommendations and readiness guidance. They must not be presented as qualifications for belonging.

### Step 6: Accessibility and Support Preferences

Members may optionally identify support needs that improve participation, such as:

- Mobility considerations
- Seating needs
- Hearing or visual accommodations
- Dietary needs
- Sensory considerations
- Communication preferences
- Other assistance requests

The onboarding flow should collect broad preferences only. Adventure-specific details belong in registration and readiness workflows.

Sensitive support information must remain private and visible only to authorized staff when operationally necessary.

### Step 7: Communication Preferences

Request permission separately for:

- Essential account email
- Adventure and transactional email
- Push notifications
- SMS alerts, when available
- Community activity notifications
- Marketing and promotional messages

Emergency and legally required communications must be distinguished from optional marketing preferences.

The app must explain that disabling a channel may limit delivery reliability for important adventure updates.

### Step 8: Household Setup

Members may:

- Continue as an individual
- Create a household
- Add a dependent later
- Accept an existing household invitation
- Indicate that they commonly book for other adults or minors

Household creation should not be mandatory during first-time onboarding.

### Step 9: Community Expectations

Present a concise summary of:

- Respectful conduct
- Safety expectations
- Photo and privacy awareness
- Anti-harassment standards
- Reporting tools
- No direct messaging at launch

Members must accept the community guidelines before posting, commenting, or attending protected member activities where required.

### Step 10: Personalized Trailhead

The first authenticated Trailhead should not be empty.

It should contain:

- A welcome tile
- Recommended adventures based on broad interests and location
- A prompt to complete optional profile details
- Saved or recently viewed adventures
- A simple explanation of Trailhead, Explore, Community, Passport, and Menu

The welcome tile should disappear after the member has meaningfully used the app or dismissed it.

## Progressive Onboarding

Information should also be collected contextually later.

Examples:

- Ask for emergency contacts when the first relevant registration requires them.
- Ask for dietary details when an adventure includes meals.
- Ask for guardian authority when registering a minor.
- Ask for precise pickup information only when transportation is selected.
- Ask for profile visibility preferences before the member first posts.

Contextual prompts must explain the benefit and allow deferral unless the information is required for the current action.

## Profile Completion

Profile completion should be represented by useful categories rather than a vanity percentage alone.

Suggested categories:

- Account verified
- Basic identity complete
- Discovery preferences added
- Communication preferences reviewed
- Household information reviewed
- Safety information available when needed
- Community guidelines accepted

Missing optional information must not be framed as failure.

## Guardian and Minor Onboarding

A minor may not independently create a fully active account unless permitted by age policy and applicable requirements.

Supported patterns:

- Guardian creates a dependent profile
- Guardian invites an eligible teen to claim limited account access
- Existing minor account requests guardian connection
- Host-created guest registration is later claimed through guardian approval

Guardian setup must include:

- Identity verification appropriate to the risk
- Relationship or authority declaration
- Consent records
- Clear visibility into what the minor can access
- Ability to revoke or modify delegated access

Minor accounts should default to stricter privacy settings.

## Household Invitation Flow

An adult household manager may invite another adult by email.

The invitee must:

- Create or sign into their own account
- Review the requested relationship
- Accept or decline
- Retain control of their own private profile information

Joining a household must not give one adult unrestricted access to another adult's sensitive records.

## Guest Account Claiming

When a purchaser registers a guest, the guest may later receive an invitation to claim their profile.

The claim process must:

- Verify the guest's contact channel
- Match the registration without exposing unrelated purchaser data
- Preserve completed waivers and registration answers
- Transfer appropriate control to the guest
- Keep purchaser responsibilities where payment or group management still applies

## Existing Member Matching and Duplicate Prevention

The system should detect likely duplicates using verified identifiers.

When a possible duplicate exists:

- Offer sign-in or account recovery
- Do not silently merge accounts
- Require verification before merging records
- Preserve purchase, Passport, household, and registration history
- Log administrative merges

## Consent Records

The system must store versioned acceptance records for:

- Terms of service
- Privacy notice
- Community guidelines
- Marketing consent
- Guardian consent
- Event-specific waivers where applicable

Each record should include:

- User or authorized actor
- Version
- Timestamp
- Source flow
- Relevant account or dependent

Material policy changes may require renewed acceptance.

## Privacy Controls During Onboarding

Members should be able to choose:

- Profile discoverability
- Display name behavior
- Profile photo visibility
- Whether activity appears in community-facing areas
- Whether Passport accomplishments are public, member-only, or private

Defaults should favor member safety over maximum exposure.

## Accessibility Requirements

Onboarding must support:

- Screen readers
- Dynamic text sizing
- Clear focus order
- High contrast
- Keyboard and switch navigation where applicable
- Plain-language explanations
- Error messages linked to the relevant field
- Saving progress between sessions
- Avoidance of time-limited forms unless security requires them

## Error and Recovery States

The system must handle:

- Verification link expiration
- Lost network connection
- Duplicate email
- Interrupted registration handoff
- Invalid invitation
- Expired household invitation
- Password reset failure
- Partial onboarding completion
- Account restriction

Recovery paths should preserve as much completed work as safely possible.

## Security Controls

Required controls include:

- Rate limiting
- Secure password storage
- Verification token expiration
- Protection against account enumeration
- Session invalidation after credential reset
- Audit logs for privileged account changes
- Additional verification for role elevation
- Abuse monitoring for repeated account creation

## Analytics

Track aggregate onboarding health without collecting unnecessary sensitive data.

Suggested events:

- Account creation started
- Account created
- Verification sent
- Verification completed
- Onboarding step completed
- Onboarding skipped
- Onboarding resumed
- Household setup started
- Household invitation accepted
- First adventure viewed after onboarding
- First save
- First registration started
- First community contribution

Primary metrics:

- Account creation completion rate
- Verification completion rate
- Time to first useful action
- Onboarding abandonment by step
- Percentage of members who reach a personalized Trailhead
- Recovery success after interrupted onboarding

## MVP Scope

The first release must include:

- Email and password registration
- Email verification
- Password reset
- Basic profile setup
- General location
- Interest selection
- Communication preferences
- Community guideline acceptance
- Optional household entry point
- Progressive onboarding prompts
- Personalized first Trailhead
- Preservation of registration context through account creation

The first release may defer:

- Phone authentication
- Social sign-in
- Passkeys
- Full device and session management
- Advanced account merging
- Teen self-service claiming
- Multi-factor authentication for ordinary members

## Acceptance Criteria

The specification is satisfied when:

1. A visitor can create and verify an account without losing the task that initiated sign-up.
2. A verified member reaches a useful, personalized Trailhead.
3. Optional onboarding fields may be skipped and completed later.
4. Sensitive information is requested only with clear purpose and appropriate privacy controls.
5. Household and guardian setup do not compromise adult or minor privacy.
6. Registration, saved adventures, and invitation context survive interrupted onboarding.
7. Members can recover access through a verified email flow.
8. Community participation remains blocked until required verification and guideline acceptance are complete.
9. Authentication and role changes are auditable.
10. The flow meets accessibility and error-recovery requirements.

## Related Specifications

- Product Vision
- Information Architecture
- Core Domain Model
- Adaptive Trailhead Specification
- Explore and Adventure Discovery Specification
- Registration, Checkout, and Ticketing Specification
- Member Profiles, Roles, Permissions, Guardians, and Households Specification
- Notifications, Communication, and Emergency Alerts Specification
- Platform Boundaries and Integrations
