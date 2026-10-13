# GO Workout Your Circle V2

## Experience

Together now begins with Your Circle: connection count, new activity count, accountability partner count, upcoming scheduled workout, activity feed, and direct access to the existing shared-workout setup. The existing Connections cards, goal-sharing controls, direct partner invitations, and join-code flow remain.

## Real-time activity

Postgres triggers record in-app notifications for:
- connection request and acceptance
- encouragement
- direct workout invitation
- owner-approved shared goal completion
- accountability request, acceptance, and voluntary check-ins

Notifications display a recipient-only read status, a badge on Together, and explicit activity preferences. Live updates use Supabase Realtime with a 45-second foreground polling fallback while Together is visible. No background or remote device push delivery is claimed.

The only automatic goal notification is goal completion for goal shares whose visibility includes status. The notification itself uses generic language, not private training measurements.

## Goal progress

The assessment-based goal status uses the app's stored 4-, 8-, and 12-week windows. With at least two comparable assessments and a recent reassessment, the system can label a goal On track, Ahead of schedule, or Needs attention. It otherwise shows Waiting for reassessment, Progress recorded, Needs reassessment, Paused, Goal reached, or Review target date. Recorded exercise sets are not treated as proof of reaching a single-test goal. All goals remain private unless explicitly shared.

## Accountability

Existing accepted connections can request weekly or biweekly accountability, optionally tied to an already-shared goal. Both parties agree before the program becomes active, can pause or end participation, and can voluntarily submit check-ins. Supported signals are on track, need support, recovery, and celebrating progress. Check-ins are visible only to parties in an accepted, unblocked connection. Ending the connection removes the agreement and check-in history.

The dashboard calculates check-in due dates from acceptance or each member's last check-in. It does not automatically send personal performance data or pressure a person on recovery days.

## Staging and two-account release gate

1. Run GO Workout Connections CI, including syntax and regression tests.
2. Apply `20261013031000_workout_your_circle_v2.sql` to a staging Supabase database, verify triggers, RLS, and RPC permissions.
3. Sign in as accounts A and B. A sends B a request; B receives the notification, accepts, and A sees acceptance. Confirm usernames and profiles respect discovery consent.
4. A shares a goal by name, then status, then details. Confirm B sees only approved fields. Revoke sharing and verify B immediately loses the goal. Confirm unrelated account C cannot read it.
5. A sends encouragement, initiates a direct workout invite, and B receives activity updates. Confirm previous workout history is unchanged and the original six-character join-code flow still works.
6. A requests accountability. B accepts. Each member submits a check-in and sees the activity notice. Pause, resume, and end the agreement; confirm check-in and reminder state follows correctly.
7. B blocks A. Confirm requests, messages, goal views, and direct invitations are inaccessible. Verify the agreement is removed.
8. Test no-notification preferences, offline/reconnect state, stale assessment status, no-goal empty state, sign-out/sign-in on another account, and narrow mobile screen widths.

## Not in this release

Native background push, scheduled server-delivered reminders, voice messages, calendar invites and multi-person challenges. They require separate delivery services and opt-in settings.
