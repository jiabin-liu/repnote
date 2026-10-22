CREATE TABLE `app_settings` (
	`user_id` text DEFAULT 'owner' NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_settings_user_key` ON `app_settings` (`user_id`,`key`);