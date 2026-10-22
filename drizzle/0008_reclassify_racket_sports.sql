-- Move Apple-Calendar-imported racket-sport days out of the generic Cardio bucket.
-- Only rows imported from the calendar (source = 'apple-calendar') are touched; manual entries are left alone.
UPDATE `workouts` SET `activity` = 'tennis'
WHERE `user_id` = 'owner' AND `source` = 'apple-calendar' AND `activity` = 'cardio' AND lower(`general_note`) LIKE '%tennis%';
--> statement-breakpoint
UPDATE `workouts` SET `activity` = 'pickleball'
WHERE `user_id` = 'owner' AND `source` = 'apple-calendar' AND `activity` = 'cardio' AND lower(`general_note`) LIKE '%pick%';
