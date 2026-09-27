CREATE TABLE `poll_response_options` (
	`response_id` text NOT NULL,
	`option_id` text NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `poll_responses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`option_id`) REFERENCES `poll_options`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_response_option_once` ON `poll_response_options` (`response_id`,`option_id`);--> statement-breakpoint
CREATE INDEX `poll_response_option_option` ON `poll_response_options` (`option_id`);