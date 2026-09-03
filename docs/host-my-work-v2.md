# Host My Work V2

## Main screen

- Compact My Work header and actionable Open, Blocked, and Critical filters.
- Active events show remaining task count, critical count, and completion progress.
- Work areas aggregate open tasks across every active event.
- Quick Add is a persistent floating input. Event selection appears only when needed.
- Import and secondary actions move out of the primary work flow.

## Work areas

Each work area opens a dedicated screen instead of expanding another panel on My Work.

Supported areas:
- Marketing
- Food
- Vendors
- Venue
- Operations
- Guest Communications
- Safety
- Inventory

Each area shows current open work across all events and allows filtering by event.

## Adaptive task packs

Before presenting new tasks, the selected event is checked for existing work.

Each pack item is classified as:
- `complete`: a matching task is complete, or supported event-component settings clearly indicate the step is already filled out.
- `open`: a matching task already exists and is not complete.
- `missing`: no supported completion or existing-work signal was found.

Only missing items are selected by default. Complete and already-open items are not selectable for creation.

Example: if Little Camp of Horrors already has a completed `Finalize menu` task and an open `Create shopping list` task, Build Food Plan shows those as Complete and Already in My Work. Neither is selected. Only remaining Food tasks are offered through Add Missing Tasks.

## Safety rules

- Task packs do not overwrite existing tasks.
- Task pack insertion uses stable `campaign_id + task_key` conflict handling to prevent duplicate pack tasks.
- Existing Host campaign permissions and RLS remain the source of authorization.
- Event data is treated as complete only when a supported completion signal exists. Unknown fields are not inferred as complete.
