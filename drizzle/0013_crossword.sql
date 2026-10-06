CREATE TABLE crossword_entries (
	id text PRIMARY KEY NOT NULL,
	activity_id text NOT NULL REFERENCES activities(id),
	answer text NOT NULL,
	clue text NOT NULL,
	row integer NOT NULL,
	col integer NOT NULL,
	direction text NOT NULL,
	number integer NOT NULL,
	created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX crossword_entry_activity ON crossword_entries(activity_id, number);
--> statement-breakpoint
CREATE UNIQUE INDEX crossword_entry_unique_answer ON crossword_entries(activity_id, answer);
--> statement-breakpoint
CREATE TABLE crossword_attempts (
	id text PRIMARY KEY NOT NULL,
	session_id text NOT NULL REFERENCES live_sessions(id),
	participant_id text NOT NULL REFERENCES participants(id),
	answer_state_json text NOT NULL DEFAULT '{}',
	score integer NOT NULL DEFAULT 0,
	completed_at integer,
	updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX crossword_attempt_once ON crossword_attempts(session_id, participant_id);
--> statement-breakpoint
CREATE INDEX crossword_attempt_session ON crossword_attempts(session_id, score);
