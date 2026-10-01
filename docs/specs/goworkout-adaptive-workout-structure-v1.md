# GoWorkout Adaptive Workout Structure V2

## Product rule

Workout structure belongs to the four-week program.

By the time a user reaches Today’s Setup or starts an exercise, the session already knows whether it uses straight sets, supersets, tri-sets, circuit work, or a hybrid layout.

The start-workout flow does not ask the user to choose a structure again.

## Program creation

The program setup stores the user’s preferred structure:

- Adaptive
- Straight Sets
- Supersets
- Tri-Sets
- Circuit
- Hybrid

When the four-week block is generated, every session receives a programmed structure.

If the user chooses a specific format, compatible sessions use that format.

If the user chooses Adaptive, GoWorkout decides the format during program generation. The decision can use:

- training goal
- planned session length
- number of exercises
- workout type
- learned structure history
- the user’s adaptation preference

The result is saved with the four-week program.

## Program changes

The Program screen shows the current structure strategy and the structure mix across the block.

Users can change the structure from Program > Workout Structure.

Changing the structure:

- updates remaining planned sessions
- does not change completed workout history
- keeps the current exercise plan and program goal
- regroups compatible exercises into the selected format
- keeps existing adaptive-learning history

## Readiness

Today’s Setup remains focused on today’s conditions:

- training location and available equipment
- energy
- soreness
- sleep
- available time

The screen shows the already-programmed workout format as read-only context.

Readiness can change volume, load, rest, exercise availability, or session length. It can reflow the existing programmed format around removed or substituted exercises, but it does not choose a new workout format.

## Tri-set behavior

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

Readiness can reduce working volume when recovery signals require it. That is a volume adjustment inside the programmed tri-set, not a new structure decision.

## Workout visibility

The user should be able to understand the session before starting it.

Workout previews group exercises visually by structure. Each group shows:

- structure name
- round or set count
- exercise order
- prescription
- round-rest information when relevant

The prepared workout screen includes the same roadmap.

During strength work, the runner keeps the current block visible:

- current structure
- current round or set
- current exercise
- next exercise in the block
- later exercise in the block when relevant

The full workout map remains one tap away.

## Adaptive learning

Completed workouts continue to record:

- requested program structure
- programmed structure
- applied structure
- completion rate
- skipped-exercise rate
- duration
- readiness
- setup
- routine and focus

Structure learning informs later program creation. It does not repeatedly redesign the format at workout start.

## Persistence

Permanent structure preferences live in the workout profile JSON.

The four-week Program Engine wrapper stores a structure plan for its sessions.

Each converted workout day receives the planned structure before readiness runs.

The completed workout record stores the applied structure for learner evaluation.
