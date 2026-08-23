const USER_ID = "owner";

export const rebuildPrHighlightsStatements = (db: D1Database, computedAt: string) => [
  db.prepare("DELETE FROM workout_pr_highlights WHERE user_id = ?").bind(USER_ID),
  db.prepare(`
    INSERT INTO workout_pr_highlights (
      id, user_id, workout_id, workout_set_id, lift_type, workout_date,
      weight, unit, weight_kg, previous_best_kg, improvement_kg,
      calculation_version, computed_at
    )
    WITH eligible_sets AS (
      SELECT
        w.user_id,
        w.id AS workout_id,
        ws.id AS workout_set_id,
        CASE we.name
          WHEN 'Bench Press' THEN 'bench_press'
          WHEN 'Squat' THEN 'squat'
          WHEN 'Deadlift' THEN 'deadlift'
        END AS lift_type,
        w.workout_date,
        w.started_at,
        w.finished_at,
        w.created_at,
        ws.weight,
        w.unit,
        CASE WHEN w.unit = 'lbs' THEN ws.weight / 2.2046226218 ELSE ws.weight END AS weight_kg,
        ROW_NUMBER() OVER (
          PARTITION BY w.id, we.name
          ORDER BY CASE WHEN w.unit = 'lbs' THEN ws.weight / 2.2046226218 ELSE ws.weight END DESC,
                   we.position ASC,
                   ws.position ASC,
                   ws.id ASC
        ) AS workout_lift_rank
      FROM workouts w
      JOIN workout_exercises we ON we.workout_id = w.id
      JOIN workout_sets ws ON ws.workout_exercise_id = we.id
      WHERE w.user_id = ?
        AND w.status = 'completed'
        AND we.name IN ('Bench Press', 'Squat', 'Deadlift')
        AND ws.reps = 1
        AND ws.weight > 0
    ),
    workout_bests AS (
      SELECT * FROM eligible_sets WHERE workout_lift_rank = 1
    ),
    progression AS (
      SELECT
        *,
        MAX(weight_kg) OVER (
          PARTITION BY user_id, lift_type
          ORDER BY workout_date ASC,
                   COALESCE(started_at, finished_at, created_at, '') ASC,
                   workout_id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ) AS previous_best_kg
      FROM workout_bests
    )
    SELECT
      workout_id || ':' || lift_type,
      user_id,
      workout_id,
      workout_set_id,
      lift_type,
      workout_date,
      weight,
      unit,
      weight_kg,
      previous_best_kg,
      CASE WHEN previous_best_kg IS NULL THEN NULL ELSE weight_kg - previous_best_kg END,
      1,
      ?
    FROM progression
    WHERE previous_best_kg IS NULL OR weight_kg > previous_best_kg
  `).bind(USER_ID, computedAt),
];
