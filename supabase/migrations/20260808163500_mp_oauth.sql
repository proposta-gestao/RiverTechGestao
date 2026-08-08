ALTER TABLE empresas ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS mp_oauth_connected_at TIMESTAMPTZ;
