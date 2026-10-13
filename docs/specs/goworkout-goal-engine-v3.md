# GO Workout Goal Engine V3: measured goals, safe progression and evidence

## Scope
Extend the existing signed-in Workout `trainingProgram.goalLab` state. Preserve the workout program, history, partner settings, previous goal records, and comparative baselines. No database migration.

## New measured rowing goal
- A selectable **Row 2,000 meters** template records the uninterrupted distance in **meters**, with the exact indoor rowing variation, user feedback, and separate comparable reassessments.
- Existing custom goals with rowing-related names show **SET UP MEASURED ROWING GOAL**. This starts a new measured-distance setup. It must not relabel previous reps, time, or miles as meters.
- For rowing baselines, offer conservative guided practice distances based on the last comparable distance. Do not promise pace or completion time.
- The current workout runner has no meter-based rowing set contract. Do not insert strength/cable/dumbbell rows as rowing intervals. A focused strategy with confirmed rowing-machine access can expose a guided rowing practice card.
- Guided practice includes a self-reported meter log in `goalLab.strategy.rowingSessions[]`; it does not change `assessments[]`, `assessmentBest`, or a verified personal best. Only comparable reassessments count toward the 2K goal.
- When automatic prescription is unavailable, show a goal-specific explanation, not an unexplained unsupported-variation warning.

## Training coordination
- Keep the existing three-option strategy: integrate, separate focus, or assessment tracking.
- Show the effects and limits before approval. Explain supported exercises, guided rowing, tracking-only goals, and unchanged original workouts.
- Explicitly let users choose whether training extras can increase the session by up to 10 minutes. In time-limited mode, skip work that does not fit, rather than replacing existing exercises.
- Retain the existing safeguards: workout readiness, soreness, fatigue and pain responses, equipment checks, priority limits, and goal-specific activity spacing.
- Preserve versioned strategy revisions and user-approval checks. Existing Smart/Review baseline behavior remains.

## Progress evaluation
- Show `Baseline recorded`, `Improving`, `Holding steady`, `Review progress`, `Needs reassessment`, or `Needs attention`, as supported by self-recorded comparable assessment evidence.
- No numeric prediction of success. Completed ordinary training sets and manually logged rowing practices do not verify completion of an assessment goal.
- Show guided rowing practice entries separately from ordinary completed runner workouts in the weekly review.

## Limitation
A guided rowing practice is not automatically inserted as a scheduled runner workout. Real meter-based rowing runner support, structured interval execution, elapsed-time/pace metrics, and device import require additional exercise-runner work. The interface must state this clearly.

## Verification
- `node apps/member-app-prototype/workout/goal-lab.tests.cjs`
- `node apps/member-app-prototype/workout/goal-strategy.tests.cjs`
- Confirm active custom rowing goals can start a distinct meter-based goal without rewriting history.
- Confirm no rowing exercise is substituted automatically and no unsupported integrated strategy is approved.
- Confirm explicit equipment access and guided rowing log preserve verified baseline data.
- Confirm progress explanations are derived from comparable assessments only.
- Confirm time-constrained mode refuses additions that would extend a full session, and old approvals still behave as before.
