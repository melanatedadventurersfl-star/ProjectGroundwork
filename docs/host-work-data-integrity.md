# Host Work Data Integrity

## Goal

Every Host Center surface must agree on the operational facts for an event.

The same event and task data must produce the same values for:

- open work
- overdue work
- work that needs scheduling
- task completion percentage
- blocked and critical work
- event identity
- duplicate task handling
- event date warnings

## Shared source of truth

`apps/mobile/src/hosting/workIntegrity.ts` owns the low-level integrity rules.

`apps/mobile/src/hosting/workModel.ts` adapts those rules to hydrated Host campaigns and tasks.

`apps/mobile/src/hosting/eventOperations.ts` exposes the shared task metrics alongside finance, vendor, and communication metrics.

`getEventOperationsSummary()` also routes its task calculations through the integrity module so older Host Center surfaces cannot fall back to raw `due_at < now` logic.

## Timing model

A task has one timing state.

### Calendar

A calendar date is an explicit date that falls inside the trusted planning window.

Trusted planning window:

- up to 180 days before event start
- through 14 days after event end

Calendar dates can become overdue.

### Relative

Relative event timing describes a date in relation to the event, for example:

- 60 days before event
- 7 days before event

Relative timing remains distinct from a dependency.

When a relative task has a trustworthy generated `due_at`, that date can become overdue.

### Dependency

Dependency timing describes work that waits for another condition, for example:

- After inventory
- Once venue is confirmed
- Pending vendor response

Dependency timing never becomes overdue solely because a stale `due_at` exists underneath it.

### Unscheduled

No calendar date or scheduling rule exists.

The task belongs in Needs Scheduling.

### Review date

A date exists but is outside the trusted event planning window.

The date does not count as overdue.

The task belongs in Needs Scheduling until the date is corrected.

## Event date integrity

An event is flagged for date review when:

- start or end date is invalid
- end is before start
- the event spans more than 31 days

Long spans are not silently treated as valid operating windows.

The interface should show `Review event dates` with the reason.

## Duplicate campaign identity

Exact duplicate campaign candidates use this identity:

- normalized event title
- normalized location
- start calendar day
- end calendar day

Shared work views show one canonical record for an exact duplicate group.

The canonical record prefers:

1. a campaign the current host can manage
2. the campaign with more task context

The Events screen surfaces a possible-duplicate warning instead of deleting records automatically.

No database record is deleted by this layer.

## Duplicate task identity

Task duplication is checked at two levels.

### Stable task key

Repeated identical task keys are collapsed.

### Semantic identity

Tasks with the same normalized title and category inside one campaign are treated as the same operational task even when they were created by different sources.

The canonical task favors:

1. complete
2. blocked
3. critical/high priority
4. in progress or review
5. dated work

This prevents repeated component/template tasks from inflating Open and Overdue counts.

## Shared task completion

Task completion percentage is:

`deduplicated completed tasks / all deduplicated tasks`

This percentage must be labeled as task completion when shown to hosts.

It is separate from milestone readiness, ticket performance, or general event health.

## Surfaces

The shared integrity rules are applied to:

- Host Center My Work
- Events
- Event Work
- Campaign list
- Work Areas
- Task Packs
- event operations summaries consumed by Host Center dashboard and event builder

## Work Area filtering

When no event is selected, a Work Area header reports the visible total across active canonical events.

When one event is selected, the header reports only the selected event's visible task count.

The header must never show an all-events count above an empty selected-event list.

## Task Pack covered state

When a Task Pack has zero missing items:

- do not show `Add 0 Missing Tasks`
- show a covered state
- explain that all recommended work is complete or already in My Work

## Safety rules

The integrity layer does not:

- delete duplicate campaign records
- merge campaign records automatically
- rewrite event dates automatically
- invent due dates
- turn dependency labels into calendar dates
- create missing Task Pack items without host selection

## Acceptance criteria

- My Work and Events return the same overdue count for the same canonical event data.
- Event Work uses the same overdue logic as My Work.
- Legacy event summary consumers no longer use raw `due_at < now` logic.
- Relative event timing is distinguishable from dependency timing.
- Dependency-timed work cannot become overdue from stale hidden calendar data.
- Review-date tasks do not count as overdue.
- A long or invalid event date range is visibly flagged.
- Exact duplicate event records do not appear as separate event cards in shared work views.
- Duplicate task titles/categories do not inflate operational counts.
- Task completion uses deduplicated task records everywhere this metric is shown.
- Work Area counts change with the selected event filter.
- Task Packs with no missing work show a covered state instead of an Add 0 action.
