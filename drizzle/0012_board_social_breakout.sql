ALTER TABLE participants ADD column_id text;
--> statement-breakpoint
CREATE TABLE board_comments (
	id text PRIMARY KEY NOT NULL,
	post_id text NOT NULL REFERENCES board_posts(id),
	participant_id text NOT NULL REFERENCES participants(id),
	body text NOT NULL,
	created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX board_comment_post ON board_comments(post_id);
--> statement-breakpoint
CREATE TABLE board_reactions (
	post_id text NOT NULL REFERENCES board_posts(id),
	participant_id text NOT NULL REFERENCES participants(id),
	emoji text NOT NULL,
	created_at integer NOT NULL,
	PRIMARY KEY (post_id, participant_id)
);
--> statement-breakpoint
CREATE INDEX board_reaction_post ON board_reactions(post_id);