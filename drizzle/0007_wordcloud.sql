CREATE TABLE `wordcloud_responses` (
 `id` text PRIMARY KEY NOT NULL,
 `question_id` text NOT NULL REFERENCES `poll_questions`(`id`),
 `session_id` text NOT NULL REFERENCES `live_sessions`(`id`),
 `participant_id` text NOT NULL REFERENCES `participants`(`id`),
 `word` text NOT NULL,
 `status` text DEFAULT 'pending' NOT NULL,
 `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wordcloud_response_once` ON `wordcloud_responses` (`question_id`,`session_id`,`participant_id`,`word`);
--> statement-breakpoint
CREATE INDEX `wordcloud_response_question_status` ON `wordcloud_responses` (`question_id`,`session_id`,`status`);
--> statement-breakpoint
ALTER TABLE `poll_questions` ADD `kind` text DEFAULT 'choice' NOT NULL;
--> statement-breakpoint
ALTER TABLE `poll_questions` ADD `word_limit` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `poll_questions` ADD `moderation_enabled` integer DEFAULT true NOT NULL;
