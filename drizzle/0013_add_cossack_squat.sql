-- Add Cossack Squat to the exercise library as a frequent (one-tap) exercise.
UPDATE `exercises` SET `is_frequent` = 1 WHERE `user_id` = 'owner' AND lower(replace(replace(`name`, ' ', ''), '-', '')) = 'cossacksquat';
--> statement-breakpoint
INSERT INTO `exercises` (`id`, `user_id`, `name`, `training_frequency`, `is_frequent`, `created_at`)
SELECT 'exercise-cossack-squat', 'owner', 'Cossack Squat', 0, 1, '2026-11-04T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM `exercises` WHERE `user_id` = 'owner' AND lower(replace(replace(`name`, ' ', ''), '-', '')) = 'cossacksquat');
