CREATE TABLE `poll_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `poll_questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `poll_option_question` ON `poll_options` (`question_id`);--> statement-breakpoint
CREATE TABLE `poll_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`prompt` text NOT NULL,
	`show_results` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_question_activity` ON `poll_questions` (`activity_id`);--> statement-breakpoint
CREATE TABLE `poll_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`session_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `poll_questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`option_id`) REFERENCES `poll_options`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_response_once` ON `poll_responses` (`question_id`,`participant_id`);--> statement-breakpoint
CREATE INDEX `poll_response_session` ON `poll_responses` (`session_id`,`question_id`);