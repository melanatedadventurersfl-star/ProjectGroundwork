# Community Safety 2.0

## Goal
Build a moderation system that is evidence-first, history-aware, proportional, appealable, difficult to misuse, and capable of scaling without replacing the core architecture later.

## Core model
Case -> Incident -> Evidence -> Enforcement -> Appeal -> Audit Event.

A single incident can collect multiple reports. Enforcement and appeals always reference the underlying incident/enforcement rather than creating unrelated records.

## Enforcement ladder
Default ordinary progression:

Advisory -> Warning 1 -> Warning 2 -> Restriction -> Suspension -> Longer suspension / ban review.

Formal warnings are active for 90 days. A third confirmed ordinary violation while two formal warnings remain active must escalate to a posting restriction, suspension, or ban review. Severe cases may bypass the ladder with a documented reason.

## Rolling conduct history
The 90-day warning window is not a reset.

- 90 days: active-warning calculation and immediate escalation.
- 12 months: repeat-offender context and stronger recommended enforcement.
- Lifetime: historical moderation record for authorized admins.

Member-facing UI shows factual history, not internal risk labels or scores.

## Enforcement capabilities
Initial capability restrictions:

- Posting restriction: blocks creating/editing posts and replies while browsing remains available.
- Reporting restriction: blocks submitting new Community reports while other access remains available.
- Suspension: blocks ordinary app access and routes to Account Standing.
- Ban: permanent suspension until explicitly reversed by an authorized administrator.

The data model should remain extensible for messaging, media upload, group creation, and outing creation restrictions.

## Content disposition
Content action is separate from account enforcement.

Admins choose one of:

1. Keep content.
2. Remove permanently.
3. Remove and allow edit/resubmit.

The originally reported version is preserved privately as evidence. Serious content such as threats, doxxing, predatory material, severe harassment, hate, or serious fraud is not eligible for edit-and-restore.

## Appeals
Eligible actions include warnings, posting restrictions, reporting restrictions, suspensions, and bans.

The original enforcement remains in effect while an appeal is pending unless explicitly paused by an authorized administrator.

Appeal lifecycle:

Submitted -> Under Review -> Upheld / Modified / Reversed.

Reversal immediately deactivates the enforcement and recalculates member standing. Modification preserves the confirmed violation while changing the consequence. Whenever staffing allows, the original moderator should not decide the appeal.

## False and abusive reporting
A dismissed report is not automatically abusive.

Admin outcomes must distinguish:

- No violation: good-faith report, no reporter penalty.
- Abusive report: confirmed deliberate misuse, retaliation, repeated targeting, coordinated reporting, or knowingly false/severely miscategorized reporting.

Abusive-report progression:

Advisory -> Warning -> Reporting restriction -> Suspension -> Ban review.

Reporter identity is never exposed to the reported member.

## Admin experience
### Community Safety dashboard
Top metrics:

- Open Reports
- High Priority
- Appeals
- Escalation Required
- Posting Restricted
- Reporting Restricted
- Suspended
- Banned

Primary destinations:

- Moderation Queue
- Escalation Required / Members with Violations
- Appeals Waiting
- Report Abuse
- Current Enforcement

### Moderation Queue
Cards summarize rather than expose every action button:

- priority
- report reason
- actual evidence
- member standing
- report count
- Review Case primary action

### Case review
Order:

1. Evidence
2. Why it was reported
3. Member standing
4. 90-day and 12-month conduct history
5. Related reports
6. Enforcement
7. Appeal
8. Timeline

### Take Action
Guided flow:

1. What happens to the content?
2. What happens to the member?
3. Duration when applicable.
4. Required moderator note for bans, severe bypasses, and overrides.

Weak enforcement is unavailable when active-warning escalation is mandatory. Stronger/weaker overrides require an audit reason.

### Safety Profile
Admin tabs:

Overview | History | Appeals | Reports

The overview surfaces current standing, active warnings, 12-month confirmed history, prior restrictions, and suspensions.

## Member experience
Destination: Account Standing.

Tabs:

Standing | Decisions | Appeals

### Standing
Shows:

- current status
- expiration/restoration time
- active warnings
- 12-month factual history count
- pending appeals
- privileges currently available/unavailable
- next-escalation explanation

### Decisions
Each enforcement receives a case reference and shows:

- action
- guideline/reason
- issue date
- expiration
- active/completed/reversed state
- whether content was removed
- appeal eligibility/status

Sensitive removed evidence does not need to be redisplayed. Internal moderator notes, reporter identity, internal risk labels, staff identity, and operational signals are never shown.

### Appeals
Each appeal receives a reference and tracks:

Submitted -> Under Review -> Decision.

Final state is Upheld, Modified, or Reversed. Reversed decisions visibly stop counting toward active standing.

## Notifications
Member notifications deep-link to the exact Account Standing decision/appeal context where possible.

Admin notifications cover high-priority reports, appeals, escalation thresholds, report abuse, and severe safety cases.

## Audit requirements
Every sensitive moderation change records actor, timestamp, member, previous state, new state, reason, related report/case/enforcement, and note where required. Historical records are preserved even after enforcement expires or is reversed.

## Implementation phases
### Phase A: foundation
- enforced third-violation escalation
- rolling 12-month conduct history
- reporting-restriction capability
- Account Standing member experience
- Community Safety admin dashboard
- appeal/decision history source of truth

### Phase B: case operations
- unified case detail screen
- duplicate-report consolidation
- report-abuse classification UI
- edit/resubmit content workflow
- appeal Modify controls
- direct admin moderation from Community posts
- stronger immutable audit event model

### Phase C: scale signals
- retaliation/pattern flags
- moderator assignment and role-based permissions
- richer safety analytics
- advanced risk signals where volume justifies them

Do not introduce device fingerprinting, complex AI risk scoring, moderator productivity scoring, or enterprise SLA/compliance machinery until scale creates a real operational need.
