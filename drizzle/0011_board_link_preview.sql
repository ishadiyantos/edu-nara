ALTER TABLE board_posts ADD preview_title text;
--> statement-breakpoint
ALTER TABLE board_posts ADD preview_image_id text;
--> statement-breakpoint
ALTER TABLE board_posts ADD card_color text NOT NULL DEFAULT 'cream';
--> statement-breakpoint
CREATE UNIQUE INDEX board_post_preview_image ON board_posts(preview_image_id);
