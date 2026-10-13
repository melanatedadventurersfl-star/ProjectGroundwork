# GO Workout Connections V1

## Scope
- An opt-in social identity with unique @username. Discovery is off by default.
- Search for discoverable usernames, request, accept, decline, remove, block, and unblock.
- Connections are separate from saved workout partners. Accepted connections appear in Together's partner selector.
- Existing shared workout partners and six-character join code flows stay available.
- Goal sharing is per goal: Private, Goal name only, Goal and status, or Goal and progress details.
- Encouragement messages to accepted connections with a 240-character limit and server enforced 10-message daily limit per pair.
- A basic in-app encouragement inbox with mark-read controls.

## Source of truth and security
- Private exercise history, readiness, body measurements, coaching notes and trainingProgram.goalLab stay in workout_user_state. Never give peers access to that table.
- Only selected, minimal goal projections are copied to workout_goal_shares. RLS permits owners and accepted, unblocked connections to read.
- Discovery requires explicit permission. Connection requests and encouragement are checked by SECURITY DEFINER database functions.
- A personal goal without a concrete timeline is not classified as on track or behind. Status says baseline pending, progress recorded, paused or target reached.
- Goal privacy changes and deletions propagate when saved. If the server cannot process a change, the app displays a sync error and retries during subsequent synchronization. Users should not treat a failed privacy sync as completed.
- A removed social connection does not automatically erase old joint workout history. Blocking stops social actions and direct shared workout invitations.

## UX
Together contains a Connections section above the existing lobby creation card. A connection profile provides username and discovery settings. Connected profiles show explicitly shared goals and an encouragement field. Members can opt into sharing their own goals in the My goal sharing card.

## Deployment sequence
1. Merge frontend files and database migration as a coordinated release.
2. Run the checked-in Node syntax/privacy tests and apply SQL migration to a staging Supabase instance before production.
3. Test with two signed-in accounts: requests, accepts, removal, blocking, goal privacy downgrades, goal deletion, encouragement, and direct lobby creation.
4. Verify mobile web layout and existing saved partner/join-code regression paths.

## Deferred
Push notifications, voice encouragement, accountability agreements, shared challenges, scheduling and discover-by-name recommendations. V1 does not claim these are live.
