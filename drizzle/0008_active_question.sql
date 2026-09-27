ALTER TABLE `live_sessions` ADD `active_question_id` text;--> statement-breakpoint
UPDATE live_sessions SET active_question_id = (SELECT id FROM poll_questions WHERE activity_id = live_sessions.activity_id AND kind = 'wordcloud' ORDER BY position LIMIT 1) WHERE activity_id IN (SELECT id FROM activities WHERE type = 'wordcloud');
