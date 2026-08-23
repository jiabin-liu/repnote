ALTER TABLE `workouts` ADD `status` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `draft_of_workout_id` text;--> statement-breakpoint
CREATE INDEX `idx_workouts_user_status` ON `workouts` (`user_id`,`status`);