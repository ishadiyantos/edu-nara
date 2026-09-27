CREATE TABLE `board_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `board_column_activity` ON `board_columns` (`activity_id`);--> statement-breakpoint
CREATE TABLE `board_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`column_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`column_id`) REFERENCES `board_columns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `board_post_session_column` ON `board_posts` (`session_id`,`column_id`);--> statement-breakpoint
CREATE INDEX `board_post_status` ON `board_posts` (`session_id`,`status`);