# GoWorkout Adaptive Workout Structure V1

## Purpose

Workout structure is a first-class training preference and adaptive-learning signal.

A user's long-term preference informs planning. A session-level choice can override it for today without rewriting the permanent profile.

## Supported structures

- **Adaptive**: GoWorkout chooses a suitable structure from profile preference, learned behavior, session time, goal, and exercise compatibility.
- **Straight sets**: Complete working sets for one exercise before moving to the next.
- **Supersets**: Alternate two compatible exercises.
- **Tri-sets**: Rotate three compatible exercises. The default prescription is three rounds.
- **Circuit**: Rotate through a larger group with short transitions.
- **Hybrid**: Protect priority compound work as straight sets, then group compatible accessory work.

## Precedence

For a session, the structure decision follows this order:

1. Explicit structure selected for today's workout.
2. Permanent profile structure when it is not Adaptive.
3. Learned structure history when Adaptive is selected and the user's adaptation setting permits it.
4. Session heuristics based on goal, time, and exercise count.
5. Straight sets when no safe or compatible grouping can be formed.

## Profile controls

The training profile stores:

- preferred workout structure
- adaptation level: close, balanced, or optimize
- structure guardrails

Default guardrails:

- keep the first priority compound lift as straight sets
- avoid grouping exercises with the same primary movement pattern or overlapping primary muscles
- prefer practical grouping that reduces unnecessary transitions

## Session controls

Today's setup screen includes a Workout Structure step.

Changing the structure here applies to the current session only. The selection is stored with the completed workout so the learner can compare stated preference with actual behavior.

## Tri-set rules

A tri-set contains three compatible exercises.

Normal flow:

1. Exercise A, round 1
2. short transition
3. Exercise B, round 1
4. short transition
5. Exercise C, round 1
6. longer round rest
7. repeat for rounds 2 and 3

The default is three rounds.

If readiness has already identified an unusually poor recovery state, the session may reduce the tri-set to two rounds. This is a readiness adjustment, not a permanent preference change.

## Compatibility guardrails

Grouping should preserve the intended training purpose.

The system does not group exercises when it cannot form a compatible block. A requested grouped format may fall back to straight sets for the affected work.

Priority compound lifts can remain outside grouped blocks.

## Adaptive learning

Each completed workout records a structure observation with:

- requested structure
- recommended structure
- applied structure
- completion rate
- skipped-exercise rate
- duration
- time available
- setup
- readiness score
- routine and focus

The learner aggregates performance by structure.

A structure needs at least two completed observations before it can become the learned preferred structure.

The learner favors structures with stronger completion, lower skip rate, and repeated evidence. The Optimize setting gives learned structure history more influence than Balanced. Stick closely to my choice limits automatic structure changes.

## Persistence

Permanent structure preferences live in the workout profile JSON.

Session structure is stored on the workout record and readiness context.

Structure-learning aggregates live in the existing learner object inside the workout training program. No parallel profile or training database is introduced.
