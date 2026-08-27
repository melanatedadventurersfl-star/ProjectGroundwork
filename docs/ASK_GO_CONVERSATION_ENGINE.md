# Ask Go Conversation Engine

## Goal

Ask Go must behave like a continuing outdoor-planning conversation, not a sequence of isolated searches. A member should be able to say things like “make it easier,” “not that one,” “add lunch,” “swap the second stop,” or “what else?” and have Go modify the same adventure context without restarting.

## Product principles

1. **Conversation is the interface, session state is the brain.** The transcript is not the source of truth for the active adventure.
2. **Refinement mutates the current plan.** Follow-ups should update constraints, selections, or itinerary state rather than launch an unrelated search.
3. **Fallback must still converse.** If AI generation is unavailable, Go should preserve the active adventure session and continue modifying it deterministically.
4. **References must resolve.** Phrases such as “the first one,” “the second stop,” “that one,” and “what else?” must operate on concrete selected place IDs.
5. **Negative preferences persist.** Rejected places and explicit exclusions must remain excluded until the member starts over or changes the constraint.
6. **The active adventure survives navigation/reload.** Session state is persisted locally per Trail Guide city.
7. **Repair beats restart.** “No, I meant…” and plan edits should revise the existing state.
8. **One clarification at most when necessary.** Ask Go should prefer making a useful recommendation with editable assumptions over interrogating the member.

## Session model

Each city has one persisted active `AdventureSession` with:

- `mode`: discover, compare, plan, or detail
- `constraints`
  - difficulty
  - water preference or exclusion
  - trail preference or exclusion
  - duration
  - food-stop preference
  - quieter/less-crowded preference
- `selectedPlaceIds`
- `rejectedPlaceIds`
- `activePlan`
- `previousPlan`
- `lastIntent`
- `updatedAt`

The session is stored in `expo-sqlite/kv-store` under a versioned city-specific key.

## Intent mutations

### Planning

Prompts including build, plan, itinerary, half-day, full-day, or “make me an adventure” set `mode=plan`.

### Refinement

- “make it easier” -> difficulty=beginner
- “near water” -> water=true
- “no beach” / “no water” -> water=false
- “hiking” -> trail=true
- “no hiking” -> trail=false
- “add lunch” / “food” -> foodStop=true
- “quieter” / “less crowded” -> quieter=true
- “make it shorter” -> duration=short
- “half day” -> duration=half-day
- “full day” -> duration=full-day

### Reference/edit commands

- “not that one” / “not the first one” rejects the current first selection
- “swap the second stop” rejects the second selected place and rebuilds around the remaining plan
- “what else?” excludes currently selected places from the next result set
- “go back” / “undo that” restores the prior plan snapshot when available
- “start over” / “new adventure” clears the active session

## AI-path behavior

Before invoking the `member-guide` Edge Function, the client appends a compact structured session summary to recent conversation context. This gives the model a stable representation of current mode, constraints, selections, rejections, and itinerary without forcing it to reconstruct them from prose.

The request also includes the raw session object for future server-side use.

## Fallback-path behavior

Fallback ranking uses the persisted session as well as the newest query.

Rules:

- positive constraints boost matching destinations
- explicit exclusions penalize incompatible destinations
- rejected destination IDs receive a hard exclusion penalty
- existing selected places receive a continuity boost unless the user asks for different options
- planning mode generates or regenerates an itinerary rather than returning a fresh disconnected result list
- refinement responses explicitly communicate that the existing plan was updated

## Plan behavior

Default fallback half-day plan:

1. first selected Trail Guide stop
2. break or food stop
3. second selected Trail Guide stop

Short mode collapses to one primary destination. Full-day mode can add a third optional stop.

When a plan is rebuilt, the previous plan is retained so a later “go back” can restore it.

## Persistence

Session persistence is deliberately separate from the visible transcript. The current adventure context survives screen navigation and app restart. Storage failure must never block recommendation delivery.

## Acceptance criteria

1. “Build me an adventure” followed by “make it beginner friendly” updates the same plan.
2. “Near water” after that preserves beginner difficulty and adds the water constraint.
3. “Add lunch” changes the active itinerary instead of returning a new park search.
4. “Swap the second stop” replaces only the second destination while maintaining other constraints.
5. “Not that one” excludes the rejected destination from subsequent fallback results.
6. “What else?” produces different options without repeating current selected places.
7. “Go back” restores the prior itinerary when a previous version exists.
8. If the AI route falls back, all behaviors above still work.
9. Reloading Ask Go retains the active adventure context for that city.
10. “Start over” explicitly clears the active adventure state.
11. Typecheck and lint pass.

## Non-goals for this iteration

- server-synced cross-device conversation history
- autonomous booking or purchasing
- live traffic-aware routing
- permanent long-term preference memory beyond the active city session

Those can be layered on once the core conversation engine is stable.
