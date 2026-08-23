import { getD1 } from "../db/d1";

const USER_ID = "owner";

type ReadWorkoutsOptions = {
  status?: "draft" | "completed";
  includeNotes?: boolean;
  from?: string;
  to?: string;
  exerciseId?: string;
};

export async function readWorkouts(options: ReadWorkoutsOptions) {
  const db = getD1();
  const includeNotes = options.includeNotes ?? true;
  const filters = ["w.user_id = ?", "w.status = ?"];
  const bindings: unknown[] = [USER_ID, options.status ?? "completed"];
  let exerciseName: string | undefined;

  if (options.from) {
    filters.push("w.workout_date >= ?");
    bindings.push(options.from);
  }
  if (options.to) {
    filters.push("w.workout_date <= ?");
    bindings.push(options.to);
  }
  if (options.exerciseId) {
    const exercise = await db.prepare("SELECT name FROM exercises WHERE id = ? AND user_id = ?").bind(options.exerciseId, USER_ID).first<{ name: string }>();
    if (!exercise) throw new Error("EXERCISE_NOT_FOUND");
    exerciseName = exercise.name;
    filters.push("EXISTS (SELECT 1 FROM workout_exercises matched WHERE matched.workout_id = w.id AND matched.name = ?)");
    bindings.push(exerciseName);
  }

  const where = filters.join(" AND ");
  const workoutOrder = options.status === "draft" ? "w.updated_at DESC" : "w.workout_date DESC, w.finished_at DESC";
  const workoutRows = await db.prepare(`SELECT w.* FROM workouts w WHERE ${where} ORDER BY ${workoutOrder}`).bind(...bindings).all<Record<string, unknown>>();
  const exerciseFilters = [...filters];
  const exerciseBindings = [...bindings];
  if (exerciseName) {
    exerciseFilters.push("we.name = ?");
    exerciseBindings.push(exerciseName);
  }
  const exerciseWhere = exerciseFilters.join(" AND ");
  const exerciseRows = await db.prepare(`SELECT we.* FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE ${exerciseWhere} ORDER BY we.position`).bind(...exerciseBindings).all<Record<string, unknown>>();
  const setRows = await db.prepare(`SELECT ws.* FROM workout_sets ws JOIN workout_exercises we ON we.id = ws.workout_exercise_id JOIN workouts w ON w.id = we.workout_id WHERE ${exerciseWhere} ORDER BY ws.position`).bind(...exerciseBindings).all<Record<string, unknown>>();
  const highlightRows = await db.prepare(`SELECT ph.* FROM workout_pr_highlights ph JOIN workouts w ON w.id = ph.workout_id WHERE ${where} ORDER BY ph.workout_date, ph.lift_type`).bind(...bindings).all<Record<string, unknown>>();

  const setsByExercise = new Map<string, Record<string, unknown>[]>();
  for (const row of setRows.results as Record<string, unknown>[]) {
    const key = String(row.workout_exercise_id);
    setsByExercise.set(key, [...(setsByExercise.get(key) ?? []), row]);
  }

  const exercisesByWorkout = new Map<string, Record<string, unknown>[]>();
  for (const row of exerciseRows.results as Record<string, unknown>[]) {
    const key = String(row.workout_id);
    exercisesByWorkout.set(key, [...(exercisesByWorkout.get(key) ?? []), row]);
  }

  const highlightsByWorkout = new Map<string, Record<string, unknown>[]>();
  for (const row of highlightRows.results as Record<string, unknown>[]) {
    const key = String(row.workout_id);
    highlightsByWorkout.set(key, [...(highlightsByWorkout.get(key) ?? []), row]);
  }

  return (workoutRows.results as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    status: row.status === "draft" ? "draft" : "completed",
    draftOfWorkoutId: row.draft_of_workout_id ? String(row.draft_of_workout_id) : null,
    date: String(row.workout_date),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    unit: row.unit === "lbs" ? "lbs" : "kg",
    note: includeNotes ? String(row.general_note ?? "") : undefined,
    source: String(row.source ?? "manual"),
    prHighlights: (highlightsByWorkout.get(String(row.id)) ?? []).map((highlight) => ({
      lift: String(highlight.lift_type),
      setId: String(highlight.workout_set_id),
      weight: Number(highlight.weight),
      unit: highlight.unit === "lbs" ? "lbs" : "kg",
      weightKg: Number(highlight.weight_kg),
      previousBestKg: highlight.previous_best_kg == null ? null : Number(highlight.previous_best_kg),
      improvementKg: highlight.improvement_kg == null ? null : Number(highlight.improvement_kg),
    })),
    exercises: (exercisesByWorkout.get(String(row.id)) ?? []).map((exercise) => ({
      id: String(exercise.id),
      name: String(exercise.name),
      sets: (setsByExercise.get(String(exercise.id)) ?? []).map((set) => ({
        id: String(set.id),
        weight: set.weight == null ? "" : String(set.weight),
        reps: set.reps == null ? "" : String(set.reps),
        note: includeNotes ? String(set.note ?? "") : undefined,
      })),
    })),
  }));
}

export async function readExercises() {
  const rows = await getD1().prepare("SELECT id, name, training_frequency, is_frequent FROM exercises WHERE user_id = ? ORDER BY training_frequency DESC, name ASC").bind(USER_ID).all<{ id: string; name: string; training_frequency: number; is_frequent: number }>();
  return rows.results.map((row: { id: string; name: string; training_frequency: number; is_frequent: number }) => ({
    id: row.id,
    name: row.name,
    frequency: row.training_frequency,
    isFrequent: Boolean(row.is_frequent),
  }));
}
