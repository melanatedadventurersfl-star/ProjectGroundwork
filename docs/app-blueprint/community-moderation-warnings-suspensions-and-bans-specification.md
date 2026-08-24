# Community Moderation: Warnings, Restrictions, Suspensions, and Bans

## Purpose

Go Melanated moderation protects members, preserves trust, and gives administrators a consistent enforcement framework. Enforcement is progressive for ordinary violations but may skip directly to suspension or permanent removal when safety requires it.

This policy applies to community posts, comments, member interactions, outings, hosting behavior, and conduct connected to Go Melanated community activity.

## Principles

1. **Safety first.** Credible threats, stalking, hate, predatory conduct, fraud, doxxing, and serious real-world safety concerns may bypass progressive enforcement.
2. **Proportionality.** The action should match the severity, context, history, and likelihood of repeated harm.
3. **Documented decisions.** Formal enforcement creates an immutable moderation-history record including the acting administrator, reason, action, related report, duration, and internal note.
4. **Reporter privacy.** The reported member never receives the reporter's identity or private reporter note.
5. **Member clarity.** Members are told the enforcement category, public-facing reason, duration when applicable, and whether an appeal is available.
6. **No automatic lifetime strikes.** Formal warnings are active for 90 days, then remain historical without counting as active escalation strikes.
7. **Human discretion.** The escalation ladder guides administrators but does not force an unsafe or disproportionate result.

## Enforcement ladder

### Level 0: No violation

The report is dismissed. No enforcement record is created against the member.

### Level 1: Advisory

Use when education is more appropriate than discipline. Examples include minor incivility, low-impact rule confusion, or first-time conduct that does not justify a formal strike.

- Recorded in moderation history.
- Member receives a low-priority private notice.
- Does not count as an active warning.
- Content may remain or be removed depending on context.

### Level 2: Formal warning

A confirmed Community Guidelines violation.

- Recorded in moderation history.
- Active for 90 days.
- Member receives a high-priority notification.
- May be paired with content removal.
- Active warning count is visible to administrators.

Suggested ordinary escalation:

- 1 active warning: formal warning.
- 2 active warnings: formal warning and consider a 24-hour posting restriction.
- 3 active warnings: consider a 7-day suspension.
- Further violations during the active-warning window: consider a 30-day suspension or permanent ban based on severity and history.

This is guidance, not an automatic punishment engine.

### Level 3: Posting restriction

The member may browse but cannot create or edit community posts or comments for the restriction period.

Default duration: 24 hours when an administrator does not choose another duration.

Typical use:

- repeated disruptive posting,
- escalating arguments,
- repeated low-to-moderate violations after warnings,
- situations where a cooling-off period is appropriate.

### Level 4: Temporary suspension

The member's account is suspended for a defined period and the app routes them to their Account Status screen.

Default duration: 7 days when an administrator does not choose another duration.

Typical use:

- serious harassment,
- repeated violations after prior warnings/restrictions,
- credible but still-investigated safety concerns,
- temporary emergency containment while administrators review a serious incident.

### Level 5: Permanent ban

The member is permanently suspended from participation. Permanent bans have no automatic expiration.

Typical use:

- credible threats of violence,
- stalking or targeted harassment,
- hate-based attacks,
- sexual exploitation or predatory behavior,
- doxxing or deliberate disclosure of private information,
- serious fraud or scams,
- impersonating staff for deceptive purposes,
- ban evasion,
- severe real-world safety risk at a Go Melanated outing or event,
- repeated violations showing that lesser enforcement has failed.

Permanent bans require an internal moderator note.

## Enforcement reasons

Administrators should choose the closest applicable reason and may add an internal note:

- Harassment or bullying
- Hate or discriminatory conduct
- Threats, violence, or safety risk
- Sexual misconduct or predatory behavior
- Privacy violation or doxxing
- Fraud, scam, or deceptive conduct
- Spam or repeated disruption
- Dangerous activity
- Impersonation
- Repeated Community Guidelines violations
- Ban evasion
- Other

## Content removal

Content removal is separate from account enforcement. An administrator may:

- remove content with no member enforcement,
- issue an advisory or warning while leaving content visible,
- remove content and issue an advisory/warning/restriction/suspension/ban.

The report retains a snapshot of removed content for moderation review.

## Member notifications

Formal enforcement notifications must never expose reporter identity or private moderation notes.

Notifications should communicate:

- enforcement action,
- public-facing reason,
- expiration date when applicable,
- active warning count when relevant,
- link to Community Guidelines,
- link to Account Status for restrictions, suspensions, and bans,
- appeal availability.

## Appeals

Members may appeal posting restrictions, temporary suspensions, permanent bans, and formal warnings.

- One appeal per enforcement action.
- Appeal submission does not automatically lift enforcement.
- Appeals are marked Pending, Upheld, or Reversed.
- Another administrator should review when practical.
- Reversal deactivates the enforcement and restores the member's status when no other active restriction, suspension, or ban remains.
- Internal appeal notes are not shown to the member.

## Administrator experience

The Moderation Queue must not use one-click Warn or Ban buttons without context. Selecting **Take action** opens an enforcement sheet containing:

- action type,
- duration for timed actions,
- remove-content toggle,
- internal moderator note,
- clear explanation of what the selected action does,
- confirmation button.

Permanent ban confirmation requires an internal note.

## Data model

`community_member_enforcements`

- member
- related report
- action type
- reason
- public message
- internal note
- issuing administrator
- start and expiration timestamps
- active/revoked state
- created timestamp

`community_moderation_appeals`

- enforcement
- member
- appeal reason
- status
- deciding administrator
- decision note
- timestamps

## Expiration behavior

- Formal warnings stop counting as active after 90 days.
- Timed posting restrictions and suspensions expire automatically when status is evaluated.
- An expired enforcement remains in moderation history.
- Member profile status returns to `active` only when no other active restriction, suspension, or permanent ban remains.

## Access behavior

- Active posting restriction: member cannot create/edit community posts or comments.
- Active suspension or permanent ban: member is routed to Account Status instead of the normal signed-in application experience.
- Administrators and the master account cannot be suspended through the standard community-report enforcement flow.

## Audit requirements

Every formal enforcement must identify the administrator who took action and preserve the related report. Admin-only notes must never be exposed through member-facing queries.
