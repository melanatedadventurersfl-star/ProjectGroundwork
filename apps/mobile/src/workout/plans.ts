import type { WorkoutRoutine } from './types';

export const workoutRoutines: WorkoutRoutine[] = [
  {
    id: 'upper-a',
    name: 'Upper A',
    focus: 'Chest, back, shoulders, arms',
    durationMinutes: 45,
    exercises: [
      { id: 'bench-press', name: 'Barbell Bench Press', targetSets: 3, targetReps: '8-10' },
      { id: 'lat-pulldown', name: 'Lat Pulldown', targetSets: 3, targetReps: '8-12' },
      { id: 'shoulder-press', name: 'Seated Shoulder Press', targetSets: 3, targetReps: '8-10' },
      { id: 'cable-row', name: 'Cable Row', targetSets: 3, targetReps: '10-12' },
      { id: 'biceps-curl', name: 'Dumbbell Curl', targetSets: 2, targetReps: '10-12' },
    ],
  },
  {
    id: 'lower-a',
    name: 'Lower A',
    focus: 'Quads, glutes, hamstrings',
    durationMinutes: 45,
    exercises: [
      { id: 'back-squat', name: 'Back Squat', targetSets: 3, targetReps: '6-8' },
      { id: 'romanian-deadlift', name: 'Romanian Deadlift', targetSets: 3, targetReps: '8-10' },
      { id: 'leg-press', name: 'Leg Press', targetSets: 3, targetReps: '10-12' },
      { id: 'leg-curl', name: 'Leg Curl', targetSets: 3, targetReps: '10-12' },
      { id: 'calf-raise', name: 'Calf Raise', targetSets: 3, targetReps: '12-15' },
    ],
  },
  {
    id: 'upper-b',
    name: 'Upper B',
    focus: 'Chest, back, delts, triceps',
    durationMinutes: 45,
    exercises: [
      { id: 'incline-db-press', name: 'Incline Dumbbell Press', targetSets: 3, targetReps: '8-10' },
      { id: 'chest-supported-row', name: 'Chest Supported Row', targetSets: 3, targetReps: '8-12' },
      { id: 'lateral-raise', name: 'Lateral Raise', targetSets: 3, targetReps: '12-15' },
      { id: 'neutral-pulldown', name: 'Neutral Grip Pulldown', targetSets: 3, targetReps: '10-12' },
      { id: 'triceps-pressdown', name: 'Triceps Pressdown', targetSets: 2, targetReps: '10-12' },
    ],
  },
  {
    id: 'lower-b',
    name: 'Lower B',
    focus: 'Posterior chain and legs',
    durationMinutes: 45,
    exercises: [
      { id: 'deadlift', name: 'Deadlift', targetSets: 3, targetReps: '5-6' },
      { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', targetSets: 3, targetReps: '8-10' },
      { id: 'leg-curl-b', name: 'Seated Leg Curl', targetSets: 3, targetReps: '10-12' },
      { id: 'leg-extension', name: 'Leg Extension', targetSets: 3, targetReps: '10-12' },
      { id: 'calf-raise-b', name: 'Standing Calf Raise', targetSets: 3, targetReps: '12-15' },
    ],
  },
];
