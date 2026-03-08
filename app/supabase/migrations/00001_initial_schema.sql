-- ============================================================
-- Zoe Initial Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  work_hours_start TIME DEFAULT '09:00',
  work_hours_end TIME DEFAULT '17:00',
  work_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. STRATEGIC PRIORITIES
-- ============================================================
CREATE TABLE strategic_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE strategic_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own priorities" ON strategic_priorities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. BILLING
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own customer" ON customers FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'trialing',
  plan TEXT NOT NULL DEFAULT 'individual',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 4. INTEGRATIONS
-- ============================================================
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT,
  email TEXT,
  scopes TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  UNIQUE(user_id, provider, provider_account_id)
);

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own connections" ON integration_connections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tokens: server-only (no client access)
CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
-- No client access — server uses service_role key
CREATE POLICY "No client access to tokens" ON integration_tokens FOR ALL USING (false);

CREATE TABLE slack_channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  is_monitored BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, channel_id)
);

ALTER TABLE slack_channel_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own channel configs" ON slack_channel_configs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. SIGNALS
-- ============================================================
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  thread_id TEXT,

  title TEXT,
  snippet TEXT,
  sender_name TEXT,
  sender_email TEXT,
  participants TEXT[],

  received_at TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  labels TEXT[],

  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_organizer BOOLEAN DEFAULT FALSE,

  urgency_score INTEGER,
  topic_cluster TEXT,
  ownership_signal TEXT,
  requires_response BOOLEAN,
  escalation_level TEXT,

  ingested_at TIMESTAMPTZ DEFAULT now(),
  classified_at TIMESTAMPTZ,

  UNIQUE(user_id, source, external_id)
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own signals" ON signals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_signals_user_source ON signals(user_id, source, received_at DESC);
CREATE INDEX idx_signals_user_thread ON signals(user_id, thread_id);
CREATE INDEX idx_signals_unclassified ON signals(user_id, classified_at) WHERE classified_at IS NULL;
CREATE INDEX idx_signals_user_urgency ON signals(user_id, urgency_score DESC);

-- ============================================================
-- 6. WORK OBJECTS & ACTIVITIES
-- ============================================================
CREATE TABLE work_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  signal_count INTEGER DEFAULT 0,
  latest_signal_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own work objects" ON work_objects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE work_object_signals (
  work_object_id UUID NOT NULL REFERENCES work_objects(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  PRIMARY KEY (work_object_id, signal_id)
);

-- RLS via join: only accessible if user owns the work_object
ALTER TABLE work_object_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own work object signals" ON work_object_signals FOR ALL
  USING (
    EXISTS (SELECT 1 FROM work_objects WHERE id = work_object_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM work_objects WHERE id = work_object_id AND user_id = auth.uid())
  );

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_object_id UUID REFERENCES work_objects(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  time_estimate_minutes INTEGER,

  score INTEGER NOT NULL DEFAULT 0,
  score_rationale TEXT[],
  scoring_factors JSONB,

  horizon TEXT NOT NULL DEFAULT 'now',
  trigger_description TEXT,
  trigger_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE,

  batch_key TEXT,
  batch_label TEXT,
  parent_activity_id UUID REFERENCES activities(id),

  scored_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own activities" ON activities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activities_user_score ON activities(user_id, score DESC) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_activities_user_status ON activities(user_id, status, updated_at DESC);

-- ============================================================
-- 7. CALENDAR EVENTS
-- ============================================================
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  connection_id UUID REFERENCES integration_connections(id),

  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,

  organizer_email TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  attendees JSONB,
  attendee_count INTEGER DEFAULT 0,

  decision_density TEXT,
  ownership_load TEXT,
  efficiency_risks TEXT[],
  prep_time_needed_minutes INTEGER,
  has_prep_block BOOLEAN DEFAULT FALSE,

  etag TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, external_id)
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own calendar events" ON calendar_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_calendar_events_user_time ON calendar_events(user_id, start_at, end_at);

-- ============================================================
-- 8. CHAT
-- ============================================================
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  context_type TEXT,
  context_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON chat_conversations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  pending_action JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON chat_messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

-- ============================================================
-- 9. DAILY METRICS
-- ============================================================
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  total_meeting_minutes INTEGER DEFAULT 0,
  available_execution_minutes INTEGER DEFAULT 0,
  meeting_count INTEGER DEFAULT 0,

  active_slack_threads INTEGER DEFAULT 0,
  unread_emails INTEGER DEFAULT 0,
  open_loops INTEGER DEFAULT 0,

  reactive_activity_pct NUMERIC(5,2),
  deep_work_blocks INTEGER DEFAULT 0,
  meetings_with_outcomes INTEGER DEFAULT 0,
  meetings_prepared_on_time INTEGER DEFAULT 0,

  activities_completed INTEGER DEFAULT 0,
  activities_snoozed INTEGER DEFAULT 0,
  avg_activity_score NUMERIC(5,2),

  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own metrics" ON daily_metrics FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_daily_metrics_user_date ON daily_metrics(user_id, date DESC);

-- ============================================================
-- 10. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER strategic_priorities_updated_at BEFORE UPDATE ON strategic_priorities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integration_connections_updated_at BEFORE UPDATE ON integration_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integration_tokens_updated_at BEFORE UPDATE ON integration_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER work_objects_updated_at BEFORE UPDATE ON work_objects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER chat_conversations_updated_at BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 11. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create trial subscription
  INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trialing',
    now() + interval '14 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
