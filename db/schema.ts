import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  workoutDate: text("workout_date").notNull(),
  status: text("status", { enum: ["draft", "completed"] }).notNull().default("completed"),
  draftOfWorkoutId: text("draft_of_workout_id"),
  unit: text("unit", { enum: ["kg", "lbs"] }).notNull().default("kg"),
  generalNote: text("general_note").notNull().default(""),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  source: text("source").notNull().default("manual"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_workouts_user_date").on(table.userId, table.workoutDate),
  index("idx_workouts_user_status").on(table.userId, table.status),
]);

export const workoutExercises = sqliteTable("workout_exercises", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
}, (table) => [index("idx_workout_exercises_workout").on(table.workoutId, table.position)]);

export const workoutSets = sqliteTable("workout_sets", {
  id: text("id").primaryKey(),
  workoutExerciseId: text("workout_exercise_id").notNull().references(() => workoutExercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  weight: real("weight"),
  reps: integer("reps"),
  note: text("note").notNull().default(""),
}, (table) => [index("idx_workout_sets_exercise").on(table.workoutExerciseId, table.position)]);

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  name: text("name").notNull(),
  trainingFrequency: integer("training_frequency").notNull().default(0),
  isFrequent: integer("is_frequent", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_exercises_user_name").on(table.userId, table.name)]);

export const workoutPrHighlights = sqliteTable("workout_pr_highlights", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  workoutId: text("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  workoutSetId: text("workout_set_id").notNull().references(() => workoutSets.id, { onDelete: "cascade" }),
  liftType: text("lift_type", { enum: ["bench_press", "squat", "deadlift"] }).notNull(),
  workoutDate: text("workout_date").notNull(),
  weight: real("weight").notNull(),
  unit: text("unit", { enum: ["kg", "lbs"] }).notNull(),
  weightKg: real("weight_kg").notNull(),
  previousBestKg: real("previous_best_kg"),
  improvementKg: real("improvement_kg"),
  calculationVersion: integer("calculation_version").notNull().default(1),
  computedAt: text("computed_at").notNull(),
}, (table) => [
  index("idx_workout_pr_highlights_user_date").on(table.userId, table.workoutDate),
  index("idx_workout_pr_highlights_workout").on(table.workoutId),
]);
