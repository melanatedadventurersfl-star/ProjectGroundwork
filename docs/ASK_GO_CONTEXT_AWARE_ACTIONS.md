# Ask Go Context-Aware Actions

## Goal
Move Ask Go from a generic chat surface to a lightweight day-planning flow with clear state transitions: discover → build → refine → confirm → go.

## Interaction rules
- Infer from natural language when the member already supplies time + vibe. Only ask for missing information.
- Once a plan exists, treat it as the primary artifact.
- Actions are generated from the actual plan state, not a fixed button row.
- Never show `Swap stop` unless at least two non-placeholder stops exist.
- Never show `Shorter` when the plan cannot meaningfully shrink.
- `Undo` appears only after a prior exchange that could have changed the plan.
- `Add food` is a choice flow, not a direct mutation.

## Food discovery
`Add food` switches to a dedicated business-discovery path backed by active `community_places` rows for the current city/state. Dining options are filtered by category/description and food style. Outdoor Trail Guide places are never substituted for restaurants.

Flow:
1. Member taps `+ Food`.
2. Go asks for Quick bite / Sit-down / Coffee-dessert / Surprise me.
3. Go shows matching dining options without changing the plan.
4. Member picks one.
5. Only then is the selected business added to the current itinerary.

Verified ownership labels are surfaced only when `ownership_verification_status=verified`.

## Plan lifecycle
### Discover
Free text plus Plan my day starter.

### Build
Go creates an initial itinerary from the member's request.

### Refine
Context-aware actions include Add food, Add stop or Swap stop, Shorter when applicable, Easier, and model-generated follow-ups.

### Confirm
`Looks good · Finish plan` marks the visible plan ready.

### Go
The action set changes to execution-oriented controls such as Start outing, Share, Invite, and Save.

## History
Existing Ask Go history continues to persist completed exchanges. Resuming a thread restores the latest itinerary from the saved conversation.

## Acceptance checks
- Add food never returns parks as food choices.
- Add food does not mutate the itinerary until a restaurant is selected.
- One-stop plans show Add stop instead of Swap stop.
- Multi-stop plans may show Swap stop.
- Confirmed plans stop showing refinement controls and expose execution actions.
- Free-text conversation remains available in every phase.
- Mobile lint and typecheck pass.
