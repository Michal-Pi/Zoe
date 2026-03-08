# Zoe — Data Model (Supabase PostgreSQL)

## Schema Overview

All user data is protected by Row-Level Security (RLS). Every table with user data includes a `user_id` column with an RLS policy: `auth.uid() = user_id`.

## Tables

### Core User Tables

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  work_hours_start TIME DEFAULT '09:00',
  work_hours_end TIME DEFAULT '17:00',
  work_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 0=Sun, 1=Mon, ...
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User's 3 strategic priorities (used for scoring alignment)
CREATE TABLE strategic_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Billing

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'trialing',
    -- trialing, active, past_due, canceled, unpaid
  plan TEXT NOT NULL DEFAULT 'individual',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Integrations

```sql
-- OAuth connections to external services
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'slack'
  provider_account_id TEXT, -- external account ID
  email TEXT, -- connected email address
  scopes TEXT[], -- granted OAuth scopes
  status TEXT NOT NULL DEFAULT 'active', -- active, revoked, expired
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  UNIQUE(user_id, provider, provider_account_id)
);

-- Encrypted OAuth tokens (server-side only, no client RLS read)
CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL, -- encrypted via Supabase Vault
  refresh_token TEXT, -- encrypted via Supabase Vault
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: integration_tokens has NO client read policy. Server-only via service role.

-- Slack-specific: which channels to monitor
CREATE TABLE slack_channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  is_monitored BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, channel_id)
);
```

### Signals

```sql
-- Raw signals from all sources (email, Slack, calendar)
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'gmail', 'slack', 'google_calendar'
  source_type TEXT NOT NULL, -- 'email', 'slack_message', 'slack_thread', 'calendar_event'
  external_id TEXT NOT NULL, -- ID from the source system
  thread_id TEXT, -- thread/conversation grouping

  -- Content
  title TEXT,
  snippet TEXT, -- first ~200 chars of content
  sender_name TEXT,
  sender_email TEXT,
  participants TEXT[], -- all participants

  -- Metadata
  received_at TIMESTAMPTZ NOT NULL, -- when the signal was created at source
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  labels TEXT[], -- source labels/tags

  -- Calendar-specific
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_organizer BOOLEAN DEFAULT FALSE,

  -- AI-enriched fields (filled by classification pipeline)
  urgency_score INTEGER, -- 0-100
  topic_cluster TEXT, -- AI-assigned topic
  ownership_signal TEXT, -- 'owner', 'contributor', 'observer'
  requires_response BOOLEAN,
  escalation_level TEXT, -- 'none', 'mild', 'high'

  -- Housekeeping
  ingested_at TIMESTAMPTZ DEFAULT now(),
  classified_at TIMESTAMPTZ,

  UNIQUE(user_id, source, external_id)
);

CREATE INDEX idx_signals_user_source ON signals(user_id, source, received_at DESC);
CREATE INDEX idx_signals_user_thread ON signals(user_id, thread_id);
CREATE INDEX idx_signals_user_classified ON signals(user_id, classified_at);
CREATE INDEX idx_signals_user_urgency ON signals(user_id, urgency_score DESC);
```

### Work Objects & Activities

```sql
-- Work Objects: clusters of related signals
CREATE TABLE work_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- e.g., "Roadmap Sync", "Legal Approval"
  description TEXT,
  signal_count INTEGER DEFAULT 0,
  latest_signal_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active', -- active, resolved, snoozed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Links between signals and work objects (many-to-many)
CREATE TABLE work_object_signals (
  work_object_id UUID NOT NULL REFERENCES work_objects(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  PRIMARY KEY (work_object_id, signal_id)
);

-- Activities: atomic, time-estimated actions extracted from work objects
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_object_id UUID REFERENCES work_objects(id) ON DELETE SET NULL,

  -- Core
  title TEXT NOT NULL, -- verb-based, e.g., "Prepare for 3pm Roadmap Sync"
  description TEXT,
  time_estimate_minutes INTEGER, -- estimated duration

  -- Scoring
  score INTEGER NOT NULL DEFAULT 0, -- 0-100
  score_rationale TEXT[], -- 1-3 bullet explanations
  scoring_factors JSONB, -- detailed breakdown {urgency: 90, alignment: 70, ...}

  -- Horizon
  horizon TEXT NOT NULL DEFAULT 'now', -- 'now', 'soon', 'strategic'
  trigger_description TEXT, -- e.g., "1h before 3pm meeting"
  trigger_at TIMESTAMPTZ, -- when this becomes urgent
  deadline_at TIMESTAMPTZ,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending, in_progress, completed, snoozed, dismissed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE,

  -- Grouping
  batch_key TEXT, -- e.g., "slack_growth_channel" for grouped items
  batch_label TEXT, -- e.g., "Slack Batch — Growth Channel"
  parent_activity_id UUID REFERENCES activities(id), -- for split tasks

  -- Housekeeping
  scored_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activities_user_score ON activities(user_id, score DESC) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_activities_user_status ON activities(user_id, status, updated_at DESC);
CREATE INDEX idx_activities_user_horizon ON activities(user_id, horizon, score DESC);
```

### Calendar Intelligence

```sql
-- Cached calendar events (synced from Google Calendar)
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- Google Calendar event ID
  connection_id UUID REFERENCES integration_connections(id),

  -- Event data
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- RRULE string

  -- Participants
  organizer_email TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  attendees JSONB, -- [{email, name, response_status}]
  attendee_count INTEGER DEFAULT 0,

  -- AI classification (filled by Calendar Intelligence)
  decision_density TEXT, -- 'high', 'medium', 'low'
  ownership_load TEXT, -- 'organizer', 'presenter', 'contributor', 'passive'
  efficiency_risks TEXT[], -- ['no_prep', 'back_to_back', 'large_no_agenda', 'recurring_stale']
  prep_time_needed_minutes INTEGER,
  has_prep_block BOOLEAN DEFAULT FALSE,

  -- Sync metadata
  etag TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, external_id)
);

CREATE INDEX idx_calendar_events_user_time ON calendar_events(user_id, start_at, end_at);
CREATE INDEX idx_calendar_events_user_day ON calendar_events(user_id, (start_at::date));
```

### Chat

```sql
-- Chat conversations
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  -- Context reference (what triggered this chat)
  context_type TEXT, -- 'activity', 'calendar_event', 'signal', 'general'
  context_id UUID, -- ID of the referenced entity
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,

  -- Tool calls and results
  tool_calls JSONB, -- [{name, arguments, result}]

  -- Pending actions that need confirmation
  pending_action JSONB, -- {type, params, confirmed_at}

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
```

### Dashboard Metrics

```sql
-- Pre-computed daily metrics for the Impact Dashboard
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Today's Reality Brief
  total_meeting_minutes INTEGER DEFAULT 0,
  available_execution_minutes INTEGER DEFAULT 0,
  meeting_count INTEGER DEFAULT 0,

  -- Signal counts
  active_slack_threads INTEGER DEFAULT 0,
  unread_emails INTEGER DEFAULT 0,
  open_loops INTEGER DEFAULT 0, -- signals requiring response, >48h old

  -- Behavioral metrics
  reactive_activity_pct NUMERIC(5,2), -- % of activity that was reactive
  deep_work_blocks INTEGER DEFAULT 0, -- blocks >60min
  meetings_with_outcomes INTEGER DEFAULT 0,
  meetings_prepared_on_time INTEGER DEFAULT 0,

  -- Activities
  activities_completed INTEGER DEFAULT 0,
  activities_snoozed INTEGER DEFAULT 0,
  avg_activity_score NUMERIC(5,2),

  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_metrics_user_date ON daily_metrics(user_id, date DESC);
```

## Row-Level Security Policies

```sql
-- Standard RLS pattern for all user-scoped tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_channel_configs ENABLE ROW LEVEL SECURITY;

-- Example policy (applied to all tables above)
CREATE POLICY "Users can only access their own data"
  ON signals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- integration_tokens: server-only (no client access)
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server only access"
  ON integration_tokens FOR ALL
  USING (false); -- No client access; server uses service_role key
```

## Key Queries

### Command Center: Get ranked activities

```sql
SELECT a.*, wo.title as work_object_title
FROM activities a
LEFT JOIN work_objects wo ON a.work_object_id = wo.id
WHERE a.user_id = $1
  AND a.status IN ('pending', 'in_progress')
  AND (a.snoozed_until IS NULL OR a.snoozed_until < now())
ORDER BY a.is_pinned DESC, a.score DESC
LIMIT 20;
```

### Impact Dashboard: Today's reality brief

```sql
-- Available execution time
SELECT
  SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 60) as meeting_minutes,
  COUNT(*) as meeting_count
FROM calendar_events
WHERE user_id = $1
  AND start_at::date = CURRENT_DATE
  AND NOT is_all_day;

-- Open loops
SELECT COUNT(*) as open_loops
FROM signals
WHERE user_id = $1
  AND requires_response = true
  AND received_at < now() - interval '48 hours'
  AND NOT EXISTS (
    SELECT 1 FROM activities
    WHERE work_object_id IN (
      SELECT work_object_id FROM work_object_signals WHERE signal_id = signals.id
    )
    AND status = 'completed'
  );
```

### Calendar Intelligence: Today's meetings with classification

```sql
SELECT *,
  CASE WHEN NOT has_prep_block AND decision_density = 'high'
       AND start_at > now()
       THEN true ELSE false END as needs_prep_warning
FROM calendar_events
WHERE user_id = $1
  AND start_at::date = CURRENT_DATE
ORDER BY start_at;
```

## Realtime Subscriptions

```typescript
// Command Center: listen for activity score changes
supabase
  .channel('activities')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'activities',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      // Update React Query cache
    }
  )
  .subscribe()
```

## Migration Strategy From LifeOS_2

| LifeOS_2 Firestore Collection     | Zoe PostgreSQL Table         | Notes                                               |
| --------------------------------- | ---------------------------- | --------------------------------------------------- |
| `users/{uid}/profile`             | `profiles`                   | Simplified; billing fields moved to `subscriptions` |
| `users/{uid}/calendar`            | `calendar_events`            | Flattened; AI fields added                          |
| `users/{uid}/prioritizedMessages` | `signals`                    | Renamed; unified schema across sources              |
| N/A (new)                         | `work_objects`               | New concept for Zoe                                 |
| N/A (new)                         | `activities`                 | New concept for Zoe                                 |
| `users/{uid}/slackConnections`    | `integration_connections`    | Unified across providers                            |
| `users/{uid}/privateIntegrations` | `integration_tokens`         | Same purpose, encrypted                             |
| N/A (new)                         | `subscriptions`, `customers` | New for Stripe billing                              |
| N/A (new)                         | `daily_metrics`              | New for Impact Dashboard                            |
