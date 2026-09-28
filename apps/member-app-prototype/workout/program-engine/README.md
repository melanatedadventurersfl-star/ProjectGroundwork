# GoWorkout Program Engine v1

Isolated deterministic foundation for personalized GoWorkout programming.

## Implemented
- Controlled movement, muscle, activity, and stretch taxonomies
- Strength exercise library with equipment, goals, progression, and substitution groups
- Real stretch/mobility library with dynamic, mobility, static, and breath-assisted work
- User profile normalization with hard equipment/exclusion constraints
- Strategy generation for 2-5 training days
- Four-week block generation
- Movement-slot based exercise selection
- Exercise-specific prescriptions
- Upper/lower/full-body warm-up generation
- Exact 5, 10, and 15 minute stretch session generation
- Validation rules
- Conservative progression decision logic
- Automated scenario tests

## Deliberately not connected to live workout execution yet
The live GoWorkout UI remains unchanged. This engine should be proven independently before it becomes the source of truth for sessions.

## Run tests
```bash
cd apps/member-app-prototype/workout/program-engine
node tests.js
```

## Browser use
Load `index.js` and use `window.GoWorkoutProgramEngine`.

Example:
```js
const program = GoWorkoutProgramEngine.buildProgram({
  goal: 'hypertrophy',
  experience: 'intermediate',
  sessionsPerWeek: 4,
  sessionMinutes: 45,
  equipment: ['dumbbell','bench','cable','machine'],
  stretchMinutes: 10
});
console.log(program);
```
