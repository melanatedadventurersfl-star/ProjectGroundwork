# Go Melanated Team Meetings V1

## Product intent

Team Meetings V1 makes meetings part of event operations instead of a separate calendar feature. A meeting belongs to an event workspace, uses the event team already attached to that event, and can produce event decisions and follow-up tasks.

## V1 scope

### Teams hub

The Teams area becomes the entry point for event teams and meetings.

It must show:

- Upcoming meetings across active host events
- Active event teams and member counts
- Recent completed meeting history
- A Schedule Meeting action

### Schedule a meeting

A campaign manager can:

- Choose an active event
- Add a meeting title
- Set start and end date/time
- Add an optional physical location
- Add an optional virtual meeting link
- Invite all or selected event team members

The event owner and `adventure_staff_assignments` remain the source of truth for meeting attendees. V1 does not create a second team directory.

### RSVP

Invited team members can respond:

- Going
- Maybe
- Can't attend

The organizer can see attendee response state from the meeting workspace.

### Team Brief

The meeting workspace shows structured event status from data already stored in Go Melanated:

- Overdue tasks
- Critical tasks
- Unassigned tasks
- Open decisions
- Completed work since a previous completed meeting when that comparison is available

V1 does not claim external calendar availability or infer information that is not stored in the product.

### Agenda

Team members can add agenda items and mark them complete.

Campaign managers can use Prepare Agenda. This action proposes agenda items from:

- Open campaign decisions
- Critical or high priority work
- Overdue work

This V1 action is deterministic. It does not require live transcription or an autonomous AI agent.

### Notes

Campaign managers can save shared notes to the meeting record.

### Decisions

A campaign manager can record a decision during the meeting.

A meeting decision:

- Is stored in the existing campaign decision system
- Records the final decision text
- Can have a team owner
- Stores the source meeting ID

The event workspace remains the canonical decision record.

### Follow-up tasks

A campaign manager can create a follow-up task from the meeting and assign it to an event team member.

The task:

- Is stored in the existing campaign task system
- Uses Meeting Follow-up as its category
- Stores the source meeting ID
- Appears in the normal event work system

### Complete meeting

A campaign manager can mark a meeting complete.

Completion creates a compact recap containing:

- Number of recorded decisions
- Number of follow-up tasks
- Agenda completion count

Completed meetings stay in meeting history.

## Permission model

Meeting access follows the existing campaign permission model.

- Campaign staff can read meetings, attendees and agenda items
- Campaign managers can create, edit and complete meetings
- Invited attendees can update their own RSVP
- Campaign staff can add and update agenda items
- Campaign managers control attendee membership and create linked tasks and decisions

## Explicitly deferred

The following are not part of this V1 release:

- Live audio capture
- Speech-to-text meeting transcription
- Automatic speaker identification
- AI changing event data from spoken conversation
- Google Calendar availability lookup
- Outlook Calendar availability lookup
- External calendar sync
- Automatic email or SMS invitations
- Recurring meeting series
- Vendor guest access
- Meeting polls
- Automatic attendee communications after a decision
- Autonomous vendor outreach
- Automatic budget changes

These require separate integrations, permission controls or reliability work and should not block the basic meeting workflow.

## V1 acceptance criteria

1. A campaign manager can schedule a meeting from Teams.
2. The meeting is attached to an existing host campaign.
3. The organizer can select event team attendees.
4. An invited attendee can RSVP.
5. The meeting shows an event-status brief from stored campaign data.
6. Team members can build and complete an agenda.
7. A campaign manager can save meeting notes.
8. A campaign manager can create a campaign decision from the meeting.
9. A campaign manager can create and assign a campaign task from the meeting.
10. Linked tasks and decisions retain the source meeting ID.
11. A campaign manager can complete the meeting and generate a recap.
12. Completed meetings remain visible in meeting history.
