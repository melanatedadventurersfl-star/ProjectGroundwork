# Host Application + Review V1.1

## Goal
Turn host approval from a single textbox into a lightweight trust pathway that teaches expectations before a member is allowed to lead community outings.

## Member pathway
1. Host interest screen explains what hosting means and separates free-host approval from paid-host permission.
2. Application captures desired outing types, home area, group leadership/outdoor experience, expected group size, relevant certifications, paid-host interest, and motivation.
3. In-app Host Orientation covers planning accuracy, communication, safety leadership, welcoming the group, and closing out attendance.
4. Safety & community acknowledgement is required.
5. Submission creates a pending host record. Hosting tools remain locked until approval.

## Review states
- pending
- needs_info
- approved
- paused
- declined
- revoked

## Admin review card
Shows member identity, pathway readiness, requested paid access, outing types, area, expected group size, experience, motivation, certifications, reviewer notes, and current host stage.

Actions:
- Approve free host
- Needs info
- Pause
- Restore
- Decline
- Revoke
- Grant/remove paid-host permission after approval

## Guardrails
- Safety acknowledgement and orientation completion are required before server-side approval succeeds.
- Needs-info, decline, and revoke actions require reviewer context in the UI.
- New approvals start with host_stage = new.
- Paid hosting remains a separate permission and does not bypass payout onboarding.
- The system does not invent moderation-history data. Moderation context should be connected only after the production moderation schema is explicitly mapped.

## Future trust progression
New Host -> Established Host -> Trusted Host, driven by real completed outings, attendee feedback, cancellations, incident history, communication reliability, and policy signals.
