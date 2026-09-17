export type WorkoutSet = {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
};

export type ExerciseTemplate = {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
};

export type WorkoutRoutine = {
  id: string;
  name: string;
  focus: string;
  durationMinutes: number;
  exercises: ExerciseTemplate[];
};

export type ActiveExercise = ExerciseTemplate & {
  sets: WorkoutSet[];
};

export type ActiveWorkout = {
  id: string;
  routineId: string;
  routineName: string;
  startedAt: string;
  exercises: ActiveExercise[];
};

export type WorkoutHistoryEntry = {
  id: string;
  routineId: string;
  routineName: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  exercises: ActiveExercise[];
  totalVolume: number;
  completedSets: number;
};

export type WorkoutStore = {
  history: WorkoutHistoryEntry[];
  activeWorkout: ActiveWorkout | null;
};
