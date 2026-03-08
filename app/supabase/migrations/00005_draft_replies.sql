-- Draft replies: proactive email drafts and post-meeting follow-ups
CREATE TABLE draft_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  signal_id UUID REFERENCES signals(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,

  -- Draft content
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'professional',

  -- Type
  draft_type TEXT NOT NULL DEFAULT 'reply',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  edited_body TEXT,
  sent_at TIMESTAMPTZ,
  discarded_at TIMESTAMPTZ,

  -- Generation metadata
  model_used TEXT NOT NULL DEFAULT 'sonnet',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_draft_replies_user_status ON draft_replies(user_id, status);
CREATE INDEX idx_draft_replies_activity ON draft_replies(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX idx_draft_replies_signal ON draft_replies(signal_id) WHERE signal_id IS NOT NULL;
CREATE INDEX idx_draft_replies_meeting ON draft_replies(meeting_id) WHERE meeting_id IS NOT NULL;

-- Constraints
ALTER TABLE draft_replies ADD CONSTRAINT chk_draft_type CHECK (draft_type IN ('reply', 'follow_up'));
ALTER TABLE draft_replies ADD CONSTRAINT chk_draft_status CHECK (status IN ('pending', 'accepted', 'edited', 'sent', 'discarded'));
ALTER TABLE draft_replies ADD CONSTRAINT chk_draft_tone CHECK (tone IN ('professional', 'casual', 'direct', 'empathetic'));

-- RLS
ALTER TABLE draft_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON draft_replies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON draft_replies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert drafts"
  ON draft_replies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own drafts"
  ON draft_replies FOR DELETE
  USING (auth.uid() = user_id);

-- Add writing style notes to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS writing_style_notes TEXT;

-- Add metadata JSONB to integration_connections for storing Gmail label IDs etc.
ALTER TABLE integration_connections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
