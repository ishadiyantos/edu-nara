DROP INDEX `poll_question_activity`;--> statement-breakpoint
ALTER TABLE `poll_questions` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `poll_question_position` ON `poll_questions` (`activity_id`,`position`);--> statement-breakpoint
CREATE INDEX `poll_question_activity` ON `poll_questions` (`activity_id`);--> statement-breakpoint
ALTER TABLE `poll_options` ADD `is_correct` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `poll_responses` ADD `is_correct` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `poll_responses` ADD `points` integer DEFAULT 0 NOT NULL;