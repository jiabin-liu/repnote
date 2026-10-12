-- Replace the seeded exercise library with the curated seven-exercise set.
-- Only the reusable library is changed; completed workouts keep their exercise-name snapshots.
DELETE FROM `exercises`
WHERE `user_id` = 'owner'
  AND `name` NOT IN ('Bulgarian Split Squat', 'Single Leg Deadlift', 'Bench Press', 'Bicep Curl', 'Farmer Squat', 'Barbell Squat', 'Leg Extension');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-bulgarian-split-squat', 'owner', 'Bulgarian Split Squat', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Bulgarian Split Squat');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-single-leg-deadlift', 'owner', 'Single Leg Deadlift', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Single Leg Deadlift');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-bench-press', 'owner', 'Bench Press', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Bench Press');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-bicep-curl', 'owner', 'Bicep Curl', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Bicep Curl');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-farmer-squat', 'owner', 'Farmer Squat', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Farmer Squat');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-barbell-squat', 'owner', 'Barbell Squat', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Barbell Squat');
--> statement-breakpoint
INSERT OR IGNORE INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-leg-extension', 'owner', 'Leg Extension', 0, 1, '2026-10-11T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND `name` = 'Leg Extension');
--> statement-breakpoint
UPDATE `exercises` SET `is_frequent` = 1 WHERE `user_id` = 'owner';
--> statement-breakpoint
UPDATE `exercises` SET `training_frequency` = (
  SELECT COUNT(DISTINCT w.`workout_date`)
  FROM `workout_exercises` we JOIN `workouts` w ON w.`id` = we.`workout_id`
  WHERE w.`user_id` = `exercises`.`user_id` AND w.`status` = 'completed' AND we.`name` = `exercises`.`name`
) WHERE `user_id` = 'owner';
