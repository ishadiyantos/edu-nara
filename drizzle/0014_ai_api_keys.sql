CREATE TABLE ai_api_keys (
  id text PRIMARY KEY NOT NULL,
  token_hash text NOT NULL UNIQUE,
  admin_id text NOT NULL REFERENCES admin_users(id),
  label text NOT NULL,
  created_at integer NOT NULL,
  expires_at integer NOT NULL,
  revoked_at integer
);
--> statement-breakpoint
CREATE INDEX ai_api_key_owner ON ai_api_keys(admin_id, created_at);
--> statement-breakpoint
CREATE TABLE ai_api_key_requests (
  api_key_id text NOT NULL REFERENCES ai_api_keys(id),
  request_key text NOT NULL,
  payload_hash text NOT NULL,
  activity_id text NOT NULL,
  created_at integer NOT NULL,
  UNIQUE(api_key_id, request_key)
);
