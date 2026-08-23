export type InputSet = { id?: string; weight?: string | number; reps?: string | number; note?: string };
export type InputExercise = { id?: string; name?: string; sets?: InputSet[] };
export type InputWorkout = {
  id?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  date?: string;
  unit?: "kg" | "lbs";
  note?: string;
  source?: string;
  status?: "draft" | "completed";
  draftOfWorkoutId?: string | null;
  draftId?: string;
  exercises?: InputExercise[];
};

const USER_ID = "owner";
const cleanNumber = (value: unknown) => value === "" || value == null || !Number.isFinite(Number(value)) ? null : Number(value);

export function upsertWorkoutStatements(db: D1Database, payload: InputWorkout, status: "draft" | "completed", now: string) {
  if (!payload.id || !Array.isArray(payload.exercises)) throw new Error("Invalid workout");
  const date = payload.date ?? (payload.finishedAt || payload.startedAt || now).slice(0, 10);
  const statements = [
    db.prepare("INSERT INTO workouts (id, user_id, workout_date, status, draft_of_workout_id, unit, general_note, started_at, finished_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET workout_date=excluded.workout_date, status=excluded.status, draft_of_workout_id=excluded.draft_of_workout_id, unit=excluded.unit, general_note=excluded.general_note, started_at=excluded.started_at, finished_at=excluded.finished_at, source=excluded.source, updated_at=excluded.updated_at").bind(payload.id, USER_ID, date, status, status === "draft" ? payload.draftOfWorkoutId ?? null : null, payload.unit === "lbs" ? "lbs" : "kg", payload.note ?? "", payload.startedAt ?? null, status === "completed" ? payload.finishedAt ?? now : null, payload.source ?? "manual", now, now),
    db.prepare("DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)").bind(payload.id),
    db.prepare("DELETE FROM workout_exercises WHERE workout_id = ?").bind(payload.id),
  ];
  payload.exercises.forEach((exercise, exerciseIndex) => {
    const exerciseId = exercise.id || `${payload.id}-exercise-${exerciseIndex}`;
    statements.push(db.prepare("INSERT INTO workout_exercises (id, workout_id, name, position) VALUES (?, ?, ?, ?)").bind(exerciseId, payload.id, exercise.name?.trim() || "Exercise", exerciseIndex));
    (exercise.sets ?? []).forEach((set, setIndex) => {
      statements.push(db.prepare("INSERT INTO workout_sets (id, workout_exercise_id, position, weight, reps, note) VALUES (?, ?, ?, ?, ?, ?)").bind(set.id || `${exerciseId}-set-${setIndex}`, exerciseId, setIndex, cleanNumber(set.weight), cleanNumber(set.reps), set.note ?? ""));
    });
  });
  return statements;
}

export function deleteWorkoutContentStatements(db: D1Database, id: string) {
  return [
    db.prepare("DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)").bind(id),
    db.prepare("DELETE FROM workout_exercises WHERE workout_id = ?").bind(id),
  ];
}

export function recalculateExerciseFrequencyStatement(db: D1Database) {
  return db.prepare("UPDATE exercises SET training_frequency = (SELECT COUNT(DISTINCT w.workout_date) FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE w.user_id = exercises.user_id AND w.status = 'completed' AND we.name = exercises.name) WHERE user_id = ?").bind(USER_ID);
}
