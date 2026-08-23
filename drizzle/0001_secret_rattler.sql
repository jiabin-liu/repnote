ALTER TABLE `exercises` ADD `training_frequency` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `is_frequent` integer DEFAULT false NOT NULL;