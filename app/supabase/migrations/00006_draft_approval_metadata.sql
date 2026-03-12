-- Track explicit draft approval so sends require a distinct review step.
ALTER TABLE draft_replies
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_draft_replies_user_accepted
  ON draft_replies(user_id, accepted_at)
  WHERE accepted_at IS NOT NULL;
