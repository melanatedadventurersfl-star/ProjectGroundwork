# GoWorkout media production

This directory is the source of truth for avatar exercise image production.

The current workout catalog contains **49 exercises**. Earlier planning counted 43, but the live catalog now contains 49, so this tracker follows the repository rather than the older estimate.

## Files

- `avatars.json` locks the four V1 avatar identities and the shared visual system.
- `exercise-specs.json` defines the instructional start/end pose, camera view, equipment context, and form rule for every current catalog exercise.
- `media-status.json` tracks every required image by exercise, avatar, and position.

## Production rule

Every standard exercise needs 8 separate production images:

1. Malik start
2. Malik end
3. Drew start
4. Drew end
5. Nia start
6. Nia end
7. Maya start
8. Maya end

Each image is its own canvas. Do not create production collages.

## Status workflow

`missing → generated → needs-review → approved`

Use `needs-redo` whenever the person, equipment, position, anatomy, form, crop, or branding is wrong.

Only approved assets should be referenced by `avatar-media.js`.

## Current progress

- 5 exercises fully approved
- 40 approved images
- 44 exercises still pending
- 352 images still required for full V1 strength coverage

Approved now:

- Dumbbell Bench Press
- One-Arm Dumbbell Row
- Leg Press
- Dumbbell Romanian Deadlift
- Leg Curl

## Repository asset convention

```
apps/member-app-prototype/workout/assets/exercises/<exercise-id>/<avatar-id>/position-1.webp
apps/member-app-prototype/workout/assets/exercises/<exercise-id>/<avatar-id>/position-2.webp
```

Avatar IDs:

- `masc-athletic` = Malik
- `masc-full` = Drew
- `fem-athletic` = Nia
- `fem-full` = Maya

## Batch size

Generate and review 3 exercises at a time, 24 images total. Do not move a batch into the production manifest until all eight images for an exercise have been reviewed.
