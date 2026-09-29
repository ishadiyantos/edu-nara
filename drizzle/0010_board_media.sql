ALTER TABLE activities ADD board_moderation integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE board_posts ADD title text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE board_posts ADD link_url text;
--> statement-breakpoint
ALTER TABLE board_posts ADD image_id text;
--> statement-breakpoint
ALTER TABLE board_posts ADD request_id text;
--> statement-breakpoint
CREATE UNIQUE INDEX board_post_request ON board_posts(session_id, participant_id, request_id);
--> statement-breakpoint
CREATE UNIQUE INDEX board_post_image ON board_posts(image_id);
