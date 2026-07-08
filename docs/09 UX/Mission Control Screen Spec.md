# Mission Control Screen Spec

## Project Groundwork

Mission Control is the primary operational view inside a Workspace.

It is the first screen a user should see after opening a Workspace.

Mission Control should answer one question clearly:

> What needs my attention now?

---

# Purpose

Mission Control gives users a calm, useful summary of a Workspace.

It should help users understand:

- Current status
- Workspace health
- Today's priorities
- Upcoming milestones
- Open blockers
- Assigned work
- Recent activity
- Important resources
- Suggested next actions

Mission Control should reduce hunting.

Users should not need to open five separate tabs just to understand what is happening.

---

# Primary Users

Mission Control should adapt by role.

Primary roles:

- Organization Owner
- Workspace Lead
- Team Lead
- Worker
- Volunteer
- Member
- Client

Each role should see a version of Mission Control that matches their responsibility.

---

# Core Layout

Recommended desktop layout:

```text
+------------------------------------------------------+
| Workspace Header                                     |
| Name | Type | Status | Owner | Key Date | Actions     |
+------------------------------------------------------+
| Mission Health                                       |
| Health Score | Readiness | Timeline | Blockers       |
+---------------------------+--------------------------+
| Today's Priorities        | Upcoming Milestones      |
+---------------------------+--------------------------+
| Open Tasks                | People / Crew Status     |
+---------------------------+--------------------------+
| Resources / Documents     | Recent Activity          |
+---------------------------+--------------------------+
| Lessons / Notes           | Suggested Next Actions   |
+------------------------------------------------------+
```

Recommended mobile layout:

```text
Workspace Header
Mission Health
Today's Priorities
Upcoming Milestones
My Assignments
Open Blockers
Recent Activity
Suggested Next Actions
```

Mobile should prioritize action over completeness.

---

# Workspace Header

The header should show:

- Workspace Name
- Workspace Type
- Current Status
- Owner
- Key Date
- Visibility
- Primary Action Button

Example actions:

- Add Task
- Add Person
- Add Document
- Review Timeline
- Archive Workspace

The primary action should change based on Workspace state and user role.

---

# Mission Health

Mission Health is a summary of readiness, risk, and progress.

It may include:

- Overall Health
- Timeline Status
- Task Completion
- People Coverage
- Document Readiness
- Resource Readiness
- Budget Status
- Open Blockers

Mission Health should be easy to understand at a glance.

Suggested visual style:

- Large status card
- Simple score or label
- Clear supporting indicators
- No decorative metrics that do not support action

Example:

```text
Mission Health: On Track
Readiness: 78%
Timeline: 3 upcoming milestones
Blockers: 2 open
```

---

# Today's Priorities

This section should show the most important actions for the user today.

Priority rules may consider:

- Due date
- Blocker status
- Role responsibility
- Workspace phase
- Milestone proximity
- Manual pinning

Examples:

- Confirm venue details
- Assign setup lead
- Review open tasks
- Add missing document
- Finalize packing checklist

This section should not become a giant task list.

It should show the few items that deserve attention now.

---

# Upcoming Milestones

This section should show the next important dates or phase markers.

Each milestone should show:

- Name
- Date
- Status
- Related tasks
- Owner if applicable

Example:

```text
Crew Confirmed
Due Friday
4 related tasks
```

Milestones should help users understand momentum.

---

# Open Tasks

This section should summarize task activity.

It should show:

- Tasks due soon
- Tasks assigned to the current user
- Blocked tasks
- Recently completed tasks

Users should be able to jump from Mission Control to the full Tasks view.

---

# People and Crew Status

This section should summarize who is involved.

It may show:

- Workspace Lead
- Team Leads
- Assigned people
- Unfilled roles
- Pending confirmations
- Team status

For MVP, this can remain simple:

```text
People: 8 assigned
Open roles: 2
Pending: 1
```

---

# Resources and Documents

This section should surface important supporting materials.

Examples:

- Recently added documents
- Missing required documents
- Key resources
- Linked templates
- Important guides

This section should not replace the full Documents view.

It should surface what matters now.

---

# Recent Activity

Recent Activity shows what changed recently.

Examples:

- Task completed
- Person added
- Document uploaded
- Timeline updated
- Note added
- Workspace status changed

Activity should help users catch up quickly.

---

# Lessons and Notes

This section should expose useful knowledge.

During active work, it may show important notes.

After completion, it should help capture Lessons Learned.

Examples:

- Remember to confirm parking details earlier
- This vendor prefers two weeks notice
- Use the larger signs next time

This section supports Groundwork's memory.

---

# Suggested Next Actions

Suggested Next Actions should help users move forward.

For MVP, suggestions can be rule-based.

Examples:

- No tasks exist yet. Create your first task.
- This Workspace has no owner assigned.
- Add a milestone to start the timeline.
- Capture a lesson before archiving.
- Create a template from this completed Workspace.

Future versions may use AI assistance.

---

# Empty States

Mission Control should handle new Workspaces gracefully.

Example empty state:

```text
This Workspace is ready for setup.
Start by adding a timeline, tasks, and people.
```

Empty states should suggest the next useful action.

---

# MVP Version

The MVP version of Mission Control should include:

1. Workspace Header
2. Mission Health summary
3. Today's Priorities
4. Upcoming Milestones
5. My Tasks or Open Tasks
6. People summary
7. Documents summary
8. Recent Activity
9. Suggested Next Actions

The MVP does not need advanced analytics or AI.

It should prove that one screen can make a Workspace understandable.

---

# Success Criteria

Mission Control succeeds if a user can open a Workspace and quickly answer:

- What is this Workspace?
- What is the current status?
- What needs attention?
- What am I responsible for?
- What happens next?
- Where do I go for more detail?

---

# Design Standard

Mission Control should feel like a capable coordinator.

It should not feel like a dashboard full of numbers.

It should turn scattered information into calm, useful direction.
