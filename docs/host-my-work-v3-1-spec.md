# Host Center My Work V3.1

## Goal

My Work should help a host decide what to do next without turning the page into a raw task database.

## 1. Status model

Show compact status controls for:

- Open
- Blocked
- Critical
- Overdue
- Needs Scheduling

`Needs Scheduling` replaces the user-facing `No Date` label.

Blocked and Critical receive stronger visual treatment than ordinary status counts.

## 2. Date integrity

A task may only count as Overdue when its calendar due date is credible for the event.

Date states:

- Scheduled: valid calendar date inside the event planning window.
- Dependency timing: the task is driven by a rule such as `After Inventory`, not a calendar date.
- Needs scheduling: no calendar date or dependency rule exists.
- Review date: a stored calendar date falls outside the supported event planning window and should not drive urgency.

Initial planning window:

- 180 days before the event start.
- 14 days after the event end.

Tasks outside that window must not appear as overdue. They appear under Needs Scheduling with `Review date` context.

Dependency timing such as `After Inventory` must not count as overdue or Needs Scheduling. Task detail should show it as a dependency rule.

## 3. Event cards

Each active event card shows:

- Readable event name
- Event date
- Remaining open tasks
- Critical count
- Task completion percentage

The progress label must explicitly say it is task completion.

## 4. Work Area states

Each Work Area card shows one of:

- `N open`
- `Complete` when matching tasks exist and all are complete
- `No tasks yet` when no matching task has ever been created

A zero should never be ambiguous.

## 5. Quick Add

Quick Add always shows the selected event context before a task is submitted.

When focused, the event selector includes enough title and date context to distinguish similar events.

Quick Add confirmation should identify the event.

## 6. Work Area screens

Work Area tasks remain grouped by event.

Each event group header shows:

- Event name
- Event date
- Open task count

Tasks added from a Task Pack may show a temporary `New` marker during the current navigation flow when practical.

## 7. Adaptive Task Packs

Task Pack states remain:

- Complete
- Already in My Work
- Missing

Requirements:

- Use `Already in My Work`, not `Already open`.
- Completed items display evidence when available, including `Completed task` or `Already filled out in event setup`.
- Existing open items remain tappable.
- Event selection uses one compact selector rather than a long row of event chips.
- The primary `Add N Missing Tasks` action stays accessible while reviewing a long pack.
- After bulk add, show a confirmation with an Undo action.
- Undo removes only the tasks created by that bulk action.

## 8. Task detail

Task detail keeps visible:

- Event
- Work Area
- Priority
- Due date
- Assigned person
- Plan owner
- Status
- Dependency

When a due label represents dependency timing, show it under Dependency Timing rather than presenting it as a calendar due date.

If a task is Blocked and no dependency is recorded, show `Blocked reason not recorded` so the missing context is visible.

Free-form notes and persisted blocked reasons require task-schema support and are not part of this no-schema-change increment.

## 9. Overflow menu

The top-right overflow control becomes a real menu with individual actions.

Supported now:

- View all open tasks
- View completed tasks

Secondary items remain individually visible but clearly marked if their dedicated workflow is not connected yet:

- Import task list
- Manage templates
- Task settings

## 10. Completed tasks

The full task list supports a Completed view for completed tasks in active events.

Completed tasks do not appear in normal My Work counts.

## 11. Priority ranking

Needs Attention ranking order:

1. Blocked + Critical
2. Overdue + Critical
3. Blocked
4. Critical
5. Overdue
6. Due within 7 days

Only trustworthy calendar dates contribute overdue or due-soon urgency.

## Acceptance criteria

- Stale dates no longer inflate Overdue.
- `After Inventory` does not behave like a calendar due date.
- Needs Scheduling replaces No Date in the UI.
- Event names remain distinguishable through title and date context.
- Work Area zero states distinguish Complete from No tasks yet.
- Bulk Task Pack creation can be undone.
- Task Pack CTA remains accessible on long lists.
- Existing Task Pack tasks say Already in My Work.
- Work Area event headers show counts and dates.
- Quick Add visibly identifies the destination event.
- Overflow actions are individual menu items.
- Completed tasks can be viewed separately.
