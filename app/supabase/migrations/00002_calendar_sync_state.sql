-- Calendar sync state for tracking incremental sync tokens
CREATE TABLE calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  UNIQUE(connection_id, calendar_id)
);

-- Server-only (sync runs server-side)
ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to sync state" ON calendar_sync_state FOR ALL USING (false);

-- Also add unique constraint on integration_tokens for upsert
ALTER TABLE integration_tokens ADD CONSTRAINT integration_tokens_connection_id_key UNIQUE (connection_id);
