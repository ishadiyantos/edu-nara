ALTER TABLE `live_sessions` ADD `quiz_mode` text DEFAULT 'self_paced' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_sessions` ADD `timer_deadline` integer;--> statement-breakpoint
ALTER TABLE `live_sessions` ADD `timer_duration` integer NOT NULL DEFAULT 0;
