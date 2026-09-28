# GoWorkout Program Engine v1.2

An isolated, deterministic programming layer for GoWorkout. The live workout execution flow is intentionally untouched until the engine is proven.

## Current capabilities
- Controlled movement, muscle, activity, stretch, mobility, and conditioning taxonomies
- Exercise metadata for equipment, goals, difficulty, progression, and substitution groups
- Hard equipment and persistent exercise-exclusion filtering
- 2-5 day training strategies
- Four-week blocks with Base, Build, Overload, and Consolidate phases
- Movement-slot based exercise selection with explainable reasons
- Exercise-specific set, rep, rest, intensity, and progression prescriptions
- Contextual upper/lower warm-ups
- Exact 5, 10, and 15 minute targeted stretch sessions
- Exact 5, 10, and 15 minute mobility sessions
- Low-equipment conditioning selection
- Exercise substitutions that preserve movement intent
- Accessory supersets for session efficiency
- Session time budgets
- Three-movement minimum viable workouts for shortened sessions
- Dedicated recovery/mobility activities per week
- Program validation and deterministic output
- Conservative history-based progression decisions

## Block behavior
Week 1: Base. Establish repeatable technique and working prescriptions.

Week 2: Build. Maintain volume while nudging effort upward.

Week 3: Overload. Increase volume and/or effort.

Week 4: Consolidate. Reduce volume and effort to absorb the block before the next program version.

## Automated tests
Run:
```bash
cd apps/member-app-prototype/workout/program-engine
node tests.js
```

The scenario suite covers program shape, validation, stretching, mobility, equipment constraints, exclusions, substitutions, weekly progression, time budgeting, minimum viable workouts, supersets, recovery frequency, conditioning constraints, performance progression, and deterministic output.

## Browser inspection
Load `index.js`, then:
```js
const E = window.GoWorkoutProgramEngine;
const program = E.buildProgram({
  goal: 'hypertrophy',
  experience: 'intermediate',
  sessionsPerWeek: 4,
  sessionMinutes: 45,
  equipment: ['dumbbell','bench','cable','machine'],
  priorities: ['chest','lateral_delts'],
  stretchMinutes: 10,
  mobilitySessionsPerWeek: 1
});
console.log(program);
```

## v1.2 feedback loop
- Readiness scoring returns normal, reduced, or recovery modes from energy, sleep, soreness, and stress.
- Readiness-adjusted sessions are cloned so the canonical prescription remains unchanged.
- Performance ingestion reconciles completed exercises and sets against the planned session and calculates adherence.
- Muscle-volume accounting separates primary sets from secondary contribution.
- Time compression preserves priority movements before removing accessory work.
- Adaptation decisions can continue, simplify, reduce, or progress the next block.
- Program revisions create a new immutable version with a parent-version reference.

## Next engine layer
Before UI integration, add persistent program/version storage, richer per-muscle volume targets, exercise-history-aware selection, discomfort/limitation routing, calendar scheduling, post-workout feedback rules, and a larger production exercise/stretch library.
