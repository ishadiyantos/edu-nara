CREATE TABLE IF NOT EXISTS ai_api_key_requests (
  api_key_id text NOT NULL REFERENCES ai_api_keys(id),
  request_key text NOT NULL,
  payload_hash text NOT NULL,
  activity_id text NOT NULL,
  created_at integer NOT NULL,
  UNIQUE(api_key_id, request_key)
);
--> statement-breakpoint
CREATE TABLE ai_api_key_requests_new (
  api_key_id text NOT NULL REFERENCES ai_api_keys(id),
  request_key text NOT NULL,
  payload_hash text NOT NULL,
  activity_id text NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at integer NOT NULL,
  UNIQUE(api_key_id, request_key)
);
--> statement-breakpoint
INSERT INTO ai_api_key_requests_new (api_key_id, request_key, payload_hash, activity_id, created_at)
SELECT r.api_key_id, r.request_key, r.payload_hash, r.activity_id, r.created_at
FROM ai_api_key_requests r
JOIN activities a ON a.id = r.activity_id;
--> statement-breakpoint
DROP TABLE ai_api_key_requests;
--> statement-breakpoint
ALTER TABLE ai_api_key_requests_new RENAME TO ai_api_key_requests;
--> statement-breakpoint
CREATE UNIQUE INDEX ai_api_key_request_once ON ai_api_key_requests(api_key_id, request_key);
--> statement-breakpoint
CREATE INDEX ai_api_key_request_activity ON ai_api_key_requests(activity_id);
