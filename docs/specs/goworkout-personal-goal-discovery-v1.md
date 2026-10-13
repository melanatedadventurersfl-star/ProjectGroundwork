# GO Workout: Personal Goals & Baseline Discovery V1

## Purpose
An optional training mode for measurable achievements such as 60 consecutive push-ups, a 60-second forearm plank, pull-ups, squats, a measured running distance, or a custom exercise. GO Workout collects a performed baseline before it saves a personalized target or recommends progressions. Goals are separate from general fitness preferences.

## Entry points
- Home: Personal Goals feature card.
- Train: Personal Goals feature card.
- Performance: goal progress link.
- Profile: Personal Goals.
- Goal Lab: Set a Goal or Discover My Goals.

A user can keep an existing workout program while adding, editing, pausing, resuming, or deleting goals. Editing the general program, rebuilding it, or revisiting onboarding preserves goal records.

## Core V1 workflow
1. Choose a specific target or let the app recommend one after discovery.
2. Choose push-ups, plank, squats, pull-ups, running, cycling, walking, rowing, swimming, hiking, or a custom measurement.
3. Configure measurable target, optional deadline, and priority.
4. Complete a baseline assessment: tap to count reps or type the actual number, use the optional stopwatch or type time from an exercise machine, and enter distance in meters, kilometers, miles, yards, or feet. Record the exact exercise variation.
5. Record difficulty and discomfort. An assessment is self-recorded, not camera-verified.
6. Receive a first milestone and conservative example work.
7. Confirm and save the goal and its independently retained first baseline.
8. Reassess, view history, and compare goal metrics to the initial baseline.

The order is assessment-then-target in Discover My Goals mode. A fixed-target mode asks for the target first but requires a performed baseline before saving the goal.

## Model
Under Workout's existing account-synced training_program JSON:
- goalLab.version
- goalLab.goals[]: id, kind, name, exercise ID, unit, metric, variation, target, optional targetTimeSeconds, baseline, best, deadline, priority, status, timestamps, assessment history.
- goalLab.goals[].assessments[]: original value and unit, elapsedSeconds when recorded, measurementSource (manual, machine, watch, app), exercise variation, effort, timestamp. Every time-distance pair remains on one assessment.
- goalLab.draft: resumable goal-creation/test flow with a running timer timestamp when applicable, editable elapsed time text, optional goal time, selected measurement source.
- goalLab.selectedId: open goal.

No Go Melanated account, profile, or backend data is used. No new database table or migration is needed. Workout's authenticated cloud state remains authoritative after sync.

## Workout integration
- Goal Focus creates an optional on-demand Workout session, inside the existing warm-up/exercise/cooldown runner, for compatible movement goals with demonstrated baselines.
- It selects up to 2 or 3 exercises based on available session length, chooses controlled set volumes from personal-best measurements, and includes a supporting movement where available.
- Does not replace the existing training schedule or auto-increase every scheduled workout.
- Completed standard push-up, unassisted pull-up, or bodyweight squat sets can improve a goal's personal best when the exercise variation is comparable. An entire multi-set workout is not counted as one continuous set.
- Timed plank records support both a stopwatch and typed seconds. Running, walking, cycling, rowing, swimming, and hiking support distance plus optional elapsed time, entered manually without GPS, wearable, or machine integration.
- A custom timed-distance target such as 2,000 m in 9:00 requires both distance and elapsed time in the same assessment to count as achieved. A faster or longer distance recorded in another session must not be combined to claim success.
- Distance-unit changes convert the displayed target/baseline without inventing new assessments. Historical entries retain their original units and measurement source. Repetition-to-time changes still require a new baseline.
- Tests performed with a different variation are preserved in history but do not overwrite a best for the original variation.
- Pain/discomfort feedback pauses goal-specific prescriptions.

## Limitations for a later release
- No camera or wearable movement verification.
- No location or treadmill integration for distance.
- The optional Goal Focus session is an additional runner session, not automatically stitched into every scheduled program day.
- No personalized medical or injury assessment.
- No promise of achieving a specific target by a deadline.

## Verification
Run: node apps/member-app-prototype/workout/goal-lab.test.js

Test coverage: fixed target, interactive and manual baseline, machine-recorded time without app timer, paired time/distance goals, activity presets, distance conversion, reassessment, non-destructive target edit, incomparable variations, best completed set versus total volume, history serialization, discover-first recommendations, timer pause, and unavailable catalog handling.

## Manual-entry acceptance criteria
- A user can type 2,000 meters, type 9:00, and choose Exercise machine without starting the app timer. The result saves as one assessment and displays its measured pace (2:15 / 500 m).
- A user can type 12 reps without pressing the counter. A timed hold can be entered as 75 seconds or 1:15 without starting the stopwatch.
- A custom goal supports distance-only or distance plus a time target. Its target is reached only when one comparable assessment satisfies every required measurement.
- A user can select Running, Cycling, Walking, Rowing, Swimming, or Hiking without starting from scratch.
- Editing from m to km preserves the physical result and original source details, with no duplicate assessment.
