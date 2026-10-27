ALTER TABLE `workouts` ADD `comment` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Lifting "Notes" typed in the app become the new comment; calendar-import titles stay in general_note.
UPDATE `workouts` SET `comment` = `general_note`, `general_note` = '' WHERE `source` <> 'apple-calendar' AND `general_note` <> '';
