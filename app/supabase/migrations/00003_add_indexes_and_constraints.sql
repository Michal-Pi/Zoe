-- Missing indexes for performance

-- integration_connections: queried by cron sync
CREATE INDEX IF NOT EXISTS idx_integration_connections_user_provider_status
  ON integration_connections(user_id, provider, status);

-- calendar_events: queried by connection_id during sync
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection_id
  ON calendar_events(connection_id);

-- work_objects: queried by user_id + status frequently
CREATE INDEX IF NOT EXISTS idx_work_objects_user_status
  ON work_objects(user_id, status);

-- work_object_signals: reverse lookup by signal_id
CREATE INDEX IF NOT EXISTS idx_work_object_signals_signal_id
  ON work_object_signals(signal_id);

-- chat_conversations: queried by user_id on every chat page load
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
  ON chat_conversations(user_id, created_at DESC);

-- chat_messages: queried by user_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON chat_messages(user_id, created_at DESC);

-- strategic_priorities: queried by user_id
CREATE INDEX IF NOT EXISTS idx_strategic_priorities_user_id
  ON strategic_priorities(user_id, sort_order);

-- activities: queried by user_id and parent
CREATE INDEX IF NOT EXISTS idx_activities_user_id
  ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_parent
  ON activities(parent_activity_id) WHERE parent_activity_id IS NOT NULL;

-- integration_tokens: queried by connection_id
CREATE INDEX IF NOT EXISTS idx_integration_tokens_connection_id
  ON integration_tokens(connection_id);

-- slack_channel_configs: queried by user_id
CREATE INDEX IF NOT EXISTS idx_slack_channel_configs_user_id
  ON slack_channel_configs(user_id, connection_id);

-- daily_metrics: ensure user_id is efficiently queryable
CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_id
  ON daily_metrics(user_id);

-- Add ON DELETE SET NULL for calendar_events.connection_id
-- (allows deleting connections without FK violations)
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_connection_id_fkey,
  ADD CONSTRAINT calendar_events_connection_id_fkey
    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE SET NULL;

-- Add CHECK constraints on enum-like TEXT columns
ALTER TABLE subscriptions
  ADD CONSTRAINT chk_subscriptions_status
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired'));
ALTER TABLE subscriptions
  ADD CONSTRAINT chk_subscriptions_plan
    CHECK (plan IN ('individual'));

ALTER TABLE integration_connections
  ADD CONSTRAINT chk_connections_provider
    CHECK (provider IN ('google', 'slack'));
ALTER TABLE integration_connections
  ADD CONSTRAINT chk_connections_status
    CHECK (status IN ('active', 'revoked', 'expired'));

ALTER TABLE signals
  ADD CONSTRAINT chk_signals_source
    CHECK (source IN ('gmail', 'slack', 'google_calendar'));
ALTER TABLE signals
  ADD CONSTRAINT chk_signals_source_type
    CHECK (source_type IN ('email', 'slack_message', 'slack_thread', 'calendar_event'));

ALTER TABLE work_objects
  ADD CONSTRAINT chk_work_objects_status
    CHECK (status IN ('active', 'resolved', 'snoozed'));

ALTER TABLE activities
  ADD CONSTRAINT chk_activities_horizon
    CHECK (horizon IN ('now', 'soon', 'strategic'));
ALTER TABLE activities
  ADD CONSTRAINT chk_activities_status
    CHECK (status IN ('pending', 'in_progress', 'completed', 'snoozed', 'dismissed'));

ALTER TABLE chat_messages
  ADD CONSTRAINT chk_chat_messages_role
    CHECK (role IN ('user', 'assistant', 'system', 'tool'));

-- Add updated_at column and trigger to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add created_at to calendar_events for auditing
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
