ALTER TABLE draft_replies
ADD COLUMN IF NOT EXISTS sent_message_id TEXT,
ADD COLUMN IF NOT EXISTS sent_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_draft_replies_sent_thread
  ON draft_replies(sent_thread_id)
  WHERE sent_thread_id IS NOT NULL;
