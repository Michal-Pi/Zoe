CREATE TABLE IF NOT EXISTS slack_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,

  channel_id TEXT NOT NULL,
  channel_label TEXT,
  message TEXT NOT NULL,
  edited_message TEXT,
  thread_ts TEXT,

  status TEXT NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  review_metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  discarded_at TIMESTAMPTZ,

  model_used TEXT NOT NULL DEFAULT 'chat_tool',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_drafts_user_status
  ON slack_drafts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_slack_drafts_signal
  ON slack_drafts(signal_id)
  WHERE signal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slack_drafts_activity
  ON slack_drafts(activity_id)
  WHERE activity_id IS NOT NULL;

ALTER TABLE slack_drafts
  ADD CONSTRAINT chk_slack_draft_status
  CHECK (status IN ('pending', 'accepted', 'edited', 'sent', 'discarded'));

ALTER TABLE slack_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own slack drafts"
  ON slack_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own slack drafts"
  ON slack_drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert slack drafts"
  ON slack_drafts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own slack drafts"
  ON slack_drafts FOR DELETE
  USING (auth.uid() = user_id);
