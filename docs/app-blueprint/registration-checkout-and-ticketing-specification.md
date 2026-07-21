# Registration, Checkout, and Ticketing Specification

## Purpose

This document defines how a person moves from interest in an Adventure to confirmed attendance. It covers ticket selection, guest management, add-ons, waivers, payment, confirmation, waitlists, transfers, cancellations, refunds, and the handoff into Adventure Readiness.

The system must support simple purchases while remaining flexible enough for camping packages, transportation seats, meal options, group tickets, day passes, volunteer registrations, and event-specific requirements.

## Product Principles

1. **Clarity before conversion**  
   Members should understand what is included, what is not included, and what remains due before they pay.

2. **One registration, many configurations**  
   The same foundation should support an individual ticket, a couple, a family, a campsite, a group package, a volunteer role, or a transport-only option.

3. **No surprise obligations**  
   Waivers, guest details, payment schedules, site booking responsibilities, and event requirements must be visible before confirmation.

4. **Save progress**  
   Long or interrupted registrations should be recoverable without starting over.

5. **Separate purchase from readiness**  
   Checkout confirms the commercial transaction. Adventure Readiness tracks everything still needed afterward.

6. **Mobile-first and low-friction**  
   The flow should remain usable on a phone with minimal typing, clear progress, and large touch targets.

## Roles

### Purchaser

The person paying for the registration. The purchaser may or may not attend.

### Primary attendee

The person who owns the registration and receives the primary Adventure record.

### Guest attendee

A person included under the purchaser's registration.

### Minor attendee

A guest who requires guardian information, age-specific waivers, or special supervision rules.

### Volunteer

A participant registered for a defined role rather than a standard attendee ticket.

### Host or administrator

A person who configures inventory, registration questions, pricing, waivers, refunds, transfers, and attendance status.

## Core Objects

### Registration

The overall record connecting an Adventure, purchaser, attendees, selected inventory, payments, forms, and status.

### Ticket type

A purchasable attendance entitlement such as:

- General admission
- Overnight camping
- Day pass
- Transportation seat
- Couple package
- Group package
- Volunteer registration
- Child ticket
- Add-on-only access

### Ticket instance

A specific issued ticket assigned to one attendee or reservation unit.

### Add-on

An optional or required purchasable item such as:

- Tent package
- Air mattress
- Meal package
- Transportation
- Equipment rental
- Campsite upgrade
- Merchandise
- Activity upgrade
- Bedding
- Power access

### Reservation unit

A capacity-bearing resource that may not map one-to-one with attendees, such as a campsite, cabin, RV site, tent package, table, vehicle seat block, or group pod.

### Payment

A financial transaction or obligation tied to the registration.

### Waiver

A legal or policy acknowledgment tied to an Adventure, activity, attendee, or guardian.

### Registration question

A structured prompt used to collect information before or after payment.

## Registration States

A registration may move through these states:

- Draft
- Inventory held
- Payment pending
- Partially paid
- Confirmed
- Waitlisted
- Action required
- Cancelled by attendee
- Cancelled by host
- Transferred
- Refunded partially
- Refunded fully
- Payment failed
- Expired
- Checked in
- Completed

State changes must be timestamped and auditable.

## Entry Points

Registration may begin from:

- Adventure Detail
- Explore result card
- Trailhead recommendation
- Shared Adventure link
- Waitlist invitation
- Host-issued invitation
- Promo campaign
- QR code
- Rebooking or transfer flow

The flow should preserve the originating context for analytics and messaging.

## Registration Flow

### Step 1: Eligibility check

Before ticket selection, the system evaluates:

- Registration open or closed
- Member-only restrictions
- Age requirements
- Region or residency restrictions
- Invitation requirements
- Existing registration conflicts
- Capacity availability
- Required account status

The user receives a plain-language explanation when blocked.

### Step 2: Ticket selection

Each ticket option should display:

- Name
- Price
- Who or what it covers
- Included items
- Excluded items
- Remaining quantity when useful
- Registration deadline
- Refund or transfer summary
- Required companion ticket or prerequisite
- Whether external lodging or site booking is required

Tickets should not rely on vague labels such as Standard, Premium, or Package A without explanation.

### Step 3: Quantity and party structure

The purchaser chooses:

- Number of attendees
- Adults and minors
- Number of reservation units
- Guest relationships when required
- Whether attendee information will be entered now or invited later

The system must prevent invalid combinations, such as four attendees attached to a two-person package unless additional tickets are selected.

### Step 4: Attendee information

Minimum information may include:

- Legal or preferred name
- Email
- Phone
- Date of birth or age band
- Emergency contact
- Accessibility needs
- Dietary needs
- Shirt size or equipment size when relevant
- Guardian relationship for minors

Only collect information needed at that stage. Sensitive operational information may be deferred to Adventure Readiness.

### Step 5: Add-ons and upgrades

Add-ons should be grouped by purpose:

- Stay
- Transportation
- Food
- Comfort
- Gear
- Activities
- Merchandise

Each add-on should show:

- Price
- Quantity rules
- Who receives it
- Availability
- Compatibility with selected ticket
- Whether it changes capacity or readiness requirements

Required add-ons must not be visually disguised as optional purchases.

### Step 6: Questions and acknowledgments

Registration questions may be:

- Registration-level
- Attendee-level
- Ticket-level
- Add-on-level
- Guardian-level

Question types may include:

- Single choice
- Multiple choice
- Short text
- Long text
- Number
- Date
- Consent checkbox
- File upload in later phases

Questions should support conditional display based on earlier answers.

### Step 7: Waivers and policies

Before payment, show a concise summary of:

- Cancellation policy
- Refund policy
- Transfer policy
- Conduct expectations
- Risk acknowledgment
- Media release status
- Transportation rules
- Site or venue rules

Long legal documents may open separately, but the user must be able to review them before agreeing.

Waivers may be completed:

- During checkout
- After purchase as a readiness task
- By each adult attendee
- By a guardian for a minor

The system must distinguish acceptance of policy from completion of a legally required signature.

### Step 8: Review order

The review screen must show:

- Adventure name and date
- Ticket quantities
- Attendees or placeholders
- Add-ons
- Fees
- Taxes when applicable
- Discounts
- Credits
- Deposit due now
- Remaining balance and due date
- Cancellation and transfer summary
- External costs not collected by the app

The total must remain visible before the final payment action.

### Step 9: Payment

Supported payment patterns may include:

- Full payment
- Deposit plus scheduled balance
- Installment plan
- Free registration
- Promo or scholarship code
- Host-issued credit
- Manual/offline payment recorded by an administrator
- Split payment in a later phase

Payment actions must be idempotent so repeated taps do not create duplicate charges.

### Step 10: Confirmation

Confirmation should include:

- Registration status
- Amount paid
- Remaining balance
- Ticket summary
- Attendee summary
- Confirmation number
- Next required action
- Add to calendar
- View Adventure
- Share guest invitation when applicable
- Receipt access

The confirmation screen should immediately transition the user from purchasing into preparing.

## Inventory and Capacity

Inventory may exist at several levels:

- Total Adventure attendance
- Ticket type
- Transportation seats
- Campsites or lodging units
- Equipment rentals
- Meal quantities
- Activity sessions
- Add-ons

Inventory holds should:

- Begin when the user enters checkout or payment
- Have a visible expiration time when capacity is scarce
- Release automatically after expiration
- Avoid overselling during concurrent purchases

Hosts should be able to set:

- Capacity
- Sales start and end
- Per-order limits
- Member limits
- Hidden or invitation-only inventory
- Bundled inventory dependencies
- Waitlist behavior

## Pricing

Pricing rules may support:

- Fixed price
- Early-bird price
- Member price
- Child price
- Group price
- Deposit
- Pay-what-you-can in a later phase
- Promo codes
- Automatic discounts
- Complimentary tickets
- Host credits

All discounts should identify their source and expiration.

Fees must be shown before the final payment step. The product must not add unexplained costs after the user commits.

## Group and Guest Registration

A purchaser may register multiple people under one order.

The system should support:

- Entering all guest details immediately
- Sending secure guest invitations
- Assigning tickets later
- Replacing a guest before the transfer cutoff
- Separate waiver completion
- Separate readiness tasks per attendee
- Shared reservation-unit information

The purchaser can see completion status for group tasks but should not automatically see sensitive responses from other adults.

## Minor Attendees

Minor registration should support:

- Guardian identification
- Guardian consent
- Age-specific ticket rules
- Minor-specific waivers
- Emergency contact requirements
- Activity eligibility
- Supervision requirements
- Medical or accommodation information with restricted visibility

The system must not expose a minor's personal data to unrelated attendees.

## Waitlists

When capacity is unavailable, the Adventure may offer a waitlist.

Waitlist configuration may include:

- Ticket-specific queue
- Party-size limits
- Automatic or manual invitations
- Invitation expiration window
- Deposit requirement
- Priority rules

Waitlist users should see:

- Which ticket they requested
- Party size
- Date joined
- Current status
- Whether queue position is shown
- What happens when space opens

An invitation should temporarily reserve the offered inventory and clearly state the response deadline.

## Payment States and Failures

Payment states include:

- Not required
- Authorized
- Processing
- Paid
- Partially paid
- Failed
- Past due
- Refunded
- Disputed

When payment fails:

- Preserve the registration draft when possible
- Explain whether inventory remains held
- Provide a retry action
- Prevent duplicate charges
- Notify the host when operational intervention is required

A partially paid registration may remain confirmed, conditional, or cancelled based on host policy.

## Payment Plans and Balances

For deposits or installments, show:

- Total price
- Amount paid
- Remaining balance
- Next due date
- Scheduled payment method
- Grace period
- Consequences of missed payment

Balance reminders should route directly to payment.

Hosts should be able to:

- Record manual payments
- Waive balances
- Extend due dates
- Cancel scheduled payments
- Issue credits
- View payment history

## Receipts and Records

Each completed payment should create a receipt containing:

- Adventure
- Purchaser
- Amount
- Date
- Payment method summary
- Taxes and fees
- Discounts
- Refunds
- Registration number

Receipts should remain available in the account and may also be emailed.

## Transfers

Transfers may include:

- Reassigning an attendee
- Moving to another ticket type
- Moving to another date or Adventure
- Transferring an entire registration

Transfer rules must specify:

- Eligibility window
- Transfer fee
- Price difference
- Non-transferable items
- Waivers that must be redone
- Impact on add-ons and readiness

The original and new attendee must receive confirmation when identity or ownership changes.

## Cancellations and Refunds

Cancellation policy may vary by Adventure, ticket, or date.

The cancellation flow should show:

- Refund amount
- Non-refundable amount
- Credits offered
- Add-ons affected
- Consequences for guests
- Whether external bookings must be cancelled separately

Refund states include:

- Requested
- Under review
- Approved
- Processing
- Completed
- Denied

Hosts must be able to issue:

- Full refund
- Partial refund
- Item-level refund
- Credit instead of refund
- Manual refund record

Every refund should retain an audit trail and update the registration balance.

## Host Cancellation or Postponement

When an Adventure is cancelled or postponed, the system should support:

- Automatic notification
- Refund or credit options
- Transfer to a replacement date
- Preservation of attendee and readiness information
- New consent when terms materially change

A postponed Adventure must not silently change dates without explicit communication.

## Registration Changes After Purchase

Members may be allowed to update:

- Guest names
- Dietary needs
- Transportation choice
- Add-ons
- Emergency contacts
- Accessibility requests

Changes that affect price or inventory should create a recalculated order and payment or refund adjustment.

## Adventure Readiness Handoff

After confirmation, the system creates readiness requirements from:

- Ticket type
- Add-ons
- Attendee age
- Transportation selection
- Lodging selection
- Activity choices
- Host requirements
- Missing waivers
- Outstanding balances

Examples:

- Complete waiver
- Add emergency contact
- Choose meal option
- Pay remaining balance
- Submit guest name
- Review packing list
- Confirm transportation pickup

Checkout must never imply that payment alone means fully ready.

## Tickets and Admission Credentials

A ticket credential may contain:

- Attendee name
- Adventure name
- Ticket type
- Confirmation number
- QR or barcode
- Check-in status
- Relevant access level

Security rules:

- Do not expose sensitive attendee information in the code
- Allow credential revocation
- Prevent reused credentials when single-entry rules apply
- Support offline validation for downloaded event rosters in a later phase

A reservation unit may have one credential while individual attendees have separate identity records.

## Check-In Integration

Check-in should validate:

- Registration status
- Ticket validity
- Required balance state
- Required waiver state
- Attendee identity when needed
- Prior check-in

Hosts may override non-safety blockers with a reason and audit trail.

Check-in should not require unnecessary online steps when the host has downloaded the roster.

## Notifications

Registration-related notifications may include:

- Draft reminder
- Inventory hold expiring
- Payment confirmation
- Payment failure
- Balance due
- Guest invitation
- Guest action incomplete
- Waitlist invitation
- Transfer confirmation
- Cancellation confirmation
- Refund update
- Host cancellation or postponement

Urgent financial or access issues belong in notifications, not only Campfire.

## Privacy and Security

- Payment card details should be handled by a compliant payment provider rather than stored directly by the app.
- Sensitive attendee data must use role-based access.
- Adult guests should control their own private readiness information.
- Guardian records must be protected.
- Registration edits, payments, refunds, and overrides must be logged.
- Confirmation links and guest invitations must expire or be revocable.

## Host Administration

Hosts should be able to:

- Create and order ticket types
- Configure capacity and inventory
- Define prices, deposits, fees, and discounts
- Add registration questions
- Attach waivers and policies
- Configure add-ons
- Open or close sales
- Invite specific members
- View registrations and attendee counts
- Search by purchaser or attendee
- Record manual payments
- Process transfers, cancellations, and refunds
- Export operational rosters
- See incomplete registrations and payment risk

Administrative actions should use permissions and audit logs.

## Analytics Events

Suggested events:

- registration_started
- eligibility_blocked
- ticket_selected
- ticket_quantity_changed
- attendee_added
- guest_invitation_created
- add_on_selected
- registration_step_completed
- registration_abandoned
- promo_applied
- payment_started
- payment_succeeded
- payment_failed
- registration_confirmed
- waitlist_joined
- waitlist_offer_sent
- waitlist_offer_accepted
- balance_paid
- transfer_started
- transfer_completed
- cancellation_requested
- refund_issued

Analytics must not contain full payment data, waiver text, medical details, or other sensitive personal information.

## MVP Scope

The first release should support:

- Account-based registration
- Standard, group, child, transportation, and package ticket types
- Per-ticket capacity
- Basic add-ons
- Guest attendees
- Registration questions
- Policy acknowledgment
- Full payment and free tickets
- Promo codes
- Confirmation and receipts
- Waitlist joining and manual offers
- Basic cancellation and host-issued refunds
- Transfer by host
- Readiness task generation
- QR-based ticket credential
- Host registration roster

## Later Phases

Later releases may add:

- Installment plans
- Split payments
- Automated waitlist promotion
- Self-service transfers
- Scholarship applications
- Pay-what-you-can pricing
- Advanced tax handling
- Multiple currencies
- External lodging integrations
- Dynamic package builder
- Offline host check-in
- Resale marketplace, only if policy and safety needs justify it

## Acceptance Criteria

The specification is satisfied when:

1. A member can understand ticket inclusions and total cost before payment.
2. A purchaser can register themselves and guests without creating contradictory attendee records.
3. Capacity cannot be oversold through simultaneous checkout attempts.
4. Payment success creates a confirmed registration exactly once.
5. Payment failure preserves a recoverable path without duplicate charges.
6. Required guest, waiver, balance, and event tasks appear in Adventure Readiness.
7. Waitlisted users can receive and act on a time-limited offer.
8. Cancellations, transfers, and refunds maintain an auditable financial and attendance history.
9. Hosts can manage registrations without receiving unrestricted access to sensitive attendee information.
10. Confirmation clearly communicates what is complete and what the member must do next.

## Product Rules

- Never hide mandatory costs until the final step.
- Never label a registration fully ready when required tasks remain.
- Never delete financial history when a registration changes.
- Never treat the purchaser and attendee as automatically identical.
- Never expose adult guest private information to the purchaser without consent.
- Never sell inventory that cannot be fulfilled.
- Always pair a failed or blocked state with a clear recovery path.
- Always show the user the next meaningful action after purchase.